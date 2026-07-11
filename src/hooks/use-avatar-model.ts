import { useEffect, useState } from 'react';
import {
  ensureUserAvatarCached,
  lookupCachedAvatar,
  resolveAvatarModel,
  type AvatarModel,
} from '@privchat/sdk';

export interface UseAvatarModelInput {
  userId: string | number | bigint | null | undefined;
  remoteUrl?: string | null;
  displayName?: string | null;
  username?: string | null;
}

/**
 * P4.2 头像统一入口（CLIENT_GLOBAL_STATE §4）的 react 接入 —— **任意用户头像**
 * （自己/好友/群成员/会话 peer/资料页）都走这一个 hook，local-first：
 *
 *   查本地缓存（Cache Storage/objectURL） → fresh 直接用本地 → stale 先显示旧本地并后台刷新
 *   → 无本地则先出 remote 并后台缓存 → 都无 initials 兜底（由头像组件按 seed 上色）。
 *
 * 不允许页面再直接 `<img src={remoteUrl}>` remote-first 渲染。失败不污染旧缓存。
 */
export function useAvatarModel(input: UseAvatarModelInput): AvatarModel {
  const uid = input.userId != null ? String(input.userId) : null;
  const remote = input.remoteUrl ?? null;

  const [model, setModel] = useState<AvatarModel>(() =>
    resolveAvatarModel({
      userId: uid ?? '',
      remoteUrl: remote,
      displayName: input.displayName,
      username: input.username,
    }),
  );

  useEffect(() => {
    if (uid === null || uid === '') {
      setModel(
        resolveAvatarModel({
          userId: '',
          remoteUrl: remote,
          displayName: input.displayName,
          username: input.username,
        }),
      );
      return;
    }
    let cancelled = false;
    const apply = (localUrl: string | null, cachedUrl: string | null): void => {
      if (cancelled) return;
      setModel(
        resolveAvatarModel({
          userId: uid,
          remoteUrl: remote,
          cachedUrl,
          localUrl,
          displayName: input.displayName,
          username: input.username,
        }),
      );
    };
    apply(null, null); // uid/remote 变化时先重置为 remote_only/fallback，避免串号
    void (async () => {
      const hit = await lookupCachedAvatar(uid);
      if (hit !== null) apply(hit.localUrl, hit.cachedUrl);
      // fresh 则到此为止；stale/miss 且有 remote → 后台 ensure，成功后切到新本地副本。
      if (remote !== null && remote !== '' && (hit === null || hit.cachedUrl !== remote)) {
        const ensured = await ensureUserAvatarCached(uid, remote);
        if (ensured !== null) apply(ensured.localUrl, ensured.cachedUrl);
      }
    })();
    return () => {
      cancelled = true;
    };
    // displayName/username 只影响兜底文案，不触发重新缓存
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, remote]);

  return model;
}

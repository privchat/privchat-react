// usePresence — single-user presence for the conversation header.
//
// presence 是订阅态，不是轮询态。主路径 = 服务端 push：进入后做一次 `batchGetPresence`
// 拉当前值，之后靠 L1 `presence_changed` 事件实时更新（服务端在对端 online/offline 变化
// 时通过 channel publish 下发，SDK 解码并 emit）。轮询降级为**低频兜底**（默认 60s），
// 仅防 push 丢失 / subscriber 注册漂移，不作主机制。
//
// 重连恢复由 SDK 负责（TS SDK 在 reconnect 后 replay 订阅）；本 hook 在 `connection`/
// `user_id` 变化时重新拉一次当前值即可。
//
// `refreshMs: 0` 关闭兜底轮询（仅初始拉取 + push）。uid 空 → no-op。

import { useEffect, useState } from 'react';
import type { PresenceStatusItem } from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';

export interface UsePresenceOptions {
  /** 低频兜底轮询间隔(ms)；0 = 仅初始拉取 + push 事件，不兜底轮询。默认 60s。 */
  refreshMs?: number;
}

export function usePresence(
  user_id: string | undefined,
  opts: UsePresenceOptions = {},
): PresenceStatusItem | undefined {
  const adapter = usePrivchatClient();
  const refreshMs = opts.refreshMs ?? 60_000;
  const [presence, setPresence] = useState<PresenceStatusItem | undefined>(
    undefined,
  );

  useEffect(() => {
    if (user_id === undefined || user_id === '') {
      setPresence(undefined);
      return;
    }
    const uid = Number(user_id);
    if (!Number.isFinite(uid) || uid <= 0) {
      setPresence(undefined);
      return;
    }
    let cancelled = false;
    const fetchOnce = () => {
      adapter
        .batchGetPresence([uid])
        .then((resp) => {
          if (cancelled) return;
          const item = resp.items.find((it) => it.user_id === uid);
          if (item) setPresence(item);
        })
        .catch((e: unknown) => {
          // Best-effort; log but don't surface — header still works.
          // eslint-disable-next-line no-console
          console.warn('[privchat] usePresence batchGetPresence failed', e);
        });
    };

    // 1) 初始拉一次当前值。
    fetchOnce();

    // 2) 主路径：监听 presence_changed push 事件，实时更新（version 单调，丢弃乱序/陈旧帧）。
    let lastVersion = -1;
    const off = adapter.observeEvents((env) => {
      const e = env.event;
      // 2a) 重连落地：SDK 已 replay 订阅，但 server 的 subscribe-push 可能丢失/延迟，
      // 60s 兜底轮询又太慢。这里在 authenticated 时立即重拉一次当前值（fetchOnce 直接
      // setState、不过 version 门，所以也能修复 server 重启导致的 version 计数清零）。
      // 同时把 lastVersion 重置回 -1：否则旧基线会把重启后的低 version push 帧当陈旧丢弃。
      if (e.type === 'connection_state_changed') {
        if (e.state === 'authenticated') {
          lastVersion = -1;
          fetchOnce();
        }
        return;
      }
      if (e.type !== 'presence_changed') return;
      if (e.user_id !== user_id) return;
      if (e.version < lastVersion) return;
      lastVersion = e.version;
      setPresence({
        user_id: uid,
        is_online: e.is_online,
        last_seen_at: e.last_seen_at,
        device_count: e.device_count,
        version: e.version,
      });
    });

    // 3) 低频兜底轮询（防 push 丢失 / subscriber 漂移），默认 60s。
    const handle =
      refreshMs > 0 ? setInterval(fetchOnce, refreshMs) : undefined;

    return () => {
      cancelled = true;
      off();
      if (handle !== undefined) clearInterval(handle);
    };
  }, [adapter, user_id, refreshMs]);

  return presence;
}

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { BootstrapChannelsOptions, ChannelRecord } from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';
import { useConnectionState } from './use-connection-state.js';
import {
  projectChannelRecord,
  sortConversations,
  type ConversationListItemVM,
} from '../view-models/conversation-list.js';

export interface UseChannelListOptions {
  /** Skip the auto-bootstrap-on-mount call (when cache is empty). Default: false. */
  skipAutoBootstrap?: boolean;
  /** Forwarded to the auto-bootstrap call. */
  bootstrap?: BootstrapChannelsOptions;
}

export interface UseChannelListResult {
  /** Sorted (pinned desc, updated_at desc) UI projection. */
  conversations: ConversationListItemVM[];
  /**
   * Underlying cache records, in the SAME order as `conversations`.
   * Exposed so consumers that need to run the title resolver (or any
   * other per-channel selector that wants the raw fields) can match
   * by index without a second lookup.
   */
  records: ChannelRecord[];
  /** True while a bootstrap RPC is in flight. */
  isLoading: boolean;
  /** Most recent bootstrap error, or null. */
  error: Error | null;
  /** Force a fresh server fetch (passes `sinceChannelVersion: 0`). */
  refresh: () => Promise<void>;
}

/**
 * Subscribes to the user's channel list. On mount, if the cache is empty,
 * calls `bootstrapChannels()` automatically. Subsequent push absorption
 * (last_message bumps, unread increments) and read-cursor advances are
 * picked up via `observeChannelList`.
 *
 * Returns an empty array until bootstrap completes — the consuming UI is
 * responsible for showing an empty/loading state during that window.
 */
export function useChannelList(
  options: UseChannelListOptions = {},
): UseChannelListResult {
  const adapter = usePrivchatClient();
  const { skipAutoBootstrap, bootstrap } = options;

  // ---- Subscribe + cached snapshot (with reference-stability cache) ----

  const cacheRef = useRef<ChannelRecord[] | null>(null);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const offChannels = adapter.observeChannelList(() => {
        cacheRef.current = null;
        onChange();
      });
      // 🔴 users 也要订阅：发布屏障按「标题算不算得出来」过滤，而标题来自 users
      // store。只订阅 channel 的话，被挡住的会话在对端资料补齐后**永远不会出现**
      // ——列表根本不会重算。这一条是屏障能自愈的前提。
      const offUsers = adapter.observeUserList(() => {
        cacheRef.current = null;
        onChange();
      });
      return () => {
        offChannels();
        offUsers();
      };
    },
    [adapter],
  );

  const getSnapshot = useCallback(() => {
    if (cacheRef.current === null) {
      cacheRef.current = adapter.cachedChannels();
    }
    return cacheRef.current;
  }, [adapter]);

  const records = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // ---- Bootstrap lifecycle ----

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const runBootstrap = useCallback(
    async (opts?: BootstrapChannelsOptions) => {
      setIsLoading(true);
      setError(null);
      try {
        await adapter.bootstrapChannels(opts);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [adapter],
  );

  // Auto-bootstrap on mount, ALWAYS. Server uses sync_version to
  // incremental-fetch only what's new since the last call, so the
  // network cost is bounded — empty deltas return fast.
  //
  // The previous "skip if cache non-empty" guard was wrong: it caused
  // the hook to miss server-side updates that landed while the user
  // was offline (peer read cursor advances, new channels, unread
  // count bumps from missed pushes, etc). Conversation-panel re-mounts
  // (mobile back-and-forth, route changes) re-trigger this RPC, but
  // each call is a single page of incremental sync_version diffs.
  useEffect(() => {
    if (skipAutoBootstrap) return;
    let cancelled = false;
    runBootstrap(bootstrap).catch(() => {
      // Already captured in `error` state.
    });
    return () => {
      // bootstrap RPC isn't cancellable; cancellation would only
      // suppress a downstream state update. runBootstrap already
      // owns its own lifecycle, so this is a no-op.
      void cancelled;
    };
  }, [adapter, runBootstrap, skipAutoBootstrap, bootstrap]);

  // Self-heal after a reconnect. Mount-time bootstrap is a one-shot: if the
  // socket was down (server restart, sleep, flaky network) it failed and the
  // error stuck around forever — the list stayed stale and the UI kept showing
  // "cannot send in state closed" long after the connection came back. Re-run
  // bootstrap whenever the session becomes authenticated again, which also
  // clears the stale error (runBootstrap resets it).
  const connectionState = useConnectionState();
  // Seeded with the state AT MOUNT: "recovered" means the session became
  // authenticated AGAIN, not "was already authenticated when we mounted" —
  // that case is the mount-bootstrap effect's job, and seeding with `false`
  // made every already-authed mount fire bootstrap twice.
  const wasAuthenticated = useRef(connectionState === 'authenticated');
  useEffect(() => {
    const authed = connectionState === 'authenticated';
    const recovered = authed && !wasAuthenticated.current;
    wasAuthenticated.current = authed;
    if (skipAutoBootstrap || !recovered) return;
    runBootstrap(bootstrap).catch(() => {
      // Already captured in `error` state.
    });
  }, [connectionState, runBootstrap, skipAutoBootstrap, bootstrap]);

  // ---- Project + sort ----
  //
  // Sort the raw records first (by the same VM fields), then project —
  // that way `conversations[i]` always corresponds to `records[i]`.
  // Doing it this way avoids tracking ids twice.

  const sortedRecords = useMemo(() => {
    // 零消息 DM 不进会话列表（spec MESSAGE_HISTORY §16）。
    //
    // 好友申请通过时 ensureDirectChannel 会建出 DM，它可能一条消息都没有——服务端
    // 也是空的，请求多少次 history 都返回空。好友关系体现在联系人列表，不该占会话
    // 列表的位置；从联系人点进去仍然能打开这个空聊天页，所以过滤只能放在**列表投影**
    // 这一层，不能下沉到 `cachedChannels()`：那个方法同时被 use-conversation 当作
    // 「按 id 查会话」用，过滤下去就会把「从联系人打开空会话」一起打断。
    //
    // 判据是 `updated_at`（服务端 `last_msg_timestamp`，没有消息时为 0），不是「本地
    // 有没有缓存到消息」——历史还没拉下来的会话必须留在列表里。
    // 群不适用：刚被拉进的群还没人说话，藏掉就等于没有入口。
    // 两道过滤，都只作用在**列表投影**这一层：
    //   1. 零消息 DM 不进列表（上面那段注释）；
    //   2. 发布屏障——标题还算不出来的 DM 先不出现，等 SDK 定向补齐到位后
    //      带着完整标题/头像/预览一次性出现，而不是先渲染一个「用户 #123」
    //      再跳成真名。判据由 SDK 给（`isConversationDisplayable`），两端同构。
    //      注意屏障只挡「从未就绪过」的行：曾经展示过的会话，旧快照仍在 users
    //      store 里，名字照样算得出来，刷新失败也不会消失。
    const listable = records.filter(
      (r) => (r.channel_type !== 1 || r.updated_at > 0) && adapter.isConversationDisplayable(r),
    );
    const projected = listable.map(projectChannelRecord);
    const sortedProjections = sortConversations(projected);
    const recordById = new Map(listable.map((r) => [`${r.channel_id}:${r.channel_type}`, r]));
    return sortedProjections.map((vm) => recordById.get(vm.id)!).filter((r) => r !== undefined);
    // adapter 进依赖：`isConversationDisplayable` 读的是 users store，
    // 对端资料补齐后这里必须重算，否则会话补好了也不出现。
    // users 变化经 observeUserList → records 刷新驱动（见下方订阅）。
  }, [records, adapter]);

  const conversations = useMemo(
    () => sortedRecords.map(projectChannelRecord),
    [sortedRecords],
  );

  // ---- Manual refresh (force full refetch) ----

  const refresh = useCallback(async () => {
    await runBootstrap({ sinceChannelVersion: 0, sinceCursorVersion: 0 });
  }, [runBootstrap]);

  return { conversations, records: sortedRecords, isLoading, error, refresh };
}

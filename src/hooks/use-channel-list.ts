import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { BootstrapChannelsOptions, ChannelRecord } from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';
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
    (onChange: () => void) =>
      adapter.observeChannelList(() => {
        cacheRef.current = null;
        onChange();
      }),
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

  // ---- Project + sort ----
  //
  // Sort the raw records first (by the same VM fields), then project —
  // that way `conversations[i]` always corresponds to `records[i]`.
  // Doing it this way avoids tracking ids twice.

  const sortedRecords = useMemo(() => {
    const projected = records.map(projectChannelRecord);
    const sortedProjections = sortConversations(projected);
    const recordById = new Map(records.map((r) => [`${r.channel_id}:${r.channel_type}`, r]));
    return sortedProjections.map((vm) => recordById.get(vm.id)!).filter((r) => r !== undefined);
  }, [records]);

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

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type {
  MessageRecord,
  OpenConversationOptions,
  OutboxEntry,
  OutboxStatus,
  ScrollHistoryOptions,
  SendTextOperationResult,
} from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';
import {
  projectMessageRecord,
  type MessageItemVM,
} from '../view-models/message.js';

export interface UseConversationOptions {
  /** Skip the auto-`openConversation` call on mount. Default: false. */
  skipAutoOpen?: boolean;
  /** Forwarded to the auto-open call. */
  open?: OpenConversationOptions;
  /**
   * When `true` (default), the hook automatically calls `markRead` to the
   * highest received `pts` whenever new messages arrive. This drives the
   * conversation-list unread badge to zero and unblocks peer
   * `read_cursor_updated` broadcasts.
   *
   * Turn off for embedded scenarios where the panel is mounted but not
   * actually visible to the user (e.g. customer-support widget that
   * pre-warms a conversation off-screen).
   */
  autoMarkRead?: boolean;
}

export interface UseConversationResult {
  /** Time-ordered text messages, projected for UI. */
  messages: MessageItemVM[];
  /** Number of locally-pending sends in `messages` (status === 'pending'). */
  pendingCount: number;
  /** True once a `loadOlder()` returned an empty page. */
  reachedBeginning: boolean;
  /** True while the auto-open RPC is in flight (mount path only). */
  isOpening: boolean;
  /** Most recent error from openConversation/scrollHistory/send, or null. */
  error: Error | null;
  /**
   * The peer's read cursor on this channel, projected from
   * `ChannelRecord.peer_read_pts`. `undefined` for groups / cold-start
   * before any peer activity. Exposed so panel UIs can show diagnostic
   * "peer at pts=N" overlays during dogfood.
   */
  peerReadPts: string | undefined;

  loadOlder: () => Promise<void>;
  send: (
    text: string,
    opts?: { reply_to_message_id?: string; mentioned_user_ids?: string[] },
  ) => Promise<SendTextOperationResult>;
}

/**
 * Self-contained hook for a single conversation. On mount it calls
 * `openConversation(channelId, channelType)` and subscribes to per-channel
 * snapshot+patch events. Returns a UI-ready VM list, plus `send` and
 * `loadOlder` actions.
 *
 * R1 covers text only; markRead / peerReadCursor are deliberately deferred
 * to R1.1 (they need a real UI to validate the API shape).
 */
export function useConversation(
  channelId: string,
  channelType: number,
  options: UseConversationOptions = {},
): UseConversationResult {
  const adapter = usePrivchatClient();
  const { skipAutoOpen, open, autoMarkRead = true } = options;

  // ---- Subscribe to per-channel cache mutations + read snapshot ----
  //
  // useSyncExternalStore requires a stable reference between mutations,
  // otherwise React re-renders every commit. The cache returns a fresh
  // array per call, so we cache + invalidate it ourselves.

  const cacheRef = useRef<{
    key: string;
    value: ReadonlyArray<MessageRecord>;
  } | null>(null);

  const cacheKey = `${channelId}:${channelType}`;

  const subscribe = useCallback(
    (onChange: () => void) =>
      adapter.observeConversation(channelId, channelType, () => {
        cacheRef.current = null;
        onChange();
      }),
    [adapter, channelId, channelType],
  );

  const getSnapshot = useCallback(() => {
    if (cacheRef.current === null || cacheRef.current.key !== cacheKey) {
      cacheRef.current = {
        key: cacheKey,
        value: adapter.getCachedMessages(channelId, channelType),
      };
    }
    return cacheRef.current.value;
  }, [adapter, cacheKey, channelId, channelType]);

  const records = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // ---- Subscribe to channel-list mutations to track peer_read_pts ----
  //
  // Read-receipt projection (`MessageItemVM.read_by_peer`) needs the peer's
  // cursor on the current channel. peer_read_pts lives on ChannelRecord, so
  // we subscribe to the channel-list snapshot stream and pluck out our row.
  // Unrelated channel changes (other rooms' last_message bumps, etc.) get
  // filtered out by the channelId equality check.

  const peerCursorRef = useRef<{ key: string; value: string | undefined } | null>(null);

  const channelSubscribe = useCallback(
    (onChange: () => void) =>
      adapter.observeChannelList((channels) => {
        const match = channels.find((c) => c.channel_id === channelId);
        const next = match?.peer_read_pts;
        const prev = peerCursorRef.current?.value;
        if (peerCursorRef.current?.key === cacheKey && prev === next) {
          // Unrelated emit (some other channel changed); avoid React churn.
          return;
        }
        peerCursorRef.current = { key: cacheKey, value: next };
        onChange();
      }),
    [adapter, channelId, cacheKey],
  );

  const channelGetSnapshot = useCallback((): string | undefined => {
    if (peerCursorRef.current === null || peerCursorRef.current.key !== cacheKey) {
      const all = adapter.cachedChannels();
      const match = all.find((c) => c.channel_id === channelId);
      peerCursorRef.current = { key: cacheKey, value: match?.peer_read_pts };
    }
    return peerCursorRef.current.value;
  }, [adapter, cacheKey, channelId]);

  const peerReadPts = useSyncExternalStore(
    channelSubscribe,
    channelGetSnapshot,
    channelGetSnapshot,
  );

  // ---- Auto-open on mount / channel change ----

  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [reachedBeginning, setReachedBeginning] = useState(false);

  useEffect(() => {
    if (skipAutoOpen) return;
    let cancelled = false;
    setIsOpening(true);
    setError(null);
    setReachedBeginning(false);
    adapter
      .openConversation(channelId, channelType, open)
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setIsOpening(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adapter, channelId, channelType, skipAutoOpen, open]);

  // ---- Outbox status join (R3.7 / A1) ----
  //
  // The cache `MessageRecord.status` stays `'pending'` end-to-end
  // through outbox-managed retries; the *real* delivery state lives
  // on the outbox row. Subscribe to the outbox snapshot and build a
  // `local_message_id → status` map so projectMessageRecord can
  // surface it onto the VM. Only retries / failures we care about —
  // 'sent' rows are deleted from the outbox so they naturally fall
  // out of the map.
  const [outboxStatusByLocalId, setOutboxStatusByLocalId] = useState<
    Map<string, OutboxStatus>
  >(() => new Map());
  useEffect(() => {
    const off = adapter.observeOutbox((entries: OutboxEntry[]) => {
      const next = new Map<string, OutboxStatus>();
      for (const e of entries) {
        if (e.channel_id !== channelId) continue;
        next.set(e.local_message_id, e.status);
      }
      setOutboxStatusByLocalId(next);
    });
    return off;
  }, [adapter, channelId]);

  // ---- Project records → VMs (memoized on records identity) ----

  const selfUid = adapter.sessionSnapshot().user_id;

  const messages = useMemo(
    () =>
      records.map((r) =>
        projectMessageRecord(r, selfUid, peerReadPts, outboxStatusByLocalId),
      ),
    [records, selfUid, peerReadPts, outboxStatusByLocalId],
  );

  const pendingCount = useMemo(
    () => messages.reduce((n, m) => (m.status === 'pending' ? n + 1 : n), 0),
    [messages],
  );

  // ---- Auto markRead ----
  //
  // When new received messages land in the buffer, advance the
  // server-side read cursor so the conversation-list unread badge
  // clears and `peer_read_pts_updated` broadcasts to the other side.
  // Server treats markRead as monotonic (advanced=false short-circuits
  // duplicates), so it's safe to call this every time `records`
  // changes — no client-side dedupe needed.
  //
  // We track the last-marked watermark in a ref so we don't even hit
  // the network when nothing changed (common case: re-render due to a
  // sibling state change with no new pts).
  const lastMarkedRef = useRef<{ key: string; pts: bigint } | null>(null);

  useEffect(() => {
    if (!autoMarkRead) return;
    if (selfUid === undefined) return;
    if (records.length === 0) return;

    let highest: bigint | null = null;
    for (const r of records) {
      if (r.from_uid === selfUid) continue;
      if (r.pts === undefined) continue;
      const p = BigInt(r.pts);
      if (highest === null || p > highest) highest = p;
    }
    if (highest === null) return;

    const last = lastMarkedRef.current;
    if (last !== null && last.key === cacheKey && last.pts >= highest) return;
    lastMarkedRef.current = { key: cacheKey, pts: highest };

    void adapter
      .markRead(channelId, channelType, highest.toString())
      .then(() => {
        if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.debug(
            `[privchat/react] markRead ack channel=${channelId} pts=${highest}`,
          );
        }
      })
      .catch((e: unknown) => {
        // Server-rejected (e.g. validation) — drop the watermark so a
        // future message can retry. Don't throw, the hook's main job is
        // rendering messages; markRead is a side concern.
        // eslint-disable-next-line no-console
        console.warn(
          `[privchat/react] markRead failed channel=${channelId} pts=${highest}`,
          e,
        );
        lastMarkedRef.current = null;
      });
  }, [adapter, records, selfUid, channelId, channelType, cacheKey, autoMarkRead]);

  // ---- loadOlder ----

  const loadOlder = useCallback(async () => {
    setError(null);
    try {
      const opts: ScrollHistoryOptions = {};
      const page = await adapter.scrollHistory(channelId, channelType, opts);
      if (page.length === 0) setReachedBeginning(true);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    }
  }, [adapter, channelId, channelType]);

  // ---- send ----

  const send = useCallback(
    async (
      text: string,
      opts?: { reply_to_message_id?: string; mentioned_user_ids?: string[] },
    ): Promise<SendTextOperationResult> => {
      setError(null);
      const fromUid = adapter.sessionSnapshot().user_id;
      if (fromUid === undefined) {
        const err = new Error('cannot send: not authenticated');
        setError(err);
        throw err;
      }
      try {
        return await adapter.sendTextMessage({
          channel_id: channelId,
          channel_type: channelType,
          from_uid: fromUid,
          content: text,
          reply_to_message_id: opts?.reply_to_message_id,
          mentioned_user_ids: opts?.mentioned_user_ids,
        });
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      }
    },
    [adapter, channelId, channelType],
  );

  return {
    messages,
    pendingCount,
    reachedBeginning,
    isOpening,
    error,
    peerReadPts,
    loadOlder,
    send,
  };
}

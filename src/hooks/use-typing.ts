// useTyping — bi-directional typing indicator wired into one hook.
//
// Outbound: caller exposes `notify(text)` from their composer's onChange
// (or onKeyDown / onInput, whichever they prefer). Empty/whitespace text
// fires `is_typing=false` immediately; non-empty fires `is_typing=true`
// throttled by `throttleMs` (default 2s) so we don't spam the server
// even though server rate-limits at 500ms anyway. We also fire an
// auto-stop after `idleStopMs` (default 5s) of no further keystrokes.
//
// Inbound: subscribes to L1 `typing_received` events for THIS channel.
// `peerTyping.is_typing` flips true when a remote user reports typing,
// false on explicit `is_typing=false` from the same user OR after a
// `peerStopMs` (default 6s) safety timeout (defends against a missed
// `false` push when the peer drops offline mid-typing).
//
// Subscription side-effect: the hook calls `subscribeChannel` on mount
// and `unsubscribeChannel` on unmount. Server broadcasts typing only
// to subscribed sessions, so without this the inbound path is silent.
// Keep the lifetime tied to the hook's mount, NOT to draft activity —
// you want to start receiving typing indicators the moment the panel
// opens, not the moment the user starts typing.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TypingReceivedEvent } from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';

export interface UseTypingOptions {
  /** Min interval between outbound `is_typing=true` notifies. Default 2000. */
  throttleMs?: number;
  /** No-keystroke window after which we auto-fire `is_typing=false`. Default 5000. */
  idleStopMs?: number;
  /** Inbound safety: clear `peerTyping` after this long without a fresh
   *  notification. Default 6000 (slightly longer than `idleStopMs` to
   *  give the peer's true `false` push a chance to land first). */
  peerStopMs?: number;
}

export interface UseTypingResult {
  /** True iff at least one peer in this channel is currently typing. */
  isPeerTyping: boolean;
  /** uid of the typing peer (if any). Useful for "X 正在输入…". */
  typingUserId: string | undefined;
  /** Drive me from your composer's onChange — pass the current text. */
  notify: (text: string) => void;
}

export function useTyping(
  channelId: string,
  channelType: number,
  options: UseTypingOptions = {},
): UseTypingResult {
  const adapter = usePrivchatClient();
  const throttleMs = options.throttleMs ?? 2000;
  const idleStopMs = options.idleStopMs ?? 5000;
  const peerStopMs = options.peerStopMs ?? 6000;

  // ---- subscription (mount/unmount) ----
  useEffect(() => {
    let cancelled = false;
    void adapter.subscribeChannel(channelId, channelType).catch(() => {
      // Best-effort; if subscribe fails the channel just won't get
      // typing pushes. Other bootstrap paths still work.
    });
    return () => {
      cancelled = true;
      void adapter.unsubscribeChannel(channelId, channelType).catch(() => {});
      void cancelled;
    };
  }, [adapter, channelId, channelType]);

  // ---- outbound throttle ----
  const lastSentAtRef = useRef(0);
  const lastIsTypingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendIsTyping = useCallback(
    (isTyping: boolean) => {
      lastIsTypingRef.current = isTyping;
      lastSentAtRef.current = Date.now();
      adapter.sendTyping(channelId, isTyping, channelType).catch(() => {});
    },
    [adapter, channelId, channelType],
  );

  const notify = useCallback(
    (text: string) => {
      const hasContent = text.trim() !== '';
      if (!hasContent) {
        // Stopped typing — fire `false` only if we previously claimed `true`.
        if (idleTimerRef.current) {
          clearTimeout(idleTimerRef.current);
          idleTimerRef.current = null;
        }
        if (lastIsTypingRef.current) sendIsTyping(false);
        return;
      }
      // Has content. Maybe send `true` (throttled).
      const now = Date.now();
      if (
        !lastIsTypingRef.current ||
        now - lastSentAtRef.current >= throttleMs
      ) {
        sendIsTyping(true);
      }
      // (Re)arm the idle-stop timer.
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        if (lastIsTypingRef.current) sendIsTyping(false);
      }, idleStopMs);
    },
    [sendIsTyping, throttleMs, idleStopMs],
  );

  // Cleanup outstanding timers + send one final `false` on unmount, so
  // peers don't see a stale "still typing" indicator after we leave.
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      if (lastIsTypingRef.current) {
        adapter.sendTyping(channelId, false, channelType).catch(() => {});
      }
    };
  }, [adapter, channelId, channelType]);

  // ---- inbound state ----
  const [peerState, setPeerState] = useState<{
    user_id: string;
  } | null>(null);
  const peerStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const off = adapter.observeEvents((env) => {
      const e = env.event;
      if (e.type !== 'typing_received') return;
      // Filter to THIS channel; server already filters out our own
      // session, but stale broadcasts from prior subscriptions can land.
      if (e.channel_id !== channelId) return;
      if (e.is_typing) {
        setPeerState({ user_id: e.user_id });
        if (peerStopTimerRef.current) clearTimeout(peerStopTimerRef.current);
        peerStopTimerRef.current = setTimeout(() => {
          setPeerState((cur) => (cur?.user_id === e.user_id ? null : cur));
        }, peerStopMs);
      } else {
        setPeerState((cur) => (cur?.user_id === e.user_id ? null : cur));
        if (peerStopTimerRef.current) {
          clearTimeout(peerStopTimerRef.current);
          peerStopTimerRef.current = null;
        }
      }
    });
    return () => {
      off();
      if (peerStopTimerRef.current) {
        clearTimeout(peerStopTimerRef.current);
        peerStopTimerRef.current = null;
      }
      setPeerState(null);
    };
  }, [adapter, channelId, peerStopMs]);

  return {
    isPeerTyping: peerState !== null,
    typingUserId: peerState?.user_id,
    notify,
  };
}

export type { TypingReceivedEvent };

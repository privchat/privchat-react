// useMessageReactions — pulls the reaction map for a single message
// and exposes add / remove callbacks. Server has no realtime push for
// reaction changes today; we refetch after our own add/remove to
// converge the local state, and the caller can call `refresh()` on
// any external trigger (visibility change, refresh button, etc).
//
// `serverMessageId === undefined` short-circuits everything (returns
// empty reactions); used by callers that conditionally render based
// on whether the row has been ACKed yet.

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrivchatClient } from './use-privchat-client.js';

export interface UseMessageReactionsResult {
  /** `{emoji: [uid, …], …}` — empty object when none. */
  reactions: Record<string, number[]>;
  loading: boolean;
  error: Error | null;
  /** Add the emoji as the current user's reaction. */
  add: (emoji: string) => Promise<void>;
  /** Remove the emoji from the current user's reactions. */
  remove: (emoji: string) => Promise<void>;
  /** Force a refetch — useful after the panel regains focus. */
  refresh: () => Promise<void>;
}

export function useMessageReactions(
  serverMessageId: string | undefined,
): UseMessageReactionsResult {
  const adapter = usePrivchatClient();
  const [reactions, setReactions] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // Race protection — drop responses for stale message ids when the
  // hook re-targets mid-flight.
  const reqIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (serverMessageId === undefined) {
      setReactions({});
      return;
    }
    const reqId = ++reqIdRef.current;
    setLoading(true);
    try {
      const resp = await adapter.listReactions(serverMessageId);
      if (reqId !== reqIdRef.current) return;
      setReactions(resp.reactions);
      setError(null);
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [adapter, serverMessageId]);

  useEffect(() => {
    if (serverMessageId === undefined) {
      setReactions({});
      return;
    }
    void refresh();
  }, [serverMessageId, refresh]);

  const add = useCallback(
    async (emoji: string) => {
      if (serverMessageId === undefined) return;
      await adapter.addReaction(serverMessageId, emoji);
      await refresh();
    },
    [adapter, serverMessageId, refresh],
  );

  const remove = useCallback(
    async (emoji: string) => {
      if (serverMessageId === undefined) return;
      await adapter.removeReaction(serverMessageId, emoji);
      await refresh();
    },
    [adapter, serverMessageId, refresh],
  );

  return { reactions, loading, error, add, remove, refresh };
}

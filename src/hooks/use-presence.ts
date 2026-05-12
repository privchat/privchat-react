// usePresence — fetches presence for a single user and periodically
// refreshes it while the consumer is mounted. Server `presence/batch_get`
// is the only avenue today (no realtime presence push channel exists in
// the protocol yet); this is the minimum-viable surface so the
// conversation header can render "online" / "last seen Xm ago".
//
// Defaults: poll every 10s while mounted. Real-time presence requires a
// server-side push subscription (`presence/subscribe` + a
// `presence_status_changed` push frame) that's NOT yet implemented;
// this hook will switch to subscribe-once + listen the moment that
// lands. Until then, peer-coming-online lag tracks the poll interval —
// keep this at 10s (not lower) to avoid hammering the directory.
//
// Caller can opt out with `refreshMs: 0` (one-shot). When the uid is
// empty/undefined the hook is a no-op (returns `undefined`) — group
// panels just don't render presence.
//
// We intentionally do NOT batch across hook callers in this version. A
// future refactor can introduce a per-Provider presence store backed
// by a single batched RPC; until then each visible direct panel costs
// one 1-uid RPC every refresh interval.

import { useEffect, useState } from 'react';
import type { PresenceStatusItem } from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';

export interface UsePresenceOptions {
  /** Poll interval in ms; 0 disables refresh after the initial fetch. */
  refreshMs?: number;
}

export function usePresence(
  user_id: string | undefined,
  opts: UsePresenceOptions = {},
): PresenceStatusItem | undefined {
  const adapter = usePrivchatClient();
  const refreshMs = opts.refreshMs ?? 10_000;
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
          setPresence(item);
        })
        .catch((e: unknown) => {
          // Best-effort; log but don't surface — header still works.
          // eslint-disable-next-line no-console
          console.warn('[privchat] usePresence batchGetPresence failed', e);
        });
    };
    fetchOnce();
    if (refreshMs <= 0) {
      return () => {
        cancelled = true;
      };
    }
    const handle = setInterval(fetchOnce, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [adapter, user_id, refreshMs]);

  return presence;
}

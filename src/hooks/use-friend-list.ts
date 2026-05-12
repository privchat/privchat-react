import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { FriendshipRecord, UserRecord } from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';
import {
  projectFriendList,
  type FriendListI18n,
  type FriendListItemVM,
} from '../view-models/friend-list.js';

export interface UseFriendListOptions {
  /** Optional i18n overrides; defaults to English-only fallback. */
  i18n?: Partial<FriendListI18n>;
  /**
   * Poll interval in ms for incremental friendship sync. Default `30000`
   * (30s); set to `0` to disable polling.
   *
   * Why polling: server has no realtime push channel for friendship
   * changes (peer-accepted-our-apply, peer-set-alias, peer-unfriended-us
   * etc are invisible to us between syncs). Until that push lands,
   * polling is the only way the local cache catches up. Cost: one cheap
   * incremental `entity/sync_entities("friend")` RPC per interval —
   * server just returns `[]` when nothing is new.
   */
  pollIntervalMs?: number;
}

/**
 * Joined friendships + user profiles, projected into the list-row VM
 * the Contacts tab renders. Subscribes to BOTH the friendship-list
 * snapshot stream and the user-list snapshot stream, with reference
 * stability through a local cache (same pattern used by
 * `useChannelList`) so React's `useSyncExternalStore` doesn't churn
 * between mutations.
 */
export function useFriendList(
  options: UseFriendListOptions = {},
): FriendListItemVM[] {
  const adapter = usePrivchatClient();
  const { i18n, pollIntervalMs = 30_000 } = options;

  // Periodic incremental sync — see option docs for the rationale.
  // We deliberately fire once on mount (catches "peer accepted while
  // our tab was open" without waiting a full interval), then on each
  // tick. Failures are swallowed (best-effort).
  useEffect(() => {
    if (pollIntervalMs <= 0) return;
    let cancelled = false;
    const tick = () => {
      adapter.refreshFriendships().catch(() => {});
    };
    tick();
    const handle = setInterval(() => {
      if (cancelled) return;
      tick();
    }, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [adapter, pollIntervalMs]);

  // Friendship-list subscription (drives the row identity).
  const friendshipsRef = useRef<FriendshipRecord[] | null>(null);
  const subscribeFriendships = useCallback(
    (onChange: () => void) =>
      adapter.observeFriendshipList(() => {
        friendshipsRef.current = null;
        onChange();
      }),
    [adapter],
  );
  const getFriendshipsSnapshot = useCallback(() => {
    if (friendshipsRef.current === null) {
      friendshipsRef.current = adapter.cachedFriendships();
    }
    return friendshipsRef.current;
  }, [adapter]);
  const friendships = useSyncExternalStore(
    subscribeFriendships,
    getFriendshipsSnapshot,
    getFriendshipsSnapshot,
  );

  // User-list subscription (drives nickname / username / avatar).
  // Friendships and users sync independently — when only one of them
  // changes we still want the list to re-project.
  const usersRef = useRef<UserRecord[] | null>(null);
  const subscribeUsers = useCallback(
    (onChange: () => void) =>
      adapter.observeUserList(() => {
        usersRef.current = null;
        onChange();
      }),
    [adapter],
  );
  const getUsersSnapshot = useCallback(() => {
    if (usersRef.current === null) {
      usersRef.current = adapter.cachedUsers();
    }
    return usersRef.current;
  }, [adapter]);
  const users = useSyncExternalStore(subscribeUsers, getUsersSnapshot, getUsersSnapshot);

  return useMemo(() => {
    const usersByUid = new Map(users.map((u) => [u.user_id, u]));
    return projectFriendList(friendships, usersByUid, i18n);
  }, [friendships, users, i18n]);
}

// Imperative hooks for friend-management commands. Each returns a stable
// function the caller invokes from a click handler; nothing here observes
// state. Pending-request listing and search results are owned by the
// dialog components that consume them (lists are short-lived UI state).
//
// Why callbacks instead of data hooks:
//   - `accountSearch` / `friendPending` are user-driven (typed query,
//     opened dialog) and we don't want to fire them on mount.
//   - `friendApply` / `friendAccept` are pure side-effects with no
//     local cache to update — the next entity sync handles it.

import { useCallback } from 'react';
import type {
  AccountSearchResponse,
  FriendAcceptResponse,
  FriendApplyResponse,
  FriendPendingResponse,
} from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';

export function useAccountSearch(): (
  query: string,
  page?: number,
  pageSize?: number,
) => Promise<AccountSearchResponse> {
  const adapter = usePrivchatClient();
  return useCallback(
    (query, page, pageSize) => adapter.accountSearch(query, page, pageSize),
    [adapter],
  );
}

export function useFriendApply(): (
  targetUserId: number | string,
  message?: string,
  source?: string,
  sourceId?: string,
) => Promise<FriendApplyResponse> {
  const adapter = usePrivchatClient();
  return useCallback(
    (targetUserId, message, source, sourceId) =>
      adapter.friendApply(Number(targetUserId), message, source, sourceId),
    [adapter],
  );
}

export function useFriendAccept(): (
  fromUserId: number | string,
  message?: string,
) => Promise<FriendAcceptResponse> {
  const adapter = usePrivchatClient();
  return useCallback(
    (fromUserId, message) => adapter.friendAccept(Number(fromUserId), message),
    [adapter],
  );
}

export function useFriendPending(): () => Promise<FriendPendingResponse> {
  const adapter = usePrivchatClient();
  return useCallback(() => adapter.friendPending(), [adapter]);
}

/** Imperative refresh: re-pull the friendship cache from the server.
 *  Returns a stable callback. Usually called after `friendAccept` /
 *  `friendApply` succeed to compress the "peer accepted, list still
 *  stale" gap below the poll interval. */
export function useRefreshFriendships(): () => Promise<void> {
  const adapter = usePrivchatClient();
  return useCallback(() => adapter.refreshFriendships(), [adapter]);
}

/** Set/clear a friend's alias (remark name). Empty string clears.
 *  Doesn't auto-refresh — caller can chain `useRefreshFriendships`
 *  if they want the local list to update immediately. */
export function useSetFriendAlias(): (
  targetUserId: number | string,
  alias: string,
) => Promise<unknown> {
  const adapter = usePrivchatClient();
  return useCallback(
    (targetUserId, alias) => adapter.setFriendAlias(Number(targetUserId), alias),
    [adapter],
  );
}

/** Unfriend. Same caveat as `useSetFriendAlias` — schedule a refresh
 *  if you want the row to disappear before the next poll tick. */
export function useRemoveFriend(): (
  friendId: number | string,
) => Promise<unknown> {
  const adapter = usePrivchatClient();
  return useCallback(
    (friendId) => adapter.removeFriend(Number(friendId)),
    [adapter],
  );
}

/** Block / unblock — `callerUserId` is the current user's uid (the
 *  blacklist routes don't auto-fill it from auth ctx; server contract).
 *  Hooks pull it from `sessionSnapshot()` for the caller. */
export function useBlockUser(): (
  blockedUserId: number | string,
) => Promise<unknown> {
  const adapter = usePrivchatClient();
  return useCallback(
    (blockedUserId) => {
      const me = adapter.sessionSnapshot().user_id;
      if (me === undefined) {
        return Promise.reject(new Error('not authenticated'));
      }
      return adapter.blockUser(Number(me), Number(blockedUserId));
    },
    [adapter],
  );
}

export function useUnblockUser(): (
  blockedUserId: number | string,
) => Promise<unknown> {
  const adapter = usePrivchatClient();
  return useCallback(
    (blockedUserId) => {
      const me = adapter.sessionSnapshot().user_id;
      if (me === undefined) {
        return Promise.reject(new Error('not authenticated'));
      }
      return adapter.unblockUser(Number(me), Number(blockedUserId));
    },
    [adapter],
  );
}

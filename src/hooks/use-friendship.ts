import { useCallback, useSyncExternalStore } from 'react';
import type { FriendshipRecord } from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';

/**
 * Subscribe to a single cached friendship row by uid. Returns
 * `undefined` when the uid isn't a friend (or the bootstrap hasn't
 * pulled the row yet) — callers (notably the conversation title
 * resolver) should treat that as "no alias known" and degrade to the
 * user-profile / username fallback chain.
 */
export function useFriendship(user_id: string): FriendshipRecord | undefined {
  const adapter = usePrivchatClient();

  const subscribe = useCallback(
    (onChange: () => void) => adapter.observeFriendshipList(() => onChange()),
    [adapter],
  );

  const getSnapshot = useCallback(
    () => adapter.cachedFriendship(user_id),
    [adapter, user_id],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

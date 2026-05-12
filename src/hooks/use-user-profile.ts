import { useCallback, useSyncExternalStore } from 'react';
import type { UserRecord } from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';

/**
 * Subscribe to a single cached user profile. Returns `undefined` when
 * the uid hasn't been seen yet — the consumer can render a placeholder
 * (`#${uid}`) and let a future bootstrap / push fill it in.
 *
 * Implementation: subscribes to the bulk user-list snapshot stream and
 * picks out the matching row. We don't expose a per-uid subscription
 * surface yet — the user list is small enough at the dogfood-product
 * scale that scanning per emit is cheap.
 */
export function useUserProfile(user_id: string): UserRecord | undefined {
  const adapter = usePrivchatClient();

  const subscribe = useCallback(
    (onChange: () => void) => adapter.observeUserList(() => onChange()),
    [adapter],
  );

  const getSnapshot = useCallback(
    () => adapter.cachedUser(user_id),
    [adapter, user_id],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

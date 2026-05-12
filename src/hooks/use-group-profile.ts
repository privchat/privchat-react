import { useCallback, useSyncExternalStore } from 'react';
import type { GroupRecord } from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';

/**
 * Subscribe to a single cached group profile. Symmetrical to
 * `useUserProfile`; returns `undefined` when the group_id hasn't been
 * seen yet.
 */
export function useGroupProfile(group_id: string): GroupRecord | undefined {
  const adapter = usePrivchatClient();

  const subscribe = useCallback(
    (onChange: () => void) => adapter.observeGroupList(() => onChange()),
    [adapter],
  );

  const getSnapshot = useCallback(
    () => adapter.cachedGroup(group_id),
    [adapter, group_id],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

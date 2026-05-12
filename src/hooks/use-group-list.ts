import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import type { GroupRecord } from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';
import {
  projectGroupList,
  type GroupListI18n,
  type GroupListItemVM,
} from '../view-models/group-list.js';

export interface UseGroupListOptions {
  i18n?: Partial<GroupListI18n>;
}

/**
 * Sorted group list for the Groups tab. Mirrors `useChannelList`'s
 * cache-ref pattern for reference stability. Empty list is a normal
 * state — the consuming UI should render a placeholder, not treat it
 * as an error (see R2A audit: server eligibility for
 * `entity/sync_entities("group")` depends on membership state).
 */
export function useGroupList(options: UseGroupListOptions = {}): GroupListItemVM[] {
  const adapter = usePrivchatClient();
  const { i18n } = options;

  const cacheRef = useRef<GroupRecord[] | null>(null);

  const subscribe = useCallback(
    (onChange: () => void) =>
      adapter.observeGroupList(() => {
        cacheRef.current = null;
        onChange();
      }),
    [adapter],
  );

  const getSnapshot = useCallback(() => {
    if (cacheRef.current === null) {
      cacheRef.current = adapter.cachedGroups();
    }
    return cacheRef.current;
  }, [adapter]);

  const groups = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return useMemo(() => projectGroupList(groups, i18n), [groups, i18n]);
}

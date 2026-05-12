// Imperative hook for `groupCreate`. Same shape as the friend command
// hooks: returns a stable callback. The new group will appear in the
// host's group list once the entity sync flow catches up — we don't
// inject the response row into the local store from here so we stay
// consistent with how other entity creates flow.

import { useCallback } from 'react';
import type { GroupCreateResponse } from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';

export function useCreateGroup(): (
  name: string,
  description?: string,
) => Promise<GroupCreateResponse> {
  const adapter = usePrivchatClient();
  return useCallback(
    (name, description) => adapter.groupCreate(name, description),
    [adapter],
  );
}

// useRevokeMessage — imperative hook for `messageRevoke`. Returns a
// stable callback. After the RPC succeeds the SDK's push absorb path
// flips `record.revoked = true` on the cache row (server broadcasts a
// delete-style push back to the sender's own session as well as to
// peers); the UI re-renders via the existing `observeConversation`
// subscription, so callers don't need to update state by hand.

import { useCallback } from 'react';
import type { MessageRevokeResponse } from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';

export function useRevokeMessage(): (
  serverMessageId: string,
  channelId: string,
) => Promise<MessageRevokeResponse> {
  const adapter = usePrivchatClient();
  return useCallback(
    (serverMessageId, channelId) =>
      adapter.revokeMessage(serverMessageId, channelId),
    [adapter],
  );
}

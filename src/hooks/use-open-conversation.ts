import { useCallback } from 'react';
import type { MessageRecord, OpenConversationOptions } from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';

/**
 * Returns an imperative `openConversation` function. `useConversation` already
 * auto-opens on mount, so this hook is for the rarer case where a host wants
 * to pre-warm a conversation BEFORE rendering a panel — e.g. preloading a
 * list of recently-active channels on app boot.
 */
export function useOpenConversation(): (
  channelId: string,
  channelType: number,
  opts?: OpenConversationOptions,
) => Promise<MessageRecord[]> {
  const adapter = usePrivchatClient();
  return useCallback(
    (channelId, channelType, opts) =>
      adapter.openConversation(channelId, channelType, opts),
    [adapter],
  );
}

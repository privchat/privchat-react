// Imperative hooks for cloud message-history search and jump-to-message
// (MESSAGE_HISTORY spec §4/§5/§7). Same shape as use-friend-commands: each
// returns a stable callback; result lists are short-lived dialog state owned
// by the consuming component.
//
// Contract reminders baked into the SDK:
//   - search hits are snippet projections and must NOT be written into the
//     message cache; the server rate-limits one search per 300ms per user,
//     so callers debounce 300–500ms and drop stale in-flight results;
//   - jumpToMessageContext backfills the local cache before resolving — the
//     UI then scrolls/highlights from local state.

import { useCallback } from 'react';
import type { MessageHistorySearchResponse, MessageRecord } from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';

export function useMessageSearch(): (
  query: string,
  opts?: { channelId?: number; cursor?: string; limit?: number },
) => Promise<MessageHistorySearchResponse> {
  const adapter = usePrivchatClient();
  return useCallback((query, opts) => adapter.messageHistorySearch(query, opts), [adapter]);
}

export function useJumpToMessage(): (
  channelId: string,
  channelType: number,
  messageId: number | string,
  opts?: { beforeLimit?: number; afterLimit?: number },
) => Promise<{
  records: MessageRecord[];
  anchor: MessageRecord;
  has_more_before: boolean;
  has_more_after: boolean;
}> {
  const adapter = usePrivchatClient();
  return useCallback(
    (channelId, channelType, messageId, opts) =>
      adapter.jumpToMessageContext(channelId, channelType, messageId, opts),
    [adapter],
  );
}

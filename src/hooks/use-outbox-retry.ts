// Imperative hooks for outbox-row recovery actions. Pair with
// `MessageItemVM.outbox_status` — UI only renders the affordances when
// `outbox_status === 'failed'` (or `'pending' && stale` if the host
// also wants to expose discard for never-attempted rows).
//
// 5C invariant: `outbox_id === local_message_id`. UI surfaces always
// have access to `local_message_id` (it's on the cache MessageRecord
// even before ACK), so we accept that and pass it straight to the SDK.

import { useCallback } from 'react';
import { usePrivchatClient } from './use-privchat-client.js';

export function useRetryMessage(): (localMessageId: string) => Promise<void> {
  const adapter = usePrivchatClient();
  return useCallback(
    (localMessageId) => adapter.retryOutboxEntry(localMessageId),
    [adapter],
  );
}

export function useDiscardMessage(): (localMessageId: string) => Promise<void> {
  const adapter = usePrivchatClient();
  return useCallback(
    (localMessageId) => adapter.discardOutboxEntry(localMessageId),
    [adapter],
  );
}

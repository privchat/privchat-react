import { useCallback } from 'react';
import { usePrivchatClient } from './use-privchat-client.js';
import {
  CHANNEL_TYPE_DIRECT,
  type OpenConversationResult,
} from '../view-models/channel-type.js';

/**
 * Returns an imperative function that resolves a target uid to a
 * direct-channel `(channelId, channelType)` pair, ready to drop into
 * the host app's "active conversation" state. Wraps the SDK's
 * `channelDirectGetOrCreate` and normalises:
 *   - `channel_id: number` → `channelId: string` (web's ActiveChannel
 *     uses string ids consistent with the rest of the cache surface)
 *   - 2nd / 3rd RPC args fixed to caller-supplied or sensible defaults
 *
 * Idempotent on the server side — calling twice with the same uid
 * returns the same channel. The hook itself doesn't memoise to keep
 * the call site simple; if a race-prevention mechanism is needed
 * (e.g. block double-tap on a contact row), wire it at the host
 * level (see web's `openingDirectUid` pattern).
 */
export function useOpenDirectConversation(
  defaultSource: string = 'contacts',
): (
  user_id: string,
  source?: string,
  source_id?: string,
) => Promise<OpenConversationResult> {
  const adapter = usePrivchatClient();
  return useCallback(
    async (user_id, source, source_id) => {
      const resp = await adapter.channelDirectGetOrCreate(
        Number(user_id),
        source ?? defaultSource,
        source_id,
      );
      return {
        channelId: String(resp.channel_id),
        channelType: CHANNEL_TYPE_DIRECT,
      };
    },
    [adapter, defaultSource],
  );
}

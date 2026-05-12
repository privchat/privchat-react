// Conversation-channel type constants.
//
// Mirrors the SDK / messages-table convention (1 = direct, 2 = group).
// Exposed at the React layer so consumers (web app, embed widgets,
// future Cocos host) don't end up sprinkling magic numbers like
// `channel_type === 2` across UI code. The SDK itself uses these
// values on the wire — see `channelDirectGetOrCreate`'s response and
// `ChannelRecord.channel_type`.

/** 1-on-1 direct chat between two users. */
export const CHANNEL_TYPE_DIRECT = 1;

/** Multi-member group chat. For groups, the server-side invariant
 *  `channel_id == group_id` holds, so a `GroupRecord.group_id` can be
 *  passed straight into `openConversation(group_id, CHANNEL_TYPE_GROUP)`. */
export const CHANNEL_TYPE_GROUP = 2;

/**
 * Unified shape for "I have an active conversation pinned in the UI".
 * Web's `ActiveChannel` and React's `useOpenDirectConversation` return
 * value share this shape so handoff between them needs zero
 * field-name renaming (`channelId` / `channelType` — camelCase, not
 * the SDK's snake_case wire fields).
 */
export interface OpenConversationResult {
  channelId: string;
  channelType: number;
}

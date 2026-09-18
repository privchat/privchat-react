// Conversation-channel type constants.
//
// The wire numbering (1 = direct, 2 = group, 3 = room) is owned by
// privchat-protocol's `protocol::ChannelType` and re-exported by the SDK as
// `ChannelType`; these aliases keep the React layer free of magic numbers
// like `channel_type === 2` while pointing at that single source of truth.
import { ChannelType } from '@privchat/sdk';

export { ChannelType };

/** 1-on-1 direct chat between two users. */
export const CHANNEL_TYPE_DIRECT: number = ChannelType.Direct;

/** Multi-member group chat. For groups, the server-side invariant
 *  `channel_id == group_id` holds, so a `GroupRecord.group_id` can be
 *  passed straight into `openConversation(group_id, CHANNEL_TYPE_GROUP)`. */
export const CHANNEL_TYPE_GROUP: number = ChannelType.Group;

/** Room broadcast channel (ticket-authorised subscription, no pts/unread). */
export const CHANNEL_TYPE_ROOM: number = ChannelType.Room;

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

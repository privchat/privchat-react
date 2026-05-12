// ConversationListItemVM — UI projection of a cache ChannelRecord for use
// in conversation-list components. R1.1 covers the minimum viable shape:
// title, unread, last-message preview, ordering. Extra fields (avatar,
// online status, last-message sender, draft preview, mentions) are R2+
// and will be added here when a real UI consumes them.

import type { ChannelRecord } from '@privchat/sdk';

export interface ConversationListItemVM {
  /** Stable React key. Composes both halves of the SDK's compound key. */
  id: string;
  channel_id: string;
  channel_type: number;
  /**
   * Display title. Falls back to `Direct #<id>` / `Group #<id>` / `Channel #<id>`
   * when the SDK has no `title` yet (e.g. before entity sync hydrates names).
   */
  title: string;
  unread_count: number;
  last_message_preview: string | undefined;
  /** Server wall-clock ms — also the sort key. */
  updated_at: number;
  /** Pinned to the top of the list. Server-side persistent (R6.c). */
  pinned: boolean;
  /** Muted: UI suppresses notification sound + dim badge styling.
   *  Server-side persistent (R6.c). */
  muted: boolean;
  /** True when the channel's most-recent message was revoked. UI
   *  renders "[已撤回]" instead of `last_message_preview`. R6.a. */
  last_message_revoked: boolean;
}

export function projectChannelRecord(record: ChannelRecord): ConversationListItemVM {
  return {
    id: `${record.channel_id}:${record.channel_type}`,
    channel_id: record.channel_id,
    channel_type: record.channel_type,
    title: record.title ?? defaultTitle(record),
    unread_count: record.unread_count,
    last_message_preview: record.last_message_preview,
    updated_at: record.updated_at,
    pinned: record.pinned === true,
    muted: record.muted === true,
    last_message_revoked: record.last_message_revoked === true,
  };
}

/**
 * Compose a stable list ordering. SDK already returns `updated_at desc`;
 * we wrap that with a `pinned desc` outer key so future pinning support
 * doesn't require list-component-side rework. Returns a NEW array; the
 * input is not mutated (fresh-array contract).
 */
export function sortConversations(
  items: ConversationListItemVM[],
): ConversationListItemVM[] {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updated_at - a.updated_at;
  });
}

function defaultTitle(record: ChannelRecord): string {
  switch (record.channel_type) {
    case 1:
      return `Direct #${record.channel_id}`;
    case 2:
      return `Group #${record.channel_id}`;
    default:
      return `Channel #${record.channel_id}`;
  }
}

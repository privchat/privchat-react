// Group-list item VM. Thin projection of `GroupRecord` plus the
// server-side invariant `channel_id == group_id` for groups —
// exposing both fields in the VM means the Groups-tab click handler
// doesn't have to remember the invariant or do any lookup.

import type { GroupRecord } from '@privchat/sdk';

export interface GroupListItemVM {
  group_id: string;
  /** Same value as `group_id` by server schema (Channel::new_group sets
   *  channel_id := group_id at creation). Exposed as a separate field
   *  so the click handler can pass it straight into `setActive` /
   *  `openConversation` without remembering the invariant. */
  channel_id: string;
  title: string;
  member_count: number;
  avatar_url?: string;
}

export interface GroupListI18n {
  /** "Group #{{id}}" — fallback when a group sync row lands without
   *  a name (server eligibility edge cases). */
  unknown_group_template: (id: string) => string;
}

export const DEFAULT_GROUP_LIST_I18N: GroupListI18n = {
  unknown_group_template: (id) => `Group #${id}`,
};

export function projectGroupListItem(
  group: GroupRecord,
  i18n: Partial<GroupListI18n> = {},
): GroupListItemVM {
  const labels = { ...DEFAULT_GROUP_LIST_I18N, ...i18n };
  const title =
    group.name !== undefined && group.name !== ''
      ? group.name
      : labels.unknown_group_template(group.group_id);
  return {
    group_id: group.group_id,
    channel_id: group.group_id, // invariant
    title,
    member_count: group.member_count,
    avatar_url: group.avatar_url,
  };
}

export function projectGroupList(
  groups: GroupRecord[],
  i18n: Partial<GroupListI18n> = {},
): GroupListItemVM[] {
  const items = groups.map((g) => projectGroupListItem(g, i18n));
  items.sort((a, b) => a.title.localeCompare(b.title));
  return items;
}

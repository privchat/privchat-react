// Selector that joins `FriendshipRecord` (alias / sync_version) with
// `UserRecord` (username / nickname / avatar) into the row shape the
// Contacts tab consumes.
//
// Title precedence is the same one the conversation-title resolver
// uses (alias > nickname > username > fallback) — kept in sync here
// because list rows can pre-render before any resolver hook runs.
// `subtitle` only renders when it would add information (i.e. when
// it's not just a duplicate of `title`).

import type { FriendshipRecord, UserRecord } from '@privchat/sdk';

export interface FriendListItemVM {
  user_id: string;
  /** alias > nickname > username > `User #${user_id}` fallback. */
  title: string;
  /** `@username` when title resolved to alias OR nickname AND that
   *  resolved value differs from the underlying username. Omitted
   *  when title IS the username (no double-rendering). */
  subtitle?: string;
  avatar_url?: string;
}

export interface FriendListI18n {
  /** "User #{{id}}" — used when both UserRecord and friendship are
   *  too thin to produce a real label (race condition where friendship
   *  row landed before user-profile sync). */
  unknown_user_template: (id: string) => string;
}

export const DEFAULT_FRIEND_LIST_I18N: FriendListI18n = {
  unknown_user_template: (id) => `User #${id}`,
};

/**
 * Project a friendship row + its user-profile mate into a list-item
 * VM. `user` may be undefined when caches are racing (friend sync
 * landed before user sync); we still produce a usable row using
 * alias / fallback. Pure function — no React, no SDK calls.
 */
export function projectFriendListItem(
  friendship: FriendshipRecord,
  user: UserRecord | undefined,
  i18n: Partial<FriendListI18n> = {},
): FriendListItemVM {
  const labels = { ...DEFAULT_FRIEND_LIST_I18N, ...i18n };
  const alias =
    friendship.alias !== undefined && friendship.alias !== ''
      ? friendship.alias
      : undefined;
  const nickname =
    user?.nickname !== undefined && user.nickname !== '' ? user.nickname : undefined;
  const username =
    user?.username !== undefined && user.username !== '' ? user.username : undefined;

  const title =
    alias ?? nickname ?? username ?? labels.unknown_user_template(friendship.user_id);

  // Subtitle = `@username` only when it adds information beyond title.
  const subtitle =
    username !== undefined && username !== title ? `@${username}` : undefined;

  return {
    user_id: friendship.user_id,
    title,
    subtitle,
    avatar_url:
      user?.avatar_url !== undefined && user.avatar_url !== ''
        ? user.avatar_url
        : undefined,
  };
}

/**
 * Project + sort. Sort is title-localeCompare (root locale — host
 * apps that need locale-aware ordering can re-sort in the UI). Stable
 * so test snapshots don't churn between runs.
 */
export function projectFriendList(
  friendships: FriendshipRecord[],
  usersByUid: Map<string, UserRecord>,
  i18n: Partial<FriendListI18n> = {},
): FriendListItemVM[] {
  const items = friendships.map((f) =>
    projectFriendListItem(f, usersByUid.get(f.user_id), i18n),
  );
  // localeCompare with no locale arg uses the runtime default; we pin
  // to root for deterministic test behaviour. Production callers can
  // re-sort with their preferred locale.
  items.sort((a, b) => a.title.localeCompare(b.title));
  return items;
}

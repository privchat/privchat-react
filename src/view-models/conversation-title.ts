// Pure title resolver for conversation-list rows + panel headers.
//
// Returns a structured ViewModel rather than just a string: callers can
// branch on `kind` to render a system icon, group avatar, person avatar,
// or fallback chrome without re-parsing the channel record. The
// `resolved` flag lets UIs decide whether to show a placeholder
// shimmer (`resolved=false` ⇒ profile not yet hydrated; ID was used as
// a fallback).
//
// Locale strings are passed in via `i18n` so this module stays
// pure / framework-free / testable. Web app wires it through
// react-i18next; future Cocos / Tauri hosts can pass their own labels.

import type {
  ChannelRecord,
  FriendshipRecord,
  GroupRecord,
  UserRecord,
} from '@privchat/sdk';

export type ConversationTitleKind = 'system' | 'direct' | 'group' | 'unknown';

export interface ConversationTitleVM {
  /** Display string. Always non-empty — falls back to the channel ID. */
  title: string;
  /** Optional secondary line (e.g. "@username" under a nickname). */
  subtitle?: string;
  /** Tag for icon / chrome decisions. */
  kind: ConversationTitleKind;
  /**
   * `true` when the title came from an authoritative source (user
   * nickname, group name, or known system label). `false` when we fell
   * back to an ID-based placeholder because the profile isn't cached
   * yet — UI may want to render a subtle loading state.
   */
  resolved: boolean;
}

/**
 * Strings the resolver needs from i18n. Keep this surface tiny — every
 * key here is something a host app must translate. Hosts that don't
 * translate can pass an identity-style helper (`(_, fallback) =>
 * fallback`); the fallbacks are English.
 */
export interface ConversationTitleI18n {
  /** Label for the platform-bot system account (uid 1..99). */
  system_notifications: string;
  /** "User #{{id}}" placeholder for direct channels with no profile yet. */
  unknown_user_template: (id: string) => string;
  /** "Group #{{id}}" placeholder for group channels with no record yet. */
  unknown_group_template: (id: string) => string;
}

/**
 * Default English labels — handy for tests and for the embed scenario
 * that doesn't want to drag in i18next.
 */
export const DEFAULT_TITLE_I18N: ConversationTitleI18n = {
  system_notifications: 'System Notifications',
  unknown_user_template: (id) => `User #${id}`,
  unknown_group_template: (id) => `Group #${id}`,
};

/** Business identifier for the system account (review red line: never uid==1). */
export function isSystemUsername(username: string | undefined | null): boolean {
  return username === 'system' || username === '__system_1__';
}

/**
 * P4.2 拍板（与 KMP app / TS SDK 对齐）：系统账号判定按 **user_type === 1**
 * （server USER_TYPE_SYSTEM）；username 通道兼容。**禁止按 uid**——此前的 uid∈[1,99]
 * 段判定已删除（uid 是部署事实不是身份语义；user record 未同步时由 display-name 常量兜底）。
 */
export function isSystemUserType(userType: number | undefined | null): boolean {
  return userType === 1;
}

/**
 * Fixed display name the server assigns to the system account (see
 * `config.rs` system account `display_name`). The channel entity sync
 * surfaces this resolved name rather than the peer uid/username, so
 * matching the constant is how the web recognises a system DM. Kept in a
 * set so future server localisations can be added without touching call
 * sites.
 */
const SYSTEM_DISPLAY_NAMES: ReadonlySet<string> = new Set([
  'System Message',
  'System Messages',
]);

export function isSystemDisplayName(title: string | undefined | null): boolean {
  return title !== undefined && title !== null && SYSTEM_DISPLAY_NAMES.has(title.trim());
}

/**
 * Compute "the other party's uid" for a direct channel. Returns
 * undefined when the channel record doesn't carry both ends — caller
 * should treat that as `unknown` kind.
 */
function peerUidOf(channel: ChannelRecord, selfUid: string | undefined): string | undefined {
  if (selfUid === undefined) return undefined;
  // R2A: ChannelRecord doesn't yet carry direct_user1_id /
  // direct_user2_id. The fields exist on the server's channel entity
  // payload (we even cite them in the SQL) but the SDK projection
  // hasn't surfaced them onto the cached record yet. Until that lands,
  // we have no way to derive the peer uid for a direct channel that
  // has never received a message — callers will see kind=`unknown`
  // and the title falls back to the channel id.
  //
  // R2.x will plumb these fields through; this function then becomes
  // `direct_user1_id === selfUid ? direct_user2_id : direct_user1_id`.
  void channel;
  return undefined;
}

export interface ResolveTitleInput {
  channel: ChannelRecord;
  user?: UserRecord;
  /**
   * Optional explicit peer uid — useful when the caller already knows
   * the other party (e.g. from a message bubble's `from_uid`). When
   * omitted the resolver falls back to deriving it from
   * `ChannelRecord` (currently always undefined; see `peerUidOf`).
   */
  peerUid?: string;
  /**
   * Friendship row for the peer of a direct channel (R2.1). When
   * present, `friendship.alias` overrides `user.nickname` so the row
   * shows the caller's remark name. Has no effect for system channels
   * (system label always wins) or group channels.
   */
  friendship?: FriendshipRecord;
  group?: GroupRecord;
  selfUid?: string;
  i18n?: Partial<ConversationTitleI18n>;
}

/**
 * Pure resolver. No React, no SDK calls — everything comes in via
 * arguments. The intent is for UI hooks to fetch profiles via
 * `useUserProfile` / `useGroupProfile` and then call this to format.
 */
export function resolveConversationTitle(input: ResolveTitleInput): ConversationTitleVM {
  const { channel, user, group, selfUid } = input;
  const i18n = { ...DEFAULT_TITLE_I18N, ...input.i18n };

  // Group channel
  if (channel.channel_type === 2) {
    const resolvedGroup = group;
    if (resolvedGroup !== undefined && resolvedGroup.name !== '') {
      return {
        title: resolvedGroup.name,
        kind: 'group',
        resolved: true,
      };
    }
    // Fall back to the channel-record's title field (server may have
    // attached a name even before the dedicated group sync row arrives)
    // and finally to the placeholder.
    if (channel.title !== undefined && channel.title !== '') {
      return {
        title: channel.title,
        kind: 'group',
        resolved: false,
      };
    }
    return {
      title: i18n.unknown_group_template(channel.channel_id),
      kind: 'group',
      resolved: false,
    };
  }

  // Direct channel
  if (channel.channel_type === 1) {
    const peerUid = input.peerUid ?? peerUidOf(channel, selfUid);
    void peerUid; // peerUid 不再参与系统判定（P4.2 拍板禁 uid），仍供后续 presence/头像使用。

    // System detection precedence (P4.2 拍板，与 KMP app 一致): user_type === 1 优先，
    // username === 'system'（legacy '__system_1__'）兼容；uid 段判定已删除。
    if (
      user !== undefined &&
      (isSystemUserType(user.user_type) || isSystemUsername(user.username))
    ) {
      return {
        title: i18n.system_notifications,
        kind: 'system',
        resolved: true,
      };
    }

    // The channel entity sync carries the peer's *resolved display name*
    // in `channel.title` (not a uid or the `system` username), so the two
    // uid/username system checks above can't fire for the system DM. The
    // system account's display name is a fixed server constant
    // ("System Message", server config.rs) — match it so the row still
    // localizes to 系统消息. Drop this once the channel entity surfaces the
    // peer uid/username the way the Rust SDK does.
    if (channel.title !== undefined && isSystemDisplayName(channel.title)) {
      return {
        title: i18n.system_notifications,
        kind: 'system',
        resolved: true,
      };
    }

    // Title precedence (per R2.1 拍板):
    //   alias (friend remark) > nickname > username > unknown
    // Alias only applies when we have a peer profile to attach a
    // username to (subtitle), but we'll surface it even if the user
    // record hasn't synced yet — the friendship row is independently
    // useful.
    const friendship = input.friendship;
    const alias = friendship?.alias;

    if (alias !== undefined && alias !== '') {
      // Show "@username" beneath the alias when we know it, so users
      // remember which underlying account they remarked. Falls back
      // to no subtitle when only the friendship row is cached.
      const subtitle =
        user?.username !== undefined && user.username !== '' && user.username !== alias
          ? `@${user.username}`
          : undefined;
      return {
        title: alias,
        subtitle,
        kind: 'direct',
        resolved: true,
      };
    }

    if (user !== undefined) {
      const display =
        (user.nickname !== undefined && user.nickname !== '' && user.nickname) ||
        user.username ||
        i18n.unknown_user_template(user.user_id);
      return {
        title: display,
        // Show the @username under the nickname when both exist and
        // differ — gives the row a Telegram/微信 look.
        subtitle:
          user.nickname !== undefined &&
          user.nickname !== '' &&
          user.username !== '' &&
          user.username !== user.nickname
            ? `@${user.username}`
            : undefined,
        kind: 'direct',
        resolved: true,
      };
    }

    // Profile not cached yet. The channel entity sync now carries the
    // peer's *resolved display name* in `channel.title` (nickname /
    // username), NOT a bare uid — so use it directly instead of wrapping
    // it in the "用户 #{id}" placeholder. Only degrade to the placeholder
    // when the title is missing or is still a bare numeric uid (legacy
    // rows / a peer that never synced a profile).
    if (
      channel.title !== undefined &&
      channel.title !== '' &&
      !/^\d+$/.test(channel.title)
    ) {
      return {
        title: channel.title,
        kind: 'direct',
        resolved: true,
      };
    }
    const placeholderId = channel.title ?? peerUid ?? channel.channel_id;
    return {
      title: i18n.unknown_user_template(placeholderId),
      kind: 'direct',
      resolved: false,
    };
  }

  // Unknown channel_type — render the raw id so dogfood UI surfaces
  // anything weird coming off the wire.
  return {
    title: channel.title ?? `Channel #${channel.channel_id}`,
    kind: 'unknown',
    resolved: channel.title !== undefined,
  };
}

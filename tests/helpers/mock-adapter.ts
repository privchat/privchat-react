// Shared `PrivchatClientAdapter` mock for hook tests.
//
// The adapter has 40+ methods — declaring all of them in every test
// file is tedious and obscures the parts each test actually cares
// about. `createMockAdapter(overrides)` returns a complete adapter
// with throw-on-call defaults (so accidental reliance shows up as
// loud failures in CI), then merges in whatever methods the test
// wants to spec.
//
// This is light DI — purely test scaffolding, no production
// implications. Hooks still go through the real `PrivchatProvider`.

import type {
  AccountSearchResponse,
  BootstrapChannelsOptions,
  ChannelRecord,
  ConnectionState,
  ConversationPatch,
  ConversationSnapshot,
  FriendAcceptResponse,
  FriendApplyResponse,
  FriendPendingResponse,
  FriendshipRecord,
  GroupCreateResponse,
  GroupMemberListResponse,
  GroupRecord,
  MarkReadOptions,
  MessageRecord,
  MessageRevokeResponse,
  OpenConversationOptions,
  OutboxEntry,
  PresenceBatchStatusResponse,
  ScrollHistoryOptions,
  SendTextInput,
  SendTextOperationResult,
  SequencedSdkEvent,
  SessionSnapshot,
  UserRecord,
} from '@privchat/sdk';
import type {
  PrivchatClientAdapter,
  Unsubscribe,
} from '../../src/adapter/client-adapter.js';

const noopUnsub: Unsubscribe = () => {};

const REJECT_NOT_MOCKED = (name: string) => () =>
  Promise.reject(
    new Error(
      `MockAdapter.${name} was called but no override was provided. ` +
        `Add it to createMockAdapter overrides if your test depends on it.`,
    ),
  );

/**
 * Build a complete `PrivchatClientAdapter` for tests. Every async
 * method defaults to a rejecting promise (so silent reliance fails
 * loud), every sync read defaults to a sensible empty value. Pass
 * `overrides` to spec only the methods your test cares about.
 */
export function createMockAdapter(
  overrides: Partial<PrivchatClientAdapter> = {},
): PrivchatClientAdapter {
  const base: PrivchatClientAdapter = {
    // ---- R0 connection / events ----
    connectionState(): ConnectionState {
      return 'authenticated';
    },
    observeEvents(_cb: (env: SequencedSdkEvent) => void): Unsubscribe {
      return noopUnsub;
    },
    sessionSnapshot(): SessionSnapshot {
      return {
        user_id: 'self',
        device_id: 'd',
        connection_state: 'authenticated',
        has_access_token: true,
        last_event_sequence_id: 0,
      };
    },

    // ---- R1 conversation ----
    openConversation: REJECT_NOT_MOCKED('openConversation') as (
      id: string,
      t: number,
      o?: OpenConversationOptions,
    ) => Promise<MessageRecord[]>,
    observeConversation(
      _id: string,
      _t: number,
      _cb: (s: ConversationSnapshot, p: ConversationPatch) => void,
    ): Unsubscribe {
      return noopUnsub;
    },
    getCachedMessages(_id: string, _t: number): MessageRecord[] {
      return [];
    },
    scrollHistory: REJECT_NOT_MOCKED('scrollHistory') as (
      id: string,
      t: number,
      o?: ScrollHistoryOptions,
    ) => Promise<MessageRecord[]>,
    sendTextMessage: REJECT_NOT_MOCKED(
      'sendTextMessage',
    ) as (input: SendTextInput) => Promise<SendTextOperationResult>,
    channelDirectGetOrCreate: REJECT_NOT_MOCKED(
      'channelDirectGetOrCreate',
    ) as (uid: number, source?: string, sourceId?: string) => Promise<{
      channel_id: number;
      created: boolean;
    }>,
    markRead: REJECT_NOT_MOCKED('markRead') as (
      id: string,
      t: number,
      pts: string,
      o?: MarkReadOptions,
    ) => Promise<unknown>,

    // ---- Bot follow / transfer (spec SERVICE_ACCOUNT_FOLLOW_SPEC + CHANNEL_TRANSFER_SPEC) ----
    botFollow: REJECT_NOT_MOCKED('botFollow') as (
      bot_user_id: number,
    ) => Promise<{
      bot_user_id: number;
      channel_id: number;
      account_user_type: number;
      followed: boolean;
      created: boolean;
    }>,
    botUnfollow: REJECT_NOT_MOCKED('botUnfollow') as (
      bot_user_id: number,
    ) => Promise<{
      bot_user_id: number;
      channel_id: number;
      unfollowed: boolean;
    }>,
    transfer: REJECT_NOT_MOCKED('transfer') as (req: {
      request_id: string;
      channel_id: string;
      route: string;
      body: Uint8Array;
      timeoutMs?: number;
    }) => Promise<{
      request_id: string;
      channel_id: string;
      code: number;
      message: string;
      data?: Uint8Array;
    }>,

    // ---- R1.1 channel list ----
    bootstrapChannels: REJECT_NOT_MOCKED('bootstrapChannels') as (
      o?: BootstrapChannelsOptions,
    ) => Promise<ChannelRecord[]>,
    cachedChannels(): ChannelRecord[] {
      return [];
    },
    observeChannelList(_cb: (channels: ChannelRecord[]) => void): Unsubscribe {
      return noopUnsub;
    },

    // ---- R2A profile cache ----
    cachedUser(_uid: string): UserRecord | undefined {
      return undefined;
    },
    cachedUsers(): UserRecord[] {
      return [];
    },
    observeUserList(_cb: (users: UserRecord[]) => void): Unsubscribe {
      return noopUnsub;
    },
    cachedGroup(_gid: string): GroupRecord | undefined {
      return undefined;
    },
    cachedGroups(): GroupRecord[] {
      return [];
    },
    observeGroupList(_cb: (groups: GroupRecord[]) => void): Unsubscribe {
      return noopUnsub;
    },

    // ---- R2.1 friendship cache ----
    cachedFriendship(_uid: string): FriendshipRecord | undefined {
      return undefined;
    },
    cachedFriendships(): FriendshipRecord[] {
      return [];
    },
    observeFriendshipList(
      _cb: (friendships: FriendshipRecord[]) => void,
    ): Unsubscribe {
      return noopUnsub;
    },
    refreshFriendships(): Promise<void> {
      return Promise.resolve();
    },

    // ---- R2.3 friend / group commands ----
    accountSearch: REJECT_NOT_MOCKED('accountSearch') as (
      q: string,
      page?: number,
      pageSize?: number,
    ) => Promise<AccountSearchResponse>,
    friendApply: REJECT_NOT_MOCKED('friendApply') as (
      uid: number,
      m?: string,
      s?: string,
      sid?: string,
    ) => Promise<FriendApplyResponse>,
    friendAccept: REJECT_NOT_MOCKED('friendAccept') as (
      uid: number,
      m?: string,
    ) => Promise<FriendAcceptResponse>,
    friendPending: REJECT_NOT_MOCKED(
      'friendPending',
    ) as () => Promise<FriendPendingResponse>,
    setFriendAlias: REJECT_NOT_MOCKED('setFriendAlias') as (
      uid: number,
      alias: string,
    ) => Promise<unknown>,
    removeFriend: REJECT_NOT_MOCKED('removeFriend') as (
      uid: number,
    ) => Promise<unknown>,
    blockUser: REJECT_NOT_MOCKED('blockUser') as (
      caller: number,
      blocked: number,
    ) => Promise<unknown>,
    unblockUser: REJECT_NOT_MOCKED('unblockUser') as (
      caller: number,
      blocked: number,
    ) => Promise<unknown>,
    groupCreate: REJECT_NOT_MOCKED('groupCreate') as (
      name: string,
      desc?: string,
    ) => Promise<GroupCreateResponse>,

    // ---- R2.4 presence ----
    batchGetPresence: REJECT_NOT_MOCKED(
      'batchGetPresence',
    ) as (uids: number[]) => Promise<PresenceBatchStatusResponse>,

    // ---- R3.1 revoke ----
    revokeMessage: REJECT_NOT_MOCKED('revokeMessage') as (
      sid: string,
      cid: string,
    ) => Promise<MessageRevokeResponse>,

    // ---- R3.2 typing ----
    subscribeChannel: REJECT_NOT_MOCKED('subscribeChannel') as (
      cid: string,
      ct: number,
    ) => Promise<unknown>,
    unsubscribeChannel: REJECT_NOT_MOCKED('unsubscribeChannel') as (
      cid: string,
      ct: number,
    ) => Promise<unknown>,
    sendTyping: REJECT_NOT_MOCKED('sendTyping') as (
      cid: string,
      isTyping: boolean,
      ct?: number,
      action?: string,
    ) => Promise<unknown>,

    // ---- R3.3 channel ops ----
    pinChannel: REJECT_NOT_MOCKED('pinChannel') as (
      cid: string,
      pinned: boolean,
    ) => Promise<unknown>,
    muteChannel: REJECT_NOT_MOCKED('muteChannel') as (
      cid: string,
      muted: boolean,
    ) => Promise<unknown>,
    hideChannel: REJECT_NOT_MOCKED('hideChannel') as (
      cid: string,
    ) => Promise<unknown>,

    // ---- R3.4 group ops ----
    listGroupMembers: REJECT_NOT_MOCKED('listGroupMembers') as (
      gid: string,
    ) => Promise<GroupMemberListResponse>,
    leaveGroup: REJECT_NOT_MOCKED('leaveGroup') as (
      gid: string,
    ) => Promise<unknown>,
    addGroupMember: REJECT_NOT_MOCKED('addGroupMember') as (
      gid: string,
      uid: string,
      role?: string,
    ) => Promise<unknown>,
    removeGroupMember: REJECT_NOT_MOCKED('removeGroupMember') as (
      gid: string,
      uid: string,
    ) => Promise<unknown>,
    muteGroupMember: REJECT_NOT_MOCKED('muteGroupMember') as (
      gid: string,
      uid: string,
      duration: number,
    ) => Promise<unknown>,
    unmuteGroupMember: REJECT_NOT_MOCKED('unmuteGroupMember') as (
      gid: string,
      uid: string,
    ) => Promise<unknown>,

    // ---- R3.5 media send ----
    sendImage: REJECT_NOT_MOCKED('sendImage') as (
      args: Parameters<PrivchatClientAdapter['sendImage']>[0],
    ) => Promise<SendTextOperationResult>,
    sendFile: REJECT_NOT_MOCKED('sendFile') as (
      args: Parameters<PrivchatClientAdapter['sendFile']>[0],
    ) => Promise<SendTextOperationResult>,
    sendVideo: REJECT_NOT_MOCKED('sendVideo') as (
      args: Parameters<PrivchatClientAdapter['sendVideo']>[0],
    ) => Promise<SendTextOperationResult>,

    // ---- Group role / transfer ----
    setGroupMemberRole: REJECT_NOT_MOCKED('setGroupMemberRole') as PrivchatClientAdapter['setGroupMemberRole'],
    transferGroupOwner: REJECT_NOT_MOCKED('transferGroupOwner') as PrivchatClientAdapter['transferGroupOwner'],

    // ---- R3.6 reactions ----
    addReaction: REJECT_NOT_MOCKED('addReaction') as (
      sid: string,
      emoji: string,
    ) => Promise<unknown>,
    removeReaction: REJECT_NOT_MOCKED('removeReaction') as (
      sid: string,
      emoji: string,
    ) => Promise<unknown>,
    listReactions: REJECT_NOT_MOCKED('listReactions') as (
      sid: string,
    ) => Promise<{ reactions: Record<string, number[]>; total_count: number }>,

    // ---- A1 outbox ----
    observeOutbox(_cb: (entries: OutboxEntry[]) => void): Unsubscribe {
      return noopUnsub;
    },
    retryOutboxEntry: REJECT_NOT_MOCKED('retryOutboxEntry') as (
      oid: string,
    ) => Promise<void>,
    discardOutboxEntry: REJECT_NOT_MOCKED('discardOutboxEntry') as (
      oid: string,
    ) => Promise<void>,

    // ---- B1 file access (voice playback lazy URL) ----
    fileGetUrl: REJECT_NOT_MOCKED('fileGetUrl') as (
      fid: string,
    ) => Promise<{
      file_url: string;
      expires_at: number;
      file_size: number;
      mime_type: string;
    }>,
  };

  return { ...base, ...overrides };
}

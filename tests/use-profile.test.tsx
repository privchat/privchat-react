// useUserProfile / useGroupProfile hook tests under MockAdapter.

import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type {
  ChannelRecord,
  ConnectionState,
  ConversationPatch,
  ConversationSnapshot,
  GroupRecord,
  MessageRecord,
  OpenConversationOptions,
  ScrollHistoryOptions,
  SendTextInput,
  SendTextOperationResult,
  SequencedSdkEvent,
  SessionSnapshot,
  UserRecord,
} from '@privchat/sdk';
import type { FriendshipRecord } from '@privchat/sdk';
import {
  PrivchatProvider,
  useFriendship,
  useGroupProfile,
  useUserProfile,
  type PrivchatClientAdapter,
  type Unsubscribe,
} from '../src/index.js';

afterEach(cleanup);

class MockAdapter implements PrivchatClientAdapter {
  private users = new Map<string, UserRecord>();
  private groups = new Map<string, GroupRecord>();
  private userListeners = new Set<(users: UserRecord[]) => void>();
  private groupListeners = new Set<(groups: GroupRecord[]) => void>();

  // ---- R0/R1 surface stubs ----
  connectionState(): ConnectionState {
    return 'authenticated';
  }
  observeEvents(_cb: (env: SequencedSdkEvent) => void): Unsubscribe {
    return () => {};
  }
  sessionSnapshot(): SessionSnapshot {
    return {
      user_id: 'self',
      device_id: 'd',
      connection_state: 'authenticated',
      has_access_token: true,
      last_event_sequence_id: 0,
    };
  }
  async openConversation(
    _id: string,
    _t: number,
    _o?: OpenConversationOptions,
  ): Promise<MessageRecord[]> {
    return [];
  }
  observeConversation(
    _id: string,
    _t: number,
    _cb: (s: ConversationSnapshot, p: ConversationPatch) => void,
  ): Unsubscribe {
    return () => {};
  }
  getCachedMessages(): MessageRecord[] {
    return [];
  }
  async scrollHistory(
    _id: string,
    _t: number,
    _o?: ScrollHistoryOptions,
  ): Promise<MessageRecord[]> {
    return [];
  }
  async sendTextMessage(_input: SendTextInput): Promise<SendTextOperationResult> {
    throw new Error('not used');
  }
  async bootstrapChannels(): Promise<ChannelRecord[]> {
    return [];
  }
  cachedChannels(): ChannelRecord[] {
    return [];
  }
  observeChannelList(_cb: (channels: ChannelRecord[]) => void): Unsubscribe {
    return () => {};
  }
  async markRead(): Promise<unknown> {
    return null;
  }
  async botFollow(): Promise<{
    bot_user_id: number;
    channel_id: number;
    account_user_type: number;
    followed: boolean;
    created: boolean;
  }> {
    throw new Error('botFollow not used in profile hook tests');
  }
  async botUnfollow(): Promise<{
    bot_user_id: number;
    channel_id: number;
    unfollowed: boolean;
  }> {
    throw new Error('botUnfollow not used in profile hook tests');
  }
  async transfer(): Promise<{
    request_id: string;
    channel_id: string;
    code: number;
    message: string;
    data?: Uint8Array;
  }> {
    throw new Error('transfer not used in profile hook tests');
  }

  // ---- R2A profile surface (the hooks under test) ----
  cachedUser(user_id: string): UserRecord | undefined {
    return this.users.get(user_id);
  }
  cachedUsers(): UserRecord[] {
    return [...this.users.values()];
  }
  observeUserList(cb: (users: UserRecord[]) => void): Unsubscribe {
    this.userListeners.add(cb);
    return () => {
      this.userListeners.delete(cb);
    };
  }
  cachedGroup(group_id: string): GroupRecord | undefined {
    return this.groups.get(group_id);
  }
  cachedGroups(): GroupRecord[] {
    return [...this.groups.values()];
  }
  observeGroupList(cb: (groups: GroupRecord[]) => void): Unsubscribe {
    this.groupListeners.add(cb);
    return () => {
      this.groupListeners.delete(cb);
    };
  }
  // R2.1 friendship surface (real impl for the friendship hook tests below)
  private friendships = new Map<string, FriendshipRecord>();
  private friendshipListeners = new Set<(rs: FriendshipRecord[]) => void>();
  cachedFriendship(user_id: string): FriendshipRecord | undefined {
    return this.friendships.get(user_id);
  }
  cachedFriendships(): FriendshipRecord[] {
    return [...this.friendships.values()];
  }
  observeFriendshipList(cb: (rs: FriendshipRecord[]) => void): Unsubscribe {
    this.friendshipListeners.add(cb);
    return () => {
      this.friendshipListeners.delete(cb);
    };
  }
  async channelDirectGetOrCreate(): Promise<{ channel_id: number; created: boolean }> {
    return { channel_id: 0, created: false };
  }
  async accountSearch() {
    return { users: [], total: 0, query: '' };
  }
  async friendApply() {
    return { user_id: 0, username: '', status: '', added_at: 0 };
  }
  async friendAccept() {
    return 0;
  }
  async friendPending() {
    return { requests: [], total: 0 };
  }
  async groupCreate() {
    return {
      group_id: 0,
      name: '',
      description: '',
      member_count: 0,
      created_at: 0,
      creator_id: 0,
    };
  }
  async batchGetPresence() {
    return { items: [], denied_user_ids: [] };
  }
  async refreshFriendships() {}
  async revokeMessage() {
    return true as const;
  }
  async setFriendAlias() {
    return true;
  }
  async removeFriend() {
    return true;
  }
  async blockUser() {
    return true;
  }
  async unblockUser() {
    return true;
  }
  async subscribeChannel() {
    return undefined;
  }
  async unsubscribeChannel() {
    return undefined;
  }
  async sendTyping() {
    return undefined;
  }
  async pinChannel() {
    return undefined;
  }
  async muteChannel() {
    return undefined;
  }
  async hideChannel() {
    return undefined;
  }
  async listGroupMembers() {
    return { members: [], total: 0 };
  }
  async leaveGroup() {
    return true;
  }
  async addGroupMember() {
    return true;
  }
  async removeGroupMember() {
    return true;
  }
  async muteGroupMember() {
    return true;
  }
  async unmuteGroupMember() {
    return true;
  }
  async setGroupMemberRole() {
    return { group_id: 0, user_id: 0, role: 'admin' };
  }
  async transferGroupOwner() {
    return { group_id: 0, new_owner_id: 0 };
  }
  async getGroupSettings() {
    return {
      group_id: 0,
      settings: {
        join_need_approval: false,
        member_can_invite: false,
        all_muted: false,
        max_members: 0,
        created_at: 0,
        updated_at: 0,
      },
    };
  }
  async updateGroupSettings() {
    return { success: true, group_id: '0', message: 'ok', updated_count: 0, updated_at: 0 };
  }
  async muteGroupAll() {
    return { success: true, group_id: '0', all_muted: false, message: 'ok', operator_id: '0', updated_at: 0 };
  }
  async sendImage(): Promise<SendTextOperationResult> {
    throw new Error('not used in this test');
  }
  async sendFile(): Promise<SendTextOperationResult> {
    throw new Error('not used in this test');
  }
  async sendVideo(): Promise<SendTextOperationResult> {
    throw new Error('not used in this test');
  }
  async addReaction() {
    return undefined;
  }
  async removeReaction() {
    return undefined;
  }
  async listReactions() {
    return { reactions: {}, total_count: 0 };
  }
  observeOutbox(_cb: (entries: never[]) => void): Unsubscribe {
    return () => {};
  }
  async retryOutboxEntry() {}
  async discardOutboxEntry() {}
  async fileGetUrl() {
    return { file_url: "", expires_at: 0, file_size: 0, mime_type: "" };
  }
  async downloadAttachmentBlob() {
    return new Blob([]);
  }
  async userQrcodeGet() {
    return { qr_key: "stub", qr_code: "https://stub/privchat:protocol/user/get/stub", user_id: "self" };
  }
  async userQrcodeRefresh() {
    return { old_qr_key: "old", new_qr_key: "new", qr_code: "https://stub/privchat:protocol/user/get/new", user_id: "self" };
  }
  async userQrcodeResolve(_qrKey: string) {
    return { user_id: "0", username: "stub", user_type: 0, is_friend: false, is_self: false };
  }
  async groupQrcodeGet(groupId: string) {
    return { qr_key: "stub", qr_code: `https://stub/privchat:protocol/group/join/stub`, group_id: groupId };
  }
  async groupQrcodeRefresh(groupId: string) {
    return { old_qr_key: "old", new_qr_key: "new", qr_code: `https://stub/privchat:protocol/group/join/new`, group_id: groupId };
  }
  async groupJoinByQrcode(_qrKey: string, _message?: string) {
    return { status: "joined", group_id: "0" };
  }

  // ---- test helpers ----
  emitUser(record: UserRecord) {
    this.users.set(record.user_id, record);
    for (const cb of this.userListeners) cb(this.cachedUsers());
  }
  emitFriendship(record: FriendshipRecord) {
    this.friendships.set(record.user_id, record);
    for (const cb of this.friendshipListeners) cb(this.cachedFriendships());
  }
  removeFriendship(user_id: string) {
    if (this.friendships.delete(user_id)) {
      for (const cb of this.friendshipListeners) cb(this.cachedFriendships());
    }
  }
  emitGroup(record: GroupRecord) {
    this.groups.set(record.group_id, record);
    for (const cb of this.groupListeners) cb(this.cachedGroups());
  }
}

const wrapper = (adapter: PrivchatClientAdapter) =>
  ({ children }: { children: React.ReactNode }) => (
    <PrivchatProvider adapter={adapter}>{children}</PrivchatProvider>
  );

const u = (overrides: Partial<UserRecord> = {}): UserRecord => ({
  user_id: '500',
  username: 'alice',
  nickname: 'Alice',
  user_type: 0,
  is_friend: false,
  sync_version: 1,
  ...overrides,
});

const g = (overrides: Partial<GroupRecord> = {}): GroupRecord => ({
  group_id: '900',
  name: 'Engineering',
  member_count: 5,
  sync_version: 1,
  ...overrides,
});

describe('useUserProfile', () => {
  it('returns undefined for an uncached uid', () => {
    const adapter = new MockAdapter();
    const { result } = renderHook(() => useUserProfile('500'), {
      wrapper: wrapper(adapter),
    });
    expect(result.current).toBeUndefined();
  });

  it('returns the cached record synchronously when present', () => {
    const adapter = new MockAdapter();
    adapter.emitUser(u({ user_id: '500', nickname: 'Alice' }));
    const { result } = renderHook(() => useUserProfile('500'), {
      wrapper: wrapper(adapter),
    });
    expect(result.current?.nickname).toBe('Alice');
  });

  it('re-renders when the user list emits an update for the watched uid', async () => {
    const adapter = new MockAdapter();
    const { result } = renderHook(() => useUserProfile('500'), {
      wrapper: wrapper(adapter),
    });
    expect(result.current).toBeUndefined();

    act(() => {
      adapter.emitUser(u({ user_id: '500', nickname: 'Alice' }));
    });
    await waitFor(() => expect(result.current?.nickname).toBe('Alice'));

    act(() => {
      adapter.emitUser(u({ user_id: '500', nickname: 'Alice (renamed)', sync_version: 2 }));
    });
    await waitFor(() => expect(result.current?.nickname).toBe('Alice (renamed)'));
  });

  it('switches result when the requested uid changes', () => {
    const adapter = new MockAdapter();
    adapter.emitUser(u({ user_id: '500', nickname: 'A' }));
    adapter.emitUser(u({ user_id: '600', nickname: 'B' }));
    const { result, rerender } = renderHook(
      ({ uid }: { uid: string }) => useUserProfile(uid),
      { wrapper: wrapper(adapter), initialProps: { uid: '500' } },
    );
    expect(result.current?.nickname).toBe('A');
    rerender({ uid: '600' });
    expect(result.current?.nickname).toBe('B');
  });
});

describe('useFriendship', () => {
  const f = (overrides: Partial<FriendshipRecord> = {}): FriendshipRecord => ({
    user_id: '500',
    alias: '老王',
    created_at: 0,
    updated_at: 0,
    sync_version: 1,
    ...overrides,
  });

  it('returns undefined for an uncached uid', () => {
    const adapter = new MockAdapter();
    const { result } = renderHook(() => useFriendship('500'), {
      wrapper: wrapper(adapter),
    });
    expect(result.current).toBeUndefined();
  });

  it('returns the cached row when present', () => {
    const adapter = new MockAdapter();
    adapter.emitFriendship(f({ user_id: '500', alias: '老王' }));
    const { result } = renderHook(() => useFriendship('500'), {
      wrapper: wrapper(adapter),
    });
    expect(result.current?.alias).toBe('老王');
  });

  it('updates after observeFriendshipList emits', async () => {
    const adapter = new MockAdapter();
    const { result } = renderHook(() => useFriendship('500'), {
      wrapper: wrapper(adapter),
    });
    expect(result.current).toBeUndefined();
    act(() => {
      adapter.emitFriendship(f({ user_id: '500', alias: '老王' }));
    });
    await waitFor(() => expect(result.current?.alias).toBe('老王'));
  });

  it('returns undefined after tombstone (unfriend)', async () => {
    const adapter = new MockAdapter();
    adapter.emitFriendship(f({ user_id: '500' }));
    const { result } = renderHook(() => useFriendship('500'), {
      wrapper: wrapper(adapter),
    });
    expect(result.current?.alias).toBe('老王');
    act(() => {
      adapter.removeFriendship('500');
    });
    await waitFor(() => expect(result.current).toBeUndefined());
  });
});

describe('useGroupProfile', () => {
  it('returns undefined for an uncached group_id', () => {
    const adapter = new MockAdapter();
    const { result } = renderHook(() => useGroupProfile('900'), {
      wrapper: wrapper(adapter),
    });
    expect(result.current).toBeUndefined();
  });

  it('updates after observeGroupList emits', async () => {
    const adapter = new MockAdapter();
    const { result } = renderHook(() => useGroupProfile('900'), {
      wrapper: wrapper(adapter),
    });
    act(() => {
      adapter.emitGroup(g({ group_id: '900', name: 'Eng' }));
    });
    await waitFor(() => expect(result.current?.name).toBe('Eng'));
  });
});

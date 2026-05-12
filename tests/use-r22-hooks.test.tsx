// Hook-level tests for the R2.2 sidebar hooks: useFriendList,
// useGroupList, useOpenDirectConversation. The MockAdapter here
// implements the cache-related portions of PrivchatClientAdapter
// fully (so the hooks see realistic data), but stubs out the rest.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type {
  ChannelRecord,
  ConnectionState,
  ConversationPatch,
  ConversationSnapshot,
  FriendshipRecord,
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
import {
  CHANNEL_TYPE_DIRECT,
  PrivchatProvider,
  useFriendList,
  useGroupList,
  useOpenDirectConversation,
  type PrivchatClientAdapter,
  type Unsubscribe,
} from '../src/index.js';

afterEach(cleanup);

class MockAdapter implements PrivchatClientAdapter {
  // ---- Profile / friendship caches ----
  private users = new Map<string, UserRecord>();
  private groups = new Map<string, GroupRecord>();
  private friendships = new Map<string, FriendshipRecord>();
  private userListeners = new Set<(u: UserRecord[]) => void>();
  private groupListeners = new Set<(g: GroupRecord[]) => void>();
  private friendshipListeners = new Set<(f: FriendshipRecord[]) => void>();

  /** Captures every channelDirectGetOrCreate call for assertions. */
  directCalls: { uid: number; source?: string; source_id?: string }[] = [];
  /** Pre-seeded responses keyed by uid, defaulting to channel_id=uid*10. */
  directResponses = new Map<number, { channel_id: number; created: boolean }>();

  // ---- Trivial stubs for the hook-irrelevant adapter surface ----
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
  async openConversation(_id: string, _t: number, _o?: OpenConversationOptions): Promise<MessageRecord[]> {
    return [];
  }
  observeConversation(_id: string, _t: number, _cb: (s: ConversationSnapshot, p: ConversationPatch) => void): Unsubscribe {
    return () => {};
  }
  getCachedMessages(): MessageRecord[] {
    return [];
  }
  async scrollHistory(_id: string, _t: number, _o?: ScrollHistoryOptions): Promise<MessageRecord[]> {
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
  // Bot follow / unfollow + transfer — unused by R2.2 hooks; throw to fail
  // loudly if a test starts depending on them without stubbing.
  async botFollow(): Promise<{
    bot_user_id: number;
    channel_id: number;
    account_user_type: number;
    followed: boolean;
    created: boolean;
  }> {
    throw new Error('botFollow not used in r22 hook tests');
  }
  async botUnfollow(): Promise<{
    bot_user_id: number;
    channel_id: number;
    unfollowed: boolean;
  }> {
    throw new Error('botUnfollow not used in r22 hook tests');
  }
  async transfer(): Promise<{
    request_id: string;
    channel_id: string;
    code: number;
    message: string;
    data?: Uint8Array;
  }> {
    throw new Error('transfer not used in r22 hook tests');
  }

  // ---- The hooks-under-test surfaces ----
  cachedUser(user_id: string): UserRecord | undefined {
    return this.users.get(user_id);
  }
  cachedUsers(): UserRecord[] {
    return [...this.users.values()];
  }
  observeUserList(cb: (u: UserRecord[]) => void): Unsubscribe {
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
  observeGroupList(cb: (g: GroupRecord[]) => void): Unsubscribe {
    this.groupListeners.add(cb);
    return () => {
      this.groupListeners.delete(cb);
    };
  }
  cachedFriendship(user_id: string): FriendshipRecord | undefined {
    return this.friendships.get(user_id);
  }
  cachedFriendships(): FriendshipRecord[] {
    return [...this.friendships.values()];
  }
  observeFriendshipList(cb: (f: FriendshipRecord[]) => void): Unsubscribe {
    this.friendshipListeners.add(cb);
    return () => {
      this.friendshipListeners.delete(cb);
    };
  }
  async channelDirectGetOrCreate(
    target_user_id: number,
    source?: string,
    source_id?: string,
  ): Promise<{ channel_id: number; created: boolean }> {
    this.directCalls.push({ uid: target_user_id, source, source_id });
    return (
      this.directResponses.get(target_user_id) ?? {
        channel_id: target_user_id * 10,
        created: false,
      }
    );
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
  refreshCalls = 0;
  async refreshFriendships() {
    this.refreshCalls += 1;
  }
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
  async sendImage(): Promise<SendTextOperationResult> {
    throw new Error('not used in this test');
  }
  async sendFile(): Promise<SendTextOperationResult> {
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

  // ---- Test helpers ----
  emitUser(record: UserRecord) {
    this.users.set(record.user_id, record);
    for (const cb of this.userListeners) cb(this.cachedUsers());
  }
  emitGroup(record: GroupRecord) {
    this.groups.set(record.group_id, record);
    for (const cb of this.groupListeners) cb(this.cachedGroups());
  }
  emitFriendship(record: FriendshipRecord) {
    this.friendships.set(record.user_id, record);
    for (const cb of this.friendshipListeners) cb(this.cachedFriendships());
  }
}

const wrapper = (adapter: PrivchatClientAdapter) =>
  ({ children }: { children: React.ReactNode }) => (
    <PrivchatProvider adapter={adapter}>{children}</PrivchatProvider>
  );

const u = (overrides: Partial<UserRecord> = {}): UserRecord => ({
  user_id: '500',
  username: 'wangwu',
  user_type: 0,
  is_friend: false,
  sync_version: 1,
  ...overrides,
});
const f = (overrides: Partial<FriendshipRecord> = {}): FriendshipRecord => ({
  user_id: '500',
  alias: undefined,
  created_at: 0,
  updated_at: 0,
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

describe('useFriendList', () => {
  it('joins friendships with cached users (alias > nickname > username)', () => {
    const adapter = new MockAdapter();
    adapter.emitUser(u({ user_id: '500', username: 'wangwu', nickname: '王五' }));
    adapter.emitUser(u({ user_id: '600', username: 'bob' }));
    adapter.emitFriendship(f({ user_id: '500', alias: '老王' }));
    adapter.emitFriendship(f({ user_id: '600', alias: undefined }));

    const { result } = renderHook(() => useFriendList(), {
      wrapper: wrapper(adapter),
    });
    const titles = result.current.map((v) => v.title).sort();
    expect(titles).toEqual(['bob', '老王']);
  });

  it('updates when a new friendship arrives', async () => {
    const adapter = new MockAdapter();
    const { result } = renderHook(() => useFriendList(), {
      wrapper: wrapper(adapter),
    });
    expect(result.current).toEqual([]);
    act(() => {
      adapter.emitUser(u({ user_id: '500', username: 'wangwu' }));
      adapter.emitFriendship(f({ user_id: '500', alias: '老王' }));
    });
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0]?.title).toBe('老王');
  });

  it('updates when a user-profile sync arrives AFTER the friendship row', async () => {
    const adapter = new MockAdapter();
    adapter.emitFriendship(f({ user_id: '500', alias: undefined }));
    const { result } = renderHook(() => useFriendList(), {
      wrapper: wrapper(adapter),
    });
    // Pre-user-sync: title falls back to template
    expect(result.current[0]?.title).toBe('User #500');

    act(() => {
      adapter.emitUser(u({ user_id: '500', username: 'wangwu', nickname: '王五' }));
    });
    await waitFor(() => expect(result.current[0]?.title).toBe('王五'));
  });
});

describe('useGroupList', () => {
  it('exposes group_id and channel_id (invariant)', () => {
    const adapter = new MockAdapter();
    adapter.emitGroup(g({ group_id: '900', name: 'Eng' }));
    const { result } = renderHook(() => useGroupList(), {
      wrapper: wrapper(adapter),
    });
    expect(result.current[0]?.group_id).toBe('900');
    expect(result.current[0]?.channel_id).toBe('900');
  });

  it('updates after observeGroupList emits', async () => {
    const adapter = new MockAdapter();
    const { result } = renderHook(() => useGroupList(), {
      wrapper: wrapper(adapter),
    });
    expect(result.current).toEqual([]);
    act(() => {
      adapter.emitGroup(g({ group_id: '900', name: 'Eng' }));
    });
    await waitFor(() => expect(result.current).toHaveLength(1));
  });
});

describe('useOpenDirectConversation', () => {
  it('calls SDK with the target uid + default source, normalises the response', async () => {
    const adapter = new MockAdapter();
    adapter.directResponses.set(500, { channel_id: 1234, created: false });
    const { result } = renderHook(() => useOpenDirectConversation(), {
      wrapper: wrapper(adapter),
    });
    const out = await result.current('500');
    expect(adapter.directCalls).toEqual([
      { uid: 500, source: 'contacts', source_id: undefined },
    ]);
    expect(out).toEqual({
      channelId: '1234', // normalised number → string
      channelType: CHANNEL_TYPE_DIRECT,
    });
  });

  it('honours caller-provided source / source_id', async () => {
    const adapter = new MockAdapter();
    const { result } = renderHook(() => useOpenDirectConversation('default'), {
      wrapper: wrapper(adapter),
    });
    await result.current('700', 'group_member', 'g_42');
    expect(adapter.directCalls[0]).toEqual({
      uid: 700,
      source: 'group_member',
      source_id: 'g_42',
    });
  });

  it('forwards SDK errors so the caller can surface them', async () => {
    const adapter = new MockAdapter();
    vi.spyOn(adapter, 'channelDirectGetOrCreate').mockRejectedValueOnce(
      new Error('network down'),
    );
    const { result } = renderHook(() => useOpenDirectConversation(), {
      wrapper: wrapper(adapter),
    });
    await expect(result.current('500')).rejects.toThrow('network down');
  });
});

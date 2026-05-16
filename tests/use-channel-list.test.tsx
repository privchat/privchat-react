import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type {
  BootstrapChannelsOptions,
  ChannelRecord,
  ConnectionState,
  ConversationPatch,
  ConversationSnapshot,
  MessageRecord,
  OpenConversationOptions,
  ScrollHistoryOptions,
  SendTextInput,
  SendTextOperationResult,
  SequencedSdkEvent,
  SessionSnapshot,
} from '@privchat/sdk';
import {
  PrivchatProvider,
  useChannelList,
  type PrivchatClientAdapter,
  type Unsubscribe,
} from '../src/index.js';

afterEach(cleanup);

class MockAdapter implements PrivchatClientAdapter {
  private channels: ChannelRecord[] = [];
  private listeners = new Set<(channels: ChannelRecord[]) => void>();

  bootstrapCalls: BootstrapChannelsOptions[] = [];

  // ----- adapter (R0/R1 stubs) -----
  connectionState(): ConnectionState {
    return 'authenticated';
  }
  observeEvents(_cb: (env: SequencedSdkEvent) => void): Unsubscribe {
    return () => {};
  }
  sessionSnapshot(): SessionSnapshot {
    return {
      user_id: '1',
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
  getCachedMessages(_id: string, _t: number): MessageRecord[] {
    return [];
  }
  async scrollHistory(
    _id: string,
    _t: number,
    _o?: ScrollHistoryOptions,
  ): Promise<MessageRecord[]> {
    return [];
  }
  async sendTextMessage(_i: SendTextInput): Promise<SendTextOperationResult> {
    throw new Error('not used in this test');
  }

  // ----- channel-list surface -----
  async bootstrapChannels(
    opts: BootstrapChannelsOptions = {},
  ): Promise<ChannelRecord[]> {
    this.bootstrapCalls.push(opts);
    // simulate server replying with whatever has been pre-seeded
    return this.channels;
  }
  cachedChannels(): ChannelRecord[] {
    return [...this.channels];
  }
  observeChannelList(cb: (channels: ChannelRecord[]) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
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
    throw new Error('not used');
  }
  async botUnfollow(): Promise<{
    bot_user_id: number;
    channel_id: number;
    unfollowed: boolean;
  }> {
    throw new Error('not used');
  }
  async transfer(): Promise<{
    request_id: string;
    channel_id: string;
    code: number;
    message: string;
    data?: Uint8Array;
  }> {
    throw new Error('not used');
  }
  cachedUser(): undefined {
    return undefined;
  }
  cachedUsers(): never[] {
    return [];
  }
  observeUserList(_cb: (users: never[]) => void): Unsubscribe {
    return () => {};
  }
  cachedGroup(): undefined {
    return undefined;
  }
  cachedGroups(): never[] {
    return [];
  }
  observeGroupList(_cb: (groups: never[]) => void): Unsubscribe {
    return () => {};
  }
  cachedFriendship(): undefined {
    return undefined;
  }
  cachedFriendships(): never[] {
    return [];
  }
  observeFriendshipList(_cb: (friendships: never[]) => void): Unsubscribe {
    return () => {};
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

  // ----- test helpers -----
  seed(channels: ChannelRecord[]) {
    this.channels = [...channels];
  }
  emit(channels: ChannelRecord[]) {
    this.channels = [...channels];
    for (const cb of this.listeners) cb(this.channels);
  }
}

function makeChannel(partial: Partial<ChannelRecord>): ChannelRecord {
  return {
    channel_id: partial.channel_id ?? '1',
    channel_type: partial.channel_type ?? 1,
    title: partial.title,
    latest_pts: partial.latest_pts ?? '0',
    read_pts: partial.read_pts ?? '0',
    unread_count: partial.unread_count ?? 0,
    last_message_preview: partial.last_message_preview,
    updated_at: partial.updated_at ?? 0,
    sync_version: partial.sync_version ?? 0,
    server_current_pts: partial.server_current_pts,
  };
}

function wrapper(adapter: PrivchatClientAdapter) {
  return ({ children }: { children: React.ReactNode }) => (
    <PrivchatProvider adapter={adapter}>{children}</PrivchatProvider>
  );
}

describe('useChannelList (R1.1)', () => {
  it('auto-bootstraps when cache is empty', async () => {
    const adapter = new MockAdapter();
    renderHook(() => useChannelList(), { wrapper: wrapper(adapter) });
    await waitFor(() => expect(adapter.bootstrapCalls.length).toBe(1));
  });

  it('always auto-bootstraps on mount, even when cache is non-empty (server-side increments)', async () => {
    // Server uses sync_version to incremental-fetch only what's new
    // (peer cursor advances landed while we were offline, etc), so the
    // hook always re-bootstraps on mount. The earlier "skip-if-cache-
    // non-empty" guard was wrong: it caused the local cache to drift
    // away from server reality whenever the user relogged.
    const adapter = new MockAdapter();
    adapter.seed([makeChannel({ channel_id: '10', updated_at: 1 })]);
    renderHook(() => useChannelList(), { wrapper: wrapper(adapter) });
    await waitFor(() => expect(adapter.bootstrapCalls.length).toBe(1));
  });

  it('skipAutoBootstrap=true short-circuits even on empty cache', () => {
    const adapter = new MockAdapter();
    renderHook(() => useChannelList({ skipAutoBootstrap: true }), {
      wrapper: wrapper(adapter),
    });
    expect(adapter.bootstrapCalls.length).toBe(0);
  });

  it('returns sorted snapshot — pinned (R1.1=none) then updated_at desc', () => {
    const adapter = new MockAdapter();
    adapter.seed([
      makeChannel({ channel_id: '1', updated_at: 100 }),
      makeChannel({ channel_id: '2', updated_at: 300 }),
      makeChannel({ channel_id: '3', updated_at: 200 }),
    ]);
    const { result } = renderHook(() => useChannelList({ skipAutoBootstrap: true }), {
      wrapper: wrapper(adapter),
    });
    expect(result.current.conversations.map((c) => c.channel_id)).toEqual([
      '2',
      '3',
      '1',
    ]);
  });

  it('falls back to default title when ChannelRecord.title is missing', () => {
    const adapter = new MockAdapter();
    adapter.seed([
      makeChannel({ channel_id: '11', channel_type: 1 }),
      makeChannel({ channel_id: '22', channel_type: 2 }),
      makeChannel({ channel_id: '33', channel_type: 9, title: 'Custom' }),
    ]);
    const { result } = renderHook(() => useChannelList({ skipAutoBootstrap: true }), {
      wrapper: wrapper(adapter),
    });
    const titles = result.current.conversations.map((c) => c.title);
    expect(titles).toContain('Direct #11');
    expect(titles).toContain('Group #22');
    expect(titles).toContain('Custom');
  });

  it('re-renders when observeChannelList emits a fresh snapshot', () => {
    const adapter = new MockAdapter();
    const { result } = renderHook(() => useChannelList({ skipAutoBootstrap: true }), {
      wrapper: wrapper(adapter),
    });
    expect(result.current.conversations).toHaveLength(0);
    act(() => {
      adapter.emit([makeChannel({ channel_id: '5', updated_at: 5 })]);
    });
    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0]?.channel_id).toBe('5');
  });

  it('refresh() forces a sinceChannelVersion=0 / sinceCursorVersion=0 fetch', async () => {
    const adapter = new MockAdapter();
    adapter.seed([makeChannel({ channel_id: '1', updated_at: 1 })]);
    const { result } = renderHook(() => useChannelList(), { wrapper: wrapper(adapter) });
    await act(async () => {
      await result.current.refresh();
    });
    const last = adapter.bootstrapCalls[adapter.bootstrapCalls.length - 1];
    expect(last).toEqual({ sinceChannelVersion: 0, sinceCursorVersion: 0 });
  });

  it('isLoading toggles around bootstrap and surfaces error', async () => {
    class FailingAdapter extends MockAdapter {
      override async bootstrapChannels(): Promise<ChannelRecord[]> {
        throw new Error('boom');
      }
    }
    const adapter = new FailingAdapter();
    const { result } = renderHook(() => useChannelList(), { wrapper: wrapper(adapter) });
    await waitFor(() => expect(result.current.error?.message).toBe('boom'));
    expect(result.current.isLoading).toBe(false);
  });

  it('snapshot reference is stable between mutations', () => {
    const adapter = new MockAdapter();
    adapter.seed([makeChannel({ channel_id: '1', updated_at: 1 })]);
    const { result, rerender } = renderHook(
      () => useChannelList({ skipAutoBootstrap: true }),
      { wrapper: wrapper(adapter) },
    );
    const first = result.current.conversations;
    rerender();
    expect(result.current.conversations).toBe(first);
  });

  it('unread + last_message_preview pass through to the VM', () => {
    const adapter = new MockAdapter();
    adapter.seed([
      makeChannel({
        channel_id: '7',
        title: 'Bob',
        unread_count: 3,
        last_message_preview: 'see you tomorrow',
        updated_at: 9,
      }),
    ]);
    const { result } = renderHook(() => useChannelList({ skipAutoBootstrap: true }), {
      wrapper: wrapper(adapter),
    });
    const vm = result.current.conversations[0]!;
    expect(vm.unread_count).toBe(3);
    expect(vm.last_message_preview).toBe('see you tomorrow');
    expect(vm.id).toBe('7:1');
  });
});

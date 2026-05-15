// Hook tests for useConversation (R1). Uses an in-test MockAdapter that
// implements PrivchatClientAdapter without depending on @privchat/sdk's
// runtime. Validates: auto-open on mount, snapshot stability,
// patch-driven re-renders, send wiring, loadOlder + reachedBeginning.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import type {
  BootstrapChannelsOptions,
  ChannelRecord,
  ConnectionState,
  ConversationPatch,
  ConversationSnapshot,
  MessageRecord,
  MessageStatus,
  OpenConversationOptions,
  ScrollHistoryOptions,
  SendTextInput,
  SendTextOperationResult,
  SequencedSdkEvent,
  SessionSnapshot,
} from '@privchat/sdk';
import {
  PrivchatProvider,
  useConversation,
  type PrivchatClientAdapter,
  type Unsubscribe,
} from '../src/index.js';

afterEach(cleanup);

type ConvKey = string;
const key = (id: string, t: number) => `${id}:${t}`;

class MockAdapter implements PrivchatClientAdapter {
  state: ConnectionState = 'authenticated';
  selfUid = '100';

  private store = new Map<ConvKey, MessageRecord[]>();
  private convListeners = new Map<
    ConvKey,
    Set<(s: ConversationSnapshot, p: ConversationPatch) => void>
  >();
  private historyPages = new Map<ConvKey, MessageRecord[][]>();

  /** Captures every sendTextMessage input for assertions. */
  sentInputs: SendTextInput[] = [];
  openCalls: { channel_id: string; channel_type: number; opts?: OpenConversationOptions }[] = [];

  // --- adapter surface ---
  connectionState() {
    return this.state;
  }
  observeEvents(_cb: (env: SequencedSdkEvent) => void): Unsubscribe {
    return () => {};
  }
  sessionSnapshot(): SessionSnapshot {
    return {
      user_id: this.selfUid,
      device_id: 'd1',
      connection_state: this.state,
      has_access_token: true,
      last_event_sequence_id: 0,
    };
  }
  async openConversation(
    channel_id: string,
    channel_type: number,
    opts?: OpenConversationOptions,
  ): Promise<MessageRecord[]> {
    this.openCalls.push({ channel_id, channel_type, opts });
    return this.getCachedMessages(channel_id, channel_type);
  }
  observeConversation(
    channel_id: string,
    channel_type: number,
    cb: (s: ConversationSnapshot, p: ConversationPatch) => void,
  ): Unsubscribe {
    const k = key(channel_id, channel_type);
    let set = this.convListeners.get(k);
    if (set === undefined) {
      set = new Set();
      this.convListeners.set(k, set);
    }
    set.add(cb);
    return () => {
      set!.delete(cb);
    };
  }
  getCachedMessages(channel_id: string, channel_type: number): MessageRecord[] {
    return this.store.get(key(channel_id, channel_type)) ?? [];
  }
  async scrollHistory(
    channel_id: string,
    channel_type: number,
    _opts?: ScrollHistoryOptions,
  ): Promise<MessageRecord[]> {
    const k = key(channel_id, channel_type);
    const queued = this.historyPages.get(k) ?? [];
    const page = queued.shift() ?? [];
    if (page.length > 0) {
      const cur = this.store.get(k) ?? [];
      this.store.set(k, [...page, ...cur]);
      this.notify(channel_id, channel_type, { upserted: page, removed: [] });
    }
    return page;
  }
  async sendTextMessage(input: SendTextInput): Promise<SendTextOperationResult> {
    this.sentInputs.push(input);
    const local_message_id = input.local_message_id ?? `lmid-${this.sentInputs.length}`;
    return {
      status: 'sent',
      local_message_id,
      response: {
        client_seq: 0,
        server_message_id: `s-${local_message_id}`,
        message_seq: 1,
        reason_code: 0,
      },
    };
  }
  async bootstrapChannels(_opts?: BootstrapChannelsOptions): Promise<ChannelRecord[]> {
    return [];
  }
  cachedChannels(): ChannelRecord[] {
    return [];
  }
  observeChannelList(_cb: (channels: ChannelRecord[]) => void): Unsubscribe {
    return () => {};
  }

  /** Captures every markRead call for assertions. */
  markReadCalls: { channel_id: string; channel_type: number; read_pts: string }[] = [];
  async markRead(
    channel_id: string,
    channel_type: number,
    read_pts: string,
  ): Promise<unknown> {
    this.markReadCalls.push({ channel_id, channel_type, read_pts });
    return null;
  }
  async botFollow(): Promise<{
    bot_user_id: number;
    channel_id: number;
    account_user_type: number;
    followed: boolean;
    created: boolean;
  }> {
    throw new Error('botFollow not used in conversation hook tests');
  }
  async botUnfollow(): Promise<{
    bot_user_id: number;
    channel_id: number;
    unfollowed: boolean;
  }> {
    throw new Error('botUnfollow not used in conversation hook tests');
  }
  async transfer(): Promise<{
    request_id: string;
    channel_id: string;
    code: number;
    message: string;
    data?: Uint8Array;
  }> {
    throw new Error('transfer not used in conversation hook tests');
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
    return { qr_key: "stub", qr_code: "https://stub/privchat:protocol/user/get?qrkey=stub", user_id: "self" };
  }
  async userQrcodeRefresh() {
    return { old_qr_key: "old", new_qr_key: "new", qr_code: "https://stub/privchat:protocol/user/get?qrkey=new", user_id: "self" };
  }
  async userQrcodeResolve(_qrKey: string) {
    return { user_id: "0", username: "stub", user_type: 0, is_friend: false, is_self: false };
  }
  async groupQrcodeGet(groupId: string) {
    return { qr_key: "stub", qr_code: `https://stub/privchat:protocol/group/join?qrkey=stub`, group_id: groupId };
  }
  async groupQrcodeRefresh(groupId: string) {
    return { old_qr_key: "old", new_qr_key: "new", qr_code: `https://stub/privchat:protocol/group/join?qrkey=new`, group_id: groupId };
  }
  async groupJoinByQrcode(_qrKey: string, _message?: string) {
    return { status: "joined", group_id: "0" };
  }

  // --- test helpers ---
  push(channel_id: string, channel_type: number, partial: Partial<MessageRecord>) {
    const k = key(channel_id, channel_type);
    const record = makeRecord(channel_id, channel_type, partial);
    const cur = this.store.get(k) ?? [];
    this.store.set(k, [...cur, record]);
    this.notify(channel_id, channel_type, { upserted: [record], removed: [] });
  }
  queueHistoryPage(channel_id: string, channel_type: number, records: MessageRecord[]) {
    const k = key(channel_id, channel_type);
    const queued = this.historyPages.get(k) ?? [];
    queued.push(records);
    this.historyPages.set(k, queued);
  }
  private notify(
    channel_id: string,
    channel_type: number,
    p: { upserted: MessageRecord[]; removed: string[] },
  ) {
    const k = key(channel_id, channel_type);
    const snapshot: ConversationSnapshot = {
      channel_id,
      channel_type,
      messages: this.getCachedMessages(channel_id, channel_type),
      is_remote: true,
    };
    const patch: ConversationPatch = {
      channel_id,
      channel_type,
      upserted: p.upserted,
      removed: p.removed,
      is_remote: true,
    };
    for (const cb of this.convListeners.get(k) ?? []) cb(snapshot, patch);
  }
}

function makeRecord(
  channel_id: string,
  channel_type: number,
  partial: Partial<MessageRecord>,
): MessageRecord {
  return {
    channel_id,
    channel_type,
    server_message_id: partial.server_message_id,
    local_message_id: partial.local_message_id,
    pts: partial.pts,
    from_uid: partial.from_uid ?? '999',
    message_type: partial.message_type ?? 'text',
    content: partial.content ?? '',
    payload: partial.payload ?? new Uint8Array(),
    timestamp: partial.timestamp ?? Date.now(),
    status: (partial.status ?? 'received') as MessageStatus,
    revoked: partial.revoked,
    mime_type: partial.mime_type,
  };
}

function wrapper(adapter: PrivchatClientAdapter) {
  return ({ children }: { children: React.ReactNode }) => (
    <PrivchatProvider adapter={adapter}>{children}</PrivchatProvider>
  );
}

describe('useConversation (R1)', () => {
  it('calls openConversation once on mount', async () => {
    const adapter = new MockAdapter();
    renderHook(() => useConversation('100', 1), { wrapper: wrapper(adapter) });
    await waitFor(() => {
      expect(adapter.openCalls).toHaveLength(1);
      expect(adapter.openCalls[0]).toMatchObject({ channel_id: '100', channel_type: 1 });
    });
  });

  it('skips auto-open when skipAutoOpen=true', () => {
    const adapter = new MockAdapter();
    renderHook(() => useConversation('100', 1, { skipAutoOpen: true }), {
      wrapper: wrapper(adapter),
    });
    expect(adapter.openCalls).toHaveLength(0);
  });

  it('returns the cached snapshot synchronously and stays referentially stable', () => {
    const adapter = new MockAdapter();
    adapter.push('100', 1, { server_message_id: '1', content: 'hi', timestamp: 1 });
    const { result, rerender } = renderHook(() => useConversation('100', 1), {
      wrapper: wrapper(adapter),
    });
    const first = result.current.messages;
    rerender();
    expect(result.current.messages).toBe(first); // ref stability across re-renders
    expect(first).toHaveLength(1);
    expect(first[0]?.content).toBe('hi');
  });

  it('re-renders when observeConversation fires a patch', () => {
    const adapter = new MockAdapter();
    const { result } = renderHook(() => useConversation('100', 1), {
      wrapper: wrapper(adapter),
    });
    expect(result.current.messages).toHaveLength(0);
    act(() => {
      adapter.push('100', 1, {
        server_message_id: '7',
        content: 'arrived',
        timestamp: 5,
      });
    });
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.content).toBe('arrived');
  });

  it('marks is_self based on session.user_id', () => {
    const adapter = new MockAdapter();
    adapter.selfUid = '100';
    adapter.push('100', 1, { from_uid: '100', content: 'mine' });
    adapter.push('100', 1, { from_uid: '999', content: 'theirs' });
    const { result } = renderHook(() => useConversation('100', 1), {
      wrapper: wrapper(adapter),
    });
    expect(result.current.messages[0]?.is_self).toBe(true);
    expect(result.current.messages[1]?.is_self).toBe(false);
  });

  it('counts pending messages', () => {
    const adapter = new MockAdapter();
    adapter.push('100', 1, { content: 'sent', status: 'sent' });
    adapter.push('100', 1, { content: 'p1', status: 'pending', local_message_id: 'l1' });
    adapter.push('100', 1, { content: 'p2', status: 'pending', local_message_id: 'l2' });
    const { result } = renderHook(() => useConversation('100', 1), {
      wrapper: wrapper(adapter),
    });
    expect(result.current.pendingCount).toBe(2);
  });

  it('send() forwards from_uid from session and returns the SDK result', async () => {
    const adapter = new MockAdapter();
    adapter.selfUid = '42';
    const { result } = renderHook(() => useConversation('100', 1), {
      wrapper: wrapper(adapter),
    });
    let out: SendTextOperationResult | undefined;
    await act(async () => {
      out = await result.current.send('hello');
    });
    expect(adapter.sentInputs[0]).toMatchObject({
      channel_id: '100',
      channel_type: 1,
      from_uid: '42',
      content: 'hello',
    });
    expect(out?.status).toBe('sent');
  });

  it('send() throws when session has no user_id', async () => {
    const adapter = new MockAdapter();
    adapter.selfUid = undefined as unknown as string;
    const { result } = renderHook(() => useConversation('100', 1), {
      wrapper: wrapper(adapter),
    });
    await expect(result.current.send('hi')).rejects.toThrow(/not authenticated/);
  });

  it('loadOlder sets reachedBeginning when scrollHistory returns empty', async () => {
    const adapter = new MockAdapter();
    const { result } = renderHook(() => useConversation('100', 1), {
      wrapper: wrapper(adapter),
    });
    expect(result.current.reachedBeginning).toBe(false);
    await act(async () => {
      await result.current.loadOlder();
    });
    expect(result.current.reachedBeginning).toBe(true);
  });

  it('loadOlder appends a page and observers see the upserted records', async () => {
    const adapter = new MockAdapter();
    adapter.queueHistoryPage('100', 1, [
      makeRecord('100', 1, { server_message_id: 'h1', content: 'old1', timestamp: 1 }),
      makeRecord('100', 1, { server_message_id: 'h2', content: 'old2', timestamp: 2 }),
    ]);
    const { result } = renderHook(() => useConversation('100', 1), {
      wrapper: wrapper(adapter),
    });
    await act(async () => {
      await result.current.loadOlder();
    });
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.reachedBeginning).toBe(false);
  });

  it('switching (channelId, channelType) re-opens and resubscribes', async () => {
    const adapter = new MockAdapter();
    adapter.push('100', 1, { content: 'A', server_message_id: 'a' });
    adapter.push('200', 1, { content: 'B', server_message_id: 'b' });
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useConversation(id, 1),
      { wrapper: wrapper(adapter), initialProps: { id: '100' } },
    );
    await waitFor(() => expect(adapter.openCalls).toHaveLength(1));
    expect(result.current.messages[0]?.content).toBe('A');
    rerender({ id: '200' });
    await waitFor(() => expect(adapter.openCalls).toHaveLength(2));
    expect(result.current.messages[0]?.content).toBe('B');
  });
});

// Reuse R0 smoke shape too — confirm hooks coexist under one Provider.
function ConversationView() {
  const { messages, pendingCount } = useConversation('100', 1);
  return (
    <div>
      <span data-testid="count">{messages.length}</span>
      <span data-testid="pending">{pendingCount}</span>
    </div>
  );
}

describe('useConversation read-by-peer projection (R1.2)', () => {
  const seedChannel = (
    adapter: MockAdapter,
    overrides: { channel_id: string; channel_type: number; peer_read_pts?: string },
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adapter as any).channelStore = (adapter as any).channelStore ?? new Map<string, ChannelRecord>();
    // The MockAdapter in this file doesn't simulate channel state by
    // default; we patch cachedChannels/observeChannelList on the fly.
    const ch: ChannelRecord = {
      channel_id: overrides.channel_id,
      channel_type: overrides.channel_type,
      latest_pts: '0',
      read_pts: '0',
      unread_count: 0,
      updated_at: 0,
      sync_version: 0,
      peer_read_pts: overrides.peer_read_pts,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adapter as any).__channels = [ch];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adapter as any).__channelListeners = (adapter as any).__channelListeners ?? new Set();
  };

  // Override MockAdapter cachedChannels / observeChannelList for this block.
  const wireChannelMock = (adapter: MockAdapter) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = adapter as any;
    a.cachedChannels = () => [...(a.__channels ?? [])];
    a.observeChannelList = (cb: (channels: ChannelRecord[]) => void) => {
      a.__channelListeners ??= new Set();
      a.__channelListeners.add(cb);
      return () => a.__channelListeners.delete(cb);
    };
    a.notifyChannels = () => {
      for (const cb of a.__channelListeners ?? []) cb([...(a.__channels ?? [])]);
    };
    a.setPeerReadPts = (channel_id: string, pts: string | undefined) => {
      const ch = a.__channels.find((c: ChannelRecord) => c.channel_id === channel_id);
      if (ch) ch.peer_read_pts = pts;
      a.notifyChannels();
    };
  };

  it('marks self rows as read_by_peer when channel.peer_read_pts >= row.pts', () => {
    const adapter = new MockAdapter();
    wireChannelMock(adapter);
    adapter.selfUid = '555';
    seedChannel(adapter, { channel_id: '100', channel_type: 1, peer_read_pts: '20' });
    adapter.push('100', 1, { from_uid: '555', server_message_id: 's1', pts: '10' });
    adapter.push('100', 1, { from_uid: '555', server_message_id: 's2', pts: '20' });
    adapter.push('100', 1, { from_uid: '555', server_message_id: 's3', pts: '30' });
    adapter.push('100', 1, { from_uid: '888', server_message_id: 'p1', pts: '15' });

    const { result } = renderHook(() => useConversation('100', 1, { autoMarkRead: false }), {
      wrapper: wrapper(adapter),
    });

    const byKey = new Map(result.current.messages.map((m) => [m.server_message_id!, m]));
    expect(byKey.get('s1')?.read_by_peer).toBe(true); // pts=10 ≤ 20
    expect(byKey.get('s2')?.read_by_peer).toBe(true); // pts=20 ≤ 20
    expect(byKey.get('s3')?.read_by_peer).toBe(false); // pts=30 > 20
    expect(byKey.get('p1')?.read_by_peer).toBe(false); // peer row, never read_by_peer
    // status stays 'sent' regardless of read_by_peer.
    expect(byKey.get('s1')?.status).toBe('received'); // mock default
  });

  it('updates read_by_peer when channel.peer_read_pts advances', async () => {
    const adapter = new MockAdapter();
    wireChannelMock(adapter);
    adapter.selfUid = '555';
    seedChannel(adapter, { channel_id: '100', channel_type: 1, peer_read_pts: '5' });
    adapter.push('100', 1, { from_uid: '555', server_message_id: 's1', pts: '10' });

    const { result } = renderHook(() => useConversation('100', 1, { autoMarkRead: false }), {
      wrapper: wrapper(adapter),
    });
    expect(result.current.messages[0]?.read_by_peer).toBe(false); // 10 > 5

    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (adapter as any).setPeerReadPts('100', '20');
    });
    await waitFor(() => expect(result.current.messages[0]?.read_by_peer).toBe(true));
  });

  it('falls back to read_by_peer=false when peer_read_pts is undefined (cold start)', () => {
    const adapter = new MockAdapter();
    wireChannelMock(adapter);
    adapter.selfUid = '555';
    seedChannel(adapter, { channel_id: '100', channel_type: 1, peer_read_pts: undefined });
    adapter.push('100', 1, { from_uid: '555', server_message_id: 's1', pts: '10' });

    const { result } = renderHook(() => useConversation('100', 1, { autoMarkRead: false }), {
      wrapper: wrapper(adapter),
    });
    expect(result.current.messages[0]?.read_by_peer).toBe(false);
  });
});

describe('useConversation auto-markRead (R1.2)', () => {
  it('marks the highest received pts on mount when records are pre-seeded', async () => {
    const adapter = new MockAdapter();
    adapter.selfUid = 'me';
    // Pre-seed: peer messages with various pts; one self message that
    // must NOT trigger markRead.
    adapter.push('100', 1, { from_uid: 'peer', server_message_id: '1', pts: '5' });
    adapter.push('100', 1, { from_uid: 'peer', server_message_id: '2', pts: '7' });
    adapter.push('100', 1, { from_uid: 'me', server_message_id: '3', pts: '8' });
    renderHook(() => useConversation('100', 1), { wrapper: wrapper(adapter) });
    await waitFor(() => expect(adapter.markReadCalls).toHaveLength(1));
    expect(adapter.markReadCalls[0]).toMatchObject({
      channel_id: '100',
      channel_type: 1,
      read_pts: '7', // highest non-self pts
    });
  });

  it('re-marks when a new received message lands', async () => {
    const adapter = new MockAdapter();
    adapter.selfUid = 'me';
    adapter.push('100', 1, { from_uid: 'peer', server_message_id: '1', pts: '5' });
    renderHook(() => useConversation('100', 1), { wrapper: wrapper(adapter) });
    await waitFor(() => expect(adapter.markReadCalls).toHaveLength(1));
    expect(adapter.markReadCalls[0]?.read_pts).toBe('5');

    act(() => {
      adapter.push('100', 1, { from_uid: 'peer', server_message_id: '2', pts: '9' });
    });
    await waitFor(() => expect(adapter.markReadCalls).toHaveLength(2));
    expect(adapter.markReadCalls[1]?.read_pts).toBe('9');
  });

  it('does not re-mark when nothing new arrived (watermark dedup)', async () => {
    const adapter = new MockAdapter();
    adapter.selfUid = 'me';
    adapter.push('100', 1, { from_uid: 'peer', server_message_id: '1', pts: '5' });
    const { rerender } = renderHook(() => useConversation('100', 1), {
      wrapper: wrapper(adapter),
    });
    await waitFor(() => expect(adapter.markReadCalls).toHaveLength(1));
    rerender();
    rerender();
    await new Promise((r) => setTimeout(r, 10));
    expect(adapter.markReadCalls).toHaveLength(1);
  });

  it('skips when autoMarkRead is false', async () => {
    const adapter = new MockAdapter();
    adapter.selfUid = 'me';
    adapter.push('100', 1, { from_uid: 'peer', server_message_id: '1', pts: '5' });
    renderHook(() => useConversation('100', 1, { autoMarkRead: false }), {
      wrapper: wrapper(adapter),
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(adapter.markReadCalls).toHaveLength(0);
  });

  it('ignores rows without pts and self rows even if they outlive received ones', async () => {
    const adapter = new MockAdapter();
    adapter.selfUid = 'me';
    // No pts on peer row → should NOT be the watermark target.
    adapter.push('100', 1, { from_uid: 'peer', server_message_id: '1' /* no pts */ });
    // Self row with pts=999 — must be ignored.
    adapter.push('100', 1, { from_uid: 'me', server_message_id: '2', pts: '999' });
    renderHook(() => useConversation('100', 1), { wrapper: wrapper(adapter) });
    await new Promise((r) => setTimeout(r, 30));
    expect(adapter.markReadCalls).toHaveLength(0);
  });
});

describe('useConversation under PrivchatProvider', () => {
  it('renders end-to-end with messages flowing through observeConversation', async () => {
    const adapter = new MockAdapter();
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <PrivchatProvider adapter={adapter}>
        <ConversationView />
      </PrivchatProvider>,
    );
    expect(screen.getByTestId('count').textContent).toBe('0');
    act(() => {
      adapter.push('100', 1, { content: 'a', server_message_id: '1' });
      adapter.push('100', 1, {
        content: 'b',
        local_message_id: 'l1',
        status: 'pending',
      });
    });
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
    expect(screen.getByTestId('pending').textContent).toBe('1');
    consoleErr.mockRestore();
  });
});

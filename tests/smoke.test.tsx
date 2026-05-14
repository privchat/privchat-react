// R0 smoke: Provider + useConnectionState + adapter event stream end-to-end.
// Uses an in-test adapter so this file has no @privchat/sdk runtime dependency
// beyond the type imports. The shape of MockAdapter is the template the next
// hook test (R1+) will build on.

import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

afterEach(cleanup);
import type {
  BootstrapChannelsOptions,
  ChannelRecord,
  ConnectionState,
  ConnectionStateChangedEvent,
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
  PrivchatProviderMissingError,
  useConnectionState,
  usePrivchatClient,
  type PrivchatClientAdapter,
  type Unsubscribe,
} from '../src/index.js';

class MockAdapter implements PrivchatClientAdapter {
  private state: ConnectionState = 'disconnected';
  private listeners = new Set<(env: SequencedSdkEvent) => void>();
  private seq = 0;

  connectionState() {
    return this.state;
  }

  observeEvents(cb: (env: SequencedSdkEvent) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  // R1 surface — stubbed; smoke test only exercises connectionState/events.
  sessionSnapshot(): SessionSnapshot {
    return {
      user_id: undefined,
      device_id: undefined,
      connection_state: this.state,
      has_access_token: false,
      last_event_sequence_id: this.seq,
    };
  }
  async openConversation(_id: string, _t: number, _o?: OpenConversationOptions): Promise<MessageRecord[]> {
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
  async scrollHistory(_id: string, _t: number, _o?: ScrollHistoryOptions): Promise<MessageRecord[]> {
    return [];
  }
  async sendTextMessage(_input: SendTextInput): Promise<SendTextOperationResult> {
    throw new Error('not used in smoke test');
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
  async sendImage(): Promise<SendTextOperationResult> {
    throw new Error('not used in smoke');
  }
  async sendFile(): Promise<SendTextOperationResult> {
    throw new Error('not used in smoke');
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

  setState(next: ConnectionState, reason: string = 'test') {
    this.state = next;
    const event: ConnectionStateChangedEvent = {
      type: 'connection_state_changed',
      state: next,
      reason,
    };
    const env: SequencedSdkEvent = {
      sequence_id: ++this.seq,
      timestamp_ms: Date.now(),
      event,
    };
    for (const cb of this.listeners) cb(env);
  }
}

function ConnectionBadge() {
  const state = useConnectionState();
  return <span data-testid="state">{state}</span>;
}

describe('@privchat/react R0', () => {
  it('renders the initial connection state synchronously (no flash)', () => {
    const adapter = new MockAdapter();
    render(
      <PrivchatProvider adapter={adapter}>
        <ConnectionBadge />
      </PrivchatProvider>,
    );
    expect(screen.getByTestId('state').textContent).toBe('disconnected');
  });

  it('re-renders on connection_state_changed events', () => {
    const adapter = new MockAdapter();
    render(
      <PrivchatProvider adapter={adapter}>
        <ConnectionBadge />
      </PrivchatProvider>,
    );

    act(() => adapter.setState('connecting'));
    expect(screen.getByTestId('state').textContent).toBe('connecting');

    act(() => adapter.setState('authenticated'));
    expect(screen.getByTestId('state').textContent).toBe('authenticated');

    act(() => adapter.setState('disconnected', 'user'));
    expect(screen.getByTestId('state').textContent).toBe('disconnected');
  });

  it('throws PrivchatProviderMissingError when usePrivchatClient is unmounted', () => {
    function Probe() {
      usePrivchatClient();
      return null;
    }
    expect(() => render(<Probe />)).toThrow(PrivchatProviderMissingError);
  });
});

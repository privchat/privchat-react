// Pure-resolver unit tests for the title VM. No React, no SDK calls —
// just mapping input shapes to ConversationTitleVM.

import { describe, expect, it } from 'vitest';
import type {
  ChannelRecord,
  FriendshipRecord,
  GroupRecord,
  UserRecord,
} from '@privchat/sdk';
import {
  isSystemUser,
  resolveConversationTitle,
  type ConversationTitleI18n,
} from '../src/index.js';

const ch = (overrides: Partial<ChannelRecord> = {}): ChannelRecord => ({
  channel_id: '1000',
  channel_type: 1,
  latest_pts: '0',
  read_pts: '0',
  unread_count: 0,
  updated_at: 0,
  sync_version: 1,
  ...overrides,
});

const u = (overrides: Partial<UserRecord> = {}): UserRecord => ({
  user_id: '500',
  username: 'alice',
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

describe('isSystemUser', () => {
  it('accepts uids in [1, 99]', () => {
    expect(isSystemUser('1')).toBe(true);
    expect(isSystemUser('50')).toBe(true);
    expect(isSystemUser('99')).toBe(true);
  });

  it('rejects values outside the system range', () => {
    expect(isSystemUser('0')).toBe(false);
    expect(isSystemUser('100')).toBe(false);
    expect(isSystemUser('100002048')).toBe(false);
    expect(isSystemUser('-1')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isSystemUser('')).toBe(false);
    expect(isSystemUser(undefined)).toBe(false);
    expect(isSystemUser('1.5')).toBe(false);
    expect(isSystemUser('NaN')).toBe(false);
    expect(isSystemUser('1e2')).toBe(false); // not safe-integer literal
    expect(isSystemUser('hello')).toBe(false);
  });
});

describe('resolveConversationTitle — direct channels', () => {
  it('user with nickname → nickname title + @username subtitle', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 1 }),
      user: u({ user_id: '500', username: 'alice', nickname: 'Alice' }),
      selfUid: '999',
    });
    expect(vm).toEqual({
      title: 'Alice',
      subtitle: '@alice',
      kind: 'direct',
      resolved: true,
    });
  });

  it('user with username only → username title, no subtitle', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 1 }),
      user: u({ user_id: '500', username: 'alice', nickname: undefined }),
      selfUid: '999',
    });
    expect(vm.title).toBe('alice');
    expect(vm.subtitle).toBeUndefined();
    expect(vm.resolved).toBe(true);
  });

  it('nickname == username → no subtitle (avoid duplication)', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 1 }),
      user: u({ user_id: '500', username: 'alice', nickname: 'alice' }),
    });
    expect(vm.subtitle).toBeUndefined();
  });

  it('user undefined → unknown_user_template fallback, resolved=false', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 1, channel_id: '7777', title: '500' }),
    });
    expect(vm.kind).toBe('direct');
    expect(vm.resolved).toBe(false);
    // Fallback prefers channel.title (server fills with peer uid) over channel_id.
    expect(vm.title).toBe('User #500');
  });

  it('peerUid in system range → 系统通知 even without UserRecord', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 1, title: '1' }),
      peerUid: '1',
    });
    expect(vm).toMatchObject({ kind: 'system', resolved: true });
    expect(vm.title).toBe('System Notifications');
  });

  it('channel.title is system uid → 系统通知 (no peerUid passed)', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 1, title: '1' }),
    });
    expect(vm.kind).toBe('system');
    expect(vm.resolved).toBe(true);
  });

  it('user.user_type=1 still renders normally — kind is determined by uid range, not type', () => {
    // user_type=1 (system) is informational metadata for UI badges; the
    // resolver classifies by uid range so a normal user that happens to
    // be tagged user_type=1 still shows nickname (deliberate).
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 1 }),
      user: u({ user_id: '500', user_type: 1, nickname: 'Bot' }),
    });
    expect(vm.kind).toBe('direct');
    expect(vm.title).toBe('Bot');
  });
});

describe('resolveConversationTitle — friendship alias (R2.1)', () => {
  const fr = (overrides: Partial<FriendshipRecord> = {}): FriendshipRecord => ({
    user_id: '500',
    alias: '老王',
    created_at: 0,
    updated_at: 0,
    sync_version: 1,
    ...overrides,
  });

  it('alias overrides nickname when both are present', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 1 }),
      user: u({ user_id: '500', username: 'wangwu', nickname: '王五' }),
      friendship: fr({ user_id: '500', alias: '老王' }),
    });
    expect(vm.title).toBe('老王');
    expect(vm.kind).toBe('direct');
    expect(vm.resolved).toBe(true);
    // Subtitle still shows the underlying account so the user
    // remembers what handle the remark applies to.
    expect(vm.subtitle).toBe('@wangwu');
  });

  it('alias works without UserRecord (friendship row alone is enough)', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 1 }),
      friendship: fr({ user_id: '500', alias: '老王' }),
    });
    expect(vm.title).toBe('老王');
    expect(vm.subtitle).toBeUndefined();
    expect(vm.resolved).toBe(true);
  });

  it('empty alias falls through to nickname (alias="" not the same as remarked)', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 1 }),
      user: u({ user_id: '500', username: 'wangwu', nickname: '王五' }),
      friendship: fr({ user_id: '500', alias: '' }),
    });
    expect(vm.title).toBe('王五'); // nickname, NOT empty alias
  });

  it('subtitle suppressed when username equals alias', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 1 }),
      user: u({ user_id: '500', username: '老王', nickname: 'Alice' }),
      friendship: fr({ alias: '老王' }),
    });
    expect(vm.title).toBe('老王');
    expect(vm.subtitle).toBeUndefined();
  });

  it('system uid still wins over alias (alias never overrides system label)', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 1, title: '1' }),
      friendship: fr({ user_id: '1', alias: '小助手' }), // user tried to remark system!
      peerUid: '1',
    });
    // System gets the system label, not the alias.
    expect(vm.kind).toBe('system');
    expect(vm.title).not.toBe('小助手');
  });

  it('group channel ignores friendship.alias entirely', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 2, channel_id: '900' }),
      group: g({ group_id: '900', name: 'Engineering' }),
      friendship: fr({ alias: '不该用' }),
    });
    expect(vm.title).toBe('Engineering');
    expect(vm.kind).toBe('group');
  });
});

describe('resolveConversationTitle — group channels', () => {
  it('group record with name → group name + resolved', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 2, channel_id: '2222' }),
      group: g({ group_id: '900', name: 'Engineering' }),
    });
    expect(vm).toEqual({
      title: 'Engineering',
      kind: 'group',
      resolved: true,
    });
  });

  it('group missing → falls back to channel.title (resolved=false)', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 2, channel_id: '2222', title: 'Cached Group Name' }),
    });
    expect(vm.title).toBe('Cached Group Name');
    expect(vm.kind).toBe('group');
    expect(vm.resolved).toBe(false);
  });

  it('group missing AND channel.title missing → unknown_group_template', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 2, channel_id: '2222' }),
    });
    expect(vm.title).toBe('Group #2222');
    expect(vm.resolved).toBe(false);
  });
});

describe('resolveConversationTitle — i18n override', () => {
  it('uses caller-provided strings for system / fallback labels', () => {
    const i18n: Partial<ConversationTitleI18n> = {
      system_notifications: '系统通知',
      unknown_user_template: (id) => `用户 #${id}`,
      unknown_group_template: (id) => `群 #${id}`,
    };
    expect(
      resolveConversationTitle({
        channel: ch({ channel_type: 1, title: '1' }),
        i18n,
      }).title,
    ).toBe('系统通知');

    expect(
      resolveConversationTitle({
        channel: ch({ channel_type: 1, channel_id: '7' }),
        i18n,
      }).title,
    ).toBe('用户 #7');

    expect(
      resolveConversationTitle({
        channel: ch({ channel_type: 2, channel_id: '88' }),
        i18n,
      }).title,
    ).toBe('群 #88');
  });
});

describe('resolveConversationTitle — unknown channel_type', () => {
  it('renders raw channel_id as fallback', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 9, channel_id: '5555' }),
    });
    expect(vm.kind).toBe('unknown');
    expect(vm.title).toContain('5555');
  });
});

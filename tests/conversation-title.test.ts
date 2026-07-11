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
  isSystemUserType,
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

describe('isSystemUserType (P4.2 拍板: user_type===1, never uid)', () => {
  it('accepts only USER_TYPE_SYSTEM', () => {
    expect(isSystemUserType(1)).toBe(true);
    expect(isSystemUserType(0)).toBe(false);
    expect(isSystemUserType(2)).toBe(false); // bot
    expect(isSystemUserType(undefined)).toBe(false);
    expect(isSystemUserType(null)).toBe(false);
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

  it('peerUid alone never classifies system (P4.2 拍板: 判定按 user_type, 禁 uid)', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 1, title: '1' }),
      peerUid: '1',
    });
    expect(vm.kind).not.toBe('system');
    expect(vm.title).toBe('User #1');
  });

  it('channel.title that is a bare uid does not classify system (uid is not identity)', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 1, title: '1' }),
    });
    expect(vm.kind).not.toBe('system');
  });

  it('user.user_type=1 classifies as system (P4.2 拍板: user_type 是权威判据)', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 1 }),
      user: u({ user_id: '500', user_type: 1, nickname: 'System Message' }),
    });
    expect(vm.kind).toBe('system');
    expect(vm.title).toBe('System Notifications');
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

  it('system (by user_type) still wins over alias (alias never overrides system label)', () => {
    const vm = resolveConversationTitle({
      channel: ch({ channel_type: 1, title: '1' }),
      user: u({ user_id: '1', user_type: 1, username: 'system', nickname: 'System Message' }),
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
        user: u({ user_id: '1', user_type: 1, username: 'system', nickname: 'System Message' }),
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

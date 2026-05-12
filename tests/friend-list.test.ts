// Pure-selector tests for the Contacts-tab list. No React, no SDK.

import { describe, expect, it } from 'vitest';
import type { FriendshipRecord, UserRecord } from '@privchat/sdk';
import {
  projectFriendList,
  projectFriendListItem,
  type FriendListItemVM,
} from '../src/index.js';

const f = (overrides: Partial<FriendshipRecord> = {}): FriendshipRecord => ({
  user_id: '500',
  alias: undefined,
  created_at: 0,
  updated_at: 0,
  sync_version: 1,
  ...overrides,
});

const u = (overrides: Partial<UserRecord> = {}): UserRecord => ({
  user_id: '500',
  username: 'wangwu',
  user_type: 0,
  is_friend: false,
  sync_version: 1,
  ...overrides,
});

describe('projectFriendListItem (R2.2)', () => {
  it('alias > nickname > username precedence', () => {
    const vm = projectFriendListItem(
      f({ alias: '老王' }),
      u({ nickname: '王五', username: 'wangwu' }),
    );
    expect(vm.title).toBe('老王');
    expect(vm.subtitle).toBe('@wangwu');
  });

  it('alias absent → falls through to nickname', () => {
    const vm = projectFriendListItem(
      f({ alias: undefined }),
      u({ nickname: '王五', username: 'wangwu' }),
    );
    expect(vm.title).toBe('王五');
    expect(vm.subtitle).toBe('@wangwu');
  });

  it('alias and nickname both absent → username', () => {
    const vm = projectFriendListItem(
      f({ alias: undefined }),
      u({ nickname: undefined, username: 'wangwu' }),
    );
    expect(vm.title).toBe('wangwu');
    // Subtitle is omitted when title IS the username — no double-render.
    expect(vm.subtitle).toBeUndefined();
  });

  it('user record missing entirely (race: friend sync landed first) — alias still wins', () => {
    const vm = projectFriendListItem(f({ alias: '老王' }), undefined);
    expect(vm.title).toBe('老王');
    // No username known → no subtitle.
    expect(vm.subtitle).toBeUndefined();
    expect(vm.avatar_url).toBeUndefined();
  });

  it('user record missing AND no alias → fallback template', () => {
    const vm = projectFriendListItem(f({ user_id: '777', alias: undefined }), undefined);
    expect(vm.title).toBe('User #777');
    expect(vm.subtitle).toBeUndefined();
  });

  it('empty alias is treated as absent (cleared remark)', () => {
    const vm = projectFriendListItem(
      f({ alias: '' }),
      u({ nickname: '王五', username: 'wangwu' }),
    );
    expect(vm.title).toBe('王五');
  });

  it('subtitle suppressed when alias === username', () => {
    const vm = projectFriendListItem(
      f({ alias: 'wangwu' }),
      u({ username: 'wangwu' }),
    );
    expect(vm.title).toBe('wangwu');
    expect(vm.subtitle).toBeUndefined();
  });

  it('avatar_url passes through from user record (empty string normalised to undefined)', () => {
    expect(
      projectFriendListItem(f({}), u({ avatar_url: 'https://cdn/u.png' })).avatar_url,
    ).toBe('https://cdn/u.png');
    expect(projectFriendListItem(f({}), u({ avatar_url: '' })).avatar_url).toBeUndefined();
  });

  it('i18n override is honoured for fallback template', () => {
    const vm = projectFriendListItem(
      f({ user_id: '999', alias: undefined }),
      undefined,
      { unknown_user_template: (id) => `用户 #${id}` },
    );
    expect(vm.title).toBe('用户 #999');
  });
});

describe('projectFriendList sort (R2.2)', () => {
  it('sorts by title, deterministic across runs', () => {
    const friendships = [
      f({ user_id: '1', alias: 'Charlie' }),
      f({ user_id: '2', alias: 'Alice' }),
      f({ user_id: '3', alias: 'Bob' }),
    ];
    const users = new Map<string, UserRecord>();
    const out = projectFriendList(friendships, users);
    expect(out.map((v) => v.title)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('joins with users-by-uid map correctly even when ordering of inputs differs', () => {
    const friendships = [
      f({ user_id: '500', alias: '老王' }),
      f({ user_id: '600', alias: undefined }),
    ];
    const users = new Map<string, UserRecord>();
    users.set('600', u({ user_id: '600', username: 'bob', nickname: 'Bob' }));
    // 500's user not yet synced — should still produce a row using alias
    const out = projectFriendList(friendships, users);
    const ids = out.map((v) => v.user_id).sort();
    expect(ids).toEqual(['500', '600']);
    const wang = out.find((v: FriendListItemVM) => v.user_id === '500');
    expect(wang?.title).toBe('老王');
    expect(wang?.subtitle).toBeUndefined();
  });
});

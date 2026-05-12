import { describe, expect, it } from 'vitest';
import type { GroupRecord } from '@privchat/sdk';
import {
  projectGroupList,
  projectGroupListItem,
} from '../src/index.js';

const g = (overrides: Partial<GroupRecord> = {}): GroupRecord => ({
  group_id: '900',
  name: 'Engineering',
  member_count: 5,
  sync_version: 1,
  ...overrides,
});

describe('projectGroupListItem (R2.2)', () => {
  it('exposes channel_id === group_id (server invariant)', () => {
    const vm = projectGroupListItem(g({ group_id: '900' }));
    expect(vm.group_id).toBe('900');
    expect(vm.channel_id).toBe('900');
  });

  it('falls back to template when name is empty', () => {
    const vm = projectGroupListItem(g({ group_id: '777', name: '' }));
    expect(vm.title).toBe('Group #777');
  });

  it('honours i18n override', () => {
    const vm = projectGroupListItem(g({ group_id: '777', name: '' }), {
      unknown_group_template: (id) => `群 #${id}`,
    });
    expect(vm.title).toBe('群 #777');
  });

  it('member_count + avatar_url pass through', () => {
    const vm = projectGroupListItem(
      g({ member_count: 12, avatar_url: 'https://cdn/g.png' }),
    );
    expect(vm.member_count).toBe(12);
    expect(vm.avatar_url).toBe('https://cdn/g.png');
  });
});

describe('projectGroupList sort (R2.2)', () => {
  it('sorts by title alphabetically', () => {
    const out = projectGroupList([
      g({ group_id: '1', name: 'Charlie' }),
      g({ group_id: '2', name: 'Alice' }),
      g({ group_id: '3', name: 'Bob' }),
    ]);
    expect(out.map((v) => v.title)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('empty input yields empty list (not an error)', () => {
    expect(projectGroupList([])).toEqual([]);
  });
});

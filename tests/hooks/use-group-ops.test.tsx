// Contract tests for `useGroupOps` (R3.4 + F4).
//
// Six callbacks grouped in one hook covering the full group-member
// lifecycle: list / leave / add / remove / mute / unmute. Contract is
// the same per-method shape as `useChannelOps`:
//   - args forwarded verbatim
//   - referentially stable ops object
//   - failures propagate
//
// We don't test the higher-level "owner can manage, member cannot"
// permission gate — that's UI logic baked into `GroupInfoDialog`,
// not the hook. Server still enforces authoritatively, so the hook
// stays simple.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import type { GroupMemberListResponse } from '@privchat/sdk';
import { useGroupOps } from '../../src/index.js';
import { createMockAdapter } from '../helpers/mock-adapter.js';
import { renderHookWithAdapter } from '../helpers/render-with-provider.js';

afterEach(cleanup);

const emptyMembers: GroupMemberListResponse = { members: [], total: 0 };

describe('useGroupOps', () => {
  it('listMembers forwards groupId', async () => {
    const list = vi.fn().mockResolvedValue(emptyMembers);
    const adapter = createMockAdapter({ listGroupMembers: list });
    const { result } = renderHookWithAdapter(() => useGroupOps(), adapter);

    await act(async () => {
      await result.current.listMembers('900');
    });
    expect(list).toHaveBeenCalledWith('900');
  });

  it('listMembers returns the SDK response', async () => {
    const resp: GroupMemberListResponse = {
      members: [
        {
          user_id: 1,
          username: 'alice',
          nickname: 'Alice',
          role: 'owner',
          joined_at: 0,
          is_muted: false,
        },
      ],
      total: 1,
    };
    const adapter = createMockAdapter({
      listGroupMembers: vi.fn().mockResolvedValue(resp),
    });
    const { result } = renderHookWithAdapter(() => useGroupOps(), adapter);

    let out: GroupMemberListResponse | undefined;
    await act(async () => {
      out = await result.current.listMembers('1');
    });
    expect(out).toBe(resp);
  });

  it('leaveGroup forwards groupId', async () => {
    const leave = vi.fn().mockResolvedValue(true);
    const adapter = createMockAdapter({ leaveGroup: leave });
    const { result } = renderHookWithAdapter(() => useGroupOps(), adapter);

    await act(async () => {
      await result.current.leaveGroup('900');
    });
    expect(leave).toHaveBeenCalledWith('900');
  });

  it('addMember forwards (groupId, userId, role?)', async () => {
    const add = vi.fn().mockResolvedValue(true);
    const adapter = createMockAdapter({ addGroupMember: add });
    const { result } = renderHookWithAdapter(() => useGroupOps(), adapter);

    await act(async () => {
      await result.current.addMember('900', '101');
    });
    await act(async () => {
      await result.current.addMember('900', '102', 'admin');
    });

    expect(add.mock.calls).toEqual([
      ['900', '101', undefined],
      ['900', '102', 'admin'],
    ]);
  });

  it('removeMember forwards (groupId, userId)', async () => {
    const remove = vi.fn().mockResolvedValue(true);
    const adapter = createMockAdapter({ removeGroupMember: remove });
    const { result } = renderHookWithAdapter(() => useGroupOps(), adapter);

    await act(async () => {
      await result.current.removeMember('900', '101');
    });
    expect(remove).toHaveBeenCalledWith('900', '101');
  });

  it('muteMember forwards (groupId, userId, durationSeconds)', async () => {
    const mute = vi.fn().mockResolvedValue(true);
    const adapter = createMockAdapter({ muteGroupMember: mute });
    const { result } = renderHookWithAdapter(() => useGroupOps(), adapter);

    await act(async () => {
      await result.current.muteMember('900', '101', 0);
    });
    await act(async () => {
      await result.current.muteMember('900', '101', 3600);
    });
    expect(mute.mock.calls).toEqual([
      ['900', '101', 0],
      ['900', '101', 3600],
    ]);
  });

  it('unmuteMember forwards (groupId, userId)', async () => {
    const unmute = vi.fn().mockResolvedValue(true);
    const adapter = createMockAdapter({ unmuteGroupMember: unmute });
    const { result } = renderHookWithAdapter(() => useGroupOps(), adapter);

    await act(async () => {
      await result.current.unmuteMember('900', '101');
    });
    expect(unmute).toHaveBeenCalledWith('900', '101');
  });

  it('setMemberRole forwards (groupId, userId, role)', async () => {
    const setRole = vi.fn().mockResolvedValue({
      group_id: 900,
      user_id: 101,
      role: 'admin',
    });
    const adapter = createMockAdapter({ setGroupMemberRole: setRole });
    const { result } = renderHookWithAdapter(() => useGroupOps(), adapter);

    await act(async () => {
      await result.current.setMemberRole('900', '101', 'admin');
    });
    await act(async () => {
      await result.current.setMemberRole('900', '101', 'member');
    });
    expect(setRole.mock.calls).toEqual([
      ['900', '101', 'admin'],
      ['900', '101', 'member'],
    ]);
  });

  it('transferOwner forwards (groupId, newOwnerId)', async () => {
    const transfer = vi.fn().mockResolvedValue({
      group_id: 900,
      new_owner_id: 202,
    });
    const adapter = createMockAdapter({ transferGroupOwner: transfer });
    const { result } = renderHookWithAdapter(() => useGroupOps(), adapter);

    await act(async () => {
      await result.current.transferOwner('900', '202');
    });
    expect(transfer).toHaveBeenCalledWith('900', '202');
  });

  it('returns a referentially stable ops object across re-renders', () => {
    const adapter = createMockAdapter({
      listGroupMembers: vi.fn().mockResolvedValue(emptyMembers),
      leaveGroup: vi.fn().mockResolvedValue(true),
      addGroupMember: vi.fn().mockResolvedValue(true),
      removeGroupMember: vi.fn().mockResolvedValue(true),
      muteGroupMember: vi.fn().mockResolvedValue(true),
      unmuteGroupMember: vi.fn().mockResolvedValue(true),
      setGroupMemberRole: vi.fn().mockResolvedValue({
        group_id: 0,
        user_id: 0,
        role: 'admin',
      }),
      transferGroupOwner: vi.fn().mockResolvedValue({
        group_id: 0,
        new_owner_id: 0,
      }),
    });
    const { result, rerender } = renderHookWithAdapter(
      () => useGroupOps(),
      adapter,
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('propagates failures from each method', async () => {
    const err = new Error('not authorised');
    const adapter = createMockAdapter({
      listGroupMembers: vi.fn().mockRejectedValue(err),
      leaveGroup: vi.fn().mockRejectedValue(err),
      addGroupMember: vi.fn().mockRejectedValue(err),
      removeGroupMember: vi.fn().mockRejectedValue(err),
      muteGroupMember: vi.fn().mockRejectedValue(err),
      unmuteGroupMember: vi.fn().mockRejectedValue(err),
      setGroupMemberRole: vi.fn().mockRejectedValue(err),
      transferGroupOwner: vi.fn().mockRejectedValue(err),
    });
    const { result } = renderHookWithAdapter(() => useGroupOps(), adapter);

    await expect(result.current.listMembers('1')).rejects.toBe(err);
    await expect(result.current.leaveGroup('1')).rejects.toBe(err);
    await expect(result.current.addMember('1', '2')).rejects.toBe(err);
    await expect(result.current.removeMember('1', '2')).rejects.toBe(err);
    await expect(result.current.muteMember('1', '2', 0)).rejects.toBe(err);
    await expect(result.current.unmuteMember('1', '2')).rejects.toBe(err);
    await expect(result.current.setMemberRole('1', '2', 'admin')).rejects.toBe(
      err,
    );
    await expect(result.current.transferOwner('1', '2')).rejects.toBe(err);
  });
});

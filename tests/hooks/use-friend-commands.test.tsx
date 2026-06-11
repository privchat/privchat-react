// Contract tests for the R2.2 friend-command hooks: each callback
// forwards its arguments (with string→number uid coercion at the
// boundary) to the matching adapter method, and block/unblock derive the
// current uid from `sessionSnapshot()`.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import {
  useAccountSearch,
  useBlockUser,
  useFriendAccept,
  useFriendApply,
  useFriendPending,
  useRefreshFriendships,
  useRemoveFriend,
  useSetFriendAlias,
  useUnblockUser,
} from '../../src/index.js';
import { createMockAdapter } from '../helpers/mock-adapter.js';
import { renderHookWithAdapter } from '../helpers/render-with-provider.js';

afterEach(cleanup);

describe('friend command hooks forward to the adapter', () => {
  it('useAccountSearch forwards (query, page, pageSize)', async () => {
    const accountSearch = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const adapter = createMockAdapter({ accountSearch });
    const { result } = renderHookWithAdapter(() => useAccountSearch(), adapter);

    await act(async () => {
      await result.current('alice', 2, 50);
    });
    expect(accountSearch).toHaveBeenCalledWith('alice', 2, 50);
  });

  it('useFriendApply coerces the uid to number and forwards the message', async () => {
    const friendApply = vi.fn().mockResolvedValue({ success: true });
    const adapter = createMockAdapter({ friendApply });
    const { result } = renderHookWithAdapter(() => useFriendApply(), adapter);

    await act(async () => {
      await result.current('500', 'hi there', 'search', 'src-1');
    });
    expect(friendApply).toHaveBeenCalledWith(500, 'hi there', 'search', 'src-1');
  });

  it('useFriendAccept coerces the uid and forwards the greeting', async () => {
    const friendAccept = vi.fn().mockResolvedValue({ success: true });
    const adapter = createMockAdapter({ friendAccept });
    const { result } = renderHookWithAdapter(() => useFriendAccept(), adapter);

    await act(async () => {
      await result.current('500', 'welcome');
    });
    expect(friendAccept).toHaveBeenCalledWith(500, 'welcome');
  });

  it('useFriendPending forwards the call verbatim', async () => {
    const friendPending = vi.fn().mockResolvedValue({ items: [] });
    const adapter = createMockAdapter({ friendPending });
    const { result } = renderHookWithAdapter(() => useFriendPending(), adapter);

    await act(async () => {
      await result.current();
    });
    expect(friendPending).toHaveBeenCalledTimes(1);
  });

  it('useRefreshFriendships forwards the call verbatim', async () => {
    const refreshFriendships = vi.fn().mockResolvedValue(undefined);
    const adapter = createMockAdapter({ refreshFriendships });
    const { result } = renderHookWithAdapter(
      () => useRefreshFriendships(),
      adapter,
    );

    await act(async () => {
      await result.current();
    });
    expect(refreshFriendships).toHaveBeenCalledTimes(1);
  });

  it('useSetFriendAlias coerces the uid and forwards the alias', async () => {
    const setFriendAlias = vi.fn().mockResolvedValue(undefined);
    const adapter = createMockAdapter({ setFriendAlias });
    const { result } = renderHookWithAdapter(() => useSetFriendAlias(), adapter);

    await act(async () => {
      await result.current('500', '老王');
    });
    expect(setFriendAlias).toHaveBeenCalledWith(500, '老王');
  });

  it('useRemoveFriend coerces the uid', async () => {
    const removeFriend = vi.fn().mockResolvedValue(undefined);
    const adapter = createMockAdapter({ removeFriend });
    const { result } = renderHookWithAdapter(() => useRemoveFriend(), adapter);

    await act(async () => {
      await result.current('500');
    });
    expect(removeFriend).toHaveBeenCalledWith(500);
  });
});

describe('block / unblock derive the current uid from sessionSnapshot', () => {
  const snapshot = {
    user_id: '42',
    device_id: 'dev-1',
    connection_state: 'authenticated' as const,
    has_access_token: true,
    last_event_sequence_id: 0,
  };

  it('useBlockUser passes (me, target) as numbers', async () => {
    const blockUser = vi.fn().mockResolvedValue(undefined);
    const adapter = createMockAdapter({
      blockUser,
      sessionSnapshot: () => snapshot,
    });
    const { result } = renderHookWithAdapter(() => useBlockUser(), adapter);

    await act(async () => {
      await result.current('500');
    });
    expect(blockUser).toHaveBeenCalledWith(42, 500);
  });

  it('useUnblockUser passes (me, target) as numbers', async () => {
    const unblockUser = vi.fn().mockResolvedValue(undefined);
    const adapter = createMockAdapter({
      unblockUser,
      sessionSnapshot: () => snapshot,
    });
    const { result } = renderHookWithAdapter(() => useUnblockUser(), adapter);

    await act(async () => {
      await result.current('500');
    });
    expect(unblockUser).toHaveBeenCalledWith(42, 500);
  });

  it('useBlockUser rejects when not authenticated (no user_id)', async () => {
    const blockUser = vi.fn().mockResolvedValue(undefined);
    const adapter = createMockAdapter({
      blockUser,
      sessionSnapshot: () => ({ ...snapshot, user_id: undefined }),
    });
    const { result } = renderHookWithAdapter(() => useBlockUser(), adapter);

    await expect(
      act(async () => {
        await result.current('500');
      }),
    ).rejects.toThrow();
    expect(blockUser).not.toHaveBeenCalled();
  });
});

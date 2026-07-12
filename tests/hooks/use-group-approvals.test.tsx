// P6-3-4 useGroupApprovals contract: mount-refresh, optimistic drop on approve/reject
// success, pendingCount tracks items, terminal error surfaces.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, waitFor } from '@testing-library/react';
import type { GroupApprovalItem } from '@privchat/sdk';
import { useGroupApprovals } from '../../src/index.js';
import { createMockAdapter } from '../helpers/mock-adapter.js';
import { renderHookWithAdapter } from '../helpers/render-with-provider.js';

afterEach(cleanup);

const item = (id: string): GroupApprovalItem => ({
  request_id: id,
  user_id: 7,
  method: { QRCode: { qr_code_id: 'q' } },
  created_at: 0,
});

describe('useGroupApprovals', () => {
  it('refreshes on mount and exposes items + pendingCount', async () => {
    const groupApprovalList = vi
      .fn()
      .mockResolvedValue({ group_id: '9', requests: [item('a'), item('b')], total: 2 });
    const adapter = createMockAdapter({ groupApprovalList });
    const { result } = renderHookWithAdapter(() => useGroupApprovals('9'), adapter);

    await waitFor(() => expect(result.current.pendingCount).toBe(2));
    expect(groupApprovalList).toHaveBeenCalledWith('9');
    expect(result.current.error).toBe(false);
  });

  it('approve drops the row on success', async () => {
    const groupApprovalList = vi
      .fn()
      .mockResolvedValue({ group_id: '9', requests: [item('a'), item('b')], total: 2 });
    const groupApprovalHandle = vi.fn().mockResolvedValue({ success: true, request_id: 'a' });
    const adapter = createMockAdapter({ groupApprovalList, groupApprovalHandle });
    const { result } = renderHookWithAdapter(() => useGroupApprovals('9'), adapter);
    await waitFor(() => expect(result.current.pendingCount).toBe(2));

    await act(async () => {
      await result.current.approve('a');
    });
    expect(groupApprovalHandle).toHaveBeenCalledWith('a', true);
    expect(result.current.items.map((x) => x.request_id)).toEqual(['b']);
    expect(result.current.pendingCount).toBe(1);
  });

  it('reject keeps the row when server reports not-success', async () => {
    const groupApprovalList = vi
      .fn()
      .mockResolvedValue({ group_id: '9', requests: [item('a')], total: 1 });
    const groupApprovalHandle = vi.fn().mockResolvedValue({ success: false, request_id: 'a' });
    const adapter = createMockAdapter({ groupApprovalList, groupApprovalHandle });
    const { result } = renderHookWithAdapter(() => useGroupApprovals('9'), adapter);
    await waitFor(() => expect(result.current.pendingCount).toBe(1));

    await act(async () => {
      const ok = await result.current.reject('a', 'spam');
      expect(ok).toBe(false);
    });
    expect(groupApprovalHandle).toHaveBeenCalledWith('a', false, 'spam');
    expect(result.current.pendingCount).toBe(1);
  });

  it('surfaces terminal error when list fails', async () => {
    const groupApprovalList = vi.fn().mockRejectedValue(new Error('boom'));
    const adapter = createMockAdapter({ groupApprovalList });
    const { result } = renderHookWithAdapter(() => useGroupApprovals('9'), adapter);
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.pendingCount).toBe(0);
  });
});

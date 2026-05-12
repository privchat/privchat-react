// Contract tests for `useRevokeMessage` (R3.1).
//
// Revoke is a single-RPC affair from the React layer: the hook
// dispatches `adapter.revokeMessage(server_message_id, channel_id)`.
// The push-side absorb that flips `record.revoked = true` is SDK-
// internal and tested in the SDK suite — the React-level contract is
// just that we call the adapter with the right args, return the SDK
// response, and don't swallow errors.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { useRevokeMessage } from '../../src/index.js';
import { createMockAdapter } from '../helpers/mock-adapter.js';
import { renderHookWithAdapter } from '../helpers/render-with-provider.js';

afterEach(cleanup);

describe('useRevokeMessage', () => {
  it('forwards (server_message_id, channel_id) to adapter.revokeMessage', async () => {
    const revoke = vi.fn().mockResolvedValue(true);
    const adapter = createMockAdapter({ revokeMessage: revoke });
    const { result } = renderHookWithAdapter(() => useRevokeMessage(), adapter);

    await act(async () => {
      await result.current('s-9001', '42');
    });

    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('s-9001', '42');
  });

  it('returns the SDK response unchanged', async () => {
    const adapter = createMockAdapter({
      revokeMessage: vi.fn().mockResolvedValue(true),
    });
    const { result } = renderHookWithAdapter(() => useRevokeMessage(), adapter);

    let out: unknown;
    await act(async () => {
      out = await result.current('s-1', '1');
    });
    expect(out).toBe(true);
  });

  it('keeps a stable callback identity across re-renders', () => {
    const adapter = createMockAdapter({
      revokeMessage: vi.fn().mockResolvedValue(true),
    });
    const { result, rerender } = renderHookWithAdapter(
      () => useRevokeMessage(),
      adapter,
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('propagates server rejection (e.g. 24h window expired)', async () => {
    const err = new Error('rpc message/revoke failed: code=403 too old');
    const adapter = createMockAdapter({
      revokeMessage: vi.fn().mockRejectedValue(err),
    });
    const { result } = renderHookWithAdapter(() => useRevokeMessage(), adapter);

    await expect(result.current('s-1', '1')).rejects.toBe(err);
  });

  it('does not coalesce concurrent calls — every click hits the adapter', async () => {
    const revoke = vi.fn().mockResolvedValue(true);
    const adapter = createMockAdapter({ revokeMessage: revoke });
    const { result } = renderHookWithAdapter(() => useRevokeMessage(), adapter);

    await act(async () => {
      // Two distinct messages revoked in quick succession.
      await Promise.all([
        result.current('s-1', '1'),
        result.current('s-2', '1'),
      ]);
    });

    expect(revoke).toHaveBeenCalledTimes(2);
    expect(revoke.mock.calls).toEqual([
      ['s-1', '1'],
      ['s-2', '1'],
    ]);
  });
});

// Contract tests for `useChannelOps` (R3.3).
//
// Three pin/mute/hide callbacks grouped in one hook. Contract:
//   - Each callback forwards (channelId, value) to the matching
//     adapter method.
//   - The returned ops object is referentially stable across re-
//     renders so consumers can stash it in deps without churn.
//   - Failures propagate (UI shows the error).
//
// We do NOT test the local-cache mirror (`applyChannelFlags`) — that
// runs INSIDE the adapter (`DirectClientAdapter.pinChannel` etc) and
// belongs to the SDK / adapter-impl test suite. The hook just calls
// `adapter.pinChannel`; if a future adapter implementation forgets
// the cache mirror, that's an adapter bug, not a hook bug.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { useChannelOps } from '../../src/index.js';
import { createMockAdapter } from '../helpers/mock-adapter.js';
import { renderHookWithAdapter } from '../helpers/render-with-provider.js';

afterEach(cleanup);

describe('useChannelOps', () => {
  it('pinChannel forwards (channelId, pinned) to the adapter', async () => {
    const pin = vi.fn().mockResolvedValue(undefined);
    const adapter = createMockAdapter({ pinChannel: pin });
    const { result } = renderHookWithAdapter(() => useChannelOps(), adapter);

    await act(async () => {
      await result.current.pinChannel('42', true);
    });
    await act(async () => {
      await result.current.pinChannel('42', false);
    });

    expect(pin.mock.calls).toEqual([
      ['42', true],
      ['42', false],
    ]);
  });

  it('muteChannel forwards (channelId, muted) to the adapter', async () => {
    const mute = vi.fn().mockResolvedValue(undefined);
    const adapter = createMockAdapter({ muteChannel: mute });
    const { result } = renderHookWithAdapter(() => useChannelOps(), adapter);

    await act(async () => {
      await result.current.muteChannel('7', true);
    });
    expect(mute).toHaveBeenCalledWith('7', true);
  });

  it('hideChannel forwards (channelId) to the adapter', async () => {
    const hide = vi.fn().mockResolvedValue(undefined);
    const adapter = createMockAdapter({ hideChannel: hide });
    const { result } = renderHookWithAdapter(() => useChannelOps(), adapter);

    await act(async () => {
      await result.current.hideChannel('99');
    });
    expect(hide).toHaveBeenCalledWith('99');
  });

  it('returns a referentially stable ops object across re-renders', () => {
    const adapter = createMockAdapter({
      pinChannel: vi.fn().mockResolvedValue(undefined),
      muteChannel: vi.fn().mockResolvedValue(undefined),
      hideChannel: vi.fn().mockResolvedValue(undefined),
    });
    const { result, rerender } = renderHookWithAdapter(
      () => useChannelOps(),
      adapter,
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('propagates pin/mute/hide failures to the caller', async () => {
    const pinErr = new Error('pin failed');
    const muteErr = new Error('mute failed');
    const hideErr = new Error('hide failed');
    const adapter = createMockAdapter({
      pinChannel: vi.fn().mockRejectedValue(pinErr),
      muteChannel: vi.fn().mockRejectedValue(muteErr),
      hideChannel: vi.fn().mockRejectedValue(hideErr),
    });
    const { result } = renderHookWithAdapter(() => useChannelOps(), adapter);

    await expect(result.current.pinChannel('1', true)).rejects.toBe(pinErr);
    await expect(result.current.muteChannel('1', true)).rejects.toBe(muteErr);
    await expect(result.current.hideChannel('1')).rejects.toBe(hideErr);
  });
});

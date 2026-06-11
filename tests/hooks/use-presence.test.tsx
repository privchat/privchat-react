// Contract tests for `usePresence` (poll-based presence until a server
// push channel exists).
//
//   - fetches once on mount via `batchGetPresence([uid])` and exposes
//     the matching item
//   - polls every `refreshMs` while mounted; `refreshMs: 0` = one-shot
//   - invalid / empty uid → no RPC, returns undefined
//   - fetch failure is swallowed (header still renders) — hook keeps
//     the previous value
//   - unmount stops the interval (no further RPCs)

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, waitFor } from '@testing-library/react';
import { usePresence } from '../../src/index.js';
import { createMockAdapter } from '../helpers/mock-adapter.js';
import { renderHookWithAdapter } from '../helpers/render-with-provider.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const item = (user_id: number, is_online: boolean) => ({
  user_id,
  is_online,
  last_seen_at: 1_700_000_000_000,
  device_count: is_online ? 1 : 0,
  version: 1,
});

describe('usePresence', () => {
  it('fetches once on mount and exposes the matching item', async () => {
    const batch = vi.fn().mockResolvedValue({ items: [item(500, true)] });
    const adapter = createMockAdapter({ batchGetPresence: batch });

    const { result } = renderHookWithAdapter(
      () => usePresence('500', { refreshMs: 0 }),
      adapter,
    );

    await waitFor(() => expect(result.current?.is_online).toBe(true));
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch).toHaveBeenCalledWith([500]);
  });

  it('returns undefined (no RPC) for empty / invalid uid', async () => {
    const batch = vi.fn().mockResolvedValue({ items: [] });
    const adapter = createMockAdapter({ batchGetPresence: batch });

    const { result: empty } = renderHookWithAdapter(
      () => usePresence('', { refreshMs: 0 }),
      adapter,
    );
    const { result: bad } = renderHookWithAdapter(
      () => usePresence('not-a-uid', { refreshMs: 0 }),
      adapter,
    );

    // Give any (incorrect) fetch a chance to run.
    await act(async () => {});
    expect(empty.current).toBeUndefined();
    expect(bad.current).toBeUndefined();
    expect(batch).not.toHaveBeenCalled();
  });

  it('polls on the configured interval and stops after unmount', async () => {
    vi.useFakeTimers();
    const batch = vi.fn().mockResolvedValue({ items: [item(500, false)] });
    const adapter = createMockAdapter({ batchGetPresence: batch });

    const { unmount } = renderHookWithAdapter(
      () => usePresence('500', { refreshMs: 10_000 }),
      adapter,
    );
    expect(batch).toHaveBeenCalledTimes(1); // initial

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(batch).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(batch).toHaveBeenCalledTimes(3);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(batch).toHaveBeenCalledTimes(3); // interval cleared
  });

  it('swallows fetch failures and keeps the previous value', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const batch = vi
      .fn()
      .mockResolvedValueOnce({ items: [item(500, true)] })
      .mockRejectedValueOnce(new Error('directory down'));
    const adapter = createMockAdapter({ batchGetPresence: batch });

    const { result } = renderHookWithAdapter(
      () => usePresence('500', { refreshMs: 10_000 }),
      adapter,
    );
    await act(async () => {}); // initial fetch settles
    expect(result.current?.is_online).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000); // failing poll
    });
    expect(result.current?.is_online).toBe(true); // previous value retained
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

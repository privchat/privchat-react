// Contract tests for `useRetryMessage` / `useDiscardMessage` (A1).
//
// These are imperative recovery actions for outbox-managed sends. The
// hook contract is intentionally tiny — return a stable callback that
// forwards to the adapter — so the tests focus on:
//
//   - the SDK adapter is called with the right argument
//   - the same callback identity is preserved across re-renders
//     (callers stash it in deps; churning it would re-fire effects)
//   - errors are propagated to the caller (not swallowed)
//   - the SDK is consulted once per click (no implicit retry-on-retry
//     loops)
//
// We deliberately do NOT test:
//   - cache row mutation (SDK-internal; tested in SDK suite)
//   - flushOutbox semantics (SDK-internal)
//   - UI button states (covered by A1 component-level tests
//     elsewhere when we get to Playwright in C2)

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { useDiscardMessage, useRetryMessage } from '../../src/index.js';
import { createMockAdapter } from '../helpers/mock-adapter.js';
import { renderHookWithAdapter } from '../helpers/render-with-provider.js';

afterEach(cleanup);

describe('useRetryMessage', () => {
  it('forwards localMessageId to adapter.retryOutboxEntry', async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    const adapter = createMockAdapter({ retryOutboxEntry: retry });
    const { result } = renderHookWithAdapter(() => useRetryMessage(), adapter);

    await act(async () => {
      await result.current('local-123');
    });

    expect(retry).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledWith('local-123');
  });

  it('keeps a stable callback identity across re-renders', () => {
    const adapter = createMockAdapter({
      retryOutboxEntry: vi.fn().mockResolvedValue(undefined),
    });
    const { result, rerender } = renderHookWithAdapter(
      () => useRetryMessage(),
      adapter,
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('propagates SDK rejections to the caller (does not swallow)', async () => {
    const err = new Error('outbox row not found');
    const adapter = createMockAdapter({
      retryOutboxEntry: vi.fn().mockRejectedValue(err),
    });
    const { result } = renderHookWithAdapter(() => useRetryMessage(), adapter);

    await expect(result.current('missing')).rejects.toBe(err);
  });

  it('calls the adapter exactly once per click — no implicit re-arming', async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    const adapter = createMockAdapter({ retryOutboxEntry: retry });
    const { result } = renderHookWithAdapter(() => useRetryMessage(), adapter);

    await act(async () => {
      await result.current('A');
    });
    await act(async () => {
      await result.current('A');
    });

    expect(retry).toHaveBeenCalledTimes(2);
    expect(retry.mock.calls[0]).toEqual(['A']);
    expect(retry.mock.calls[1]).toEqual(['A']);
  });
});

describe('useDiscardMessage', () => {
  it('forwards to adapter.discardOutboxEntry', async () => {
    const discard = vi.fn().mockResolvedValue(undefined);
    const adapter = createMockAdapter({ discardOutboxEntry: discard });
    const { result } = renderHookWithAdapter(() => useDiscardMessage(), adapter);

    await act(async () => {
      await result.current('local-456');
    });

    expect(discard).toHaveBeenCalledTimes(1);
    expect(discard).toHaveBeenCalledWith('local-456');
  });

  it('propagates rejections', async () => {
    const err = new Error('not found');
    const adapter = createMockAdapter({
      discardOutboxEntry: vi.fn().mockRejectedValue(err),
    });
    const { result } = renderHookWithAdapter(
      () => useDiscardMessage(),
      adapter,
    );

    await expect(result.current('x')).rejects.toBe(err);
  });
});

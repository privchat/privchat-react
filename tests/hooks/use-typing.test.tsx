// Contract tests for `useTyping` (bi-directional typing indicator).
//
// Outbound: notify(text) throttles `is_typing=true`, fires `false` on
// empty text / idle timeout / unmount. Inbound: `typing_received` events
// for THIS channel flip `isPeerTyping`; explicit `false` or the
// `peerStopMs` safety timeout clears it. Mount subscribes the channel,
// unmount unsubscribes.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import type { SequencedSdkEvent } from '@privchat/sdk';
import { useTyping } from '../../src/index.js';
import { createMockAdapter } from '../helpers/mock-adapter.js';
import { renderHookWithAdapter } from '../helpers/render-with-provider.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const typingEvent = (
  channel_id: string,
  user_id: string,
  is_typing: boolean,
): SequencedSdkEvent => ({
  sequence_id: 1,
  timestamp_ms: 0,
  event: {
    type: 'typing_received',
    channel_id,
    channel_type: 1,
    user_id,
    is_typing,
    timestamp: 0,
  },
});

function adapterWithEventCapture(overrides: Record<string, unknown> = {}) {
  let emit: ((env: SequencedSdkEvent) => void) | null = null;
  const adapter = createMockAdapter({
    subscribeChannel: vi.fn().mockResolvedValue(undefined),
    unsubscribeChannel: vi.fn().mockResolvedValue(undefined),
    sendTyping: vi.fn().mockResolvedValue(undefined),
    observeEvents: (cb: (env: SequencedSdkEvent) => void) => {
      emit = cb;
      return () => {
        emit = null;
      };
    },
    ...overrides,
  });
  return { adapter, fire: (env: SequencedSdkEvent) => emit?.(env) };
}

describe('useTyping outbound', () => {
  it('notify with content sends is_typing=true once within the throttle window', async () => {
    vi.useFakeTimers();
    const sendTyping = vi.fn().mockResolvedValue(undefined);
    const { adapter } = adapterWithEventCapture({ sendTyping });
    const { result } = renderHookWithAdapter(
      () => useTyping('100', 1, { throttleMs: 2000, idleStopMs: 5000 }),
      adapter,
    );

    act(() => {
      result.current.notify('h');
      result.current.notify('he');
      result.current.notify('hel');
    });
    expect(sendTyping.mock.calls.filter(([, t]) => t === true)).toHaveLength(1);
    expect(sendTyping).toHaveBeenCalledWith('100', true, 1);
  });

  it('empty text after typing sends an explicit is_typing=false', async () => {
    vi.useFakeTimers();
    const sendTyping = vi.fn().mockResolvedValue(undefined);
    const { adapter } = adapterWithEventCapture({ sendTyping });
    const { result } = renderHookWithAdapter(() => useTyping('100', 1), adapter);

    act(() => {
      result.current.notify('hello');
    });
    act(() => {
      result.current.notify('   ');
    });
    expect(sendTyping).toHaveBeenLastCalledWith('100', false, 1);
  });

  it('idle timeout auto-fires is_typing=false', async () => {
    vi.useFakeTimers();
    const sendTyping = vi.fn().mockResolvedValue(undefined);
    const { adapter } = adapterWithEventCapture({ sendTyping });
    const { result } = renderHookWithAdapter(
      () => useTyping('100', 1, { idleStopMs: 5000 }),
      adapter,
    );

    act(() => {
      result.current.notify('hello');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(sendTyping).toHaveBeenLastCalledWith('100', false, 1);
  });

  it('unmount sends a final is_typing=false when we claimed true', async () => {
    const sendTyping = vi.fn().mockResolvedValue(undefined);
    const { adapter } = adapterWithEventCapture({ sendTyping });
    const { result, unmount } = renderHookWithAdapter(
      () => useTyping('100', 1),
      adapter,
    );

    act(() => {
      result.current.notify('hello');
    });
    unmount();
    expect(sendTyping).toHaveBeenLastCalledWith('100', false, 1);
  });
});

describe('useTyping inbound', () => {
  it('typing_received for this channel flips isPeerTyping + typingUserId', () => {
    const { adapter, fire } = adapterWithEventCapture();
    const { result } = renderHookWithAdapter(() => useTyping('100', 1), adapter);

    expect(result.current.isPeerTyping).toBe(false);
    act(() => {
      fire(typingEvent('100', '500', true));
    });
    expect(result.current.isPeerTyping).toBe(true);
    expect(result.current.typingUserId).toBe('500');

    act(() => {
      fire(typingEvent('100', '500', false));
    });
    expect(result.current.isPeerTyping).toBe(false);
  });

  it('events for OTHER channels are ignored', () => {
    const { adapter, fire } = adapterWithEventCapture();
    const { result } = renderHookWithAdapter(() => useTyping('100', 1), adapter);

    act(() => {
      fire(typingEvent('999', '500', true));
    });
    expect(result.current.isPeerTyping).toBe(false);
  });

  it('peerStopMs safety timeout clears a stale typing state', async () => {
    vi.useFakeTimers();
    const { adapter, fire } = adapterWithEventCapture();
    const { result } = renderHookWithAdapter(
      () => useTyping('100', 1, { peerStopMs: 6000 }),
      adapter,
    );

    act(() => {
      fire(typingEvent('100', '500', true));
    });
    expect(result.current.isPeerTyping).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(result.current.isPeerTyping).toBe(false);
  });
});

describe('useTyping subscription lifecycle', () => {
  it('subscribes on mount, unsubscribes on unmount', () => {
    const subscribeChannel = vi.fn().mockResolvedValue(undefined);
    const unsubscribeChannel = vi.fn().mockResolvedValue(undefined);
    const { adapter } = adapterWithEventCapture({
      subscribeChannel,
      unsubscribeChannel,
    });
    const { unmount } = renderHookWithAdapter(() => useTyping('100', 1), adapter);

    expect(subscribeChannel).toHaveBeenCalledWith('100', 1);
    unmount();
    expect(unsubscribeChannel).toHaveBeenCalledWith('100', 1);
  });
});

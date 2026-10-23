import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { useGroupProjectionRefresh, type PrivchatClientAdapter } from '../../src/index.js';
import { createMockAdapter } from '../helpers/mock-adapter.js';
import { renderHookWithAdapter } from '../helpers/render-with-provider.js';

afterEach(() => { cleanup(); Reflect.deleteProperty(document, 'visibilityState'); vi.useRealTimers(); });

it('refreshes on entry, matching hint, resume, and missed-push reconciliation; cleans up', async () => {
  vi.useFakeTimers();
  const listeners = new Set<Parameters<PrivchatClientAdapter['observeEvents']>[0]>();
  const adapter = createMockAdapter({ observeEvents: cb => { listeners.add(cb); return () => { listeners.delete(cb); }; } });
  const refresh = vi.fn().mockResolvedValue(undefined);
  const { unmount } = renderHookWithAdapter(() => useGroupProjectionRefresh('900', 'pinned_messages_changed', refresh), adapter);
  await act(async () => {});
  expect(refresh).toHaveBeenCalledTimes(1);
  const emit = (channel: string) => {
    for (const cb of listeners) cb({ sequence_id: 1, timestamp_ms: 1, event: { type: 'channel_publish_received', channel_id: channel,
      topic: 'pinned_messages_changed', payload_text: '{}', publisher: '', timestamp: 1 } } as Parameters<typeof cb>[0]);
  };
  await act(async () => emit('901'));
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => emit('900'));
  expect(refresh).toHaveBeenCalledTimes(2);
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(refresh).toHaveBeenCalledTimes(3);
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(refresh).toHaveBeenCalledTimes(4);
  unmount();
  await act(async () => { emit('900'); await vi.advanceTimersByTimeAsync(30_000); });
  expect(refresh).toHaveBeenCalledTimes(4);
});

it('does not poll in the background and refreshes when the document resumes', async () => {
  vi.useFakeTimers();
  let visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  const refresh = vi.fn().mockResolvedValue(undefined);
  renderHookWithAdapter(() => useGroupProjectionRefresh('900', 'group_profile_changed', refresh), createMockAdapter());
  await act(async () => {});
  visibility = 'hidden';
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(90_000);
  });
  expect(refresh).toHaveBeenCalledTimes(1);
  visibility = 'visible';
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(refresh).toHaveBeenCalledTimes(2);
});

it('coalesces hints during an in-flight read and cancels the pending rerun on unmount', async () => {
  const listeners = new Set<Parameters<PrivchatClientAdapter['observeEvents']>[0]>();
  const adapter = createMockAdapter({ observeEvents: cb => { listeners.add(cb); return () => { listeners.delete(cb); }; } });
  let resolve!: () => void;
  const refresh = vi.fn().mockImplementationOnce(() => new Promise<void>(r => { resolve = r; }))
    .mockResolvedValue(undefined);
  const { unmount } = renderHookWithAdapter(() => useGroupProjectionRefresh('900', 'group_profile_changed', refresh), adapter);
  const reconnect = () => {
    for (const cb of listeners) cb({ event: { type: 'connection_state_changed' } } as Parameters<typeof cb>[0]);
  };
  await act(async () => { reconnect(); reconnect(); reconnect(); });
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(); });
  expect(refresh).toHaveBeenCalledTimes(2);
  unmount();
  expect(listeners.size).toBe(0);

  const pending = vi.fn().mockImplementation(() => new Promise<void>(r => { resolve = r; }));
  const mounted = renderHookWithAdapter(() => useGroupProjectionRefresh('900', 'group_profile_changed', pending), adapter);
  await act(async () => reconnect());
  mounted.unmount();
  await act(async () => { resolve(); });
  expect(pending).toHaveBeenCalledTimes(1);
});

it('uses the latest callback, retries after failure, and skips inactive pages', async () => {
  vi.useFakeTimers();
  const first = vi.fn().mockRejectedValue(new Error('offline'));
  const next = vi.fn().mockResolvedValue(undefined);
  const { rerender } = renderHookWithAdapter(
    ({ channel, refresh }: { channel: string | undefined; refresh: () => Promise<void> }) =>
      useGroupProjectionRefresh(channel, 'pinned_messages_changed', refresh),
    createMockAdapter(), { channel: '900' as string | undefined, refresh: first },
  );
  await act(async () => {});
  rerender({ channel: '900', refresh: next });
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(first).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledTimes(1);
  rerender({ channel: undefined, refresh: next });
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(next).toHaveBeenCalledTimes(1);
});

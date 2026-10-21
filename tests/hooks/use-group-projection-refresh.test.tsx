import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { useGroupProjectionRefresh, type PrivchatClientAdapter } from '../../src/index.js';
import { createMockAdapter } from '../helpers/mock-adapter.js';
import { renderHookWithAdapter } from '../helpers/render-with-provider.js';

afterEach(() => { cleanup(); vi.useRealTimers(); });

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

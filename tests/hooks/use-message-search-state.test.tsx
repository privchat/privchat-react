// P5 unified SearchState contract (CLIENT_GLOBAL_STATE §17.6, cross-client):
//   - 400ms debounce, <2 chars skipped
//   - request-id guard drops stale in-flight responses
//   - keyset-cursor pagination appends
//   - terminal failure sets `error` (no silent "no results" lie)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, waitFor } from '@testing-library/react';
import { useMessageSearchState } from '../../src/index.js';
import { createMockAdapter } from '../helpers/mock-adapter.js';
import { renderHookWithAdapter } from '../helpers/render-with-provider.js';

afterEach(cleanup);

const hit = (id: number) => ({
  channel_id: '9',
  message_id: String(id),
  sender_user_id: '7',
  created_at: 1000 + id,
  message_type: 1,
  snippet: `hit-${id}`,
  highlight_ranges: [[0, 3]] as Array<[number, number]>,
});

describe('useMessageSearchState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces, skips short queries, resolves hits + cursor', async () => {
    const search = vi
      .fn()
      .mockResolvedValue({ hits: [hit(1), hit(2)], next_cursor: 'c1' });
    const adapter = createMockAdapter({ messageHistorySearch: search });
    const { result } = renderHookWithAdapter(() => useMessageSearchState(), adapter);

    act(() => result.current.setQuery('a')); // <2 chars
    act(() => vi.advanceTimersByTime(500));
    expect(search).not.toHaveBeenCalled();
    expect(result.current.searching).toBe(false);

    act(() => result.current.setQuery('abc'));
    expect(result.current.searching).toBe(true);
    act(() => vi.advanceTimersByTime(399));
    expect(search).not.toHaveBeenCalled(); // debounce 未到
    act(() => vi.advanceTimersByTime(1));
    expect(search).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
    await waitFor(() => expect(result.current.searched).toBe(true));
    expect(result.current.hits).toHaveLength(2);
    expect(result.current.nextCursor).toBe('c1');
    expect(result.current.error).toBe(false);
  });

  it('drops stale in-flight responses when the query changes', async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    const search = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveFirst = res;
          }),
      )
      .mockResolvedValueOnce({ hits: [hit(9)], next_cursor: null });
    const adapter = createMockAdapter({ messageHistorySearch: search });
    const { result } = renderHookWithAdapter(() => useMessageSearchState(), adapter);

    act(() => result.current.setQuery('first'));
    act(() => vi.advanceTimersByTime(400)); // 第一发 in-flight
    act(() => result.current.setQuery('second'));
    act(() => vi.advanceTimersByTime(400)); // 第二发

    vi.useRealTimers();
    // 旧响应此刻才回来 → 必须被丢弃
    await act(async () => {
      resolveFirst({ hits: [hit(1), hit(2), hit(3)], next_cursor: 'stale' });
    });
    await waitFor(() => expect(result.current.searched).toBe(true));
    expect(result.current.hits.map((h) => h.snippet)).toEqual(['hit-9']);
    expect(result.current.nextCursor).toBeNull();
  });

  it('loadMore appends with the cursor', async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({ hits: [hit(1)], next_cursor: 'c1' })
      .mockResolvedValueOnce({ hits: [hit(2)], next_cursor: null });
    const adapter = createMockAdapter({ messageHistorySearch: search });
    const { result } = renderHookWithAdapter(() => useMessageSearchState(), adapter);

    act(() => result.current.setQuery('abc'));
    act(() => vi.advanceTimersByTime(400));
    vi.useRealTimers();
    await waitFor(() => expect(result.current.searched).toBe(true));

    await act(async () => {
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.hits).toHaveLength(2));
    expect(search.mock.calls[1]?.[1]).toMatchObject({ cursor: 'c1' });
    expect(result.current.nextCursor).toBeNull();
  });

  it('terminal failure surfaces error instead of a silent empty result', async () => {
    const search = vi.fn().mockRejectedValue(new Error('boom'));
    const adapter = createMockAdapter({ messageHistorySearch: search });
    const { result } = renderHookWithAdapter(() => useMessageSearchState(), adapter);

    act(() => result.current.setQuery('abc'));
    act(() => vi.advanceTimersByTime(400));
    vi.useRealTimers();
    await waitFor(() => expect(result.current.searched).toBe(true));
    expect(result.current.error).toBe(true);
    expect(result.current.hits).toHaveLength(0);
  });
});

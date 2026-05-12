// Contract tests for `useMessageReactions` (R3.6).
//
// This hook owns more state than the imperative ones — initial fetch
// on mount, refetch after add/remove, race protection for re-targets.
// We test the OBSERVABLE behaviour, not the implementation:
//
//   - On mount with a defined `serverMessageId`, it calls
//     `listReactions` and exposes the result via `reactions`.
//   - With `serverMessageId === undefined`, it short-circuits (no
//     RPC, empty `reactions`).
//   - `add` / `remove` call the corresponding RPCs THEN refetch.
//   - Errors during fetch surface via `error`.
//   - Add / remove with no message id are no-ops (don't call RPC).
//   - Re-targeting the message id refetches.
//
// We deliberately do NOT test:
//   - That fetch races are dropped via reqId — that's an
//     implementation detail; the public guarantee is "the most
//     recent serverMessageId wins", which we exercise via
//     re-targeting + waitFor.
//   - Realtime sync — explicitly out of scope for the hook.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, waitFor } from '@testing-library/react';
import { useMessageReactions } from '../../src/index.js';
import { createMockAdapter } from '../helpers/mock-adapter.js';
import { renderHookWithAdapter } from '../helpers/render-with-provider.js';

afterEach(cleanup);

describe('useMessageReactions', () => {
  it('fetches reactions on mount when serverMessageId is set', async () => {
    const list = vi.fn().mockResolvedValue({
      reactions: { '👍': [101, 102] },
      total_count: 2,
    });
    const adapter = createMockAdapter({ listReactions: list });
    const { result } = renderHookWithAdapter(
      () => useMessageReactions('s-1'),
      adapter,
    );

    await waitFor(() => {
      expect(result.current.reactions).toEqual({ '👍': [101, 102] });
    });
    expect(list).toHaveBeenCalledWith('s-1');
  });

  it('returns empty reactions and skips RPC when serverMessageId is undefined', async () => {
    const list = vi.fn();
    const adapter = createMockAdapter({ listReactions: list });
    const { result } = renderHookWithAdapter(
      () => useMessageReactions(undefined),
      adapter,
    );
    expect(result.current.reactions).toEqual({});
    // Short-circuit happens synchronously; `listReactions` is never
    // called. Wait one tick to be sure.
    await new Promise((r) => setTimeout(r, 0));
    expect(list).not.toHaveBeenCalled();
  });

  it('add() calls addReaction then refetches', async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const list = vi
      .fn()
      .mockResolvedValueOnce({ reactions: {}, total_count: 0 })
      .mockResolvedValueOnce({ reactions: { '❤️': [101] }, total_count: 1 });
    const adapter = createMockAdapter({ addReaction: add, listReactions: list });

    const { result } = renderHookWithAdapter(
      () => useMessageReactions('s-1'),
      adapter,
    );
    await waitFor(() => expect(result.current.reactions).toEqual({}));

    await act(async () => {
      await result.current.add('❤️');
    });

    expect(add).toHaveBeenCalledWith('s-1', '❤️');
    // Initial mount fetch + post-add refetch.
    expect(list).toHaveBeenCalledTimes(2);
    expect(result.current.reactions).toEqual({ '❤️': [101] });
  });

  it('remove() calls removeReaction then refetches', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const list = vi
      .fn()
      .mockResolvedValueOnce({ reactions: { '👍': [101] }, total_count: 1 })
      .mockResolvedValueOnce({ reactions: {}, total_count: 0 });
    const adapter = createMockAdapter({
      removeReaction: remove,
      listReactions: list,
    });

    const { result } = renderHookWithAdapter(
      () => useMessageReactions('s-1'),
      adapter,
    );
    await waitFor(() =>
      expect(result.current.reactions).toEqual({ '👍': [101] }),
    );

    await act(async () => {
      await result.current.remove('👍');
    });

    expect(remove).toHaveBeenCalledWith('s-1', '👍');
    expect(result.current.reactions).toEqual({});
  });

  it('add()/remove() are no-ops when serverMessageId is undefined', async () => {
    const add = vi.fn();
    const remove = vi.fn();
    const list = vi.fn();
    const adapter = createMockAdapter({
      addReaction: add,
      removeReaction: remove,
      listReactions: list,
    });

    const { result } = renderHookWithAdapter(
      () => useMessageReactions(undefined),
      adapter,
    );

    await act(async () => {
      await result.current.add('👍');
      await result.current.remove('👍');
    });

    expect(add).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it('surfaces fetch errors via `error` (does not throw at render time)', async () => {
    const err = new Error('rpc message/reaction/list failed');
    const adapter = createMockAdapter({
      listReactions: vi.fn().mockRejectedValue(err),
    });

    const { result } = renderHookWithAdapter(
      () => useMessageReactions('s-1'),
      adapter,
    );
    await waitFor(() => expect(result.current.error).toBe(err));
    // Even after error, the reactions map remains an empty object —
    // not undefined — so consumers can iterate safely.
    expect(result.current.reactions).toEqual({});
  });

  it('refetches when serverMessageId changes', async () => {
    const list = vi.fn(async (id: string) => ({
      reactions: { '👍': [Number(id.replace('s-', ''))] },
      total_count: 1,
    }));
    const adapter = createMockAdapter({ listReactions: list });

    const { result, rerender } = renderHookWithAdapter(
      ({ id }: { id: string }) => useMessageReactions(id),
      adapter,
      { id: 's-1' },
    );

    await waitFor(() =>
      expect(result.current.reactions).toEqual({ '👍': [1] }),
    );

    rerender({ id: 's-2' });
    await waitFor(() =>
      expect(result.current.reactions).toEqual({ '👍': [2] }),
    );
    expect(list).toHaveBeenCalledTimes(2);
  });
});

// Contract tests for `useSendImage` (F1 + A2).
//
// The hook is a thin pass-through to `adapter.sendImage`, but the
// "thin" part hides several invariants we want to keep:
//
//   - The full args object (channel_id/type, blob, filename, mime,
//     dims, caption, onProgress) is forwarded verbatim — the
//     adapter does the real upload + send orchestration internally,
//     so any field dropped here would silently break uploads.
//   - The promise resolves with the SDK's `SendTextOperationResult`
//     unchanged ('sent' inline ACK vs 'queued' offline outbox).
//   - Failures from the upload OR the subsequent send must propagate;
//     swallowing would leave the user with a phantom "uploaded but
//     not delivered" message.
//   - `onProgress` callbacks fire from the adapter side; the hook
//     never wraps or filters them.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import type { SendTextOperationResult } from '@privchat/sdk';
import { useSendImage } from '../../src/index.js';
import { createMockAdapter } from '../helpers/mock-adapter.js';
import { renderHookWithAdapter } from '../helpers/render-with-provider.js';

afterEach(cleanup);

const okResult: SendTextOperationResult = {
  status: 'sent',
  local_message_id: 'local-1',
  // Cast: the test only inspects `status` + `local_message_id`; the
  // full `response` shape is SDK-internal.
  response: {} as SendTextOperationResult extends { response: infer R }
    ? R
    : never,
};

function blob(size = 100): Blob {
  return new Blob([new Uint8Array(size)], { type: 'image/png' });
}

describe('useSendImage', () => {
  it('forwards all args verbatim to adapter.sendImage', async () => {
    const sendImage = vi.fn().mockResolvedValue(okResult);
    const adapter = createMockAdapter({ sendImage });
    const { result } = renderHookWithAdapter(() => useSendImage(), adapter);

    const file = blob(2048);
    const onProgress = vi.fn();

    await act(async () => {
      await result.current({
        channel_id: '42',
        channel_type: 1,
        file,
        filename: 'photo.png',
        mime_type: 'image/png',
        width: 800,
        height: 600,
        caption: 'hi',
        onProgress,
      });
    });

    expect(sendImage).toHaveBeenCalledTimes(1);
    expect(sendImage).toHaveBeenCalledWith({
      channel_id: '42',
      channel_type: 1,
      file,
      filename: 'photo.png',
      mime_type: 'image/png',
      width: 800,
      height: 600,
      caption: 'hi',
      onProgress,
    });
  });

  it('returns the SDK result unchanged', async () => {
    const sendImage = vi.fn().mockResolvedValue(okResult);
    const adapter = createMockAdapter({ sendImage });
    const { result } = renderHookWithAdapter(() => useSendImage(), adapter);

    let out: SendTextOperationResult | undefined;
    await act(async () => {
      out = await result.current({
        channel_id: '1',
        channel_type: 1,
        file: blob(),
        filename: 'x.png',
        mime_type: 'image/png',
        width: 1,
        height: 1,
      });
    });
    expect(out).toBe(okResult);
  });

  it('keeps a stable callback identity across re-renders', () => {
    const adapter = createMockAdapter({
      sendImage: vi.fn().mockResolvedValue(okResult),
    });
    const { result, rerender } = renderHookWithAdapter(
      () => useSendImage(),
      adapter,
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('propagates upload / send failures (does not swallow)', async () => {
    const err = new Error('upload network error');
    const adapter = createMockAdapter({
      sendImage: vi.fn().mockRejectedValue(err),
    });
    const { result } = renderHookWithAdapter(() => useSendImage(), adapter);

    await expect(
      result.current({
        channel_id: '1',
        channel_type: 1,
        file: blob(),
        filename: 'x.png',
        mime_type: 'image/png',
        width: 1,
        height: 1,
      }),
    ).rejects.toBe(err);
  });

  it('passes onProgress through so adapter can fire callbacks during upload', async () => {
    // Capture the `onProgress` argument and synthesise progress events
    // to verify the hook doesn't intercept / wrap them.
    let captured: ((e: { loaded: number; total: number; percent?: number }) => void) | undefined;
    const sendImage = vi.fn().mockImplementation(async (args) => {
      captured = args.onProgress;
      // Simulate adapter firing two progress events before resolving.
      captured?.({ loaded: 50, total: 100, percent: 50 });
      captured?.({ loaded: 100, total: 100, percent: 100 });
      return okResult;
    });
    const adapter = createMockAdapter({ sendImage });
    const { result } = renderHookWithAdapter(() => useSendImage(), adapter);

    const onProgress = vi.fn();
    await act(async () => {
      await result.current({
        channel_id: '1',
        channel_type: 1,
        file: blob(),
        filename: 'x.png',
        mime_type: 'image/png',
        width: 1,
        height: 1,
        onProgress,
      });
    });

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, {
      loaded: 50,
      total: 100,
      percent: 50,
    });
    expect(onProgress).toHaveBeenNthCalledWith(2, {
      loaded: 100,
      total: 100,
      percent: 100,
    });
  });
});

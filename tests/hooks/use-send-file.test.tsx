// Contract tests for `useSendFile` (F1 + A2).
//
// File send shares the upload/send orchestration with `useSendImage`
// but skips the dimension probe (file kind, not image). Same contract
// rules apply: forward args verbatim, propagate failures, keep stable
// callback identity, plumb onProgress.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import type { SendTextOperationResult } from '@privchat/sdk';
import { useSendFile } from '../../src/index.js';
import { createMockAdapter } from '../helpers/mock-adapter.js';
import { renderHookWithAdapter } from '../helpers/render-with-provider.js';

afterEach(cleanup);

const okResult: SendTextOperationResult = {
  status: 'sent',
  local_message_id: 'local-1',
  response: {} as SendTextOperationResult extends { response: infer R }
    ? R
    : never,
};

function blob(size = 100, type = 'application/octet-stream'): Blob {
  return new Blob([new Uint8Array(size)], { type });
}

describe('useSendFile', () => {
  it('forwards all args verbatim to adapter.sendFile', async () => {
    const sendFile = vi.fn().mockResolvedValue(okResult);
    const adapter = createMockAdapter({ sendFile });
    const { result } = renderHookWithAdapter(() => useSendFile(), adapter);

    const file = blob(4096, 'application/pdf');
    const onProgress = vi.fn();

    await act(async () => {
      await result.current({
        channel_id: '7',
        channel_type: 2,
        file,
        filename: 'spec.pdf',
        mime_type: 'application/pdf',
        caption: 'see attached',
        onProgress,
      });
    });

    expect(sendFile).toHaveBeenCalledTimes(1);
    expect(sendFile).toHaveBeenCalledWith({
      channel_id: '7',
      channel_type: 2,
      file,
      filename: 'spec.pdf',
      mime_type: 'application/pdf',
      caption: 'see attached',
      onProgress,
    });
  });

  it('returns the SDK result unchanged', async () => {
    const adapter = createMockAdapter({
      sendFile: vi.fn().mockResolvedValue(okResult),
    });
    const { result } = renderHookWithAdapter(() => useSendFile(), adapter);

    let out: SendTextOperationResult | undefined;
    await act(async () => {
      out = await result.current({
        channel_id: '1',
        channel_type: 1,
        file: blob(),
        filename: 'x.bin',
        mime_type: 'application/octet-stream',
      });
    });
    expect(out).toBe(okResult);
  });

  it('keeps a stable callback identity across re-renders', () => {
    const adapter = createMockAdapter({
      sendFile: vi.fn().mockResolvedValue(okResult),
    });
    const { result, rerender } = renderHookWithAdapter(
      () => useSendFile(),
      adapter,
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('propagates upload / send failures', async () => {
    const err = new Error('upload rejected: code=413 file too large');
    const adapter = createMockAdapter({
      sendFile: vi.fn().mockRejectedValue(err),
    });
    const { result } = renderHookWithAdapter(() => useSendFile(), adapter);

    await expect(
      result.current({
        channel_id: '1',
        channel_type: 1,
        file: blob(),
        filename: 'huge.zip',
        mime_type: 'application/zip',
      }),
    ).rejects.toBe(err);
  });

  it('plumbs onProgress callback through to the adapter', async () => {
    const sendFile = vi.fn().mockImplementation(async (args) => {
      args.onProgress?.({ loaded: 25, total: 100, percent: 25 });
      args.onProgress?.({ loaded: 100, total: 100, percent: 100 });
      return okResult;
    });
    const adapter = createMockAdapter({ sendFile });
    const { result } = renderHookWithAdapter(() => useSendFile(), adapter);

    const onProgress = vi.fn();
    await act(async () => {
      await result.current({
        channel_id: '1',
        channel_type: 1,
        file: blob(),
        filename: 'x.bin',
        mime_type: 'application/octet-stream',
        onProgress,
      });
    });
    expect(onProgress).toHaveBeenCalledTimes(2);
  });
});

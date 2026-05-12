// Imperative hooks for sending image / file messages. Each runs the
// full upload flow (token + multipart POST + send) inside the SDK
// adapter, so callers just hand over the Blob + a few hints. The
// returned promise resolves with the same `SendTextOperationResult`
// shape as text sends — branch on `status === 'sent' | 'queued'`
// upstream.

import { useCallback } from 'react';
import type {
  SendTextOperationResult,
  UploadProgressEvent,
} from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';

export interface SendImageArgs {
  channel_id: string;
  channel_type: number;
  file: Blob;
  filename: string;
  mime_type: string;
  width: number;
  height: number;
  caption?: string;
  onProgress?: (event: UploadProgressEvent) => void;
}

export interface SendFileArgs {
  channel_id: string;
  channel_type: number;
  file: Blob;
  filename: string;
  mime_type: string;
  caption?: string;
  onProgress?: (event: UploadProgressEvent) => void;
}

export function useSendImage(): (
  args: SendImageArgs,
) => Promise<SendTextOperationResult> {
  const adapter = usePrivchatClient();
  return useCallback((args) => adapter.sendImage(args), [adapter]);
}

export function useSendFile(): (
  args: SendFileArgs,
) => Promise<SendTextOperationResult> {
  const adapter = usePrivchatClient();
  return useCallback((args) => adapter.sendFile(args), [adapter]);
}

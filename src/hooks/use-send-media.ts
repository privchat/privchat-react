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

export interface SendVideoArgs {
  channel_id: string;
  channel_type: number;
  file: Blob;
  filename: string;
  mime_type: string;
  /** Best-effort dimensions; the upload response's probed dims win if
   *  the server supplied them. */
  width: number;
  height: number;
  /** Duration in seconds. The Web client typically reads this from the
   *  `<video>` element's `loadedmetadata` event before send. */
  duration: number;
  /** Optional pre-resolved poster URL. The Web client does NOT generate
   *  one (would require decoding + drawing a canvas frame pre-send) —
   *  receivers render without a poster when this is absent. */
  thumbnail_url?: string;
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

export function useSendVideo(): (
  args: SendVideoArgs,
) => Promise<SendTextOperationResult> {
  const adapter = usePrivchatClient();
  return useCallback((args) => adapter.sendVideo(args), [adapter]);
}

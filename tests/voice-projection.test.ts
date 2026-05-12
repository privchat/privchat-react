// Pure-resolver unit tests for voice metadata projection. The SDK
// stores message payloads as raw bytes; the VM layer is responsible
// for decoding `metadata` out of the JSON envelope and shaping it
// into `VoiceMetadataVM`. Tests cover well-formed records, the
// "duration missing" cross-version case, and reject paths
// (mismatched `type`, malformed JSON).
//
// No React, no SDK calls — just bytes-in / VM-out.

import { describe, expect, it } from 'vitest';
import type { MessageRecord } from '@privchat/sdk';
import { projectMessageRecord } from '../src/index.js';

const enc = (obj: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(obj));

const r = (overrides: Partial<MessageRecord> = {}): MessageRecord => ({
  server_message_id: 'sid-1',
  local_message_id: undefined,
  channel_id: '100',
  channel_type: 1,
  from_uid: '500',
  message_type: '1',
  content: '',
  payload: new Uint8Array(),
  status: 'received',
  timestamp: 0,
  pts: '1',
  revoked: false,
  ...overrides,
});

describe('voice metadata projection', () => {
  it('decodes a well-formed voice payload', () => {
    const vm = projectMessageRecord(
      r({
        payload: enc({
          metadata: {
            type: 'voice',
            file_id: 'f-abc',
            url: 'https://cdn/abc.m4a',
            duration: 8.4,
          },
        }),
      }),
      undefined,
      undefined,
    );
    expect(vm.content_type).toBe('voice');
    expect(vm.metadata).toEqual({
      type: 'voice',
      file_id: 'f-abc',
      url: 'https://cdn/abc.m4a',
      duration: 8.4,
    });
  });

  it('defaults duration to 0 when missing (cross-version SDK record)', () => {
    const vm = projectMessageRecord(
      r({
        payload: enc({
          metadata: {
            type: 'voice',
            file_id: 'f-abc',
          },
        }),
      }),
      undefined,
      undefined,
    );
    expect(vm.metadata).toEqual({
      type: 'voice',
      file_id: 'f-abc',
      url: undefined,
      duration: 0,
    });
  });

  it('returns undefined metadata when file_id is missing', () => {
    const vm = projectMessageRecord(
      r({
        payload: enc({ metadata: { type: 'voice', duration: 3 } }),
      }),
      undefined,
      undefined,
    );
    expect(vm.content_type).toBe('voice');
    expect(vm.metadata).toBeUndefined();
  });

  it('returns undefined metadata for malformed payload', () => {
    const vm = projectMessageRecord(
      r({ payload: new TextEncoder().encode('not-json') }),
      undefined,
      undefined,
    );
    expect(vm.content_type).toBe('voice');
    expect(vm.metadata).toBeUndefined();
  });

  it('returns undefined metadata for empty payload', () => {
    const vm = projectMessageRecord(r(), undefined, undefined);
    expect(vm.content_type).toBe('voice');
    expect(vm.metadata).toBeUndefined();
  });
});

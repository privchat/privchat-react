// Pure-resolver unit tests for `content_type` projection from a cache
// MessageRecord's `message_type` field.
//
// The cache legitimately stores `message_type` in TWO representations
// (both are tested/documented elsewhere):
//   - decimal-string of the FlatBuffers wire u32 ("0".."10") — produced
//     by the push / outbox / local-echo paths.
//   - word string ("text" / "image" / "system" / ...) — produced by the
//     server-JSON paths (message/history/get and sync/get_difference,
//     which emit `MessageType::as_str()`).
//
// The VM projection must decode BOTH into the same `ContentTypeName`,
// otherwise history/sync-loaded rows render as "unsupported".
//
// No React, no SDK calls — just record-in / VM-out.

import { describe, expect, it } from 'vitest';
import type { MessageRecord } from '@privchat/sdk';
import { projectMessageRecord } from '../src/index.js';

const r = (message_type: string): MessageRecord => ({
  server_message_id: 'sid-1',
  local_message_id: undefined,
  channel_id: '100',
  channel_type: 1,
  from_uid: '500',
  message_type,
  content: 'hello',
  payload: new Uint8Array(),
  status: 'received',
  timestamp: 0,
  pts: '1',
  revoked: false,
});

const ct = (message_type: string) =>
  projectMessageRecord(r(message_type), undefined, undefined).content_type;

describe('content_type projection from decimal-string message_type', () => {
  it.each([
    ['0', 'text'],
    ['1', 'voice'],
    ['2', 'image'],
    ['3', 'video'],
    ['4', 'file'],
    ['5', 'system'],
    ['6', 'sticker'],
    ['7', 'contact_card'],
    ['8', 'location'],
    ['9', 'link'],
    ['10', 'forward'],
  ] as const)('decimal %s → %s', (raw, expected) => {
    expect(ct(raw)).toBe(expected);
  });
});

describe('content_type projection from word-string message_type', () => {
  // These are the strings the server emits via `MessageType::as_str()`
  // and what message/history/get + sync/get_difference store verbatim.
  it.each([
    'text',
    'voice',
    'image',
    'video',
    'file',
    'system',
    'sticker',
    'contact_card',
    'location',
    'link',
    'forward',
  ] as const)('word %s → %s', (word) => {
    expect(ct(word)).toBe(word);
  });
});

describe('content_type projection falls back to unknown', () => {
  it('returns unknown for an unrecognized tag', () => {
    expect(ct('999')).toBe('unknown');
    expect(ct('definitely-not-a-type')).toBe('unknown');
  });
});

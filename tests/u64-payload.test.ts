// u64 precision in payload-envelope decoding. Native senders (Rust /
// Kotlin) serialize reply_to_message_id and metadata ids as raw JSON u64
// numbers; 18-digit snowflakes round under plain JSON.parse, so the
// reply anchor would point at a non-existent message. The VM decoders
// parse losslessly — big ints arrive as strings with full digits.
//
// The id literal is spliced into raw JSON TEXT (JS cannot even represent
// it as a number — which is exactly the bug being defended against).

import { describe, expect, it } from 'vitest';
import type { MessageRecord } from '@privchat/sdk';
import { projectMessageRecord } from '../src/index.js';

const BIG_ID = '581782206540812288'; // 18 digits, > 2^53

const record = (payloadJson: string, message_type = 'text'): MessageRecord => ({
  server_message_id: 'sid-1',
  local_message_id: undefined,
  channel_id: '100',
  channel_type: 1,
  from_uid: '500',
  message_type,
  content: 'hi',
  payload: new TextEncoder().encode(payloadJson),
  status: 'received',
  timestamp: 0,
  pts: '1',
  revoked: false,
});

describe('u64 payload decoding', () => {
  it('reply_to_message_id as a raw JSON u64 keeps full precision', () => {
    const vm = projectMessageRecord(
      record(`{"content":"hi","reply_to_message_id":${BIG_ID}}`),
      undefined,
      undefined,
    );
    expect(vm.reply_to).toBe(BIG_ID); // exact — not rounded
  });

  it('sanity: plain JSON.parse WOULD round this id', () => {
    expect(String(JSON.parse(BIG_ID))).not.toBe(BIG_ID);
  });

  it('image metadata with a u64 file_id decodes with full precision', () => {
    const vm = projectMessageRecord(
      record(
        `{"content":"","metadata":{"type":"image","file_id":${BIG_ID},"width":4,"height":3}}`,
        'image',
      ),
      undefined,
      undefined,
    );
    // Lossless parse surfaces the big int as a string, which satisfies
    // the decoder's `typeof file_id === 'string'` guard with full digits.
    expect(vm.metadata).toMatchObject({ type: 'image', file_id: BIG_ID });
  });

  it('string-form reply_to_message_id still passes through verbatim', () => {
    const vm = projectMessageRecord(
      record(`{"content":"hi","reply_to_message_id":"${BIG_ID}"}`),
      undefined,
      undefined,
    );
    expect(vm.reply_to).toBe(BIG_ID);
  });
});

import { describe, expect, it } from 'vitest';
import type { MessageRecord } from '@privchat/sdk';
import { projectMessageRecord } from '../src/index.js';

const record = (content: string): MessageRecord => ({
  server_message_id: '1',
  channel_id: '2',
  channel_type: 1,
  from_uid: '3',
  message_type: 'text',
  content,
  payload: new Uint8Array(),
  status: 'received',
  timestamp: 1,
});

describe('message content projection', () => {
  it('never exposes a legacy protocol envelope as bubble text', () => {
    const content = JSON.stringify({
      content: '归一化后的正文',
      mentioned_user_ids: [],
      reply_to_message_id: '600997771041832960',
    });
    expect(projectMessageRecord(record(content), undefined, undefined).body.text).toBe(
      '归一化后的正文',
    );
  });
});

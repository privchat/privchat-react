import type { PrivchatClient } from '@privchat/sdk';
import { describe, expect, it, vi } from 'vitest';
import { DirectClientAdapter } from '../src/adapter/direct-adapter.js';

describe('DirectClientAdapter', () => {
  it('preserves a snowflake channel id when pinning', async () => {
    const channelPin = vi.fn().mockResolvedValue({ pinned: true });
    const applyChannelFlags = vi.fn();
    const client = { channelPin, applyChannelFlags } as unknown as PrivchatClient;
    const adapter = new DirectClientAdapter(client);
    const channelId = '9007199254740993';

    await adapter.pinChannel(channelId, true);

    expect(channelPin).toHaveBeenCalledWith(channelId, true);
    expect(applyChannelFlags).toHaveBeenCalledWith(channelId, { pinned: true });
  });
});

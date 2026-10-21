import { describe, expect, it } from 'vitest';
import { encodeMessagePayloadEnvelope } from '@privchat/sdk';
import type { MessageRecord } from '@privchat/sdk';
import { projectMessageRecord } from '../src/index.js';

describe('location protocol metadata is preserved in the view model', () => {
  it.each(['wgs84', 'gcj02', 'bd09', 'unknown-crs', undefined])('preserves %s without relabelling', crs => {
    const metadata = { type: 'location' as const, latitude: 0, longitude: 0, coordinate_system: crs,
      name: 'Place', address: 'Address', poi_id: 'abc', poi_source: 'amap', thumbnail_file_id: '9007199254740999' };
    const record: MessageRecord = {
      id: 'm1', server_message_id: '1', channel_id: '2', channel_type: 1, from_uid: '3',
      message_type: '8', content: '', status: 'received', timestamp: 1,
      payload: encodeMessagePayloadEnvelope({ content: '', metadata, mentioned_user_ids: [] }),
    };
    expect(projectMessageRecord(record, undefined, undefined).metadata).toEqual(metadata);
  });
});

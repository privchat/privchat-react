// parsePrivchatLink coverage (QR_CODE_SPEC v1.4):
// - v1.4 path-only is the canonical form
// - v1.3 ?qrkey= still parses (back-compat for in-flight QRs)
// - unknown entity/action degrades to `unsupported` (never crashes)
// - non-PrivChat URLs fall through to `not-privchat`
// - hard anti-patterns from §4.2 reject mode

import { describe, expect, it } from 'vitest';
import { parsePrivchatLink } from '../src/hooks/use-qrcode.js';

describe('parsePrivchatLink — v1.4 path-only', () => {
  it('user/get path-only', () => {
    expect(
      parsePrivchatLink('https://privchat.app/privchat:protocol/user/get/abc123'),
    ).toEqual({ kind: 'user-get', qrKey: 'abc123' });
  });

  it('group/join path-only', () => {
    expect(
      parsePrivchatLink('https://privchat.app/privchat:protocol/group/join/Zk9Pq3Rt'),
    ).toEqual({ kind: 'group-join', qrKey: 'Zk9Pq3Rt' });
  });

  it('preserves sub-path hosts', () => {
    expect(
      parsePrivchatLink(
        'https://example.com/tenant/qr/privchat:protocol/user/get/sub_K7sP',
      ),
    ).toEqual({ kind: 'user-get', qrKey: 'sub_K7sP' });
  });

  it('ignores extra query params (utm, ref, etc) — qr_key still from path', () => {
    expect(
      parsePrivchatLink(
        'https://privchat.app/privchat:protocol/user/get/path_key?utm_source=share&ref=a',
      ),
    ).toEqual({ kind: 'user-get', qrKey: 'path_key' });
  });
});

describe('parsePrivchatLink — v1.3 back-compat (?qrkey=)', () => {
  it('user/get with ?qrkey= still parses', () => {
    expect(
      parsePrivchatLink('https://privchat.app/privchat:protocol/user/get?qrkey=legacy123'),
    ).toEqual({ kind: 'user-get', qrKey: 'legacy123' });
  });

  it('group/join with ?qrkey= still parses', () => {
    expect(
      parsePrivchatLink(
        'https://privchat.app/privchat:protocol/group/join?qrkey=legacy_g',
      ),
    ).toEqual({ kind: 'group-join', qrKey: 'legacy_g' });
  });

  it('path-key wins over query-key when both present (forward-compat priority)', () => {
    expect(
      parsePrivchatLink(
        'https://privchat.app/privchat:protocol/user/get/path_wins?qrkey=query_loses',
      ),
    ).toEqual({ kind: 'user-get', qrKey: 'path_wins' });
  });
});

describe('parsePrivchatLink — degrade & reject', () => {
  it('unknown entity → unsupported', () => {
    const got = parsePrivchatLink(
      'https://privchat.app/privchat:protocol/bot/add/whatever',
    );
    expect(got).toEqual({
      kind: 'unsupported',
      entity: 'bot',
      action: 'add',
      qrKey: 'whatever',
    });
  });

  it('unknown action → unsupported', () => {
    const got = parsePrivchatLink(
      'https://privchat.app/privchat:protocol/user/edit/key',
    );
    expect(got).toEqual({
      kind: 'unsupported',
      entity: 'user',
      action: 'edit',
      qrKey: 'key',
    });
  });

  it('user/get with no qr_key (neither path nor query) → unsupported', () => {
    expect(
      parsePrivchatLink('https://privchat.app/privchat:protocol/user/get'),
    ).toEqual({
      kind: 'unsupported',
      entity: 'user',
      action: 'get',
      qrKey: null,
    });
  });

  it('non-privchat host with same path is still PrivChat (host-agnostic)', () => {
    expect(
      parsePrivchatLink('https://random.example/privchat:protocol/user/get/key'),
    ).toEqual({ kind: 'user-get', qrKey: 'key' });
  });

  it('plain http (dev) accepted', () => {
    expect(
      parsePrivchatLink('http://localhost:8080/privchat:protocol/user/get/k'),
    ).toEqual({ kind: 'user-get', qrKey: 'k' });
  });

  it('non-PrivChat URL → not-privchat', () => {
    expect(parsePrivchatLink('https://example.com/foo/bar')).toEqual({
      kind: 'not-privchat',
    });
  });

  it('garbled string → not-privchat (does not throw)', () => {
    expect(parsePrivchatLink('not a url')).toEqual({ kind: 'not-privchat' });
    expect(parsePrivchatLink('')).toEqual({ kind: 'not-privchat' });
  });

  it('legacy privchat:// custom scheme → not-privchat (spec §4.4 forbids)', () => {
    expect(parsePrivchatLink('privchat://user/get?qrkey=abc')).toEqual({
      kind: 'not-privchat',
    });
  });
});

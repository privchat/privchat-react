// useUserQrcode + useGroupQrcode + URL parser (QR_CODE_SPEC v1.3).
//
// Imperative-style hooks: each returns stable callbacks the caller
// invokes from a click handler / dialog open / scan event. No
// auto-fetch on mount — the dialogs decide when to call.
//
// Spec reference: privchat-docs/spec/02-server/QR_CODE_SPEC.md v1.3.

import { useCallback, useMemo } from 'react';
import { usePrivchatClient } from './use-privchat-client.js';

// =====================================================
// Hook surface
// =====================================================

export interface UserQrcodeOps {
  /** Read the current user's qr_key + URL. Server fills user_id from
   *  the auth context. */
  get: () => Promise<{ qr_key: string; qr_code: string; user_id: string }>;
  /** Rotate the current user's qr_key. */
  refresh: () => Promise<{
    old_qr_key: string;
    new_qr_key: string;
    qr_code: string;
    user_id: string;
  }>;
  /** Look up the user behind a scanned qrkey. */
  resolve: (qrKey: string) => Promise<{
    user_id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    user_type: number;
    is_friend: boolean;
    is_self: boolean;
  }>;
}

export interface GroupQrcodeOps {
  /** Read a group's qr_key + URL. Any member can call. */
  get: (groupId: string) => Promise<{
    qr_key: string;
    qr_code: string;
    group_id: string;
  }>;
  /** Rotate the group's qr_key. Owner/Admin only (server enforces). */
  refresh: (groupId: string) => Promise<{
    old_qr_key: string;
    new_qr_key: string;
    qr_code: string;
    group_id: string;
  }>;
  /** Submit a join-by-qr request — server reverse-looks-up the
   *  group_id from qrkey and runs the same approval flow as
   *  member/invite. Status is `'joined'` or `'pending'`. */
  joinByQrcode: (qrKey: string, message?: string) => Promise<{
    status: string;
    group_id: string;
    request_id?: string;
    message?: string;
    user_id?: string;
    joined_at?: number;
  }>;
}

export function useUserQrcode(): UserQrcodeOps {
  const adapter = usePrivchatClient();
  const get = useCallback(() => adapter.userQrcodeGet(), [adapter]);
  const refresh = useCallback(() => adapter.userQrcodeRefresh(), [adapter]);
  const resolve = useCallback(
    (qrKey: string) => adapter.userQrcodeResolve(qrKey),
    [adapter],
  );
  return useMemo(() => ({ get, refresh, resolve }), [get, refresh, resolve]);
}

export function useGroupQrcode(): GroupQrcodeOps {
  const adapter = usePrivchatClient();
  const get = useCallback((groupId: string) => adapter.groupQrcodeGet(groupId), [adapter]);
  const refresh = useCallback(
    (groupId: string) => adapter.groupQrcodeRefresh(groupId),
    [adapter],
  );
  const joinByQrcode = useCallback(
    (qrKey: string, message?: string) => adapter.groupJoinByQrcode(qrKey, message),
    [adapter],
  );
  return useMemo(
    () => ({ get, refresh, joinByQrcode }),
    [get, refresh, joinByQrcode],
  );
}

// =====================================================
// URL parser — sealed-enum style
// =====================================================
//
// Spec §4.2/§4.3: any client receiving a string MUST go through one
// central parser, NOT split / contains / host-match. This is the only
// place in privchat-react where the URL → action mapping is defined.

export type PrivchatProtocolLink =
  | { kind: 'user-get'; qrKey: string }
  | { kind: 'group-join'; qrKey: string }
  | { kind: 'unsupported'; entity: string; action: string; qrKey: string | null }
  | { kind: 'not-privchat' };

const PROTOCOL_MARKER = 'privchat:protocol';

/** Parse a raw string (URL, pasted text, scan result) into a sealed
 *  link variant. Rules (per spec):
 *  1. Must parse as URL with `http`/`https` scheme.
 *  2. `pathSegments[0]` must equal `"privchat:protocol"`.
 *  3. `(segments[1], segments[2])` decides the action.
 *  4. Only `qrkey` query param is read; other params are ignored.
 *  5. Anything else returns `not-privchat` or `unsupported` — never throws. */
export function parsePrivchatLink(raw: string): PrivchatProtocolLink {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { kind: 'not-privchat' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { kind: 'not-privchat' };
  }
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] !== PROTOCOL_MARKER) {
    return { kind: 'not-privchat' };
  }
  if (segments.length < 3) {
    return {
      kind: 'unsupported',
      entity: segments[1] ?? '',
      action: '',
      qrKey: url.searchParams.get('qrkey'),
    };
  }
  const entity = segments[1] ?? '';
  const action = segments[2] ?? '';
  const qrKey = url.searchParams.get('qrkey') ?? '';
  if (entity === 'user' && action === 'get' && qrKey !== '') {
    return { kind: 'user-get', qrKey };
  }
  if (entity === 'group' && action === 'join' && qrKey !== '') {
    return { kind: 'group-join', qrKey };
  }
  return {
    kind: 'unsupported',
    entity,
    action,
    qrKey: qrKey === '' ? null : qrKey,
  };
}

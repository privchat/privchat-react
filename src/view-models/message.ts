// MessageItemVM — UI projection of a cache MessageRecord. R1 covers text
// only; richer payloads (image/video/voice/contact card/file/link) are R2+
// and will live alongside this type, not replace it.
//
// The selector is a pure function so it can be tested in isolation and
// memoized cheaply. It does NOT decode FlatBuffers payloads — `record.content`
// already carries the display text for both inbound and locally-echoed rows.

import type { MessageRecord, MessageStatus, OutboxStatus } from '@privchat/sdk';
import {
  decodeContentTypeName,
  decodeMessagePayloadEnvelope,
  parseRpcJson,
  projectMessageContent,
  type ContentTypeName,
  type MessageContent,
  type MessagePayloadEnvelope,
} from '@privchat/sdk';

export interface MessageItemVM {
  /**
   * Stable React key. Prefers `server_message_id` when available, falls back
   * to `local_message_id` for pending rows that haven't been ACKed yet. The
   * cache swaps the row identity in place when an ACK arrives, so the key
   * naturally migrates from local-id to server-id without UI churn.
   */
  record_key: string;
  server_message_id?: string;
  local_message_id?: string;
  from_uid: string;
  /** SDK-owned, fully projected content. UI code must not parse raw message content. */
  body: MessageContent;
  /**
   * Send-state of the row. NOT a read-receipt field — peer "已读" is a
   * separate dimension carried in `read_by_peer` below. `pending`, `sent`,
   * `received`, `failed`. Mirrors `cache.MessageStatus` minus any UI sugar.
   */
  status: MessageStatus;
  /** Wall-clock ms; same sort key the SDK uses internally. */
  timestamp: number;
  /** Convenience flag derived from `session.user_id === record.from_uid`. */
  is_self: boolean;
  /**
   * Read-receipt projection: `true` when this is a self-sent row whose
   * pts the direct-channel peer has already read past
   * (`pts <= channel.peer_read_pts`). Always `false` for inbound rows
   * and for outbound rows the peer hasn't read yet (or in channels
   * where peer cursor isn't tracked, e.g. groups).
   *
   * This deliberately does NOT live on `MessageStatus` — it's a
   * separate dimension from the send-state machine, mirroring Rust
   * SDK's split between `MessageStatus` and `channel_extra.peer_read_pts`.
   */
  read_by_peer: boolean;
  /** Per-channel server pts (snowflake-ish counter) once the row is
   *  ACKed. Surfaced for diagnostic UIs (dev tooltips comparing pts vs
   *  peer_read_pts) — production UI shouldn't need to read this. */
  pts?: string;
  /** True when the row was revoked (sender called `messageRevoke` —
   *  push side flips `record.revoked`). UI should render a placeholder
   *  ("X 撤回了一条消息") instead of `content`, and suppress reactions /
   *  reply / etc. */
  revoked: boolean;
  /** Application content type (`'text' | 'image' | 'voice' | 'video' |
   *  'file' | 'system' | 'sticker' | 'contact_card' | 'location' |
   *  'link' | 'forward'`). Decoded from `record.message_type`, which is
   *  either the wire u32 as a decimal-string (push/outbox) or the server
   *  word form (history/sync). Renderers switch on this. */
  content_type: ContentTypeName;
  /** Parsed media metadata for image/voice/video/file rows. `undefined`
   *  for plain text. Caller should narrow on `content_type`. */
  metadata?: MediaMetadataVM;
  /** server_message_id of the message this row replies to, parsed
   *  out of the JSON envelope's `reply_to_message_id` field. UI
   *  renders a quote header above the bubble — the original message
   *  body should be looked up from the local cache by this id. */
  reply_to?: string;
  /** Joined outbox row status when this message has a matching outbox
   *  entry (keyed by `local_message_id`). The cache `MessageRecord`
   *  stays `'pending'` end-to-end during outbox-managed retries; this
   *  surfaces the *real* delivery state so the UI can render a "Send
   *  failed · Retry" affordance. Undefined for inbound messages and
   *  for outbound messages whose outbox row has been deleted (sent /
   *  discarded). */
  outbox_status?: OutboxStatus;
}

/** All content types defined by `protocol::ContentMessageType`.
 *  Re-exported from `@privchat/sdk` — the SDK owns the canonical
 *  mapping (one table, not two drifting copies). */
export type { ContentTypeName };

export interface ImageMetadataVM {
  type: 'image';
  file_id: string;
  url?: string;
  width: number;
  height: number;
}

export interface FileMetadataVM {
  type: 'file';
  file_id: string;
  url?: string;
  filename?: string;
  mime_type?: string;
  size?: number;
}

export interface VoiceMetadataVM {
  type: 'voice';
  file_id: string;
  url?: string;
  duration: number;
}

export interface VideoMetadataVM {
  type: 'video';
  file_id: string;
  url?: string;
  width: number;
  height: number;
  duration: number;
  thumbnail_url?: string;
}

export interface StickerMetadataVM {
  type: 'sticker';
  sticker_id: string;
  image_url: string;
}

export interface LocationMetadataVM {
  type: 'location';
  latitude: number;
  longitude: number;
}

export interface LinkMetadataVM {
  type: 'link';
  url: string;
  title?: string;
  description?: string;
  /** Resolved thumbnail URL when the wire payload carries a
   *  `thumbnail_url` field (some senders pre-resolve). The opaque
   *  `thumbnail_file_id` from the FlatBuffers schema isn't directly
   *  consumable by the UI — surfacing it would force every renderer to
   *  call `fileGetUrl`, so we only forward the URL form. */
  thumbnail_url?: string;
}

export type MediaMetadataVM =
  | ImageMetadataVM
  | FileMetadataVM
  | VoiceMetadataVM
  | VideoMetadataVM
  | StickerMetadataVM
  | LocationMetadataVM
  | LinkMetadataVM;

/**
 * Project a cache MessageRecord into a UI ViewModel.
 *
 * `selfUid` may be undefined when the session hasn't completed authentication
 * yet; in that case `is_self` defaults to `false` so unauthenticated views
 * render messages as "from someone else" rather than crashing.
 *
 * `peerReadPts` is the direct-channel peer's read cursor (from
 * `ChannelRecord.peer_read_pts`). Pass `undefined` when the channel has
 * no known peer cursor yet (cold start before any peer markRead), or for
 * group channels — the projection cleanly degrades to
 * `read_by_peer: false`.
 */
export function projectMessageRecord(
  record: MessageRecord,
  selfUid: string | undefined,
  peerReadPts: string | undefined,
  outboxStatusByLocalId?: Map<string, OutboxStatus>,
): MessageItemVM {
  const isSelf = selfUid !== undefined && record.from_uid === selfUid;
  const readByPeer =
    isSelf &&
    record.pts !== undefined &&
    peerReadPts !== undefined &&
    BigInt(record.pts) <= BigInt(peerReadPts);
  const contentType = decodeContentType(record.message_type);
  const envelope = decodeContentEnvelope(record.payload);
  const metadata = decodeMediaMetadata(record.payload, contentType);
  const body = projectMessageContent({
    content_type: contentType,
    content: record.content,
    envelope,
  });
  const outboxStatus =
    outboxStatusByLocalId !== undefined &&
    record.local_message_id !== undefined
      ? outboxStatusByLocalId.get(record.local_message_id)
      : undefined;
  return {
    record_key: record.server_message_id ?? `local:${record.local_message_id}`,
    server_message_id: record.server_message_id,
    local_message_id: record.local_message_id,
    from_uid: record.from_uid,
    body,
    status: record.status,
    timestamp: record.timestamp,
    is_self: isSelf,
    read_by_peer: readByPeer,
    pts: record.pts,
    revoked: record.revoked === true,
    content_type: contentType,
    metadata,
    reply_to: body.reply_to_message_id,
    outbox_status: outboxStatus,
  };
}

function decodeContentEnvelope(payload: Uint8Array): MessagePayloadEnvelope | undefined {
  if (payload.length === 0) return undefined;
  if (payload[0] === 0x7b) {
    try {
      const value = parseRpcJson<MessagePayloadEnvelope>(new TextDecoder().decode(payload));
      return typeof value?.content === 'string' ? value : undefined;
    } catch {
      return undefined;
    }
  }
  try {
    return decodeMessagePayloadEnvelope(payload);
  } catch {
    return undefined;
  }
}

/** Pull `reply_to_message_id` out of the JSON envelope, if present.
 *  Returns `undefined` for raw-text messages or malformed payloads. */
function decodeReplyTo(payload: Uint8Array): string | undefined {
  if (payload.length === 0 || payload[0] !== 0x7b /* '{' */) return undefined;
  try {
    // Lossless parse: native senders (Rust/Kotlin) serialize
    // reply_to_message_id as a raw JSON u64 — 18-digit snowflakes round
    // under plain JSON.parse and the reply anchor points at a message
    // that doesn't exist. parseRpcJson surfaces big ints as strings.
    const obj = parseRpcJson<{ reply_to_message_id?: unknown }>(
      new TextDecoder().decode(payload),
    );
    if (typeof obj.reply_to_message_id === 'string')
      return obj.reply_to_message_id;
    if (typeof obj.reply_to_message_id === 'number')
      return String(obj.reply_to_message_id);
  } catch {
    /* not JSON */
  }
  return undefined;
}

/** Map a cache `MessageRecord.message_type` into a stable discriminant
 *  the UI can switch on. Delegates to the SDK's canonical decoder, which
 *  accepts both the word form ('text'/'image'/…, the canonical cache
 *  representation) and the legacy decimal-string form ('0'..'10') still
 *  present in IndexedDB rows persisted before the SDK converged its
 *  write paths. Unrecognized values fall back to `'unknown'`. */
function decodeContentType(raw: string): ContentTypeName {
  return decodeContentTypeName(raw);
}

/** Pull the metadata record out of a wire `payload`. Media payloads are
 *  the typed FlatBuffers `MessagePayloadEnvelope` (byte-compatible with
 *  the server / Rust + iOS clients); the metadata union decodes to a flat
 *  record with `file_id`, dims, etc. A legacy JSON payload (first byte
 *  `{`) — possible for rows persisted by an older build — is still parsed
 *  via the old path. Returns `undefined` when there is no usable metadata. */
function extractMetadataRecord(
  payload: Uint8Array,
): Record<string, unknown> | undefined {
  // Discriminate by first byte: JSON envelopes start with '{' (0x7B);
  // FlatBuffers root offsets never do.
  if (payload[0] === 0x7b) {
    let parsed: unknown;
    try {
      // Lossless parse — cross-client metadata may carry u64s (file_id)
      // as raw JSON numbers; big ones must arrive as strings, not rounded.
      parsed = parseRpcJson(new TextDecoder().decode(payload));
    } catch {
      return undefined;
    }
    if (parsed === null || typeof parsed !== 'object') return undefined;
    const meta = (parsed as { metadata?: unknown }).metadata;
    if (meta === null || typeof meta !== 'object') return undefined;
    return meta as Record<string, unknown>;
  }
  try {
    const env = decodeMessagePayloadEnvelope(payload);
    if (env.metadata === undefined) return undefined;
    return env.metadata as unknown as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** Coerce a u64 id field to the public string form. 服务端 push 是 JSON：
 *  小 file_id 会被 `parseRpcJson` 保留为 number（大 u64 才保成 string），而
 *  FlatBuffers 路径恒为 string。统一接受 number|string，避免「JSON push + 小
 *  file_id」时误判 metadata 无效 → 气泡退化成「[文件]」。0/空 → undefined。 */
function coerceIdString(v: unknown): string | undefined {
  if (typeof v === 'string') return v !== '' && v !== '0' ? v : undefined;
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return String(v);
  return undefined;
}

/** Decode a media row's typed metadata into the renderer's shape. Empty /
 *  unparseable / mismatched payloads return `undefined` and renderers fall
 *  through to the text bubble using `content`. */
function decodeMediaMetadata(
  payload: Uint8Array,
  contentType: ContentTypeName,
): MediaMetadataVM | undefined {
  if (
    contentType !== 'image' &&
    contentType !== 'file' &&
    contentType !== 'voice' &&
    contentType !== 'video' &&
    contentType !== 'sticker' &&
    contentType !== 'location' &&
    contentType !== 'link'
  ) {
    return undefined;
  }
  if (payload.length === 0) return undefined;
  const m = extractMetadataRecord(payload);
  if (m === undefined) return undefined;
  // The `type` field on the envelope MUST match `contentType` derived
  // from `message_type`; otherwise we have a sender bug. Don't rely on
  // it — trust `contentType` and shape accordingly.
  switch (contentType) {
    case 'image': {
      const fileId = coerceIdString(m.file_id);
      if (fileId === undefined) return undefined;
      return {
        type: 'image',
        file_id: fileId,
        url: typeof m.url === 'string' ? m.url : undefined,
        width: typeof m.width === 'number' ? m.width : 0,
        height: typeof m.height === 'number' ? m.height : 0,
      };
    }
    case 'file': {
      const fileId = coerceIdString(m.file_id);
      if (fileId === undefined) return undefined;
      // typed 协议字段是 file_name/file_size；legacy JSON 用 filename/size。两者都认。
      const filename =
        typeof m.file_name === 'string'
          ? m.file_name
          : typeof m.filename === 'string'
            ? m.filename
            : undefined;
      const size =
        typeof m.file_size === 'number'
          ? m.file_size
          : typeof m.size === 'number'
            ? m.size
            : undefined;
      return {
        type: 'file',
        file_id: fileId,
        url: typeof m.url === 'string' ? m.url : undefined,
        filename,
        mime_type: typeof m.mime_type === 'string' ? m.mime_type : undefined,
        size: size !== undefined && size > 0 ? size : undefined,
      };
    }
    case 'voice': {
      const fileId = coerceIdString(m.file_id);
      if (fileId === undefined) return undefined;
      return {
        type: 'voice',
        file_id: fileId,
        url: typeof m.url === 'string' ? m.url : undefined,
        duration: typeof m.duration === 'number' ? m.duration : 0,
      };
    }
    case 'video': {
      const fileId = coerceIdString(m.file_id);
      if (fileId === undefined) return undefined;
      return {
        type: 'video',
        file_id: fileId,
        url: typeof m.url === 'string' ? m.url : undefined,
        width: typeof m.width === 'number' ? m.width : 0,
        height: typeof m.height === 'number' ? m.height : 0,
        duration: typeof m.duration === 'number' ? m.duration : 0,
        thumbnail_url:
          typeof m.thumbnail_url === 'string' ? m.thumbnail_url : undefined,
      };
    }
    case 'sticker': {
      // Sticker payloads carry an opaque `sticker_id` (catalog reference)
      // plus an already-resolved `image_url`. The UI only needs the URL
      // to render — `sticker_id` is forwarded for analytics / future
      // catalog lookups.
      const stickerId = m.sticker_id;
      const imageUrl = m.image_url;
      if (typeof stickerId !== 'string' || typeof imageUrl !== 'string') {
        return undefined;
      }
      return {
        type: 'sticker',
        sticker_id: stickerId,
        image_url: imageUrl,
      };
    }
    case 'location':
      if (typeof m.latitude !== 'number' || typeof m.longitude !== 'number') {
        return undefined;
      }
      return {
        type: 'location',
        latitude: m.latitude,
        longitude: m.longitude,
      };
    case 'link': {
      const url = m.url;
      if (typeof url !== 'string' || url === '') return undefined;
      return {
        type: 'link',
        url,
        title: typeof m.title === 'string' ? m.title : undefined,
        description:
          typeof m.description === 'string' ? m.description : undefined,
        thumbnail_url:
          typeof m.thumbnail_url === 'string' ? m.thumbnail_url : undefined,
      };
    }
  }
  return undefined;
}

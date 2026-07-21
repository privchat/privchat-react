// ClientAdapter — the seam between @privchat/react and a concrete chat client.
//
// The Provider does not import PrivchatClient directly. It talks to whatever
// implements this interface. That keeps three options open without changing
// hook code:
//
//   1. Direct in-page client (default; web app constructs PrivchatClient and
//      passes it through DirectClientAdapter).
//   2. SharedWorker / DedicatedWorker bridge (web app owns the worker and
//      forwards calls; the adapter is a postMessage proxy).
//   3. Test fakes / mocks.
//
// One adapter method per real hook need. Each method is a cost paid by every
// adapter implementation; do NOT pre-declare the entire SDK API here. Add
// methods when a hook requires them.

import type {
  AccountSearchResponse,
  BootstrapChannelsOptions,
  ChannelRecord,
  ConnectionState,
  ConversationPatch,
  ConversationSnapshot,
  FriendAcceptResponse,
  FriendApplyResponse,
  FriendPendingResponse,
  FriendshipRecord,
  GroupCreateResponse,
  GroupRecord,
  MarkReadOptions,
  MessageRecord,
  MessageRevokeResponse,
  OpenConversationOptions,
  PresenceBatchStatusResponse,
  ScrollHistoryOptions,
  SendTextInput,
  SendTextOperationResult,
  SequencedSdkEvent,
  SessionSnapshot,
  UserRecord,
} from '@privchat/sdk';

export type Unsubscribe = () => void;

export interface PrivchatClientAdapter {
  // ----- Connection state (R0) -----

  /** Current connection state — synchronous read for hooks like useConnectionState. */
  connectionState(): ConnectionState;

  /**
   * Subscribe to the L1 event stream. The adapter MUST replay no buffered
   * events on subscription; hooks that need an initial snapshot read it
   * synchronously via dedicated methods (e.g. connectionState()).
   *
   * Returned function unsubscribes. Calling it more than once is a no-op.
   */
  observeEvents(cb: (envelope: SequencedSdkEvent) => void): Unsubscribe;

  // ----- Session (R1) -----

  /** Synchronous session read — `useConversation` needs `user_id` for `from_uid`. */
  sessionSnapshot(): SessionSnapshot;

  // ----- Conversation (R1) -----

  /**
   * Open a conversation: emit cached window first (if any), then RPC the
   * latest server window. Idempotent under concurrent calls. Requires cache.
   */
  openConversation(
    channel_id: string,
    channel_type: number,
    opts?: OpenConversationOptions,
  ): Promise<MessageRecord[]>;

  /** Subscribe to per-conversation snapshot+patch updates. */
  observeConversation(
    channel_id: string,
    channel_type: number,
    cb: (snapshot: ConversationSnapshot, patch: ConversationPatch) => void,
  ): Unsubscribe;

  /** Synchronous read of currently-cached messages for a conversation. */
  getCachedMessages(channel_id: string, channel_type: number): MessageRecord[];

  /** Paginate older history. Empty result indicates the beginning is reached. */
  scrollHistory(
    channel_id: string,
    channel_type: number,
    opts?: ScrollHistoryOptions,
  ): Promise<MessageRecord[]>;

  /** Send a text message. Returns `'sent'` (server ACK) or `'queued'` (offline outbox). */
  sendTextMessage(input: SendTextInput): Promise<SendTextOperationResult>;

  /** Forward a cached message into another conversation as a fresh copy
   *  (Rust `forward_message` parity). Throws on revoked / uncached sources. */
  forwardMessage(input: {
    source_channel_id: string;
    source_channel_type: number;
    source_server_message_id: string;
    target_channel_id: string;
    target_channel_type: number;
    from_uid: string;
  }): Promise<SendTextOperationResult>;

  /**
   * R2.2: get or create the direct (1-on-1) channel between the current
   * user and `target_user_id`. Idempotent — same target returns the
   * same channel id. Used by the Contacts tab to turn a tap on a
   * friend row into an active conversation.
   *
   * `source` / `source_id` are optional analytics tags the server
   * stores on the channel record (e.g. `source='contacts'` /
   * `source_id='friend_card'`).
   */
  channelDirectGetOrCreate(
    target_user_id: number,
    source?: string,
    source_id?: string,
  ): Promise<{ channel_id: number; created: boolean }>;

  /**
   * Bot follow（spec `02-server/SERVICE_ACCOUNT_FOLLOW_SPEC` §3.1）。
   *
   * 关注一个 Bot；server 写 `privchat_bot_follow` + 触发 application binding
   * webhook。返回 channel_id 即可用于后续 Subscribe / Transfer / SendMessage。
   *
   * 与微信服务号 / Telegram bot 一致：拿到 channel_id 后就能调用所有 bot 功能；
   * 关注是可选的，只是让 application 自动写 binding（bot/menu/get 等 transfer
   * 命中 dispatch 必须）。
   */
  botFollow(
    bot_user_id: number,
  ): Promise<{
    bot_user_id: number;
    channel_id: number;
    account_user_type: number;
    followed: boolean;
    created: boolean;
  }>;

  /**
   * Bot unfollow（spec §3.2）。server 切 status=0，**不**删 channel / 历史。
   */
  botUnfollow(
    bot_user_id: number,
  ): Promise<{
    bot_user_id: number;
    channel_id: number;
    unfollowed: boolean;
  }>;

  /**
   * Channel Transfer RPC（spec `02-server/CHANNEL_TRANSFER_SPEC` v2.0
   * + `07-application/BOT_INTERACTION_SPEC` §3.2 拉菜单 / §4 三种 action）。
   *
   * `request_id` 由调用方生成（UUID v4，长度 ≤64）。`channel_id` 是 IdString。
   * `route` 形如 `bot/menu/get`，server 把请求 forward 给 application
   * 的 `/service/privchat/transfer/dispatch`。返回 application handler 的
   * `code` / `message` / `data` byte payload。
   *
   * 失败信号：reject when transport 错（超时、断连）；server / application
   * 业务错通过 `response.code != 0` 暴露。
   */
  transfer(req: {
    request_id: string;
    channel_id: string;
    route: string;
    body: Uint8Array;
    timeoutMs?: number;
  }): Promise<{
    request_id: string;
    channel_id: string;
    code: number;
    message: string;
    data?: Uint8Array;
  }>;

  /**
   * Mark messages up to `read_pts` as read for the current user. Server
   * advances the canonical `channel_read_cursor` row, zeros local unread,
   * and (for direct channels) broadcasts `peer_read_pts_updated` to the
   * other party. Idempotent — calling with a `read_pts` ≤ existing cursor
   * is a server-side no-op.
   *
   * Returns the raw RPC result; SDK has already projected `accepted_read_pts`
   * into the local cache before the promise resolves.
   */
  markRead(
    channel_id: string,
    channel_type: number,
    read_pts: string,
    opts?: MarkReadOptions,
  ): Promise<unknown>;

  // ----- Channel list (R1.1) -----

  /**
   * Pull the user's channel list from the server. Idempotent under repeated
   * calls (uses `sinceChannelVersion` to resume); pass
   * `{ sinceChannelVersion: 0, sinceCursorVersion: 0 }` to force a full
   * refetch. Returns the merged `ChannelRecord[]` and persists to cache.
   */
  bootstrapChannels(opts?: BootstrapChannelsOptions): Promise<ChannelRecord[]>;

  /**
   * Synchronous read of currently-cached channels, sorted `updated_at desc`
   * by the SDK. Returns `[]` until `bootstrapChannels()` has run at least
   * once. The result is a fresh array per call — hooks must memoize for
   * `useSyncExternalStore` reference stability.
   */
  cachedChannels(): ChannelRecord[];

  /**
   * Subscribe to channel-list mutations. Callback receives the FULL snapshot
   * (not a delta). Fires on bootstrap completion, on inbound push absorption
   * (last_message / unread bumps), and on read-cursor advances.
   */
  observeChannelList(cb: (channels: ChannelRecord[]) => void): Unsubscribe;

  // ----- User profile cache (R2A) -----

  cachedUser(user_id: string): UserRecord | undefined;
  cachedUsers(): UserRecord[];
  observeUserList(cb: (users: UserRecord[]) => void): Unsubscribe;

  // ----- Group profile cache (R2A) -----

  cachedGroup(group_id: string): GroupRecord | undefined;
  cachedGroups(): GroupRecord[];
  observeGroupList(cb: (groups: GroupRecord[]) => void): Unsubscribe;

  // ----- Friendship cache (R2.1) -----

  cachedFriendship(user_id: string): FriendshipRecord | undefined;
  cachedFriendships(): FriendshipRecord[];
  observeFriendshipList(cb: (friendships: FriendshipRecord[]) => void): Unsubscribe;
  /** Force an incremental friendship sync from the server. Used to
   *  reconcile out-of-band changes the SDK can't otherwise hear about
   *  (peer accepted our outgoing apply, peer changed alias, etc) — no
   *  push channel exists for friendship today. Idempotent + cheap when
   *  nothing changed. */
  refreshFriendships(): Promise<void>;

  // ----- Friend management commands (R2.3) -----

  /** Server-side keyword search across the user directory. Used by the
   *  Find Friend dialog. Returns the raw SDK response so the UI can
   *  decide which fields to surface. */
  accountSearch(
    query: string,
    page?: number,
    pageSize?: number,
  ): Promise<AccountSearchResponse>;

  /** Cloud history search over the caller's visible channels (message
   *  history spec §4). Hits are snippet projections — never write them into
   *  the message cache; click-through goes via [jumpToMessageContext].
   *  Server rate-limits 300ms/user: debounce 300–500ms, drop stale results,
   *  skip queries under 2 chars. `channelId` narrows to one conversation. */
  messageHistorySearch(
    query: string,
    opts?: { channelId?: number; cursor?: string; limit?: number },
  ): Promise<import('@privchat/sdk').MessageHistorySearchResponse>;

  /** jump-to-message (spec §5): fetches full context around the anchor,
   *  backfills the local cache (IndexedDB + memory buffer), and returns the
   *  window + anchor so the UI can scroll/highlight from local state. */
  jumpToMessageContext(
    channelId: string,
    channelType: number,
    messageId: number | string,
    opts?: { beforeLimit?: number; afterLimit?: number },
  ): Promise<{
    records: import('@privchat/sdk').MessageRecord[];
    anchor: import('@privchat/sdk').MessageRecord;
    has_more_before: boolean;
    has_more_after: boolean;
  }>;

  /** Send a friend request. `source` / `source_id` are analytics tags. */
  friendApply(
    targetUserId: number,
    message?: string,
    source?: string,
    sourceId?: string,
  ): Promise<FriendApplyResponse>;

  /** Accept an incoming friend request. */
  friendAccept(
    fromUserId: number,
    message?: string,
  ): Promise<FriendAcceptResponse>;

  /** Pull pending (incoming) friend requests for the current user. */
  friendPending(): Promise<FriendPendingResponse>;

  /** Set/clear the local-only remark name (alias) for a friend. Empty
   *  string clears it. After the RPC returns, the next entity sync will
   *  echo the change back into the friendship cache; callers should
   *  trigger `refreshFriendships()` if they want immediate convergence. */
  setFriendAlias(targetUserId: number, alias: string): Promise<unknown>;

  /** Remove a friendship (unfriend). Server tombstones the friendship
   *  row; entity sync emits a `deleted: true` row that the SDK absorbs
   *  → local FriendshipStore drops the row. UserRecord stays put (the
   *  uid may still appear in unrelated channels). */
  removeFriend(friendId: number): Promise<unknown>;

  /** Add a uid to the caller's blacklist. Server-side: blocks subsequent
   *  apply / message / etc from that uid. Caller passes its own user_id
   *  because the blacklist routes don't auto-fill from auth ctx (server
   *  contract; verified). */
  blockUser(callerUserId: number, blockedUserId: number): Promise<unknown>;

  /** Remove a uid from the caller's blacklist. */
  unblockUser(callerUserId: number, blockedUserId: number): Promise<unknown>;

  // ----- Group management commands (R2.3) -----

  /** Create a new group. Server returns the new group's id + canonical
   *  metadata; the entity sync flow will eventually catch up the local
   *  GroupStore so we don't have to inject it ourselves. */
  groupCreate(name: string, description?: string): Promise<GroupCreateResponse>;

  // ----- Presence (R2.4) -----

  /** Batch presence query. Server enforces 1..=100 uids per call. */
  batchGetPresence(userIds: number[]): Promise<PresenceBatchStatusResponse>;

  // ----- Message ops (R3.1) -----

  /** Revoke (recall) a previously-sent message. Server tombstones the
   *  row + broadcasts to peers; the SDK's local cache absorbs the push
   *  and flips `record.revoked = true`. Idempotent — re-revoking a
   *  revoked row is a server-side no-op. */
  revokeMessage(
    serverMessageId: string,
    channelId: string,
  ): Promise<MessageRevokeResponse>;

  // ----- Typing (R3.2) -----

  /** Wire-level subscribe to a channel. Required to receive
   *  PublishRequest broadcasts (typing notifications today, possibly
   *  reactions / presence in the future). Idempotent at the server. */
  subscribeChannel(channelId: string, channelType: number): Promise<unknown>;

  /** Wire-level unsubscribe. Pair with `subscribeChannel`. */
  unsubscribeChannel(channelId: string, channelType: number): Promise<unknown>;

  /** Send a typing indicator. Server broadcasts to other channel
   *  subscribers (skipping the sender's own session) and rate-limits to
   *  one publish per (uid, channel) per 500ms. */
  sendTyping(
    channelId: string,
    isTyping: boolean,
    channelType?: number,
    actionType?: string,
  ): Promise<unknown>;

  // ----- Channel ops (R3.3) -----

  /** Set a channel's pinned state. Server-side persistent; local
   *  ChannelRecord doesn't carry `pinned` yet so the UI can't show the
   *  current state — callers expose both Pin/Unpin actions for now. */
  pinChannel(channelId: string, pinned: boolean): Promise<unknown>;

  /** 读取自己的隐私设置(「添加我的方式」等,PROFILE_VISIBILITY P2)。 */
  privacyGet(): Promise<Record<string, unknown>>;

  /** 更新自己的隐私设置(部分字段)。 */
  privacyUpdate(patch: Record<string, unknown>): Promise<unknown>;

  /** Set a channel's mute state (per-user). Same caveat as pin. */
  muteChannel(channelId: string, muted: boolean): Promise<unknown>;

  /** Hide a channel from the user's list. Server-side tombstone-style;
   *  next channel-list sync drops the row. */
  hideChannel(channelId: string): Promise<unknown>;

  // ----- Group ops (R3.4) -----

  /** Pull the member roster for a group. Server returns `{ members,
   *  total }`; SDK leaves the response as-is (no local cache for group
   *  members yet — call from a dialog when needed). */
  listGroupMembers(groupId: string): Promise<unknown>;

  /** Leave a group. Server tombstones the membership row + drops the
   *  channel from the user's channel list (entity sync handles cache
   *  cleanup on the next pass). */
  leaveGroup(groupId: string): Promise<unknown>;

  /** Add a user to a group. Caller must be owner/admin server-side. */
  addGroupMember(groupId: string, userId: string, role?: string): Promise<unknown>;

  /** Kick a member out (owner/admin only server-side). */
  removeGroupMember(groupId: string, userId: string): Promise<unknown>;

  /** Mute a member. `muteDuration` in seconds; 0 = permanent. */
  muteGroupMember(groupId: string, userId: string, muteDuration: number): Promise<unknown>;

  /** Unmute a previously muted member. */
  unmuteGroupMember(groupId: string, userId: string): Promise<unknown>;

  // ----- Outbox (R3.7) -----

  /** Snapshot subscription to the outbox state. The callback fires
   *  with an initial async snapshot then on every persisted state
   *  transition. Used by `useConversation` to join outbox status onto
   *  the message timeline. */
  observeOutbox(cb: (entries: import('@privchat/sdk').OutboxEntry[]) => void): Unsubscribe;

  /** User-triggered retry of a `failed` outbox row. Resets backoff +
   *  kicks the flush engine. `outbox_id` equals `local_message_id`
   *  in 5C — callers can pass either. */
  retryOutboxEntry(outboxId: string): Promise<void>;

  /** Drop a row WITHOUT sending. Removes the matching cache message. */
  discardOutboxEntry(outboxId: string): Promise<void>;

  // ----- Media upload + send (R3.5) -----

  /** End-to-end image upload: requests a token, POSTs the file via
   *  multipart, sends an Image-typed message. Returns the SDK's send
   *  result so callers can inspect ack vs queued state. `onProgress`
   *  fires during the multipart body write. */
  sendImage(args: {
    channel_id: string;
    channel_type: number;
    file: Blob;
    filename: string;
    mime_type: string;
    local_message_id?: string;
    width: number;
    height: number;
    caption?: string;
    onProgress?: (event: import('@privchat/sdk').UploadProgressEvent) => void;
  }): Promise<SendTextOperationResult>;

  /** End-to-end generic file upload + send. */
  sendFile(args: {
    channel_id: string;
    channel_type: number;
    file: Blob;
    filename: string;
    mime_type: string;
    local_message_id?: string;
    caption?: string;
    onProgress?: (event: import('@privchat/sdk').UploadProgressEvent) => void;
  }): Promise<SendTextOperationResult>;

  /** End-to-end video upload + send. `width`/`height`/`duration` are
   *  the caller's best-effort hints; the upload-response values win
   *  if the server probed the file. No poster-frame generation —
   *  receivers render the player chrome without a thumbnail unless
   *  the sender pre-computed one. */
  sendVideo(args: {
    channel_id: string;
    channel_type: number;
    file: Blob;
    filename: string;
    mime_type: string;
    local_message_id?: string;
    width: number;
    height: number;
    duration: number;
    thumbnail_url?: string;
    caption?: string;
    onProgress?: (event: import('@privchat/sdk').UploadProgressEvent) => void;
  }): Promise<SendTextOperationResult>;

  // ----- Group role management -----

  /** Promote a member to admin or demote them to member. The wire
   *  shape requires the operator's user id for the permission check;
   *  adapters fill that from the current session. Server only accepts
   *  this call from the group owner. Role `'owner'` is NOT settable
   *  through this RPC — use `transferGroupOwner` for ownership moves. */
  setGroupMemberRole(
    groupId: string,
    userId: string,
    role: 'admin' | 'member',
  ): Promise<import('@privchat/sdk').GroupRoleSetResponse>;

  /** Transfer ownership to another existing member. Server expects
   *  the wire field `current_owner_id` to match both the session uid
   *  AND the group's current owner. Outgoing owner becomes a regular
   *  member (server-side: `MemberRole::Member`, NOT admin — see
   *  `privchat-server/src/rpc/group/role/transfer_owner.rs`). */
  transferGroupOwner(
    groupId: string,
    newOwnerId: string,
  ): Promise<import('@privchat/sdk').GroupTransferOwnerResponse>;

  // ----- Group settings -----

  /** Read the mutable group settings (description / announcement /
   *  approval flags / mute-all / member limit). Server gates on
   *  membership; non-members get an error. */
  getGroupSettings(
    groupId: string,
  ): Promise<import('@privchat/sdk').GroupSettingsGetResponse>;

  /** Apply a partial patch to the group settings. Owner-only per
   *  spec. The adapter fills `operator_id` from the current session.
   *  Pass `''` to clear a string field; omit fields to leave them
   *  unchanged. */
  updateGroupSettings(
    groupId: string,
    settings: import('@privchat/sdk').GroupSettingsPatch,
  ): Promise<import('@privchat/sdk').GroupSettingsUpdateResponse>;

  /** Toggle whole-group mute. Owner-only. Goes through the dedicated
   *  `group/settings/mute_all` route (the server emits a distinct
   *  notification for it). */
  muteGroupAll(
    groupId: string,
    muted: boolean,
  ): Promise<import('@privchat/sdk').GroupMuteAllResponse>;

  /** List pending group-join approvals (owner/admin; server gates).
   *  The adapter/SDK fills operator_id from the current session. */
  groupApprovalList(
    groupId: string,
  ): Promise<import('@privchat/sdk').GroupApprovalListResponse>;

  /** Approve/reject a pending join request by its server UUID
   *  (`GroupApprovalItem.request_id`). `approve=true` admits the applicant. */
  groupApprovalHandle(
    requestId: string,
    approve: boolean,
    reason?: string,
  ): Promise<import('@privchat/sdk').GroupApprovalHandleResponse>;

  /** Pin / unpin a group message (owner / admin only; server enforces).
   *  `pinned=false` unpins. `channelId` is the message's channel. */
  pinGroupMessage(
    groupId: string,
    channelId: string,
    messageId: string,
    pinned: boolean,
  ): Promise<import('@privchat/sdk').MessagePinResponse>;

  /** List a group's pinned messages (any member; newest-pinned first). */
  listGroupPinnedMessages(
    groupId: string,
  ): Promise<import('@privchat/sdk').MessagePinListResponse>;

  // ----- Reactions (R3.6) -----

  /** Add an emoji reaction to a server-acked message. Idempotent at
   *  the server (re-add same emoji is a no-op). */
  addReaction(serverMessageId: string, emoji: string): Promise<unknown>;

  /** Remove an emoji reaction. Idempotent. */
  removeReaction(serverMessageId: string, emoji: string): Promise<unknown>;

  /** List reactions for a message: `{emoji: [uid, uid, …], …}`. */
  listReactions(serverMessageId: string): Promise<{
    reactions: Record<string, number[]>;
    total_count: number;
  }>;

  // ----- File access (B1: voice playback lazy URL) -----

  /** Resolve a file_id to a freshly-signed download URL. Bubble
   *  renderers (image / file / voice) call this lazily, on first
   *  user interaction (e.g. play tap), when message metadata
   *  carries only an id and no baked-in URL. Wire shape exposed
   *  verbatim so callers can introspect `expires_at` for
   *  future renewal logic. */
  fileGetUrl(fileId: string): Promise<{
    file_url: string;
    expires_at: number;
    file_size: number;
    mime_type: string;
    /** 原始文件名（file 表数据；Scheme B 下 filename/size/mime 均由 get_url 下发）。 */
    original_filename?: string;
  }>;

  /** 附件加密 v1 下载：`file_id -> file/get_url -> signed_url + cek` → fetch 密文 →
   *  WebCrypto 解密 → 明文 `Blob`。UI 用 `URL.createObjectURL(blob)` 预览/下载，
   *  不能 `img.src = file_url`（v1 是密文）。CEK 不进 URL/日志。 */
  downloadAttachmentBlob(fileId: string): Promise<Blob>;

  // ----- QR Code v1.3 (per QR_CODE_SPEC v1.3) -----

  /** Read the current user's permanent qr_key + fully-built scan URL.
   *  Shape (v1.4 path-only): `https://<host>/privchat:protocol/user/get/<qr_key>`. */
  userQrcodeGet(): Promise<{
    qr_key: string;
    qr_code: string;
    user_id: string;
  }>;

  /** Rotate the current user's qr_key. Old key becomes immediately
   *  unresolvable. Anti-spam tool — there's no time-based expiry. */
  userQrcodeRefresh(): Promise<{
    old_qr_key: string;
    new_qr_key: string;
    qr_code: string;
    user_id: string;
  }>;

  /** Resolve a peer's qr_key (scanned from their QR) to the minimum
   *  user card the caller can act on (view profile / add friend).
   *  Server does NOT return qr_key in response — discourage secondary
   *  spreading. */
  userQrcodeResolve(qrKey: string): Promise<{
    user_id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    user_type: number;
    is_friend: boolean;
    is_self: boolean;
  }>;

  /** Read a group's permanent qr_key + URL. Any member of the group
   *  can read. URL targets the `join` action. */
  groupQrcodeGet(groupId: string): Promise<{
    qr_key: string;
    qr_code: string;
    group_id: string;
  }>;

  /** Rotate the group's qr_key. Owner/Admin only — server enforces. */
  groupQrcodeRefresh(groupId: string): Promise<{
    old_qr_key: string;
    new_qr_key: string;
    qr_code: string;
    group_id: string;
  }>;

  /** Submit a join-by-QR request for the group whose qr_key was
   *  scanned. Server reverse-looks-up the group_id and runs the same
   *  membership/capacity/approval flow as `member/invite`. Response
   *  `status` is `'joined'` (auto-admitted) or `'pending'` (queued
   *  for owner/admin approval). */
  groupJoinByQrcode(qrKey: string, message?: string): Promise<{
    status: string;
    group_id: string;
    request_id?: string;
    message?: string;
    user_id?: string;
    joined_at?: number;
  }>;
}

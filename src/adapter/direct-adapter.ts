// DirectClientAdapter — wraps a PrivchatClient instance the host owns.
//
// This is the default adapter for apps that run the SDK in the same JS context
// as React (no worker boundary). Pass it your already-constructed client; the
// adapter does NOT call connect() / authenticate() / dispose() — lifecycle is
// driven by the host because hosts have very different lifecycle policies
// (Tauri vs single-page React vs Cocos).

import {
  buildSendFileInput,
  buildSendImageInput,
  buildSendVideoInput,
  uploadSealedFileViaToken,
} from '@privchat/sdk';
import type {
  UserDetailSource,
  AccountSearchResponse,
  BootstrapChannelsOptions,
  PresenceBatchStatusResponse,
  ChannelRecord,
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
  PrivchatClient,
  ScrollHistoryOptions,
  SendTextInput,
  SendTextOperationResult,
  SequencedSdkEvent,
  SessionSnapshot,
  UserRecord,
} from '@privchat/sdk';
import { RpcError, sealAttachment } from '@privchat/sdk';
import type { PrivchatClientAdapter, Unsubscribe } from './client-adapter.js';

export class DirectClientAdapter implements PrivchatClientAdapter {
  constructor(private readonly client: PrivchatClient) {}

  connectionState() {
    return this.client.connectionState();
  }

  observeEvents(cb: (env: SequencedSdkEvent) => void): Unsubscribe {
    return this.client.observeEvents(cb);
  }

  sessionSnapshot(): SessionSnapshot {
    return this.client.sessionSnapshot();
  }

  openConversation(
    channel_id: string,
    channel_type: number,
    opts?: OpenConversationOptions,
  ): Promise<MessageRecord[]> {
    return this.client.openConversation(channel_id, channel_type, opts);
  }

  observeConversation(
    channel_id: string,
    channel_type: number,
    cb: (snapshot: ConversationSnapshot, patch: ConversationPatch) => void,
  ): Unsubscribe {
    return this.client.observeConversation(channel_id, channel_type, cb);
  }

  getCachedMessages(channel_id: string, channel_type: number): MessageRecord[] {
    return this.client.getCachedMessages(channel_id, channel_type);
  }

  scrollHistory(
    channel_id: string,
    channel_type: number,
    opts?: ScrollHistoryOptions,
  ): Promise<MessageRecord[]> {
    return this.client.scrollHistory(channel_id, channel_type, opts);
  }

  sendTextMessage(input: SendTextInput): Promise<SendTextOperationResult> {
    return this.client.sendTextMessage(input);
  }

  channelDirectGetOrCreate(
    target_user_id: number,
    source?: string,
    source_id?: string,
  ): Promise<{ channel_id: number; created: boolean }> {
    return this.client.channelDirectGetOrCreate(
      target_user_id,
      source,
      source_id,
    );
  }

  botFollow(bot_user_id: number) {
    return this.client.botFollow(bot_user_id);
  }

  botUnfollow(bot_user_id: number) {
    return this.client.botUnfollow(bot_user_id);
  }

  transfer(req: {
    request_id: string;
    channel_id: string;
    route: string;
    body: Uint8Array;
    timeoutMs?: number;
  }) {
    const { timeoutMs, ...rest } = req;
    return this.client.transfer(rest, { timeoutMs });
  }

  markRead(
    channel_id: string,
    channel_type: number,
    read_pts: string,
    opts?: MarkReadOptions,
  ): Promise<unknown> {
    return this.client.markRead(channel_id, channel_type, read_pts, opts);
  }

  bootstrapChannels(opts?: BootstrapChannelsOptions): Promise<ChannelRecord[]> {
    return this.client.bootstrapChannels(opts);
  }

  cachedChannels(): ChannelRecord[] {
    return this.client.cachedChannels();
  }

  observeChannelList(cb: (channels: ChannelRecord[]) => void): Unsubscribe {
    return this.client.observeChannelList(cb);
  }

  cachedUser(user_id: string): UserRecord | undefined {
    return this.client.cachedUser(user_id);
  }

  cachedUsers(): UserRecord[] {
    return this.client.cachedUsers();
  }

  observeUserList(cb: (users: UserRecord[]) => void): Unsubscribe {
    return this.client.observeUserList(cb);
  }

  cachedGroup(group_id: string): GroupRecord | undefined {
    return this.client.cachedGroup(group_id);
  }

  cachedGroups(): GroupRecord[] {
    return this.client.cachedGroups();
  }

  observeGroupList(cb: (groups: GroupRecord[]) => void): Unsubscribe {
    return this.client.observeGroupList(cb);
  }

  cachedFriendship(user_id: string): FriendshipRecord | undefined {
    return this.client.cachedFriendship(user_id);
  }

  cachedFriendships(): FriendshipRecord[] {
    return this.client.cachedFriendships();
  }

  observeFriendshipList(
    cb: (friendships: FriendshipRecord[]) => void,
  ): Unsubscribe {
    return this.client.observeFriendshipList(cb);
  }

  refreshFriendships(): Promise<void> {
    return this.client.refreshFriendships();
  }

  accountSearch(
    query: string,
    page?: number,
    pageSize?: number,
  ): Promise<AccountSearchResponse> {
    return this.client.accountSearch(query, page, pageSize);
  }

  messageHistorySearch(
    query: string,
    opts?: { channelId?: number; cursor?: string; limit?: number },
  ) {
    return this.client.messageHistorySearch(query, opts);
  }

  jumpToMessageContext(
    channelId: string,
    channelType: number,
    messageId: number | string,
    opts?: { beforeLimit?: number; afterLimit?: number },
  ) {
    return this.client.jumpToMessageContext(channelId, channelType, messageId, opts);
  }

  friendApply(
    targetUserId: number,
    message?: string,
    source?: string,
    sourceId?: string,
    grantId?: string,
  ): Promise<FriendApplyResponse> {
    return this.client.friendApply(targetUserId, message, source, sourceId, grantId);
  }

  userDetail(req: {
    target_user_id: number;
    source: UserDetailSource;
    source_id: string;
  }) {
    return this.client.userDetail(req);
  }

  friendAccept(
    fromUserId: number,
    message?: string,
  ): Promise<FriendAcceptResponse> {
    return this.client.friendAccept(fromUserId, message);
  }

  friendPending(): Promise<FriendPendingResponse> {
    return this.client.friendPending();
  }

  setFriendAlias(targetUserId: number, alias: string): Promise<unknown> {
    return this.client.friendSetAlias(targetUserId, alias);
  }

  removeFriend(friendId: number): Promise<unknown> {
    return this.client.friendRemove(friendId);
  }

  blockUser(callerUserId: number, blockedUserId: number): Promise<unknown> {
    return this.client.blacklistAdd(callerUserId, blockedUserId);
  }

  unblockUser(callerUserId: number, blockedUserId: number): Promise<unknown> {
    return this.client.blacklistRemove(callerUserId, blockedUserId);
  }

  groupCreate(name: string, description?: string): Promise<GroupCreateResponse> {
    return this.client.groupCreate(name, description);
  }

  batchGetPresence(userIds: number[]): Promise<PresenceBatchStatusResponse> {
    return this.client.batchGetPresence(userIds);
  }

  revokeMessage(
    serverMessageId: string,
    channelId: string,
  ): Promise<MessageRevokeResponse> {
    return this.client.messageRevoke(serverMessageId, Number(channelId));
  }

  subscribeChannel(channelId: string, channelType: number): Promise<unknown> {
    return this.client.subscribeChannel(channelId, channelType);
  }

  unsubscribeChannel(channelId: string, channelType: number): Promise<unknown> {
    return this.client.unsubscribeChannel(channelId, channelType);
  }

  sendTyping(
    channelId: string,
    isTyping: boolean,
    channelType?: number,
    actionType?: string,
  ): Promise<unknown> {
    return this.client.sendTyping(
      Number(channelId),
      isTyping,
      actionType,
      channelType,
    );
  }

  privacyGet(): Promise<Record<string, unknown>> {
    return this.client.privacyGet() as unknown as Promise<Record<string, unknown>>;
  }

  privacyUpdate(patch: Record<string, unknown>): Promise<unknown> {
    return this.client.privacyUpdate(patch);
  }

  async pinChannel(channelId: string, pinned: boolean): Promise<unknown> {
    const r = await this.client.channelPin(channelId, pinned);
    // Mirror server state to local cache so observers fire and the UI
    // toggle flips without waiting for the next entity sync.
    this.client.applyChannelFlags(channelId, { pinned });
    return r;
  }

  async muteChannel(channelId: string, muted: boolean): Promise<unknown> {
    const r = await this.client.channelMute(Number(channelId), muted);
    this.client.applyChannelFlags(channelId, { muted });
    return r;
  }

  async hideChannel(channelId: string): Promise<unknown> {
    const r = await this.client.channelHide(Number(channelId));
    this.client.applyChannelFlags(channelId, { hidden: true });
    return r;
  }

  groupInfo(groupId: string): Promise<unknown> {
    return this.client.groupInfo(Number(groupId));
  }

  syncGroupMembers(groupId: string): Promise<number> {
    return this.client.syncGroupMembers(Number(groupId));
  }

  cachedGroupMembers(
    groupId: string,
    page?: { limit?: number; offset?: number },
  ): Promise<unknown> {
    return this.client.cachedGroupMembers(Number(groupId), page);
  }

  listGroupMembers(
    groupId: string,
    page?: { limit?: number; offset?: number },
  ): Promise<unknown> {
    return this.client.groupMemberList(Number(groupId), page);
  }

  leaveGroup(groupId: string): Promise<unknown> {
    return this.client.groupMemberLeave(Number(groupId));
  }

  addGroupMember(groupId: string, userId: string, role?: string): Promise<unknown> {
    return this.client.groupMemberAdd(Number(groupId), Number(userId), role);
  }

  removeGroupMember(groupId: string, userId: string): Promise<unknown> {
    return this.client.groupMemberRemove(Number(groupId), Number(userId));
  }

  muteGroupMember(
    groupId: string,
    userId: string,
    muteDuration: number,
  ): Promise<unknown> {
    return this.client.groupMemberMute(
      Number(groupId),
      Number(userId),
      muteDuration,
    );
  }

  unmuteGroupMember(groupId: string, userId: string): Promise<unknown> {
    return this.client.groupMemberUnmute(Number(groupId), Number(userId));
  }

  setGroupMemberRole(
    groupId: string,
    userId: string,
    role: 'admin' | 'member',
  ): Promise<import('@privchat/sdk').GroupRoleSetResponse> {
    const operator = this.requireAuthenticatedUid('setGroupMemberRole');
    return this.client.groupRoleSet(
      Number(groupId),
      operator,
      Number(userId),
      role,
    );
  }

  transferGroupOwner(
    groupId: string,
    newOwnerId: string,
  ): Promise<import('@privchat/sdk').GroupTransferOwnerResponse> {
    const currentOwner = this.requireAuthenticatedUid('transferGroupOwner');
    return this.client.groupTransferOwner(
      Number(groupId),
      currentOwner,
      Number(newOwnerId),
    );
  }

  getGroupSettings(
    groupId: string,
  ): Promise<import('@privchat/sdk').GroupSettingsGetResponse> {
    return this.client.groupSettingsGet(Number(groupId));
  }

  updateGroupSettings(
    groupId: string,
    settings: import('@privchat/sdk').GroupSettingsPatch,
  ): Promise<import('@privchat/sdk').GroupSettingsUpdateResponse> {
    const operator = this.requireAuthenticatedUid('updateGroupSettings');
    return this.client.groupSettingsUpdate(Number(groupId), operator, settings);
  }

  muteGroupAll(
    groupId: string,
    muted: boolean,
  ): Promise<import('@privchat/sdk').GroupMuteAllResponse> {
    // operator 由 server 从鉴权会话取，不再从客户端传 operator_id。
    return this.client.groupMuteAll(Number(groupId), muted);
  }

  groupApprovalList(
    groupId: string,
  ): Promise<import('@privchat/sdk').GroupApprovalListResponse> {
    // operator_id 由 SDK 从 session 自填（与 groupApprovalHandle 一致）。
    return this.client.groupApprovalList(Number(groupId));
  }

  groupApprovalHandle(
    requestId: string,
    approve: boolean,
    reason?: string,
  ): Promise<import('@privchat/sdk').GroupApprovalHandleResponse> {
    return this.client.groupApprovalHandle(requestId, approve, reason);
  }

  pinGroupMessage(
    groupId: string,
    channelId: string,
    messageId: string,
    pinned: boolean,
  ): Promise<import('@privchat/sdk').MessagePinResponse> {
    return this.client.messagePin(
      Number(groupId),
      Number(channelId),
      messageId,
      pinned,
    );
  }

  listGroupPinnedMessages(
    groupId: string,
  ): Promise<import('@privchat/sdk').MessagePinListResponse> {
    return this.client.messagePinList(Number(groupId));
  }

  /** Resolve the current session uid as a `number` for wire ops that
   *  require `operator_id` / `current_owner_id`. Throws when there's
   *  no authenticated session — these RPCs cannot be issued
   *  anonymously, so failing loud at the adapter beats a confusing
   *  401-style server reject downstream. */
  private requireAuthenticatedUid(op: string): number {
    const uid = this.client.sessionSnapshot().user_id;
    if (uid === undefined) {
      throw new Error(`${op}: not authenticated`);
    }
    return Number(uid);
  }

  observeOutbox(
    cb: (entries: import('@privchat/sdk').OutboxEntry[]) => void,
  ): Unsubscribe {
    return this.client.observeOutbox(cb);
  }

  retryOutboxEntry(outboxId: string): Promise<void> {
    return this.client.retryOutboxEntry(outboxId);
  }

  discardOutboxEntry(outboxId: string): Promise<void> {
    return this.client.discardOutboxEntry(outboxId);
  }

  async sendImage(args: {
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
    /** 这份内容已经封装好的密文（`downloadAttachmentDetailed` 给的）。
     *  有它就跳过重新封装，直接进预检——否则秒传恒不命中。 */
    sealed?: { blob: Blob; cek: string; sha256: string };
  }): Promise<SendTextOperationResult> {
    const fromUid = this.client.sessionSnapshot().user_id;
    if (fromUid === undefined) throw new Error('not authenticated');
    const result = await uploadOneFile(
      this.client,
      args.file,
      args.filename,
      args.mime_type,
      'image',
      args.onProgress,
      args.sealed,
    );
    // 与 Rust SDK 发送侧对齐：缩略图是独立 file（320px），接收端(App/Rust)气泡
    // 只渲染缩略图，缺失会落成 thumb_status=3 的静态占位。生成/上传失败不阻断
    // 发送——退回无缩略图消息（接收端有原图兜底）。
    let thumb: { file_id: string; url?: string } | undefined;
    try {
      const thumbBlob = await makeImageThumbnail(args.file, 320);
      if (thumbBlob !== undefined) {
        const uploaded = await uploadOneFile(
          this.client,
          thumbBlob.blob,
          'thumb.webp',
          thumbBlob.mime,
          'image',
        );
        thumb = { file_id: String(uploaded.file_id), url: uploaded.file_url };
      }
    } catch {
      thumb = undefined;
    }
    // 图片消息协议上必须带缩略图(server 校验拒绝无缩略图的 image)。生成/上传
    // 失败或不值得独立缩略图(压不小)时,把原图引用为缩略图——接收端自动下载
    // 原图当缩略图,代价可接受,绝不发出无缩略图的图片消息。
    if (thumb === undefined) {
      thumb = { file_id: String(result.file_id), url: result.file_url };
    }
    return this.client.sendTextMessage(
      buildSendImageInput({
        channel_id: args.channel_id,
        channel_type: args.channel_type,
        from_uid: fromUid,
        caption: args.caption,
        local_message_id: args.local_message_id,
        metadata: {
          file_id: String(result.file_id),
          url: result.file_url,
          width: result.width ?? args.width,
          height: result.height ?? args.height,
          thumbnail_file_id: thumb?.file_id,
          thumbnail_url: thumb?.url,
        },
      }),
    );
  }

  async sendFile(args: {
    channel_id: string;
    channel_type: number;
    file: Blob;
    filename: string;
    mime_type: string;
    local_message_id?: string;
    caption?: string;
    onProgress?: (event: import('@privchat/sdk').UploadProgressEvent) => void;
    /** 这份内容已经封装好的密文（`downloadAttachmentDetailed` 给的）。
     *  有它就跳过重新封装，直接进预检——否则秒传恒不命中。 */
    sealed?: { blob: Blob; cek: string; sha256: string };
  }): Promise<SendTextOperationResult> {
    const fromUid = this.client.sessionSnapshot().user_id;
    if (fromUid === undefined) throw new Error('not authenticated');
    const result = await uploadOneFile(
      this.client,
      args.file,
      args.filename,
      args.mime_type,
      'file',
      args.onProgress,
      args.sealed,
    );
    const sendResult = await this.client.sendTextMessage(
      buildSendFileInput({
        channel_id: args.channel_id,
        channel_type: args.channel_type,
        from_uid: fromUid,
        caption: args.caption,
        local_message_id: args.local_message_id,
        metadata: {
          file_id: String(result.file_id),
          url: result.file_url,
          filename: args.filename,
          mime_type: args.mime_type,
          size: result.file_size,
        },
      }),
    );
    return sendResult;
  }

  async sendVideo(args: {
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
    /** 这份内容已经封装好的密文（`downloadAttachmentDetailed` 给的）。
     *  有它就跳过重新封装，直接进预检——否则秒传恒不命中。 */
    sealed?: { blob: Blob; cek: string; sha256: string };
  }): Promise<SendTextOperationResult> {
    const fromUid = this.client.sessionSnapshot().user_id;
    if (fromUid === undefined) throw new Error('not authenticated');
    // Use the same `uploadOneFile` plumbing as image/file (the
    // upload-token API is content-agnostic; `file_type` is the hint).
    const result = await uploadOneFile(
      this.client,
      args.file,
      args.filename,
      args.mime_type,
      'video',
      args.onProgress,
      args.sealed,
    );
    return this.client.sendTextMessage(
      buildSendVideoInput({
        channel_id: args.channel_id,
        channel_type: args.channel_type,
        from_uid: fromUid,
        caption: args.caption,
        local_message_id: args.local_message_id,
        metadata: {
          file_id: String(result.file_id),
          url: result.file_url,
          // Prefer the server-probed dimensions when available; the
          // caller's args are best-effort hints derived from the
          // `<video>` metadata event, which can lag a slow load.
          width: result.width ?? args.width,
          height: result.height ?? args.height,
          duration: args.duration,
          thumbnail_url: args.thumbnail_url,
        },
      }),
    );
  }

  addReaction(serverMessageId: string, emoji: string): Promise<unknown> {
    return this.client.messageReactionAdd(serverMessageId, emoji);
  }

  removeReaction(serverMessageId: string, emoji: string): Promise<unknown> {
    return this.client.messageReactionRemove(serverMessageId, emoji);
  }

  async listReactions(serverMessageId: string) {
    const resp = await this.client.messageReactionList(Number(serverMessageId));
    return { reactions: resp.reactions, total_count: resp.total_count };
  }

  async fileGetUrl(fileId: string) {
    const resp = await this.client.fileGetUrl(Number(fileId));
    return {
      file_url: resp.file_url,
      expires_at: resp.expires_at,
      file_size: resp.file_size,
      mime_type: resp.mime_type,
      original_filename: resp.original_filename,
    };
  }

  async downloadAttachmentBlob(fileId: string): Promise<Blob> {
    return this.client.downloadAttachmentBlob(Number(fileId));
  }

  // ----- QR Code v1.3 -----

  async userQrcodeGet() {
    const resp = await this.client.userQrcodeGet();
    return {
      qr_key: resp.qr_key,
      qr_code: resp.qr_code,
      user_id: String(resp.user_id),
    };
  }

  async userQrcodeRefresh() {
    const resp = await this.client.userQrcodeRefresh();
    return {
      old_qr_key: resp.old_qr_key,
      new_qr_key: resp.new_qr_key,
      qr_code: resp.qr_code,
      user_id: String(resp.user_id),
    };
  }

  async userQrcodeResolve(qrKey: string) {
    const resp = await this.client.userQrcodeResolve(qrKey);
    return {
      user_id: String(resp.user_id),
      username: resp.username,
      display_name: resp.display_name,
      avatar_url: resp.avatar_url,
      user_type: resp.user_type,
      is_friend: resp.is_friend,
      is_self: resp.is_self,
    };
  }

  async groupQrcodeGet(groupId: string) {
    const resp = await this.client.groupQrcodeGet(Number(groupId));
    return {
      qr_key: resp.qr_key,
      qr_code: resp.qr_code,
      group_id: String(resp.group_id),
    };
  }

  async groupQrcodeRefresh(groupId: string) {
    const resp = await this.client.groupQrcodeRefresh(Number(groupId));
    return {
      old_qr_key: resp.old_qr_key,
      new_qr_key: resp.new_qr_key,
      qr_code: resp.qr_code,
      group_id: String(resp.group_id),
    };
  }

  async groupJoinByQrcode(qrKey: string, message?: string) {
    const resp = await this.client.groupJoinByQrcode(qrKey, message);
    return {
      status: resp.status,
      group_id: String(resp.group_id),
      request_id: resp.request_id,
      message: resp.message,
      user_id: resp.user_id !== undefined ? String(resp.user_id) : undefined,
      joined_at: resp.joined_at,
    };
  }
}

/** 浏览器侧缩略图：长边压到 maxSide，webp(0.85) 优先、jpeg 兜底。
 *  非浏览器环境（无 createImageBitmap/document）返回 undefined，由调用方
 *  按"无缩略图"发送。压缩后不比原图小就没意义，也返回 undefined。 */
async function makeImageThumbnail(
  file: Blob,
  maxSide: number,
): Promise<{ blob: Blob; mime: string } | undefined> {
  if (
    typeof createImageBitmap !== 'function' ||
    typeof document === 'undefined'
  ) {
    return undefined;
  }
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return undefined;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const encode = (mime: string): Promise<Blob | null> =>
      new Promise((resolve) => canvas.toBlob(resolve, mime, 0.85));
    let mime = 'image/webp';
    let blob = await encode(mime);
    if (blob === null || blob.type !== 'image/webp') {
      mime = 'image/jpeg';
      blob = await encode(mime);
    }
    if (blob === null || blob.size >= file.size) return undefined;
    return { blob, mime };
  } finally {
    bitmap.close();
  }
}

/** Two-step upload: request token → multipart POST. Pulled out of the
 *  per-content-type adapter methods so they only differ in the message
 *  envelope, not in the upload plumbing. */
/** claim 失败是不是「服务端拿不到那份内容」这一种——只有它该退回整传。
 *
 *  服务端把「没有这份内容」和「有但你无权」说成同一句话（否则这个接口就是文件
 *  存在性探测器），两者都落在这里；退回整传对两者都对：真无权的人传自己的字节，
 *  本来就该被允许。 */
export function claimMissShouldReupload(e: unknown): boolean {
  // 🔴 码在 `response.code` 上，不是 `e.code`。读错位置的话这里恒为 false，
  // 回退形同虚设——claim 一 miss，整条附件发送就失败了。
  return e instanceof RpcError && e.response.code === RESOURCE_NOT_FOUND;
}

/** `ServerError::NotFound` 的协议码。 */
const RESOURCE_NOT_FOUND = 10201;

async function uploadOneFile(
  client: PrivchatClient,
  file: Blob,
  filename: string,
  mime_type: string,
  file_type: 'image' | 'voice' | 'video' | 'file' | 'other',
  onProgress?: (event: import('@privchat/sdk').UploadProgressEvent) => void,
  /** 这份内容**已经封装好的密文**（下载时服务端给的那串，已核对摘要）。
   *
   * 🔴 有它就不要再封装：加密用随机 CEK/nonce，重新封装必然产出另一串字节，
   * 摘要一变预检就不可能命中——「再发一次同一份内容」于是每次都整传。
   * 这不是转发专用参数，它就是这份内容当前的封装结果。 */
  presealed?: { blob: Blob; cek: string; sha256: string },
) {
  // 🔴 顺序：**先封装**（压缩/转码已在更上层完成），对**封装结果**求摘要，
  // 再拿这个摘要去预检。加密用随机 CEK/nonce，预检之后重新加密字节就变了，
  // 命中率恒为 0；重试也必须复用这同一个 blob。
  const sealed = presealed !== undefined
    ? {
        blob: new Uint8Array(await presealed.blob.arrayBuffer()),
        cek: presealed.cek,
        sha256: presealed.sha256,
      }
    : await sealAttachment(new Uint8Array(await file.arrayBuffer()));
  const token = await client.fileRequestUploadToken({
    // 报的是**封装后**的字节数，与摘要同一口径。
    file_size: sealed.blob.byteLength,
    mime_type,
    file_type,
    business_type: 'message',
    filename,
    sha256: sealed.sha256,
  });

  let uploadToken = token;
  if (token.already_exists === true) {
    // 服务端已经有这串字节：一个字节都不传，换一个属于自己的 file_id。
    try {
      return await client.fileClaimExisting({ token: token.token, sha256: sealed.sha256 });
    } catch (e) {
      // 🔴 秒传没成 → **照常上传**，不是发送失败。
      //
      // 预检说「有」、claim 却拿不到，是会正常发生的：那份内容的记录里没有一条
      // 是这个人现在读得到的，或者候选在这中间失效了。服务端把它和「根本没有」
      // 说成同一句话（否则接口会变成文件存在性探测器），客户端只能凭这个信号
      // 退回整传。
      //
      // 只有这一种退回。参数错、真无权、瞬时竞争各有各的处理，一并当成「传一遍」
      // 会把真问题盖掉，还白传一遍字节。
      if (!claimMissShouldReupload(e)) throw e;
      // 用**同一个已封装好的 blob** 重新要一张普通 token：重新封装会产出另一串
      // 字节，白白让服务端多存一份。
      uploadToken = await client.fileRequestUploadToken({
        file_size: sealed.blob.byteLength,
        mime_type,
        file_type,
        business_type: 'message',
        filename,
        // 不带摘要：这一次就是要传字节，不要再进秒传分支。
      });
    }
  }

  return uploadSealedFileViaToken({
    sealed,
    filename,
    uploadUrl: uploadToken.upload_url,
    token: uploadToken.token,
    onProgress,
  });
}

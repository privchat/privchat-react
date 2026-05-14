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
  uploadFileViaToken,
} from '@privchat/sdk';
import type {
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

  friendApply(
    targetUserId: number,
    message?: string,
    source?: string,
    sourceId?: string,
  ): Promise<FriendApplyResponse> {
    return this.client.friendApply(targetUserId, message, source, sourceId);
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
    return this.client.messageRevoke(Number(serverMessageId), Number(channelId));
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

  async pinChannel(channelId: string, pinned: boolean): Promise<unknown> {
    const r = await this.client.channelPin(Number(channelId), pinned);
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

  listGroupMembers(groupId: string): Promise<unknown> {
    return this.client.groupMemberList(Number(groupId));
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
    const operator = this.requireAuthenticatedUid('muteGroupAll');
    return this.client.groupMuteAll(Number(groupId), operator, muted);
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
    width: number;
    height: number;
    caption?: string;
    onProgress?: (event: import('@privchat/sdk').UploadProgressEvent) => void;
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
    );
    return this.client.sendTextMessage(
      buildSendImageInput({
        channel_id: args.channel_id,
        channel_type: args.channel_type,
        from_uid: fromUid,
        caption: args.caption,
        metadata: {
          file_id: String(result.file_id),
          url: result.file_url,
          width: result.width ?? args.width,
          height: result.height ?? args.height,
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
    caption?: string;
    onProgress?: (event: import('@privchat/sdk').UploadProgressEvent) => void;
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
    );
    return this.client.sendTextMessage(
      buildSendFileInput({
        channel_id: args.channel_id,
        channel_type: args.channel_type,
        from_uid: fromUid,
        caption: args.caption,
        metadata: {
          file_id: String(result.file_id),
          url: result.file_url,
          filename: args.filename,
          mime_type: args.mime_type,
          size: result.file_size,
        },
      }),
    );
  }

  async sendVideo(args: {
    channel_id: string;
    channel_type: number;
    file: Blob;
    filename: string;
    mime_type: string;
    width: number;
    height: number;
    duration: number;
    thumbnail_url?: string;
    caption?: string;
    onProgress?: (event: import('@privchat/sdk').UploadProgressEvent) => void;
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
    );
    return this.client.sendTextMessage(
      buildSendVideoInput({
        channel_id: args.channel_id,
        channel_type: args.channel_type,
        from_uid: fromUid,
        caption: args.caption,
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
    return this.client.messageReactionAdd(Number(serverMessageId), emoji);
  }

  removeReaction(serverMessageId: string, emoji: string): Promise<unknown> {
    return this.client.messageReactionRemove(Number(serverMessageId), emoji);
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
    };
  }
}

/** Two-step upload: request token → multipart POST. Pulled out of the
 *  per-content-type adapter methods so they only differ in the message
 *  envelope, not in the upload plumbing. */
async function uploadOneFile(
  client: PrivchatClient,
  file: Blob,
  filename: string,
  mime_type: string,
  file_type: 'image' | 'voice' | 'video' | 'file' | 'other',
  onProgress?: (event: import('@privchat/sdk').UploadProgressEvent) => void,
) {
  const token = await client.fileRequestUploadToken({
    file_size: file.size,
    mime_type,
    file_type,
    business_type: 'message',
    filename,
  });
  return uploadFileViaToken({
    file,
    filename,
    uploadUrl: token.upload_url,
    token: token.token,
    onProgress,
  });
}

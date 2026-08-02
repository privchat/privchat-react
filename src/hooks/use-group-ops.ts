// useGroupOps — imperative callbacks for group member management.
// Roster fetching is on-demand (group panels open a dialog and call
// `listMembers()` once); leave/add/remove/mute are one-shot. Same
// shape as useChannelOps — grouped to avoid hook-per-RPC ceremony.

import { useCallback, useMemo } from 'react';
import type {
  GroupInfoResponse,
  GroupMember,
  GroupMemberListResponse,
  GroupMuteAllResponse,
  GroupRoleSetResponse,
  GroupSettingsGetResponse,
  GroupSettingsPatch,
  GroupSettingsUpdateResponse,
  GroupTransferOwnerResponse,
  MessagePinResponse,
  MessagePinListResponse,
} from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';
import { isSystemUsername } from '../view-models/conversation-title.js';

export interface GroupOps {
  /** 群资料 + 请求者自己的角色 + 管理员 uid。**权限判定走这里**：
   *  「我能不能管理这个群」不许靠拉整份花名册在里面找自己
   *  （750 人 = 126 KB，会话列表里每个大群都要判一次）。见 CHANNEL_SPEC §9.2.2。 */
  groupInfo: (groupId: string) => Promise<GroupInfoResponse>;
  /** 增量同步本群成员：只取变更，退群的人由服务端 tombstone 通知。
   *  与 [cachedMembers] 配合就是 App 的三段式：读本地 → 增量同步 → 再读本地。 */
  syncMembers: (groupId: string) => Promise<number>;
  /** 读本地已缓存的成员：打开成员页时先拿它渲染，再让 [listMembers] 刷新。
   *  与 App 的两段式一致（App 一直是"读本地 → 同步 → 再读本地"）。
   *  系统账号在这里同样被滤掉，口径与 [listMembers] 一致。 */
  cachedMembers: (
    groupId: string,
    page?: { limit?: number; offset?: number },
  ) => Promise<GroupMember[]>;
  /** 不传 page = 全量（成员列表页）。九宫格这类只需要前几个的调用方
   *  MUST 传 `page.limit`，见 CHANNEL_SPEC §9.2.2。 */
  listMembers: (
    groupId: string,
    page?: { limit?: number; offset?: number },
  ) => Promise<GroupMemberListResponse>;
  leaveGroup: (groupId: string) => Promise<unknown>;
  addMember: (groupId: string, userId: string, role?: string) => Promise<unknown>;
  removeMember: (groupId: string, userId: string) => Promise<unknown>;
  /** `muteDuration` is in seconds; 0 = permanent. */
  muteMember: (
    groupId: string,
    userId: string,
    muteDuration: number,
  ) => Promise<unknown>;
  unmuteMember: (groupId: string, userId: string) => Promise<unknown>;
  /** Promote a member to admin (`'admin'`) or demote them
   *  (`'member'`). Owner-only. Server rejects with a permission error
   *  when the caller isn't the owner. */
  setMemberRole: (
    groupId: string,
    userId: string,
    role: 'admin' | 'member',
  ) => Promise<GroupRoleSetResponse>;
  /** Transfer ownership to another existing group member. The caller
   *  becomes a regular member server-side (NOT admin — see server
   *  `rpc/group/role/transfer_owner.rs:99-101`). */
  transferOwner: (
    groupId: string,
    newOwnerId: string,
  ) => Promise<GroupTransferOwnerResponse>;
  /** Read the group's mutable settings. Member-or-above can call. */
  getSettings: (groupId: string) => Promise<GroupSettingsGetResponse>;
  /** Apply a partial settings patch. Owner-only per spec — server
   *  rejects admin / member callers. Pass `''` to clear a string
   *  field; omit fields to leave them unchanged. */
  updateSettings: (
    groupId: string,
    settings: GroupSettingsPatch,
  ) => Promise<GroupSettingsUpdateResponse>;
  /** Toggle whole-group mute. Owner-only. Goes through the dedicated
   *  `group/settings/mute_all` route. */
  muteAll: (groupId: string, muted: boolean) => Promise<GroupMuteAllResponse>;
  /** Pin / unpin a group message (owner / admin only; server enforces).
   *  `pinned=false` unpins. */
  pinMessage: (
    groupId: string,
    channelId: string,
    messageId: string,
    pinned: boolean,
  ) => Promise<MessagePinResponse>;
  /** List a group's pinned messages (any member; newest-pinned first). */
  pinnedMessages: (groupId: string) => Promise<MessagePinListResponse>;
}

export function useGroupOps(): GroupOps {
  const adapter = usePrivchatClient();
  // P6-1C（CLIENT_GLOBAL_STATE §22，系统用户红线）：新协议按 user_type 过滤；
  // username 仅保留为老 server 兼容，不能再承担身份类型语义。
  const listMembers = useCallback(
    (groupId: string, page?: { limit?: number; offset?: number }) =>
      // 不传 page 时保持原来的调用形态（单参数），别给既有 adapter 实现塞一个
      // 多余的 undefined。
      ((page === undefined
        ? adapter.listGroupMembers(groupId)
        : adapter.listGroupMembers(groupId, page)) as Promise<GroupMemberListResponse>).then((resp) => {
        const members = resp.members.filter(
          (m) => m.user_type !== 1 && !isSystemUsername(m.username),
        );
        // total 是**群总人数**（服务端不随分页变化）。过滤掉几个系统账号就从
        // total 里减几个——绝不能改写成 `members.length`：分页后那是本页条数，
        // 750 人的群会显示成「成员 (9)」。
        const filtered = resp.members.length - members.length;
        return filtered === 0
          ? resp
          : { ...resp, members, total: Math.max(0, resp.total - filtered) };
      }),
    [adapter],
  );
  const groupInfo = useCallback(
    (groupId: string) => adapter.groupInfo(groupId) as Promise<GroupInfoResponse>,
    [adapter],
  );
  const syncMembers = useCallback(
    (groupId: string) => adapter.syncGroupMembers(groupId),
    [adapter],
  );
  const cachedMembers = useCallback(
    (groupId: string, page?: { limit?: number; offset?: number }) =>
      (adapter.cachedGroupMembers(groupId, page) as Promise<GroupMember[]>).then(
        (rows) => rows.filter((m) => m.user_type !== 1 && !isSystemUsername(m.username)),
      ),
    [adapter],
  );
  const leaveGroup = useCallback(
    (groupId: string) => adapter.leaveGroup(groupId),
    [adapter],
  );
  const addMember = useCallback(
    (groupId: string, userId: string, role?: string) =>
      adapter.addGroupMember(groupId, userId, role),
    [adapter],
  );
  const removeMember = useCallback(
    (groupId: string, userId: string) =>
      adapter.removeGroupMember(groupId, userId),
    [adapter],
  );
  const muteMember = useCallback(
    (groupId: string, userId: string, muteDuration: number) =>
      adapter.muteGroupMember(groupId, userId, muteDuration),
    [adapter],
  );
  const unmuteMember = useCallback(
    (groupId: string, userId: string) =>
      adapter.unmuteGroupMember(groupId, userId),
    [adapter],
  );
  const setMemberRole = useCallback(
    (groupId: string, userId: string, role: 'admin' | 'member') =>
      adapter.setGroupMemberRole(groupId, userId, role),
    [adapter],
  );
  const transferOwner = useCallback(
    (groupId: string, newOwnerId: string) =>
      adapter.transferGroupOwner(groupId, newOwnerId),
    [adapter],
  );
  const getSettings = useCallback(
    (groupId: string) => adapter.getGroupSettings(groupId),
    [adapter],
  );
  const updateSettings = useCallback(
    (groupId: string, settings: GroupSettingsPatch) =>
      adapter.updateGroupSettings(groupId, settings),
    [adapter],
  );
  const muteAll = useCallback(
    (groupId: string, muted: boolean) => adapter.muteGroupAll(groupId, muted),
    [adapter],
  );
  const pinMessage = useCallback(
    (groupId: string, channelId: string, messageId: string, pinned: boolean) =>
      adapter.pinGroupMessage(groupId, channelId, messageId, pinned),
    [adapter],
  );
  const pinnedMessages = useCallback(
    (groupId: string) => adapter.listGroupPinnedMessages(groupId),
    [adapter],
  );
  return useMemo(
    () => ({
      groupInfo,
      syncMembers,
      cachedMembers,
      listMembers,
      leaveGroup,
      addMember,
      removeMember,
      muteMember,
      unmuteMember,
      setMemberRole,
      transferOwner,
      getSettings,
      updateSettings,
      muteAll,
      pinMessage,
      pinnedMessages,
    }),
    [
      groupInfo,
      syncMembers,
      cachedMembers,
      listMembers,
      leaveGroup,
      addMember,
      removeMember,
      muteMember,
      unmuteMember,
      setMemberRole,
      transferOwner,
      getSettings,
      updateSettings,
      muteAll,
      pinMessage,
      pinnedMessages,
    ],
  );
}

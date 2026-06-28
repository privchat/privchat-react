// useGroupOps — imperative callbacks for group member management.
// Roster fetching is on-demand (group panels open a dialog and call
// `listMembers()` once); leave/add/remove/mute are one-shot. Same
// shape as useChannelOps — grouped to avoid hook-per-RPC ceremony.

import { useCallback, useMemo } from 'react';
import type {
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

export interface GroupOps {
  listMembers: (groupId: string) => Promise<GroupMemberListResponse>;
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
  const listMembers = useCallback(
    (groupId: string) =>
      adapter.listGroupMembers(groupId) as Promise<GroupMemberListResponse>,
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

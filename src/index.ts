// Public surface for @privchat/react.
//
// Headless React integration for @privchat/sdk. No visual components, no
// router, no multi-tab policy, no worker bridge implementations. The web app
// (or Tauri/Cocos host) provides the adapter; this package provides Provider,
// hooks, and ViewModel selectors.

// ----- Adapter -----
export type {
  PrivchatClientAdapter,
  Unsubscribe,
} from './adapter/client-adapter.js';
export { DirectClientAdapter } from './adapter/direct-adapter.js';

// ----- Provider -----
export {
  PrivchatProvider,
  type PrivchatProviderProps,
} from './provider/privchat-provider.js';

// ----- Hooks (R0) -----
export {
  PrivchatProviderMissingError,
  usePrivchatClient,
} from './hooks/use-privchat-client.js';
export { useConnectionState } from './hooks/use-connection-state.js';

// ----- Hooks (R1) -----
export {
  useConversation,
  type UseConversationOptions,
  type UseConversationResult,
} from './hooks/use-conversation.js';
export { useOpenConversation } from './hooks/use-open-conversation.js';

// ----- Hooks (R1.1) -----
export {
  useChannelList,
  type UseChannelListOptions,
  type UseChannelListResult,
} from './hooks/use-channel-list.js';

// ----- Hooks (R2A: profile cache) -----
export { useUserProfile } from './hooks/use-user-profile.js';
export { useGroupProfile } from './hooks/use-group-profile.js';

// ----- Hooks (R2.1: friendship cache) -----
export { useFriendship } from './hooks/use-friendship.js';

// ----- Hooks (R2.2: Contacts/Groups tab) -----
export {
  useFriendList,
  type UseFriendListOptions,
} from './hooks/use-friend-list.js';
export {
  useGroupList,
  type UseGroupListOptions,
} from './hooks/use-group-list.js';
export { useOpenDirectConversation } from './hooks/use-open-direct-conversation.js';

// ----- Hooks (R2.3: friend / group management commands) -----
export { useMessageSearch, useJumpToMessage } from './hooks/use-message-search.js';
export {
  useAccountSearch,
  useBlockUser,
  useFriendAccept,
  useFriendApply,
  useFriendPending,
  useRefreshFriendships,
  useRemoveFriend,
  useSetFriendAlias,
  useUnblockUser,
} from './hooks/use-friend-commands.js';
export { useCreateGroup } from './hooks/use-create-group.js';

// ----- Hooks (R2.4: presence) -----
export {
  usePresence,
  type UsePresenceOptions,
} from './hooks/use-presence.js';

// ----- Hooks (R3.1: message ops) -----
export { useRevokeMessage } from './hooks/use-revoke-message.js';

// ----- Hooks (R3.2: typing) -----
export {
  useTyping,
  type UseTypingOptions,
  type UseTypingResult,
} from './hooks/use-typing.js';

// ----- Hooks (R3.3: channel ops) -----
export { useChannelOps, type ChannelOps } from './hooks/use-channel-ops.js';

// ----- Hooks (R3.4: group ops) -----
export { useGroupOps, type GroupOps } from './hooks/use-group-ops.js';

// ----- Hooks (QR Code v1.3) -----
export {
  useUserQrcode,
  useGroupQrcode,
  parsePrivchatLink,
  type UserQrcodeOps,
  type GroupQrcodeOps,
  type PrivchatProtocolLink,
} from './hooks/use-qrcode.js';

// ----- Hooks (R3.5: media send) -----
export {
  useSendFile,
  useSendImage,
  useSendVideo,
  type SendFileArgs,
  type SendImageArgs,
} from './hooks/use-send-media.js';

// ----- Hooks (R3.6: reactions) -----
export {
  useMessageReactions,
  type UseMessageReactionsResult,
} from './hooks/use-message-reactions.js';

// ----- Hooks (A1: outbox retry/discard) -----
export {
  useDiscardMessage,
  useRetryMessage,
} from './hooks/use-outbox-retry.js';

// ----- View models (R1) -----
export {
  projectMessageRecord,
  type ContentTypeName,
  type FileMetadataVM,
  type ImageMetadataVM,
  type LinkMetadataVM,
  type LocationMetadataVM,
  type MediaMetadataVM,
  type MessageItemVM,
  type StickerMetadataVM,
  type VideoMetadataVM,
  type VoiceMetadataVM,
} from './view-models/message.js';

// ----- View models (R1.1) -----
export {
  projectChannelRecord,
  sortConversations,
  type ConversationListItemVM,
} from './view-models/conversation-list.js';

// ----- View models (R2A) -----
export {
  DEFAULT_TITLE_I18N,
  isSystemUser,
  resolveConversationTitle,
  type ConversationTitleI18n,
  type ConversationTitleKind,
  type ConversationTitleVM,
  type ResolveTitleInput,
} from './view-models/conversation-title.js';

// ----- View models (R2.2: Contacts/Groups) -----
export {
  CHANNEL_TYPE_DIRECT,
  CHANNEL_TYPE_GROUP,
  type OpenConversationResult,
} from './view-models/channel-type.js';
export {
  DEFAULT_FRIEND_LIST_I18N,
  projectFriendList,
  projectFriendListItem,
  type FriendListI18n,
  type FriendListItemVM,
} from './view-models/friend-list.js';
export {
  DEFAULT_GROUP_LIST_I18N,
  projectGroupList,
  projectGroupListItem,
  type GroupListI18n,
  type GroupListItemVM,
} from './view-models/group-list.js';

// useChannelOps — three imperative callbacks for the per-channel
// right-rail menu (Pin / Mute / Hide). They're grouped in one hook
// because they're invariably surfaced together — and because building
// three near-identical hook files for a 1-line RPC each is ceremony.
//
// `pinChannel` / `muteChannel` take an explicit boolean: today's
// `ChannelRecord` doesn't track the current pinned/muted state, so
// callers expose both directions in the menu and the user picks. When
// schema gains those fields, callers can drop one of the directions.

import { useCallback, useMemo } from 'react';
import { usePrivchatClient } from './use-privchat-client.js';

export interface ChannelOps {
  pinChannel: (channelId: string, pinned: boolean) => Promise<unknown>;
  muteChannel: (channelId: string, muted: boolean) => Promise<unknown>;
  hideChannel: (channelId: string) => Promise<unknown>;
}

export function useChannelOps(): ChannelOps {
  const adapter = usePrivchatClient();
  const pinChannel = useCallback(
    (channelId: string, pinned: boolean) =>
      adapter.pinChannel(channelId, pinned),
    [adapter],
  );
  const muteChannel = useCallback(
    (channelId: string, muted: boolean) =>
      adapter.muteChannel(channelId, muted),
    [adapter],
  );
  const hideChannel = useCallback(
    (channelId: string) => adapter.hideChannel(channelId),
    [adapter],
  );
  return useMemo(
    () => ({ pinChannel, muteChannel, hideChannel }),
    [pinChannel, muteChannel, hideChannel],
  );
}

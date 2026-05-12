import { useCallback, useSyncExternalStore } from 'react';
import type { ConnectionState } from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';

/**
 * Subscribes to the SDK's connection state via useSyncExternalStore. Re-renders
 * the consuming component on every connection_state_changed event. Returns the
 * current state synchronously (no `undefined` initial value).
 */
export function useConnectionState(): ConnectionState {
  const adapter = usePrivchatClient();

  const subscribe = useCallback(
    (onChange: () => void) =>
      adapter.observeEvents((env) => {
        if (env.event.type === 'connection_state_changed') onChange();
      }),
    [adapter],
  );

  const getSnapshot = useCallback(() => adapter.connectionState(), [adapter]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

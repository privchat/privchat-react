import type { ReactNode } from 'react';
import type { PrivchatClientAdapter } from '../adapter/client-adapter.js';
import { PrivchatContext } from './privchat-context.js';

export interface PrivchatProviderProps {
  adapter: PrivchatClientAdapter;
  children: ReactNode;
}

/**
 * Roots the React tree to a PrivchatClientAdapter instance. Hooks below this
 * boundary read from the adapter via context.
 *
 * The Provider does not own connection lifecycle. The host (web app, Tauri,
 * Cocos) constructs the underlying client, calls connect()/authenticate(),
 * and disposes it on unmount. This keeps @privchat/react decoupled from
 * lifecycle policy that varies between platforms.
 */
export function PrivchatProvider({ adapter, children }: PrivchatProviderProps) {
  return (
    <PrivchatContext.Provider value={adapter}>
      {children}
    </PrivchatContext.Provider>
  );
}

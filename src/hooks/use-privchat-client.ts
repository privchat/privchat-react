import { useContext } from 'react';
import type { PrivchatClientAdapter } from '../adapter/client-adapter.js';
import { PrivchatContext } from '../provider/privchat-context.js';

export class PrivchatProviderMissingError extends Error {
  constructor() {
    super(
      'usePrivchatClient must be called inside <PrivchatProvider>. ' +
        'Wrap your app root with <PrivchatProvider adapter={...}>.',
    );
    this.name = 'PrivchatProviderMissingError';
  }
}

/**
 * Returns the PrivchatClientAdapter rooted at the nearest <PrivchatProvider>.
 * Throws if no provider is mounted.
 */
export function usePrivchatClient(): PrivchatClientAdapter {
  const adapter = useContext(PrivchatContext);
  if (adapter === null) throw new PrivchatProviderMissingError();
  return adapter;
}

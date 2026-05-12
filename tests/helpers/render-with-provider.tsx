// Wraps `renderHook` so each test can pass an adapter directly. Saves
// every test from re-declaring the inline `wrapper:` boilerplate.

import type { ReactNode } from 'react';
import { renderHook, type RenderHookResult } from '@testing-library/react';
import {
  PrivchatProvider,
  type PrivchatClientAdapter,
} from '../../src/index.js';

export function renderHookWithAdapter<TProps, TResult>(
  hook: (props: TProps) => TResult,
  adapter: PrivchatClientAdapter,
  initialProps?: TProps,
): RenderHookResult<TResult, TProps> {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <PrivchatProvider adapter={adapter}>{children}</PrivchatProvider>
  );
  return renderHook(hook, { wrapper, initialProps });
}

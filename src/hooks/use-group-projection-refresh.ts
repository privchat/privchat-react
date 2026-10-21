import { useEffect, useRef } from 'react';
import { usePrivchatClient } from './use-privchat-client.js';

/** Notifications accelerate reads; entry/resume and bounded reconciliation repair missed pushes. */
export function useGroupProjectionRefresh(
  channelId: string | undefined,
  topic: 'pinned_messages_changed' | 'group_profile_changed',
  refresh: () => Promise<void>,
): void {
  const adapter = usePrivchatClient();
  const callback = useRef(refresh);
  callback.current = refresh;
  useEffect(() => {
    if (channelId === undefined) return;
    let disposed = false;
    let running = false;
    let pending = false;
    const run = async () => {
      if (disposed) return;
      if (running) { pending = true; return; }
      running = true;
      do {
        pending = false;
        await callback.current().catch(() => {});
      } while (pending && !disposed);
      running = false;
    };
    const off = adapter.observeEvents(({ event }) => {
      if (event.type === 'connection_state_changed' ||
          (event.type === 'channel_publish_received' && event.channel_id === channelId && event.topic === topic)) {
        void run();
      }
    });
    const resume = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') void run();
    };
    const timer = setInterval(resume, 30_000);
    globalThis.addEventListener?.('focus', resume);
    globalThis.document?.addEventListener('visibilitychange', resume);
    void run();
    return () => {
      disposed = true;
      off();
      clearInterval(timer);
      globalThis.removeEventListener?.('focus', resume);
      globalThis.document?.removeEventListener('visibilitychange', resume);
    };
  }, [adapter, channelId, topic]);
}

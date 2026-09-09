import { useEffect } from 'react';
import type { UserDetailSource } from '@privchat/sdk';
import { usePrivchatClient } from './use-privchat-client.js';

/**
 * Calibrate one profile against the server when a profile surface opens.
 *
 * AVATAR_CACHE_SPEC §2 makes opening a profile a forced remote fetch: a
 * contact who renamed themselves or removed their avatar should be correct the
 * moment you look at them, not on the next entity sync. Everywhere else keeps
 * reading the cache, which is right for list rendering and wrong here — looking
 * someone up is exactly the moment the cached answer is least trustworthy.
 *
 * The fetch persists through the normal merge, so the conversation title and
 * the contact row update with it rather than the open card being the only
 * corrected surface.
 *
 * `source` is a visibility gate on the server, not decoration: it must describe
 * where the viewer actually encountered this user. Passing `undefined` skips
 * the fetch instead of inventing one — a fabricated source is rejected, and the
 * SDK's own history has a case of that being retried 178k times a day.
 */
export function useProfileRefresh(
  userId: string | number | undefined,
  source: UserDetailSource | undefined,
  sourceId: string | undefined,
): void {
  const adapter = usePrivchatClient();
  useEffect(() => {
    if (userId === undefined || source === undefined || sourceId === undefined) {
      return;
    }
    const target = typeof userId === 'string' ? Number(userId) : userId;
    if (!Number.isFinite(target) || target <= 0) return;
    let cancelled = false;
    void adapter
      .refreshUserProfile({ target_user_id: target, source, source_id: sourceId })
      .catch(() => {
        // Offline or refused: the cached row stays on screen. A profile card is
        // not worth turning into an error state over a failed calibration.
      })
      .finally(() => {
        if (cancelled) return;
      });
    return () => {
      cancelled = true;
    };
  }, [adapter, userId, source, sourceId]);
}

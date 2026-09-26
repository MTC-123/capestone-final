'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { OFFICIALS_CHANNEL, REALTIME_EVENT, userChannel, type RealtimeDetail } from '@/lib/realtime/channels';

/**
 * Live updates over Ably. Subscribes the signed-in user to their own channel
 * (and officials to the officials channel) and re-broadcasts each message as a
 * `ricer:realtime` window event, so the notification bell and the map refresh
 * at once instead of on their next poll. Without Ably configured the token
 * endpoint answers 501 and the app keeps polling, unchanged.
 */
export function useRealtime(): void {
  const userId = useAuthStore((s) => s.user?.id);
  const role = useAuthStore((s) => s.user?.role);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let close: (() => void) | undefined;

    (async () => {
      const probe = await fetchWithAuth('/api/realtime/token', { cache: 'no-store' }).catch(() => null);
      // Only the status matters here; release the body so the request completes.
      await probe?.body?.cancel().catch(() => undefined);
      if (!probe?.ok || cancelled) return;

      const Ably = await import('ably');
      if (cancelled) return;
      const client = new Ably.Realtime({
        authCallback: (_params, callback) => {
          fetchWithAuth('/api/realtime/token', { cache: 'no-store' })
            .then(async (res) => (res.ok ? callback(null, await res.json()) : callback(`token ${res.status}`, null)))
            .catch((error: unknown) => callback(String(error), null));
        },
        closeOnUnload: true,
      });
      close = () => client.close();

      const channels = [userChannel(userId), ...(role === 'OFFICIAL' ? [OFFICIALS_CHANNEL] : [])];
      for (const name of channels) {
        void client.channels.get(name).subscribe((message) => {
          const data = (message.data ?? {}) as { subject?: string; meta?: { targetType?: string; targetId?: string } };
          const detail: RealtimeDetail = {
            channel: name,
            subject: data.subject,
            targetType: data.meta?.targetType,
            targetId: data.meta?.targetId,
          };
          window.dispatchEvent(new CustomEvent<RealtimeDetail>(REALTIME_EVENT, { detail }));
        });
      }
    })();

    return () => {
      cancelled = true;
      close?.();
    };
  }, [userId, role]);
}

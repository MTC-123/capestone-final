/**
 * Tiny change-notification bus for the offline engine.
 *
 * Same-tab subscribers (the zustand store backing useOfflineQueue) get an
 * immediate, synchronous callback. Other tabs are notified via a shared
 * BroadcastChannel named "ricer-offline" so every open tab converges on the
 * same queue state.
 */

export type OfflineChangeEvent =
  | { type: 'submission-updated'; clientSubmissionId: string }
  | { type: 'submission-removed'; clientSubmissionId: string }
  | { type: 'sync-start' }
  | { type: 'sync-end'; lastSyncAt: string }
  | { type: 'online-changed'; online: boolean };

export const CHANNEL_NAME = 'ricer-offline';

type Listener = (event: OfflineChangeEvent) => void;

const listeners = new Set<Listener>();
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<OfflineChangeEvent>) => {
      for (const listener of listeners) listener(event.data);
    };
  }
  return channel;
}

/** Notify this tab's subscribers immediately, and broadcast to other tabs. */
export function emitOfflineChange(event: OfflineChangeEvent): void {
  for (const listener of listeners) listener(event);
  getChannel()?.postMessage(event);
}

/** Subscribe to changes originating from this tab or any other tab. Returns an unsubscribe function. */
export function subscribeOfflineChanges(listener: Listener): () => void {
  getChannel(); // ensure the channel is open so cross-tab messages are received
  listeners.add(listener);
  return () => listeners.delete(listener);
}

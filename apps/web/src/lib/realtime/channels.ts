/**
 * Realtime channel names shared by the server (publishers) and the browser
 * (subscribers), and the subscribe-only capability each role receives.
 */

export const OFFICIALS_CHANNEL = 'ricer:officials';
export const userChannel = (userId: string) => `ricer:user:${userId}`;

/** Browser event fired when a realtime message arrives, for data to refresh. */
export const REALTIME_EVENT = 'ricer:realtime';

export interface RealtimeDetail {
  channel: string;
  subject?: string;
  targetType?: string;
  targetId?: string;
}

export function realtimeCapability(userId: string, role: string): Record<string, string[]> {
  const capability: Record<string, string[]> = { [userChannel(userId)]: ['subscribe'] };
  if (role === 'OFFICIAL') {
    capability[OFFICIALS_CHANNEL] = ['subscribe'];
    capability['vehicles:*'] = ['subscribe'];
  }
  return capability;
}

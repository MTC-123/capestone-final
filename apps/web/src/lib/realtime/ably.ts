/**
 * Ably Realtime Server Utility (env-gated)
 * Only initializes if ABLY_API_KEY is set and ably package is installed
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

let ablyClient: any = null;

async function getAblyServer(): Promise<any> {
  if (!process.env.ABLY_API_KEY) return null;
  if (!ablyClient) {
    try {
      // Dynamic import to avoid bundling Ably when not configured
      const Ably = await import('ably');
      const AblyRest = Ably.default?.Rest ?? Ably.Rest;
      if (AblyRest) {
        ablyClient = new AblyRest({ key: process.env.ABLY_API_KEY });
      }
    } catch {
      // Ably package not installed — silently degrade
      return null;
    }
  }
  return ablyClient;
}

/**
 * Publish vehicle telemetry to Ably channel
 * No-op if Ably is not configured or package is not installed
 */
export async function publishVehicleTelemetry(vehicleId: string, data: unknown): Promise<void> {
  const ably = await getAblyServer();
  if (!ably) return;
  try {
    const channel = ably.channels.get(`vehicles:${vehicleId}`);
    await channel.publish('telemetry', data);
  } catch {
    // Silently fail — telemetry publishing is best-effort
  }
}

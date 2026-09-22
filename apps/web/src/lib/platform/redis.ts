import { createClient, type RedisClientType } from 'redis';
import { logger } from '@/lib/observability/logger';

let clientPromise: Promise<RedisClientType> | null = null;

export async function getRedisClient(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (!clientPromise) {
    const client: RedisClientType = createClient({ url });
    client.on('error', (error) => {
      logger.error({
        event: 'redis_error',
        error: { name: (error as Error)?.name, message: (error as Error)?.message, stack: (error as Error)?.stack },
      });
    });
    clientPromise = client.connect().then(() => client);
  }

  return clientPromise;
}

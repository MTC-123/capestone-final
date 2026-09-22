import { createClient } from 'redis';
import { logger } from '@/lib/observability/logger';

const QUEUE_KEY = 'ricer:notification:queue';
const MAX_RETRIES = 3;

export interface NotificationJob {
  id: string;
  reportId: string;
  recipients: string[];
  message: string;
  attempts: number;
  createdAt: string;
}

let redisClient: ReturnType<typeof createClient> | null = null;

function getRedisClient(): ReturnType<typeof createClient> {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          const delay = Math.min(retries * 50, 2000);
          return delay;
        },
      },
    });

    redisClient.on('error', (err) => {
      logger.error({ event: 'redis_error', error: { message: String(err) } });
    });

    // Connect the client
    redisClient.connect().catch((err) => {
      logger.error({ event: 'redis_connection_failed', error: { message: String(err) } });
    });
  }

  return redisClient;
}

export async function enqueueNotification(
  reportId: string,
  recipients: string[],
  message: string
): Promise<void> {
  try {
    const redis = getRedisClient();

    const job: NotificationJob = {
      id: `${reportId}-${Date.now()}`,
      reportId,
      recipients,
      message,
      attempts: 0,
      createdAt: new Date().toISOString(),
    };

    await redis.lPush(QUEUE_KEY, JSON.stringify(job));
    logger.info({ event: 'job_enqueued', meta: { jobId: job.id } });
  } catch (error) {
    logger.error({ event: 'enqueue_failed', error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) } });
    // Don't throw - notification is non-critical
  }
}

export async function dequeueNotification(): Promise<NotificationJob | null> {
  try {
    const redis = getRedisClient();
    const result = await redis.rPop(QUEUE_KEY);

    if (!result) {
      return null;
    }

    return JSON.parse(result) as NotificationJob;
  } catch (error) {
    logger.error({ event: 'dequeue_failed', error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) } });
    return null;
  }
}

export async function requeueNotification(job: NotificationJob): Promise<void> {
  if (job.attempts >= MAX_RETRIES) {
    logger.error({ event: 'max_retries_exceeded', meta: { jobId: job.id } });
    await addToDeadLetterQueue(job);
    return;
  }

  try {
    const redis = getRedisClient();
    job.attempts += 1;
    await redis.lPush(QUEUE_KEY, JSON.stringify(job));
    logger.info({ event: 'job_requeued', meta: { jobId: job.id, attempts: job.attempts, maxRetries: MAX_RETRIES } });
  } catch (error) {
    logger.error({ event: 'requeue_failed', error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) } });
  }
}

async function addToDeadLetterQueue(job: NotificationJob): Promise<void> {
  try {
    const redis = getRedisClient();
    const dlqKey = 'ricer:notification:dlq';
    await redis.lPush(dlqKey, JSON.stringify(job));
  } catch (error) {
    logger.error({ event: 'dlq_add_failed', error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) } });
  }
}

export async function getQueueDepth(): Promise<number> {
  try {
    const redis = getRedisClient();
    return await redis.lLen(QUEUE_KEY);
  } catch (error) {
    logger.error({ event: 'queue_depth_failed', error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) } });
    return 0;
  }
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

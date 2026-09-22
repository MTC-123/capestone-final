import { getTwilioClient, isTwilioConfigured } from './twilio';
import { dequeueNotification, requeueNotification, getQueueDepth } from './queue';
import { logger } from '@/lib/observability/logger';

const POLL_INTERVAL_MS = 2000;
const BATCH_SIZE = 5;
const TWILIO_RATE_LIMIT_DELAY_MS = 1000;

let isRunning = false;
let workerInterval: NodeJS.Timeout | null = null;

export function startNotificationWorker(): void {
  if (isRunning) {
    logger.info({ event: 'worker_already_running' });
    return;
  }

  if (!isTwilioConfigured()) {
    logger.info({ event: 'twilio_not_configured' });
    return;
  }

  logger.info({ event: 'worker_starting' });
  isRunning = true;

  workerInterval = setInterval(async () => {
    await processNotificationBatch();
  }, POLL_INTERVAL_MS);

  logger.info({ event: 'worker_started' });
}

export function stopNotificationWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }

  isRunning = false;
  logger.info({ event: 'worker_stopped' });
}

async function processNotificationBatch(): Promise<void> {
  try {
    const depth = await getQueueDepth();
    if (depth === 0) {
      return;
    }

    logger.info({ event: 'processing_batch', meta: { queueDepth: depth } });

    const jobsToProcess = Math.min(BATCH_SIZE, depth);

    for (let i = 0; i < jobsToProcess; i++) {
      const job = await dequeueNotification();
      if (!job) {
        break;
      }

      await processNotificationJob(job);

      // Rate limiting: wait between Twilio API calls
      if (i < jobsToProcess - 1) {
        await sleep(TWILIO_RATE_LIMIT_DELAY_MS);
      }
    }
  } catch (error) {
    logger.error({ event: 'batch_processing_error', error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) } });
  }
}

async function processNotificationJob(
  job: ReturnType<typeof dequeueNotification> extends Promise<infer T> ? T : never
): Promise<void> {
  if (!job) return;

  logger.info({ event: 'processing_job', meta: { jobId: job.id, attempt: job.attempts + 1 } });

  try {
    const client = getTwilioClient();
    const whatsappFrom = process.env.TWILIO_WHATSAPP_NUMBER;

    if (!whatsappFrom) {
      throw new Error('TWILIO_WHATSAPP_NUMBER not configured');
    }

    const results = await Promise.allSettled(
      job.recipients.map(async (recipient) => {
        try {
          const result = await client.messages.create({
            from: whatsappFrom,
            to: recipient,
            body: job.message,
          });

          logger.info({ event: 'message_sent', meta: { recipient, sid: result.sid } });
          return result;
        } catch (error) {
          logger.error({ event: 'message_send_failed', meta: { recipient }, error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) } });
          throw error;
        }
      })
    );

    const failures = results.filter((r) => r.status === 'rejected');

    if (failures.length === job.recipients.length) {
      // All messages failed, requeue with backoff
      logger.error({ event: 'all_messages_failed', meta: { jobId: job.id } });
      await sleep(getRetryDelay(job.attempts));
      await requeueNotification(job);
    } else if (failures.length > 0) {
      // Partial failure, log but consider successful
      logger.warn({ event: 'partial_failure', meta: { jobId: job.id, failures: failures.length, total: job.recipients.length } });
    } else {
      logger.info({ event: 'job_completed', meta: { jobId: job.id } });
    }
  } catch (error) {
    logger.error({ event: 'job_processing_error', meta: { jobId: job.id }, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) } });
    await sleep(getRetryDelay(job.attempts));
    await requeueNotification(job);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Exponential backoff calculation for retries
export function getRetryDelay(attempts: number): number {
  return Math.min(1000 * Math.pow(2, attempts), 30000);
}

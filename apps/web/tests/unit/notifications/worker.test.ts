/**
 * Unit Tests: Notification worker
 *
 * Covers:
 *   - startNotificationWorker: no-op when Twilio not configured, idempotent
 *   - stopNotificationWorker: clears interval
 *   - Batch processing: respects BATCH_SIZE, skips empty queue
 *   - Job processing: Twilio messages.create, requeue on failure
 *   - getRetryDelay: exponential backoff
 *   - Backoff delay applied before requeue (Fix 2)
 */

import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';

// ---- Mocks ----

const mockTwilioClient = {
  messages: {
    create: vi.fn().mockResolvedValue({ sid: 'SM_test_sid' }),
  },
};

vi.mock('@/lib/notifications/twilio', () => ({
  isTwilioConfigured: vi.fn(() => true),
  getTwilioClient: vi.fn(() => mockTwilioClient),
}));

const mockDequeue = vi.fn().mockResolvedValue(null);
const mockRequeue = vi.fn().mockResolvedValue(undefined);
const mockGetQueueDepth = vi.fn().mockResolvedValue(0);

vi.mock('@/lib/notifications/queue', () => ({
  dequeueNotification: (...args: unknown[]) => mockDequeue(...args),
  requeueNotification: (...args: unknown[]) => mockRequeue(...args),
  getQueueDepth: (...args: unknown[]) => mockGetQueueDepth(...args),
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  startNotificationWorker,
  stopNotificationWorker,
  getRetryDelay,
} from '@/lib/notifications/worker';
import { isTwilioConfigured } from '@/lib/notifications/twilio';

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    reportId: 'report-1',
    recipients: ['whatsapp:+212600000001'],
    message: 'Fire alert!',
    attempts: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Helper: advance fake timers in small increments to allow
 * async batch processing (which creates internal sleeps) to complete.
 */
async function tickTimers(totalMs: number, stepMs = 500) {
  for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
    await vi.advanceTimersByTimeAsync(stepMs);
  }
}

describe('Notification worker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Reset module-level state
    stopNotificationWorker();
    vi.mocked(isTwilioConfigured).mockReturnValue(true);
    process.env.TWILIO_WHATSAPP_NUMBER = 'whatsapp:+14155238886';
  });

  afterEach(() => {
    stopNotificationWorker();
    vi.useRealTimers();
  });

  // ---- startNotificationWorker ----

  describe('startNotificationWorker()', () => {
    it('no-ops when Twilio is not configured', async () => {
      vi.mocked(isTwilioConfigured).mockReturnValue(false);
      startNotificationWorker();

      await tickTimers(5000);
      expect(mockGetQueueDepth).not.toHaveBeenCalled();
    });

    it('is idempotent - calling twice does not create duplicate intervals', async () => {
      mockGetQueueDepth.mockResolvedValue(0);
      startNotificationWorker();
      startNotificationWorker(); // second call

      await vi.advanceTimersByTimeAsync(2000);

      // Only one interval tick should fire
      expect(mockGetQueueDepth).toHaveBeenCalledTimes(1);
    });
  });

  // ---- stopNotificationWorker ----

  describe('stopNotificationWorker()', () => {
    it('clears the polling interval', async () => {
      startNotificationWorker();
      stopNotificationWorker();

      mockGetQueueDepth.mockResolvedValue(1);
      await tickTimers(10000);
      expect(mockGetQueueDepth).not.toHaveBeenCalled();
    });
  });

  // ---- Batch processing ----

  describe('Batch processing', () => {
    it('skips processing when queue is empty', async () => {
      mockGetQueueDepth.mockResolvedValue(0);
      startNotificationWorker();

      await vi.advanceTimersByTimeAsync(2000);

      expect(mockDequeue).not.toHaveBeenCalled();
    });

    it('processes up to BATCH_SIZE (5) jobs per tick', async () => {
      // Only return 8 on the first poll, then 0 so subsequent ticks are no-ops
      mockGetQueueDepth.mockResolvedValueOnce(8).mockResolvedValue(0);
      const job = makeJob();
      mockDequeue.mockResolvedValue(job);

      startNotificationWorker();

      // The batch loop processes 5 jobs with rate-limit sleeps (1000ms each) between them.
      // Interval fires at 2000ms; 5 jobs with 4 sleeps of 1000ms = 4000ms extra.
      // Advance enough time in increments for all internal timers to resolve.
      await tickTimers(12000);

      // Should have called dequeue exactly 5 times (BATCH_SIZE)
      expect(mockDequeue).toHaveBeenCalledTimes(5);
    });

    it('stops early when dequeue returns null', async () => {
      mockGetQueueDepth.mockResolvedValueOnce(3).mockResolvedValue(0);
      mockDequeue
        .mockResolvedValueOnce(makeJob({ id: 'j1' }))
        .mockResolvedValueOnce(null);

      startNotificationWorker();
      await tickTimers(6000);

      // Called twice: once got a job, second returned null → break
      expect(mockDequeue).toHaveBeenCalledTimes(2);
    });
  });

  // ---- Job processing ----

  describe('Job processing', () => {
    it('calls messages.create with correct from/to/body', async () => {
      const job = makeJob();
      mockGetQueueDepth.mockResolvedValueOnce(1).mockResolvedValue(0);
      mockDequeue.mockResolvedValueOnce(job).mockResolvedValue(null);

      startNotificationWorker();
      await tickTimers(4000);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        from: 'whatsapp:+14155238886',
        to: 'whatsapp:+212600000001',
        body: 'Fire alert!',
      });
    });

    it('requeues job when all recipients fail', async () => {
      const job = makeJob({ recipients: ['whatsapp:+212600000001', 'whatsapp:+212600000002'] });
      mockGetQueueDepth.mockResolvedValueOnce(1).mockResolvedValue(0);
      mockDequeue.mockResolvedValueOnce(job).mockResolvedValue(null);
      mockTwilioClient.messages.create.mockRejectedValue(new Error('Twilio 429'));

      startNotificationWorker();
      // Need enough time for: interval(2s) + backoff sleep(getRetryDelay(0)=1s) + requeue
      await tickTimers(6000);

      expect(mockRequeue).toHaveBeenCalledWith(job);
    });

    it('does not requeue on partial failure', async () => {
      const job = makeJob({ recipients: ['whatsapp:+212600000001', 'whatsapp:+212600000002'] });
      mockGetQueueDepth.mockResolvedValueOnce(1).mockResolvedValue(0);
      mockDequeue.mockResolvedValueOnce(job).mockResolvedValue(null);
      mockTwilioClient.messages.create
        .mockResolvedValueOnce({ sid: 'SM1' })
        .mockRejectedValueOnce(new Error('fail'));

      startNotificationWorker();
      await tickTimers(4000);

      expect(mockRequeue).not.toHaveBeenCalled();
    });

    it('requeues on total job processing error (e.g., missing TWILIO_WHATSAPP_NUMBER)', async () => {
      delete process.env.TWILIO_WHATSAPP_NUMBER;
      const job = makeJob();
      mockGetQueueDepth.mockResolvedValueOnce(1).mockResolvedValue(0);
      mockDequeue.mockResolvedValueOnce(job).mockResolvedValue(null);

      startNotificationWorker();
      // Backoff: getRetryDelay(0)=1000ms
      await tickTimers(6000);

      expect(mockRequeue).toHaveBeenCalledWith(job);
    });
  });

  // ---- getRetryDelay ----

  describe('getRetryDelay()', () => {
    it('returns correct exponential backoff values', () => {
      expect(getRetryDelay(0)).toBe(1000);   // 1s
      expect(getRetryDelay(1)).toBe(2000);   // 2s
      expect(getRetryDelay(2)).toBe(4000);   // 4s
      expect(getRetryDelay(3)).toBe(8000);   // 8s
      expect(getRetryDelay(4)).toBe(16000);  // 16s
    });

    it('caps at 30000ms', () => {
      expect(getRetryDelay(5)).toBe(30000);
      expect(getRetryDelay(10)).toBe(30000);
    });
  });

  // ---- Backoff applied before requeue (Fix 2 verification) ----

  describe('Backoff before requeue', () => {
    it('applies delay before requeueing on total failure', async () => {
      const job = makeJob({ attempts: 1 });
      mockGetQueueDepth.mockResolvedValueOnce(1).mockResolvedValue(0);
      mockDequeue.mockResolvedValueOnce(job).mockResolvedValue(null);
      mockTwilioClient.messages.create.mockRejectedValue(new Error('fail'));

      startNotificationWorker();

      // At 2s the interval fires and job processing starts.
      // All recipients fail → backoff = getRetryDelay(1) = 2000ms.
      // Requeue should NOT have been called immediately after interval fires.
      await vi.advanceTimersByTimeAsync(2100);
      expect(mockRequeue).not.toHaveBeenCalled();

      // After backoff elapses (2s more) → requeue called
      await tickTimers(3000);
      expect(mockRequeue).toHaveBeenCalledWith(job);
    });
  });
});

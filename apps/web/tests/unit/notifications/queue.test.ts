/**
 * Unit Tests: Redis notification queue
 *
 * Covers:
 *   - enqueueNotification: push + error swallowing
 *   - dequeueNotification: parse + null on empty / error
 *   - requeueNotification: attempt increment + dead-letter at max
 *   - getQueueDepth: count + 0 on error
 *   - closeRedisConnection: cleanup
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { NotificationJob } from '@/lib/notifications/queue';

// Fake Redis client
const fakeRedis = {
  lPush: vi.fn().mockResolvedValue(1),
  rPop: vi.fn().mockResolvedValue(null),
  lLen: vi.fn().mockResolvedValue(0),
  quit: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
};

vi.mock('redis', () => ({
  createClient: vi.fn(() => fakeRedis),
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Helper to get a fresh module (clears internal singleton)
async function freshImport() {
  vi.resetModules();
  vi.doMock('redis', () => ({
    createClient: vi.fn(() => fakeRedis),
  }));
  vi.doMock('@/lib/observability/logger', () => ({
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }));
  return import('@/lib/notifications/queue');
}

describe('Notification queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeRedis.lPush.mockResolvedValue(1);
    fakeRedis.rPop.mockResolvedValue(null);
    fakeRedis.lLen.mockResolvedValue(0);
    fakeRedis.quit.mockResolvedValue(undefined);
    fakeRedis.connect.mockResolvedValue(undefined);
  });

  // ---- enqueueNotification ----

  describe('enqueueNotification()', () => {
    it('pushes a correctly shaped job to Redis', async () => {
      const { enqueueNotification } = await freshImport();

      await enqueueNotification('report-1', ['whatsapp:+212600000001'], 'test message');

      expect(fakeRedis.lPush).toHaveBeenCalledOnce();
      const [key, payload] = fakeRedis.lPush.mock.calls[0];
      expect(key).toBe('ricer:notification:queue');

      const job = JSON.parse(payload) as NotificationJob;
      expect(job.reportId).toBe('report-1');
      expect(job.recipients).toEqual(['whatsapp:+212600000001']);
      expect(job.message).toBe('test message');
      expect(job.attempts).toBe(0);
      expect(job.id).toContain('report-1');
      expect(job.createdAt).toBeDefined();
    });

    it('swallows Redis errors without throwing', async () => {
      fakeRedis.lPush.mockRejectedValueOnce(new Error('Redis down'));
      const { enqueueNotification } = await freshImport();

      await expect(
        enqueueNotification('report-2', ['whatsapp:+212600000002'], 'msg')
      ).resolves.toBeUndefined();
    });

    it('pushes correct recipients array for multiple recipients', async () => {
      const { enqueueNotification } = await freshImport();
      const recipients = ['whatsapp:+212600000001', 'whatsapp:+212600000002'];

      await enqueueNotification('report-3', recipients, 'multi');

      const job = JSON.parse(fakeRedis.lPush.mock.calls[0][1]) as NotificationJob;
      expect(job.recipients).toEqual(recipients);
    });
  });

  // ---- dequeueNotification ----

  describe('dequeueNotification()', () => {
    it('returns a parsed job when Redis has data', async () => {
      const stored: NotificationJob = {
        id: 'job-1',
        reportId: 'report-1',
        recipients: ['whatsapp:+212600000001'],
        message: 'hello',
        attempts: 0,
        createdAt: new Date().toISOString(),
      };
      fakeRedis.rPop.mockResolvedValueOnce(JSON.stringify(stored));
      const { dequeueNotification } = await freshImport();

      const job = await dequeueNotification();

      expect(job).toEqual(stored);
    });

    it('returns null when queue is empty', async () => {
      fakeRedis.rPop.mockResolvedValueOnce(null);
      const { dequeueNotification } = await freshImport();

      const job = await dequeueNotification();
      expect(job).toBeNull();
    });

    it('returns null on Redis error', async () => {
      fakeRedis.rPop.mockRejectedValueOnce(new Error('fail'));
      const { dequeueNotification } = await freshImport();

      const job = await dequeueNotification();
      expect(job).toBeNull();
    });
  });

  // ---- requeueNotification ----

  describe('requeueNotification()', () => {
    it('increments attempts and pushes back to queue', async () => {
      const { requeueNotification } = await freshImport();

      const job: NotificationJob = {
        id: 'job-requeue',
        reportId: 'r1',
        recipients: ['whatsapp:+212600000001'],
        message: 'msg',
        attempts: 0,
        createdAt: new Date().toISOString(),
      };

      await requeueNotification(job);

      expect(fakeRedis.lPush).toHaveBeenCalledOnce();
      const pushed = JSON.parse(fakeRedis.lPush.mock.calls[0][1]) as NotificationJob;
      expect(pushed.attempts).toBe(1);
    });

    it('sends job to dead-letter queue at max retries (3)', async () => {
      const { requeueNotification } = await freshImport();

      const job: NotificationJob = {
        id: 'job-dlq',
        reportId: 'r2',
        recipients: ['whatsapp:+212600000001'],
        message: 'msg',
        attempts: 3,
        createdAt: new Date().toISOString(),
      };

      await requeueNotification(job);

      // Should push to DLQ key, not the main queue on the first call
      const dlqCall = fakeRedis.lPush.mock.calls.find(
        (call: string[]) => call[0] === 'ricer:notification:dlq'
      );
      expect(dlqCall).toBeDefined();
    });
  });

  // ---- getQueueDepth ----

  describe('getQueueDepth()', () => {
    it('returns the queue length', async () => {
      fakeRedis.lLen.mockResolvedValueOnce(7);
      const { getQueueDepth } = await freshImport();

      const depth = await getQueueDepth();
      expect(depth).toBe(7);
    });

    it('returns 0 on Redis error', async () => {
      fakeRedis.lLen.mockRejectedValueOnce(new Error('fail'));
      const { getQueueDepth } = await freshImport();

      const depth = await getQueueDepth();
      expect(depth).toBe(0);
    });
  });

  // ---- closeRedisConnection ----

  describe('closeRedisConnection()', () => {
    it('calls quit on the Redis client', async () => {
      const { getQueueDepth, closeRedisConnection } = await freshImport();

      // Force client creation by calling any method
      await getQueueDepth();

      await closeRedisConnection();
      expect(fakeRedis.quit).toHaveBeenCalledOnce();
    });
  });
});

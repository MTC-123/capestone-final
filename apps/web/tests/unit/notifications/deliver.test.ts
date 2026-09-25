import { describe, expect, it, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  isConfigured: vi.fn(),
  send: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notificationDelivery: {
      findUnique: (...args: unknown[]) => mocks.findUnique(...args),
      update: (...args: unknown[]) => mocks.update(...args),
    },
  },
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/notifications/adapters', () => ({
  getAdapter: () => ({
    channel: 'WHATSAPP',
    name: 'twilio',
    isConfigured: (...args: unknown[]) => mocks.isConfigured(...args),
    send: (...args: unknown[]) => mocks.send(...args),
  }),
}));

import { deliver, MAX_DELIVERY_ATTEMPTS } from '@/lib/notifications/deliver';

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'delivery-1',
    event: 'report.submitted',
    channel: 'WHATSAPP',
    recipient: 'whatsapp:+212600000001',
    status: 'QUEUED',
    adapter: 'twilio',
    attempts: 0,
    lastError: null,
    payload: { text: 'hello', html: null, subject: null },
    targetType: 'report',
    targetId: 'report-1',
    sentAt: null,
    ...overrides,
  };
}

describe('deliver()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isConfigured.mockReturnValue(true);
    mocks.update.mockResolvedValue(undefined);
  });

  it('returns ok without updating when the row does not exist', async () => {
    mocks.findUnique.mockResolvedValue(null);
    const result = await deliver('missing');
    expect(result).toEqual({ ok: false, error: 'not_found' });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('is a no-op for already SENT or SKIPPED rows', async () => {
    mocks.findUnique.mockResolvedValue(baseRow({ status: 'SENT' }));
    const result = await deliver('delivery-1');
    expect(result).toEqual({ ok: true });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('marks the row SKIPPED when the adapter is not configured', async () => {
    mocks.findUnique.mockResolvedValue(baseRow());
    mocks.isConfigured.mockReturnValue(false);

    const result = await deliver('delivery-1');

    expect(result.ok).toBe(true);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: { status: 'SKIPPED', attempts: 1, lastError: 'adapter_not_configured' },
    });
  });

  it('marks the row SENT with a timestamp on a successful send', async () => {
    mocks.findUnique.mockResolvedValue(baseRow());
    mocks.send.mockResolvedValue({ ok: true, providerId: 'SM123' });

    const result = await deliver('delivery-1');

    expect(result).toEqual({ ok: true });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({ status: 'SENT', attempts: 1, lastError: null }),
    });
    const data = mocks.update.mock.calls[0][0].data;
    expect(data.sentAt).toBeInstanceOf(Date);
  });

  it('keeps the row QUEUED for a retryable failure below the attempt cap', async () => {
    mocks.findUnique.mockResolvedValue(baseRow({ attempts: 0 }));
    mocks.send.mockResolvedValue({ ok: false, error: 'temporary failure' });

    const result = await deliver('delivery-1');

    expect(result).toEqual({ ok: false, error: 'temporary failure' });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: { status: 'QUEUED', attempts: 1, lastError: 'temporary failure' },
    });
  });

  it('marks the row FAILED once attempts reach the cap', async () => {
    mocks.findUnique.mockResolvedValue(baseRow({ attempts: MAX_DELIVERY_ATTEMPTS - 1 }));
    mocks.send.mockResolvedValue({ ok: false, error: 'still failing' });

    const result = await deliver('delivery-1');

    expect(result.ok).toBe(false);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: { status: 'FAILED', attempts: MAX_DELIVERY_ATTEMPTS, lastError: 'still failing' },
    });
  });

  it('short-circuits to FAILED when attempts already exhausted', async () => {
    mocks.findUnique.mockResolvedValue(baseRow({ attempts: MAX_DELIVERY_ATTEMPTS }));

    const result = await deliver('delivery-1');

    expect(result).toEqual({ ok: false, error: 'max_attempts_exceeded' });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: { status: 'FAILED', lastError: 'max_attempts_exceeded' },
    });
  });

  it('catches an adapter that throws and records the error without throwing', async () => {
    mocks.findUnique.mockResolvedValue(baseRow());
    mocks.send.mockRejectedValue(new Error('network exploded'));

    await expect(deliver('delivery-1')).resolves.toEqual({ ok: false, error: 'network exploded' });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: { status: 'QUEUED', attempts: 1, lastError: 'network exploded' },
    });
  });
});

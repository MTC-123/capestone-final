import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  resolveRecipientsForEvent: vi.fn(),
  getAdapter: vi.fn(),
  buildMessage: vi.fn(),
  deliver: vi.fn(),
  publishJSON: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notificationDelivery: {
      create: (...args: unknown[]) => mocks.create(...args),
    },
  },
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/notifications/recipients', () => ({
  resolveRecipientsForEvent: (...args: unknown[]) => mocks.resolveRecipientsForEvent(...args),
}));

vi.mock('@/lib/notifications/adapters', () => ({
  getAdapter: (...args: unknown[]) => mocks.getAdapter(...args),
}));

vi.mock('@/lib/notifications/templates', () => ({
  buildMessage: (...args: unknown[]) => mocks.buildMessage(...args),
}));

vi.mock('@/lib/notifications/deliver', () => ({
  deliver: (...args: unknown[]) => mocks.deliver(...args),
}));

vi.mock('@upstash/qstash', () => ({
  Client: vi.fn().mockImplementation(() => ({
    publishJSON: (...args: unknown[]) => mocks.publishJSON(...args),
  })),
}));

import { notifyEvent } from '@/lib/notifications/events';

function adapter(name: string, configured: boolean) {
  return { channel: 'WHATSAPP', name, isConfigured: () => configured, send: vi.fn() };
}

describe('notifyEvent', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.QSTASH_TOKEN;
    mocks.buildMessage.mockReturnValue({ text: 'hi', html: '<p>hi</p>', subject: 'subj' });
    mocks.deliver.mockResolvedValue({ ok: true });
    let idCounter = 0;
    mocks.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: `delivery-${++idCounter}`, ...data })
    );
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  const reportEvent = { type: 'report.submitted' as const, report: { id: 'report-1' } as never };

  it('does nothing when there are no recipients', async () => {
    mocks.resolveRecipientsForEvent.mockResolvedValue([]);
    await expect(notifyEvent(reportEvent)).resolves.toBeUndefined();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('creates a SKIPPED row (not FAILED) for an unconfigured adapter and does not attempt delivery', async () => {
    mocks.resolveRecipientsForEvent.mockResolvedValue([
      { channel: 'EMAIL', address: 'off@ricer.ma', locale: 'fr', targetType: 'report', targetId: 'report-1' },
    ]);
    mocks.getAdapter.mockReturnValue(adapter('resend', false));

    await notifyEvent(reportEvent);

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SKIPPED', adapter: 'resend' }) })
    );
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it('creates a QUEUED row for a configured adapter and delivers it', async () => {
    mocks.resolveRecipientsForEvent.mockResolvedValue([
      { channel: 'WHATSAPP', address: 'whatsapp:+212600000001', locale: 'fr', targetType: 'report', targetId: 'report-1' },
    ]);
    mocks.getAdapter.mockReturnValue(adapter('twilio', true));

    await notifyEvent(reportEvent);

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'QUEUED', adapter: 'twilio' }) })
    );
    expect(mocks.deliver).toHaveBeenCalledWith('delivery-1');
  });

  it('always delivers IN_APP inline even when QSTASH_TOKEN is set', async () => {
    process.env.QSTASH_TOKEN = 'qstash-token';
    mocks.resolveRecipientsForEvent.mockResolvedValue([
      { channel: 'IN_APP', address: 'ricer:officials', locale: 'fr', targetType: 'report', targetId: 'report-1' },
    ]);
    mocks.getAdapter.mockReturnValue({ channel: 'IN_APP', name: 'ably', isConfigured: () => true, send: vi.fn() });

    await notifyEvent(reportEvent);

    expect(mocks.deliver).toHaveBeenCalledWith('delivery-1');
    expect(mocks.publishJSON).not.toHaveBeenCalled();
  });

  it('publishes to QStash for non-in-app channels when QSTASH_TOKEN is set', async () => {
    process.env.QSTASH_TOKEN = 'qstash-token';
    process.env.BASE_URL = 'https://ricer.example';
    mocks.resolveRecipientsForEvent.mockResolvedValue([
      { channel: 'WHATSAPP', address: 'whatsapp:+212600000001', locale: 'fr', targetType: 'report', targetId: 'report-1' },
    ]);
    mocks.getAdapter.mockReturnValue(adapter('twilio', true));

    await notifyEvent(reportEvent);

    expect(mocks.publishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://ricer.example/api/notifications/deliver',
        body: { deliveryId: 'delivery-1' },
        retries: 3,
      })
    );
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it('never throws when recipient resolution fails', async () => {
    mocks.resolveRecipientsForEvent.mockRejectedValue(new Error('boom'));
    await expect(notifyEvent(reportEvent)).resolves.toBeUndefined();
  });

  it('never throws when the delivery row creation fails', async () => {
    mocks.resolveRecipientsForEvent.mockResolvedValue([
      { channel: 'WHATSAPP', address: 'whatsapp:+212600000001', locale: 'fr', targetType: 'report', targetId: 'report-1' },
    ]);
    mocks.getAdapter.mockReturnValue(adapter('twilio', true));
    mocks.create.mockRejectedValue(new Error('db down'));

    await expect(notifyEvent(reportEvent)).resolves.toBeUndefined();
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it('never throws when the adapter (via deliver) throws', async () => {
    mocks.resolveRecipientsForEvent.mockResolvedValue([
      { channel: 'WHATSAPP', address: 'whatsapp:+212600000001', locale: 'fr', targetType: 'report', targetId: 'report-1' },
    ]);
    mocks.getAdapter.mockReturnValue(adapter('twilio', true));
    mocks.deliver.mockRejectedValue(new Error('adapter exploded'));

    await expect(notifyEvent(reportEvent)).resolves.toBeUndefined();
  });

  it('never throws when QStash publish fails, and falls back to inline delivery', async () => {
    process.env.QSTASH_TOKEN = 'qstash-token';
    mocks.resolveRecipientsForEvent.mockResolvedValue([
      { channel: 'WHATSAPP', address: 'whatsapp:+212600000001', locale: 'fr', targetType: 'report', targetId: 'report-1' },
    ]);
    mocks.getAdapter.mockReturnValue(adapter('twilio', true));
    mocks.publishJSON.mockRejectedValue(new Error('qstash down'));

    await expect(notifyEvent(reportEvent)).resolves.toBeUndefined();
    expect(mocks.deliver).toHaveBeenCalledWith('delivery-1');
  });
});

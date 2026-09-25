import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: (...args: unknown[]) => mocks.userFindMany(...args),
      findUnique: (...args: unknown[]) => mocks.userFindUnique(...args),
    },
  },
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  isE164,
  resetOfficialsCache,
  resolveRecipientsForEvent,
} from '@/lib/notifications/recipients';
import type { NotificationEvent } from '@/lib/notifications/events';

describe('isE164', () => {
  it('accepts valid E.164 numbers', () => {
    expect(isE164('+212600000001')).toBe(true);
  });

  it.each([
    ['missing plus', '0600000002'],
    ['leading zero after plus', '+0600000003'],
    ['too short', '+1'],
    ['empty', ''],
    ['null', null],
    ['undefined', undefined],
  ])('rejects %s', (_label, value) => {
    expect(isE164(value as string | null | undefined)).toBe(false);
  });
});

describe('resolveRecipientsForEvent', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.TEST_PHONE_NUMBER;
    resetOfficialsCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('report.submitted: filters out officials with invalid phone numbers and skips missing emails', async () => {
    mocks.userFindMany.mockResolvedValue([
      { id: 'off-1', phone: '+212600000001', email: 'off1@ricer.ma' },
      { id: 'off-2', phone: '0600000002', email: null }, // invalid phone, no email
      { id: 'off-3', phone: '+0600000003', email: 'off3@ricer.ma' }, // invalid phone
    ]);

    const event: NotificationEvent = {
      type: 'report.submitted',
      report: { id: 'report-1' } as never,
    };

    const recipients = await resolveRecipientsForEvent(event);

    const whatsapp = recipients.filter((r) => r.channel === 'WHATSAPP');
    expect(whatsapp).toHaveLength(1);
    expect(whatsapp[0].address).toBe('whatsapp:+212600000001');

    const email = recipients.filter((r) => r.channel === 'EMAIL');
    expect(email.map((r) => r.address).sort()).toEqual(['off1@ricer.ma', 'off3@ricer.ma']);

    const inApp = recipients.filter((r) => r.channel === 'IN_APP');
    expect(inApp).toHaveLength(1);
    expect(inApp[0].address).toBe('ricer:officials');
  });

  it('report.submitted: adds TEST_PHONE_NUMBER as an extra WhatsApp recipient when set', async () => {
    process.env.TEST_PHONE_NUMBER = '+212611111111';
    mocks.userFindMany.mockResolvedValue([{ id: 'off-1', phone: '+212600000001', email: null }]);

    const recipients = await resolveRecipientsForEvent({ type: 'report.submitted', report: { id: 'report-1' } as never });
    const whatsapp = recipients.filter((r) => r.channel === 'WHATSAPP').map((r) => r.address);
    expect(whatsapp).toContain('whatsapp:+212611111111');
    expect(whatsapp).toContain('whatsapp:+212600000001');
  });

  it('caches the officials list for repeated lookups', async () => {
    mocks.userFindMany.mockResolvedValue([{ id: 'off-1', phone: '+212600000001', email: null }]);

    await resolveRecipientsForEvent({ type: 'report.submitted', report: { id: 'report-1' } as never });
    await resolveRecipientsForEvent({ type: 'dispatch.assigned', dispatchId: 'd1', incidentId: 'i1', unitLabel: 'Alpha' });

    expect(mocks.userFindMany).toHaveBeenCalledTimes(1);
  });

  it('report.status_changed: resolves the reporter only', async () => {
    mocks.userFindUnique.mockResolvedValue({ id: 'user-1', phone: '+212600000009', email: 'reporter@ricer.ma' });

    const recipients = await resolveRecipientsForEvent({
      type: 'report.status_changed',
      report: { id: 'report-1', userId: 'user-1' } as never,
      previousStatus: 'PENDING',
    });

    expect(recipients).toHaveLength(3);
    expect(recipients.some((r) => r.channel === 'IN_APP' && r.address === 'ricer:user:user-1')).toBe(true);
    expect(recipients.some((r) => r.channel === 'EMAIL' && r.address === 'reporter@ricer.ma')).toBe(true);
    expect(recipients.some((r) => r.channel === 'WHATSAPP' && r.address === 'whatsapp:+212600000009')).toBe(true);
  });

  it('report.status_changed: returns nothing when the reporter no longer exists', async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    const recipients = await resolveRecipientsForEvent({
      type: 'report.status_changed',
      report: { id: 'report-1', userId: 'ghost' } as never,
      previousStatus: 'PENDING',
    });
    expect(recipients).toEqual([]);
  });

  it('official_request.decided: resolves the requesting user', async () => {
    mocks.userFindUnique.mockResolvedValue({ id: 'user-2', phone: null, email: 'requester@ricer.ma' });
    const recipients = await resolveRecipientsForEvent({
      type: 'official_request.decided',
      userId: 'user-2',
      approved: true,
    });
    expect(recipients.some((r) => r.channel === 'IN_APP' && r.address === 'ricer:user:user-2')).toBe(true);
    expect(recipients.some((r) => r.channel === 'EMAIL')).toBe(true);
    expect(recipients.some((r) => r.channel === 'WHATSAPP')).toBe(false);
  });

  it('never throws — returns an empty list when the lookup fails', async () => {
    mocks.userFindMany.mockRejectedValue(new Error('db down'));
    const recipients = await resolveRecipientsForEvent({ type: 'report.submitted', report: { id: 'report-1' } as never });
    expect(recipients).toEqual([]);
  });
});

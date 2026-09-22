import { describe, expect, it, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  reportFindMany: vi.fn(),
  incidentFindMany: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: (...args: unknown[]) => mocks.getCurrentUser(...args),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    report: {
      findMany: (...args: unknown[]) => mocks.reportFindMany(...args),
    },
    incident: {
      findMany: (...args: unknown[]) => mocks.incidentFindMany(...args),
    },
  },
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@/lib/observability/monitoring', () => ({
  captureException: vi.fn(),
}));

import { GET } from '@/app/api/notifications/route';

function request() {
  return new Request('http://localhost/api/notifications');
}

describe('GET /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({
      tokenUse: 'access',
      userId: 'user-civ-1',
      cin: 'CIV001',
      role: 'CIVILIAN',
      scopes: ['reports:read'],
    });
    mocks.reportFindMany.mockResolvedValue([]);
    mocks.incidentFindMany.mockResolvedValue([]);
  });

  it('scopes civilian report notifications to the current user', async () => {
    mocks.reportFindMany.mockResolvedValueOnce([
      {
        id: 'report-1',
        referenceNumber: 'RPT-20260421-ABCD',
        description: 'Smoke near the cedar trail',
        createdAt: new Date('2026-04-21T10:00:00Z'),
        status: 'PENDING',
      },
    ]);

    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(mocks.reportFindMany.mock.calls[0][0].where.userId).toBe('user-civ-1');
    expect(body.notifications).toHaveLength(1);
    expect(body.notifications[0]).toMatchObject({
      id: 'report-report-1',
      type: 'NEW_REPORT',
      referenceUrl: '/reports-list?report=report-1',
    });
  });

  it('does not scope official report notifications to one user', async () => {
    mocks.getCurrentUser.mockResolvedValue({
      tokenUse: 'access',
      userId: 'official-1',
      cin: 'OFF001',
      role: 'OFFICIAL',
      scopes: ['reports:read'],
    });

    await GET(request());

    expect(mocks.reportFindMany.mock.calls[0][0].where.userId).toBeUndefined();
  });

  it('does not show civilians incident notifications from another user report', async () => {
    mocks.reportFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mocks.incidentFindMany.mockResolvedValueOnce([
      {
        id: 'incident-1',
        status: 'ALERTE',
        updatedAt: new Date('2026-04-21T11:00:00Z'),
        reportId: 'other-report',
      },
    ]);

    const res = await GET(request());
    const body = await res.json();

    expect(mocks.reportFindMany.mock.calls[1][0].where).toMatchObject({
      id: { in: ['other-report'] },
      userId: 'user-civ-1',
    });
    expect(body.notifications).toEqual([]);
  });
});

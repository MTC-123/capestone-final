import { describe, expect, it, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: (...args: unknown[]) => mocks.getCurrentUser(...args),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notificationDelivery: {
      findMany: (...args: unknown[]) => mocks.findMany(...args),
    },
  },
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/observability/monitoring', () => ({
  captureException: vi.fn(),
}));

import { GET } from '@/app/api/notifications/deliveries/route';

function request(query = '') {
  return new Request(`http://localhost/api/notifications/deliveries${query}`);
}

describe('GET /api/notifications/deliveries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
  });

  it('rejects unauthenticated requests', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const res = await GET(request());
    expect(res.status).toBe(401);
  });

  it('rejects civilians', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'u1', role: 'CIVILIAN' });
    const res = await GET(request());
    expect(res.status).toBe(403);
  });

  it('lists deliveries for officials, applying status/channel/limit filters', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'off-1', role: 'OFFICIAL' });
    mocks.findMany.mockResolvedValue([{ id: 'd1', status: 'SENT', channel: 'WHATSAPP' }]);

    const res = await GET(request('?status=SENT&channel=WHATSAPP&limit=5'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deliveries).toHaveLength(1);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'SENT', channel: 'WHATSAPP' },
        take: 5,
      })
    );
  });

  it('caps the limit at 100', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'off-1', role: 'OFFICIAL' });
    await GET(request('?limit=500'));
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });

  it('rejects an invalid status filter', async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: 'off-1', role: 'OFFICIAL' });
    const res = await GET(request('?status=NOPE'));
    expect(res.status).toBe(422);
  });
});

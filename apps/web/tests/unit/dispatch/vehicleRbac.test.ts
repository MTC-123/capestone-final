import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules
vi.mock('@/lib/prisma', () => ({
  prisma: {
    vehicle: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/validation/geojson', () => ({
  isGeoJSONPoint: vi.fn(() => true),
  validatePoint: vi.fn((v: any) => v),
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/errors/mapError', () => ({
  mapUnknownToAppError: vi.fn((err: any) => err),
}));

vi.mock('@/lib/observability/monitoring', () => ({
  captureException: vi.fn(),
}));

vi.mock('@/lib/errors/rateLimit', () => ({
  checkErrorRateLimit: vi.fn(() => ({ limited: false, retryAfterSeconds: 0 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@/lib/database/withRetry', () => ({
  withRetry: vi.fn((fn: () => any) => fn()),
}));

import { getCurrentUser } from '@/lib/auth';
import { GET, POST } from '@/app/api/vehicles/route';

function makeRequest(method: string, body?: unknown) {
  const url = 'http://localhost:3000/api/vehicles';
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) init.body = JSON.stringify(body);
  return new Request(url, init);
}

describe('Vehicle RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns 401 for unauthenticated user', async () => {
    (getCurrentUser as any).mockResolvedValue(null);
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(401);
  });

  it('GET returns 403 for CIVILIAN role', async () => {
    (getCurrentUser as any).mockResolvedValue({ userId: 'u-1', role: 'CIVILIAN', scopes: [] });
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(403);
  });

  it('GET returns 200 for OFFICIAL role', async () => {
    (getCurrentUser as any).mockResolvedValue({ userId: 'u-1', role: 'OFFICIAL', scopes: ['map:read'] });
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
  });

  it('POST returns 401 for unauthenticated user', async () => {
    (getCurrentUser as any).mockResolvedValue(null);
    const res = await POST(makeRequest('POST', { callSign: 'FT-001', type: 'FIRE_TRUCK' }));
    expect(res.status).toBe(401);
  });

  it('POST returns 403 for CIVILIAN role', async () => {
    (getCurrentUser as any).mockResolvedValue({ userId: 'u-1', role: 'CIVILIAN', scopes: [] });
    const res = await POST(makeRequest('POST', { callSign: 'FT-001', type: 'FIRE_TRUCK' }));
    expect(res.status).toBe(403);
  });
});

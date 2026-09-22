import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUserFindUnique = vi.fn();
const mockRefreshTokenCreate = vi.fn();

function registerMocks() {
  vi.doMock('@/lib/prisma', () => ({
    prisma: {
      user: {
        findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      },
      refreshToken: {
        create: (...args: unknown[]) => mockRefreshTokenCreate(...args),
      },
    },
  }));

  vi.doMock('@/lib/observability/logger', () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }));

  vi.doMock('@/lib/observability/monitoring', () => ({
    captureException: vi.fn(),
  }));
}

describe('demo map route', () => {
  beforeEach(() => {
    vi.resetModules();
    registerMocks();
    vi.clearAllMocks();
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost/test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    delete process.env.DEMO_AUTO_LOGIN_ENABLED;
    delete process.env.DEMO_ADMIN_CIN;

    mockUserFindUnique.mockResolvedValue({
      id: '65f000000000000000000001',
      cin: 'CD789012',
      phone: '+212600000001',
      role: 'OFFICIAL',
      department: 'Operations',
      position: 'Chief',
      createdAt: new Date('2026-04-21T12:00:00.000Z'),
      updatedAt: new Date('2026-04-21T12:00:00.000Z'),
    });
    mockRefreshTokenCreate.mockResolvedValue({ id: 'refresh-1' });
  });

  it('creates a short-lived official demo session and redirects to the map', async () => {
    const { GET } = await import('@/app/demo/map/route');

    const response = await GET(new Request('https://internal-railway:8080/demo/map', {
      headers: { 'user-agent': 'vitest', 'x-forwarded-for': '127.0.0.1' },
    }));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://internal-railway:8080/map');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toContain('auth-token=');
    expect(response.headers.get('set-cookie')).toContain('refresh-token=');
    expect(mockUserFindUnique).toHaveBeenCalledWith({ where: { cin: 'CD789012' } });
    expect(mockRefreshTokenCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: '65f000000000000000000001',
        scopes: expect.arrayContaining(['map:read', 'map:write', 'reports:read', 'reports:write']),
        ip: '127.0.0.1',
        userAgent: 'vitest',
      }),
    }));
  });

  it('can be disabled by environment flag', async () => {
    process.env.DEMO_AUTO_LOGIN_ENABLED = 'false';
    const { GET } = await import('@/app/demo/map/route');

    const response = await GET(new Request('https://demo.test/demo/map'));

    expect(response.status).toBe(403);
    expect(mockRefreshTokenCreate).not.toHaveBeenCalled();
  });

  it('redirects with the public forwarded host behind Railway', async () => {
    const { GET } = await import('@/app/demo/map/route');

    const response = await GET(new Request('https://internal-railway:8080/demo/map', {
      headers: {
        host: 'ricer-project-production.up.railway.app',
        'x-forwarded-proto': 'https',
      },
    }));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://ricer-project-production.up.railway.app/map');
  });
});

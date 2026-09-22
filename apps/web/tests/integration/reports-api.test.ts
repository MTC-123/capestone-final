import { describe, expect, it, beforeEach, vi } from 'vitest';

const mockGetCurrentUser = vi.fn();
const mockReportFindMany = vi.fn();
const mockReportCount = vi.fn();
const mockReportFindFirst = vi.fn();

function registerMocks() {
  vi.doMock('@/lib/auth', () => ({
    getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
  }));

  vi.doMock('@/lib/prisma', () => ({
    prisma: {
      report: {
        findMany: (...args: unknown[]) => mockReportFindMany(...args),
        count: (...args: unknown[]) => mockReportCount(...args),
        findFirst: (...args: unknown[]) => mockReportFindFirst(...args),
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

function createRequest(url: string): Request {
  return new Request(`http://localhost${url}`);
}

function mockUser(role: 'CIVILIAN' | 'OFFICIAL', userId = 'user-1') {
  mockGetCurrentUser.mockResolvedValue({
    tokenUse: 'access',
    userId,
    cin: role === 'OFFICIAL' ? 'OFFICIAL123' : 'CIVILIAN123',
    role,
    scopes: ['reports:read'],
  });
}

const report = {
  id: '65f000000000000000000001',
  userId: 'user-1',
  latitude: 33.531,
  longitude: -5.105,
  description: 'Smoke visible from the road near the forest.',
  images: [],
  status: 'PENDING',
  cause: 'CIGARETTE',
  anonymous: false,
  contactPhone: '+212600000000',
  characteristics: {
    fireSize: 'medium',
    smokeLevel: 'moderate',
    fireType: 'surface',
    windCondition: 'light',
    nearbyThreats: ['forest'],
  },
  referenceNumber: 'RPT-20260421-ABCD',
  createdAt: new Date('2026-04-21T12:00:00.000Z'),
  updatedAt: new Date('2026-04-21T12:00:00.000Z'),
  user: {
    cin: 'CIVILIAN123',
    phone: '+212600000001',
    role: 'CIVILIAN',
  },
};

describe('reports API', () => {
  beforeEach(() => {
    vi.resetModules();
    registerMocks();
    vi.clearAllMocks();
    mockReportFindMany.mockResolvedValue([report]);
    mockReportCount.mockResolvedValue(1);
    mockReportFindFirst.mockResolvedValue(report);
  });

  it('scopes report listing to the current civilian', async () => {
    mockUser('CIVILIAN', 'user-1');
    const { GET } = await import('@/app/api/reports/route');

    const response = await GET(createRequest('/api/reports?status=PENDING&cause=CIGARETTE'));

    expect(response.status).toBe(200);
    expect(mockReportFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'user-1',
        status: 'PENDING',
        cause: 'CIGARETTE',
      }),
    }));
    expect(mockReportCount).toHaveBeenCalledWith({
      where: expect.objectContaining({ userId: 'user-1' }),
    });
  });

  it('allows officials to list all reports', async () => {
    mockUser('OFFICIAL', 'official-1');
    const { GET } = await import('@/app/api/reports/route');

    const response = await GET(createRequest('/api/reports'));

    expect(response.status).toBe(200);
    expect(mockReportFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {},
    }));
  });

  it('exports a PDF for the current civilian own report', async () => {
    mockUser('CIVILIAN', 'user-1');
    const { GET } = await import('@/app/api/reports/[id]/pdf/route');

    const response = await GET(
      createRequest('/api/reports/65f000000000000000000001/pdf?lang=en'),
      { params: { id: '65f000000000000000000001' } }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('report-RPT-20260421-ABCD-en.pdf');
    expect(mockReportFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: '65f000000000000000000001', userId: 'user-1' },
    }));
  });

  it('exports Arabic PDF with UTF-8 translated filename', async () => {
    mockUser('OFFICIAL', 'official-1');
    const { GET } = await import('@/app/api/reports/[id]/pdf/route');

    const response = await GET(
      createRequest('/api/reports/65f000000000000000000001/pdf?lang=ar'),
      { params: { id: '65f000000000000000000001' } }
    );

    expect(response.status).toBe(200);
    const disposition = response.headers.get('content-disposition') || '';
    expect(disposition).toContain('filename="report-RPT-20260421-ABCD-ar.pdf"');
    expect(decodeURIComponent(disposition.split("filename*=UTF-8''")[1])).toBe(
      'بلاغ-RPT-20260421-ABCD-ar.pdf'
    );
  });

  it('does not export another civilian report', async () => {
    mockUser('CIVILIAN', 'user-2');
    mockReportFindFirst.mockResolvedValue(null);
    const { GET } = await import('@/app/api/reports/[id]/pdf/route');

    const response = await GET(
      createRequest('/api/reports/65f000000000000000000001/pdf?lang=fr'),
      { params: { id: '65f000000000000000000001' } }
    );

    expect(response.status).toBe(404);
    expect(mockReportFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: '65f000000000000000000001', userId: 'user-2' },
    }));
  });
});

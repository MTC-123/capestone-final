/**
 * Integration Test: Fire Records Perimeter Upload
 * Tests PUT /api/fire-records/[id]/perimeter
 */

import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { getCurrentUser } from '@/lib/auth';
import { PUT as putPerimeter } from '@/app/api/fire-records/[id]/perimeter/route';

vi.mock('@/lib/auth');
vi.mock('@/lib/observability/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/observability/monitoring', () => ({
  captureException: vi.fn(),
}));

const mockFireRecords: any[] = [];

vi.mock('@/lib/prisma', () => ({
  prisma: {
    fireEventRecord: {
      findUnique: vi.fn((args: any) =>
        Promise.resolve(mockFireRecords.find((r) => r.id === args.where.id) || null)
      ),
      update: vi.fn((args: any) => {
        const record = mockFireRecords.find((r) => r.id === args.where.id);
        if (!record) throw new Error('Record not found');
        Object.assign(record, args.data);
        record.updatedAt = new Date();
        return Promise.resolve(record);
      }),
    },
  },
}));

function createRequest(url: string, body?: any, method = 'PUT'): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockOfficialUser() {
  vi.mocked(getCurrentUser).mockResolvedValue({
    tokenUse: 'access',
    userId: 'user-official-1',
    cin: 'OFF001',
    role: 'OFFICIAL',
    scopes: ['map:read', 'map:write', 'reports:read', 'reports:write', 'equipment:read', 'equipment:write', 'analytics:read'],
  });
}

const validPolygon = {
  type: 'Polygon',
  coordinates: [[
    [-5.12, 33.52], [-5.10, 33.52], [-5.10, 33.54], [-5.12, 33.54], [-5.12, 33.52],
  ]],
};

describe('Fire Records Perimeter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFireRecords.length = 0;
  });
  afterEach(() => { vi.clearAllMocks(); });

  it('computes stats from valid polygon → 200', async () => {
    mockOfficialUser();
    mockFireRecords.push({
      id: 'rec-perim-1',
      incidentId: 'inc-1',
      recordStatus: 'DRAFT',
      lockedSections: [],
      auditTrail: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await putPerimeter(
      createRequest('/api/fire-records/rec-perim-1/perimeter', { polygon: validPolygon }),
      { params: { id: 'rec-perim-1' } }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.record.burnAreaHa).toBeGreaterThan(0);
    expect(body.record.burnCentroid).toBeDefined();
    expect(body.record.burnBoundingBox).toBeDefined();
  });

  it('rejects invalid polygon → 422 (8003)', async () => {
    mockOfficialUser();
    mockFireRecords.push({
      id: 'rec-perim-2',
      incidentId: 'inc-2',
      recordStatus: 'DRAFT',
      lockedSections: [],
      auditTrail: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await putPerimeter(
      createRequest('/api/fire-records/rec-perim-2/perimeter', {
        polygon: { type: 'Point', coordinates: [0, 0] },
      }),
      { params: { id: 'rec-perim-2' } }
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe(8003);
  });

  it('rejects perimeter upload on locked section → 409 (8002)', async () => {
    mockOfficialUser();
    mockFireRecords.push({
      id: 'rec-perim-3',
      incidentId: 'inc-3',
      recordStatus: 'DRAFT',
      lockedSections: ['location'],
      auditTrail: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await putPerimeter(
      createRequest('/api/fire-records/rec-perim-3/perimeter', { polygon: validPolygon }),
      { params: { id: 'rec-perim-3' } }
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe(8002);
  });

  it('rejects perimeter upload on approved record → 409 (8005)', async () => {
    mockOfficialUser();
    mockFireRecords.push({
      id: 'rec-perim-4',
      incidentId: 'inc-4',
      recordStatus: 'LOCKED',
      lockedSections: ['location', 'cause', 'damage', 'response', 'postFire'],
      auditTrail: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await putPerimeter(
      createRequest('/api/fire-records/rec-perim-4/perimeter', { polygon: validPolygon }),
      { params: { id: 'rec-perim-4' } }
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe(8005);
  });

  it('returns 404 for non-existent record', async () => {
    mockOfficialUser();
    const res = await putPerimeter(
      createRequest('/api/fire-records/non-existent/perimeter', { polygon: validPolygon }),
      { params: { id: 'non-existent' } }
    );
    expect(res.status).toBe(404);
  });
});

/**
 * Integration Test: Fire Records CRUD
 * Tests POST/GET /api/fire-records, GET/PATCH /api/fire-records/[id]
 */

import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { getCurrentUser } from '@/lib/auth';
import { POST as createRecord, GET as listRecords } from '@/app/api/fire-records/route';
import { GET as getRecord, PATCH as patchRecord } from '@/app/api/fire-records/[id]/route';

// ============================================
// Mocks
// ============================================

vi.mock('@/lib/auth');
vi.mock('@/lib/observability/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/observability/monitoring', () => ({
  captureException: vi.fn(),
}));

const mockFireRecords: any[] = [];
const mockIncidents: any[] = [];

vi.mock('@/lib/prisma', () => ({
  prisma: {
    fireEventRecord: {
      findMany: vi.fn((args?: any) => {
        let result = [...mockFireRecords].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        if (args?.where) {
          if (args.where.recordStatus) result = result.filter((r) => r.recordStatus === args.where.recordStatus);
          if (args.where.alertSource) result = result.filter((r) => r.alertSource === args.where.alertSource);
          if (args.where.incidentId?.contains) result = result.filter((r) => r.incidentId.includes(args.where.incidentId.contains));
        }
        const take = args?.take ?? 100;
        result = result.slice(0, take);
        return Promise.resolve(result);
      }),
      findUnique: vi.fn((args: any) => {
        if (args.where.id) return Promise.resolve(mockFireRecords.find((r) => r.id === args.where.id) || null);
        if (args.where.incidentId) return Promise.resolve(mockFireRecords.find((r) => r.incidentId === args.where.incidentId) || null);
        return Promise.resolve(null);
      }),
      create: vi.fn((args: any) => {
        const record = {
          id: `rec-${mockFireRecords.length + 1}`,
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockFireRecords.push(record);
        return Promise.resolve(record);
      }),
      update: vi.fn((args: any) => {
        const record = mockFireRecords.find((r) => r.id === args.where.id);
        if (!record) throw new Error('Record not found');
        Object.assign(record, args.data);
        record.updatedAt = new Date();
        return Promise.resolve(record);
      }),
      count: vi.fn((args?: any) => {
        let result = [...mockFireRecords];
        if (args?.where?.recordStatus) result = result.filter((r) => r.recordStatus === args.where.recordStatus);
        return Promise.resolve(result.length);
      }),
    },
    incident: {
      findUnique: vi.fn((args: any) =>
        Promise.resolve(mockIncidents.find((i) => i.id === args.where.id) || null)
      ),
    },
  },
}));

// ============================================
// Helpers
// ============================================

function createRequest(url: string, body?: any, method = 'GET'): Request {
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

function mockCivilianUser() {
  vi.mocked(getCurrentUser).mockResolvedValue({
    tokenUse: 'access',
    userId: 'user-civilian-1',
    cin: 'CIV001',
    role: 'CIVILIAN',
    scopes: ['map:read', 'reports:read', 'reports:write', 'analytics:read'],
  });
}

function mockUnauthenticated() {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
}

// ============================================
// Tests
// ============================================

describe('Fire Records CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFireRecords.length = 0;
    mockIncidents.length = 0;

    // Seed an incident
    mockIncidents.push({
      id: 'inc-test-1',
      location: { type: 'Point', coordinates: [-5.06, 33.55] },
      cause: 'NATURAL',
      severity: 3,
      status: 'INTERVENTION',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(() => { vi.clearAllMocks(); });

  describe('POST /api/fire-records', () => {
    it('creates a fire record for valid incident → 201', async () => {
      mockOfficialUser();
      const res = await createRecord(
        createRequest('/api/fire-records', { incidentId: 'inc-test-1' }, 'POST')
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.incidentId).toBe('inc-test-1');
      expect(body.recordStatus).toBe('DRAFT');
      expect(body.auditTrail).toHaveLength(1);
      expect(body.auditTrail[0].action).toBe('CREATE');
    });

    it('rejects creation for non-existent incident → 404 (8006)', async () => {
      mockOfficialUser();
      const res = await createRecord(
        createRequest('/api/fire-records', { incidentId: 'non-existent' }, 'POST')
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe(8006);
    });

    it('rejects duplicate fire record → 409 (8001)', async () => {
      mockOfficialUser();
      // Create first
      await createRecord(createRequest('/api/fire-records', { incidentId: 'inc-test-1' }, 'POST'));
      // Attempt duplicate
      const res = await createRecord(
        createRequest('/api/fire-records', { incidentId: 'inc-test-1' }, 'POST')
      );
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe(8001);
    });

    it('blocks CIVILIAN from creating → 403', async () => {
      mockCivilianUser();
      const res = await createRecord(
        createRequest('/api/fire-records', { incidentId: 'inc-test-1' }, 'POST')
      );
      expect(res.status).toBe(403);
    });

    it('blocks unauthenticated users → 401', async () => {
      mockUnauthenticated();
      const res = await createRecord(
        createRequest('/api/fire-records', { incidentId: 'inc-test-1' }, 'POST')
      );
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/fire-records', () => {
    it('lists records with pagination', async () => {
      mockOfficialUser();

      // Seed records
      for (let i = 0; i < 3; i++) {
        mockFireRecords.push({
          id: `rec-list-${i}`,
          incidentId: `inc-list-${i}`,
          alertSource: 'OTHER',
          recordStatus: 'DRAFT',
          lockedSections: [],
          auditTrail: [],
          createdAt: new Date(Date.now() - i * 1000),
          updatedAt: new Date(),
        });
      }

      const res = await listRecords(createRequest('/api/fire-records?limit=2'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBeLessThanOrEqual(2);
      expect(body.pagination).toBeDefined();
    });
  });

  describe('GET /api/fire-records/[id]', () => {
    it('returns record by ID → 200', async () => {
      mockOfficialUser();
      mockFireRecords.push({
        id: 'rec-get-1',
        incidentId: 'inc-test-1',
        alertSource: 'OTHER',
        recordStatus: 'DRAFT',
        lockedSections: [],
        auditTrail: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await getRecord(
        createRequest('/api/fire-records/rec-get-1'),
        { params: { id: 'rec-get-1' } }
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.record.id).toBe('rec-get-1');
    });

    it('returns 404 (8000) for non-existent record', async () => {
      mockOfficialUser();
      const res = await getRecord(
        createRequest('/api/fire-records/non-existent'),
        { params: { id: 'non-existent' } }
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe(8000);
    });
  });

  describe('PATCH /api/fire-records/[id]', () => {
    it('updates timeline fields and adds audit entry', async () => {
      mockOfficialUser();
      mockFireRecords.push({
        id: 'rec-patch-1',
        incidentId: 'inc-test-1',
        alertSource: 'OTHER',
        recordStatus: 'DRAFT',
        lockedSections: [],
        auditTrail: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await patchRecord(
        createRequest('/api/fire-records/rec-patch-1', {
          alertSource: 'FIRMS_SATELLITE',
          alertReceivedAt: '2026-01-15T10:00:00Z',
        }, 'PATCH'),
        { params: { id: 'rec-patch-1' } }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.record.alertSource).toBe('FIRMS_SATELLITE');
      expect(body.record.auditTrail).toHaveLength(1);
      expect(body.record.auditTrail[0].action).toBe('UPDATE');
    });

    it('rejects update to locked section → 409 (8002)', async () => {
      mockOfficialUser();
      mockFireRecords.push({
        id: 'rec-locked-1',
        incidentId: 'inc-test-1',
        alertSource: 'OTHER',
        recordStatus: 'DRAFT',
        lockedSections: ['response'],
        auditTrail: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await patchRecord(
        createRequest('/api/fire-records/rec-locked-1', {
          alertSource: 'PATROL',
        }, 'PATCH'),
        { params: { id: 'rec-locked-1' } }
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe(8002);
    });

    it('rejects update to approved record → 409 (8005)', async () => {
      mockOfficialUser();
      mockFireRecords.push({
        id: 'rec-approved-1',
        incidentId: 'inc-test-1',
        alertSource: 'OTHER',
        recordStatus: 'LOCKED',
        lockedSections: ['location', 'cause', 'damage', 'response', 'postFire'],
        auditTrail: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await patchRecord(
        createRequest('/api/fire-records/rec-approved-1', {
          alertSource: 'PATROL',
        }, 'PATCH'),
        { params: { id: 'rec-approved-1' } }
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe(8005);
    });

    it('blocks CIVILIAN from patching → 403', async () => {
      mockCivilianUser();
      mockFireRecords.push({
        id: 'rec-civ-1',
        incidentId: 'inc-test-1',
        alertSource: 'OTHER',
        recordStatus: 'DRAFT',
        lockedSections: [],
        auditTrail: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await patchRecord(
        createRequest('/api/fire-records/rec-civ-1', { alertSource: 'PATROL' }, 'PATCH'),
        { params: { id: 'rec-civ-1' } }
      );
      expect(res.status).toBe(403);
    });
  });
});

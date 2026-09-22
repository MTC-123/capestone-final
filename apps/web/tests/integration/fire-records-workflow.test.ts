/**
 * Integration Test: Fire Records Workflow (Lock + Approve)
 * Tests POST /api/fire-records/[id]/lock and POST /api/fire-records/[id]/approve
 */

import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { getCurrentUser } from '@/lib/auth';
import { POST as lockSection } from '@/app/api/fire-records/[id]/lock/route';
import { POST as approveRecord } from '@/app/api/fire-records/[id]/approve/route';
import { PATCH as patchRecord } from '@/app/api/fire-records/[id]/route';

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
    incident: {
      findUnique: vi.fn(() => Promise.resolve(null)),
    },
  },
}));

function createRequest(url: string, body?: any, method = 'POST'): Request {
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

describe('Fire Records Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFireRecords.length = 0;
  });
  afterEach(() => { vi.clearAllMocks(); });

  describe('POST /api/fire-records/[id]/lock', () => {
    it('locks a section → appears in lockedSections', async () => {
      mockOfficialUser();
      mockFireRecords.push({
        id: 'rec-lock-1',
        incidentId: 'inc-1',
        recordStatus: 'DRAFT',
        lockedSections: [],
        auditTrail: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await lockSection(
        createRequest('/api/fire-records/rec-lock-1/lock', { section: 'location' }),
        { params: { id: 'rec-lock-1' } }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.record.lockedSections).toContain('location');
    });

    it('is idempotent for already-locked section → 200', async () => {
      mockOfficialUser();
      mockFireRecords.push({
        id: 'rec-lock-2',
        incidentId: 'inc-2',
        recordStatus: 'DRAFT',
        lockedSections: ['location'],
        auditTrail: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await lockSection(
        createRequest('/api/fire-records/rec-lock-2/lock', { section: 'location' }),
        { params: { id: 'rec-lock-2' } }
      );

      expect(res.status).toBe(200);
    });

    it('rejects invalid section name → 422', async () => {
      mockOfficialUser();
      mockFireRecords.push({
        id: 'rec-lock-3',
        incidentId: 'inc-3',
        recordStatus: 'DRAFT',
        lockedSections: [],
        auditTrail: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await lockSection(
        createRequest('/api/fire-records/rec-lock-3/lock', { section: 'weather' }),
        { params: { id: 'rec-lock-3' } }
      );

      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/fire-records/[id]/approve', () => {
    it('finalizes with all 5 sections locked → LOCKED', async () => {
      mockOfficialUser();
      mockFireRecords.push({
        id: 'rec-approve-1',
        incidentId: 'inc-1',
        recordStatus: 'DRAFT',
        lockedSections: ['location', 'cause', 'damage', 'response', 'postFire'],
        auditTrail: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await approveRecord(
        createRequest('/api/fire-records/rec-approve-1/approve', {}),
        { params: { id: 'rec-approve-1' } }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.record.recordStatus).toBe('LOCKED');
      expect(body.record.auditTrail).toHaveLength(1);
      expect(body.record.auditTrail[0].action).toBe('FINALIZE');
    });

    it('rejects with missing sections → 409 (8004) with missingSections', async () => {
      mockOfficialUser();
      mockFireRecords.push({
        id: 'rec-approve-2',
        incidentId: 'inc-2',
        recordStatus: 'DRAFT',
        lockedSections: ['location', 'cause'],
        auditTrail: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await approveRecord(
        createRequest('/api/fire-records/rec-approve-2/approve', {}),
        { params: { id: 'rec-approve-2' } }
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe(8004);
      expect(body.error.meta.missingSections).toContain('damage');
      expect(body.error.meta.missingSections).toContain('response');
      expect(body.error.meta.missingSections).toContain('postFire');
    });

    it('rejects already locked record → 409 (8005)', async () => {
      mockOfficialUser();
      mockFireRecords.push({
        id: 'rec-approve-3',
        incidentId: 'inc-3',
        recordStatus: 'LOCKED',
        lockedSections: ['location', 'cause', 'damage', 'response', 'postFire'],
        auditTrail: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await approveRecord(
        createRequest('/api/fire-records/rec-approve-3/approve', {}),
        { params: { id: 'rec-approve-3' } }
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe(8005);
    });
  });

  describe('Full workflow: create → update → lock all → approve → patch fails', () => {
    it('completes the full fire record lifecycle', async () => {
      mockOfficialUser();

      // Start with a DRAFT record
      mockFireRecords.push({
        id: 'rec-full-1',
        incidentId: 'inc-full-1',
        alertSource: 'OTHER',
        recordStatus: 'DRAFT',
        lockedSections: [],
        auditTrail: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Update some fields
      const patchRes = await patchRecord(
        createRequest('/api/fire-records/rec-full-1', {
          alertSource: 'FIRMS_SATELLITE',
          alertReceivedAt: '2026-01-15T10:00:00Z',
        }, 'PATCH'),
        { params: { id: 'rec-full-1' } }
      );
      expect(patchRes.status).toBe(200);

      // Lock all 5 sections
      const sections = ['location', 'cause', 'damage', 'response', 'postFire'];
      for (const section of sections) {
        const lockRes = await lockSection(
          createRequest('/api/fire-records/rec-full-1/lock', { section }),
          { params: { id: 'rec-full-1' } }
        );
        expect(lockRes.status).toBe(200);
      }

      // Finalize (approve)
      const approveRes = await approveRecord(
        createRequest('/api/fire-records/rec-full-1/approve', {}),
        { params: { id: 'rec-full-1' } }
      );
      expect(approveRes.status).toBe(200);
      const body = await approveRes.json();
      expect(body.record.recordStatus).toBe('LOCKED');

      // PATCH should now fail
      const failRes = await patchRecord(
        createRequest('/api/fire-records/rec-full-1', { alertSource: 'PATROL' }, 'PATCH'),
        { params: { id: 'rec-full-1' } }
      );
      expect(failRes.status).toBe(409);
      const failBody = await failRes.json();
      expect(failBody.error.code).toBe(8005);
    });
  });
});

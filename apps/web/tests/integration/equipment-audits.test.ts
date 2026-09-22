import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/monitoring', () => ({ trackEvent: vi.fn() }));

// Mock auth
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from '@/lib/auth';

// Mock prisma
vi.mock('@/lib/prisma', () => {
  const mockAudits: Record<string, unknown>[] = [];
  const mockFireRecords: Record<string, unknown>[] = [];

  return {
    prisma: {
      equipmentAudit: {
        findMany: vi.fn(async (args: { where?: Record<string, unknown>; orderBy?: unknown }) => {
          let results = [...mockAudits];
          if (args?.where?.fireRecordId) {
            results = results.filter((a) => a.fireRecordId === args.where!.fireRecordId);
          }
          return results;
        }),
        findUnique: vi.fn(async (args: { where: { id: string } }) => {
          return mockAudits.find((a) => a.id === args.where.id) ?? null;
        }),
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          const audit = { id: `audit-${Date.now()}`, createdAt: new Date(), updatedAt: new Date(), ...args.data };
          mockAudits.push(audit);
          return audit;
        }),
        update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
          const idx = mockAudits.findIndex((a) => a.id === args.where.id);
          if (idx === -1) throw new Error('Not found');
          mockAudits[idx] = { ...mockAudits[idx], ...args.data, updatedAt: new Date() };
          return mockAudits[idx];
        }),
      },
      fireEventRecord: {
        findUnique: vi.fn(async (args: { where: { id: string } }) => {
          return mockFireRecords.find((r) => r.id === args.where.id) ?? null;
        }),
      },
      // expose for seeding
      _mockAudits: mockAudits,
      _mockFireRecords: mockFireRecords,
    },
  };
});
import { prisma } from '@/lib/prisma';

import { POST as createAudit, GET as listAudits } from '@/app/api/equipment-audits/route';
import { PATCH as updateAudit, GET as getAudit } from '@/app/api/equipment-audits/[id]/route';

// Helpers
function createRequest(url: string, body?: unknown, method = 'GET'): Request {
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) init.body = JSON.stringify(body);
  return new Request(url, init);
}

function mockOfficialUser() {
  vi.mocked(getCurrentUser).mockResolvedValue({
    tokenUse: 'access' as const,
    userId: 'user-1',
    cin: 'AB123456',
    role: 'OFFICIAL',
    scopes: ['equipment:write'],
  });
}

function mockCivilianUser() {
  vi.mocked(getCurrentUser).mockResolvedValue({
    tokenUse: 'access' as const,
    userId: 'user-2',
    cin: 'CD789012',
    role: 'CIVILIAN',
    scopes: ['map:read'],
  });
}

function mockUnauthenticated() {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
}

const mockAudits = (prisma as unknown as { _mockAudits: Record<string, unknown>[] })._mockAudits;
const mockFireRecords = (prisma as unknown as { _mockFireRecords: Record<string, unknown>[] })._mockFireRecords;

beforeEach(() => {
  vi.clearAllMocks();
  mockAudits.length = 0;
  mockFireRecords.length = 0;
});

// ——————————————————————————————————————————
// POST /api/equipment-audits
// ——————————————————————————————————————————

describe('POST /api/equipment-audits', () => {
  it('returns 401 for unauthenticated requests', async () => {
    mockUnauthenticated();
    const res = await createAudit(
      createRequest('http://localhost/api/equipment-audits', { fireRecordId: 'rec-1', auditType: 'general', items: [] }, 'POST')
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for civilian role', async () => {
    mockCivilianUser();
    const res = await createAudit(
      createRequest('http://localhost/api/equipment-audits', { fireRecordId: 'rec-1', auditType: 'general', items: [] }, 'POST')
    );
    expect(res.status).toBe(403);
  });

  it('returns 422 for invalid auditType', async () => {
    mockOfficialUser();
    const res = await createAudit(
      createRequest('http://localhost/api/equipment-audits', { fireRecordId: 'rec-1', auditType: 'invalid', items: [] }, 'POST')
    );
    expect(res.status).toBe(422);
  });

  it('returns 404 when fire record does not exist', async () => {
    mockOfficialUser();
    const res = await createAudit(
      createRequest('http://localhost/api/equipment-audits', { fireRecordId: 'nonexistent', auditType: 'general', items: [] }, 'POST')
    );
    expect(res.status).toBe(404);
  });

  it('creates a general audit successfully', async () => {
    mockOfficialUser();
    mockFireRecords.push({ id: 'rec-1', incidentId: 'inc-1' });

    const body = {
      fireRecordId: 'rec-1',
      auditType: 'general',
      items: [{ category: 'Matériels de lutte', name: 'Hache', quantiteEngagee: 5 }],
      dpeflcd: 'Ifrane',
      signedBy: 'Test User',
    };

    const res = await createAudit(createRequest('http://localhost/api/equipment-audits', body, 'POST'));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.auditType).toBe('general');
    expect(data.fireRecordId).toBe('rec-1');
    expect(data.dpeflcd).toBe('Ifrane');
  });

  it('creates a VPI audit successfully', async () => {
    mockOfficialUser();
    mockFireRecords.push({ id: 'rec-2', incidentId: 'inc-2' });

    const body = {
      fireRecordId: 'rec-2',
      auditType: 'vpi',
      vpiMatricule: 'VPI-042',
      items: [{ category: 'Outillage du véhicule', name: 'Treuil', quantiteNecessaire: 1 }],
    };

    const res = await createAudit(createRequest('http://localhost/api/equipment-audits', body, 'POST'));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.auditType).toBe('vpi');
    expect(data.vpiMatricule).toBe('VPI-042');
  });
});

// ——————————————————————————————————————————
// GET /api/equipment-audits
// ——————————————————————————————————————————

describe('GET /api/equipment-audits', () => {
  it('returns 401 for unauthenticated requests', async () => {
    mockUnauthenticated();
    const res = await listAudits(createRequest('http://localhost/api/equipment-audits'));
    expect(res.status).toBe(401);
  });

  it('lists audits filtered by fireRecordId', async () => {
    mockOfficialUser();
    mockAudits.push(
      { id: 'a1', fireRecordId: 'rec-1', auditType: 'general', items: [] },
      { id: 'a2', fireRecordId: 'rec-2', auditType: 'vpi', items: [] },
    );

    const res = await listAudits(createRequest('http://localhost/api/equipment-audits?fireRecordId=rec-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('a1');
  });
});

// ——————————————————————————————————————————
// PATCH /api/equipment-audits/[id]
// ——————————————————————————————————————————

describe('PATCH /api/equipment-audits/[id]', () => {
  it('returns 401 for unauthenticated requests', async () => {
    mockUnauthenticated();
    const res = await updateAudit(
      createRequest('http://localhost/api/equipment-audits/a1', { status: 'submitted' }, 'PATCH'),
      { params: { id: 'a1' } }
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for civilian role', async () => {
    mockCivilianUser();
    const res = await updateAudit(
      createRequest('http://localhost/api/equipment-audits/a1', { status: 'submitted' }, 'PATCH'),
      { params: { id: 'a1' } }
    );
    expect(res.status).toBe(403);
  });

  it('updates an existing audit', async () => {
    mockOfficialUser();
    mockAudits.push({ id: 'a1', fireRecordId: 'rec-1', auditType: 'general', items: [], status: 'draft' });

    const res = await updateAudit(
      createRequest('http://localhost/api/equipment-audits/a1', { signedBy: 'Agent X', status: 'submitted' }, 'PATCH'),
      { params: { id: 'a1' } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.signedBy).toBe('Agent X');
    expect(data.status).toBe('submitted');
  });
});

// ——————————————————————————————————————————
// GET /api/equipment-audits/[id]
// ——————————————————————————————————————————

describe('GET /api/equipment-audits/[id]', () => {
  it('returns 404 for nonexistent audit', async () => {
    mockOfficialUser();
    const res = await getAudit(
      createRequest('http://localhost/api/equipment-audits/nonexistent'),
      { params: { id: 'nonexistent' } }
    );
    expect(res.status).toBe(400);
  });

  it('returns an existing audit', async () => {
    mockOfficialUser();
    mockAudits.push({ id: 'a1', fireRecordId: 'rec-1', auditType: 'general', items: [{ name: 'Hache' }] });

    const res = await getAudit(
      createRequest('http://localhost/api/equipment-audits/a1'),
      { params: { id: 'a1' } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe('a1');
    expect(data.items).toHaveLength(1);
  });
});

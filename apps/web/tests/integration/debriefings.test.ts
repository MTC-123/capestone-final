import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/monitoring', () => ({ trackEvent: vi.fn() }));

// Mock auth
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from '@/lib/auth';

// Mock prisma
vi.mock('@/lib/prisma', () => {
  const mockDebriefings: Record<string, unknown>[] = [];
  const mockFireRecords: Record<string, unknown>[] = [];

  return {
    prisma: {
      debriefing: {
        findMany: vi.fn(async (args?: { where?: Record<string, unknown>; orderBy?: unknown }) => {
          let results = [...mockDebriefings];
          if (args?.where?.fireRecordId) {
            results = results.filter((d) => d.fireRecordId === args.where!.fireRecordId);
          }
          return results;
        }),
        findUnique: vi.fn(async (args: { where: { id?: string; fireRecordId?: string } }) => {
          if (args.where.id) return mockDebriefings.find((d) => d.id === args.where.id) ?? null;
          if (args.where.fireRecordId) return mockDebriefings.find((d) => d.fireRecordId === args.where.fireRecordId) ?? null;
          return null;
        }),
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          const debriefing = {
            id: `debrief-${Date.now()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            topographie: [],
            ...args.data,
          };
          mockDebriefings.push(debriefing);
          return debriefing;
        }),
        update: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
          const idx = mockDebriefings.findIndex((d) => d.id === args.where.id);
          if (idx === -1) throw new Error('Not found');
          mockDebriefings[idx] = { ...mockDebriefings[idx], ...args.data, updatedAt: new Date() };
          return mockDebriefings[idx];
        }),
      },
      fireEventRecord: {
        findUnique: vi.fn(async (args: { where: { id: string } }) => {
          return mockFireRecords.find((r) => r.id === args.where.id) ?? null;
        }),
      },
      _mockDebriefings: mockDebriefings,
      _mockFireRecords: mockFireRecords,
    },
  };
});
import { prisma } from '@/lib/prisma';

import { POST as createDebriefing, GET as listDebriefings } from '@/app/api/debriefings/route';
import { PATCH as updateDebriefing, GET as getDebriefing } from '@/app/api/debriefings/[id]/route';

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

const mockDebriefings = (prisma as unknown as { _mockDebriefings: Record<string, unknown>[] })._mockDebriefings;
const mockFireRecords = (prisma as unknown as { _mockFireRecords: Record<string, unknown>[] })._mockFireRecords;

beforeEach(() => {
  vi.clearAllMocks();
  mockDebriefings.length = 0;
  mockFireRecords.length = 0;
});

// ——————————————————————————————————————————
// POST /api/debriefings
// ——————————————————————————————————————————

describe('POST /api/debriefings', () => {
  it('returns 401 for unauthenticated requests', async () => {
    mockUnauthenticated();
    const res = await createDebriefing(
      createRequest('http://localhost/api/debriefings', { fireRecordId: 'rec-1' }, 'POST'),
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for civilian role', async () => {
    mockCivilianUser();
    const res = await createDebriefing(
      createRequest('http://localhost/api/debriefings', { fireRecordId: 'rec-1' }, 'POST'),
    );
    expect(res.status).toBe(403);
  });

  it('returns 404 when fire record does not exist', async () => {
    mockOfficialUser();
    const res = await createDebriefing(
      createRequest('http://localhost/api/debriefings', { fireRecordId: 'nonexistent' }, 'POST'),
    );
    expect(res.status).toBe(404);
  });

  it('returns 409 when debriefing already exists for fire record', async () => {
    mockOfficialUser();
    mockFireRecords.push({ id: 'rec-1', incidentId: 'inc-1' });
    mockDebriefings.push({ id: 'd1', fireRecordId: 'rec-1' });

    const res = await createDebriefing(
      createRequest('http://localhost/api/debriefings', { fireRecordId: 'rec-1' }, 'POST'),
    );
    expect(res.status).toBe(409);
  });

  it('creates a debriefing successfully', async () => {
    mockOfficialUser();
    mockFireRecords.push({ id: 'rec-2', incidentId: 'inc-2' });

    const body = {
      fireRecordId: 'rec-2',
      superficieIncendiee: 15.5,
      heureDeclenchement: '14:30',
      typeEssence: 'Chêne vert',
      alertePrecoce: true,
      alertePrecoceDetail: 'Alerte par berger',
      topographie: ['Crête', 'Versant'],
      pistesForestieres: false,
      pointsEau: true,
      pointsEauAccessible: true,
      prochaineFois: 'Améliorer les pistes forestières',
      animateurNom: 'Mohamed Alami',
      participants: [{ nom: 'Ahmed B', poste: 'Chef de secteur' }],
    };

    const res = await createDebriefing(
      createRequest('http://localhost/api/debriefings', body, 'POST'),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.fireRecordId).toBe('rec-2');
    expect(data.superficieIncendiee).toBe(15.5);
    expect(data.topographie).toEqual(['Crête', 'Versant']);
    expect(data.pistesForestieres).toBe(false);
    expect(data.alertePrecoce).toBe(true);
  });
});

// ——————————————————————————————————————————
// GET /api/debriefings
// ——————————————————————————————————————————

describe('GET /api/debriefings', () => {
  it('returns 401 for unauthenticated requests', async () => {
    mockUnauthenticated();
    const res = await listDebriefings(
      createRequest('http://localhost/api/debriefings'),
    );
    expect(res.status).toBe(401);
  });

  it('returns debriefing for a specific fire record', async () => {
    mockOfficialUser();
    mockDebriefings.push({ id: 'd1', fireRecordId: 'rec-1', status: 'draft' });
    mockDebriefings.push({ id: 'd2', fireRecordId: 'rec-2', status: 'draft' });

    const res = await listDebriefings(
      createRequest('http://localhost/api/debriefings?fireRecordId=rec-1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe('d1');
  });

  it('returns null when no debriefing exists for fire record', async () => {
    mockOfficialUser();
    const res = await listDebriefings(
      createRequest('http://localhost/api/debriefings?fireRecordId=nonexistent'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeNull();
  });

  it('lists all debriefings without filter', async () => {
    mockOfficialUser();
    mockDebriefings.push({ id: 'd1', fireRecordId: 'rec-1' });
    mockDebriefings.push({ id: 'd2', fireRecordId: 'rec-2' });

    const res = await listDebriefings(
      createRequest('http://localhost/api/debriefings'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
  });
});

// ——————————————————————————————————————————
// PATCH /api/debriefings/[id]
// ——————————————————————————————————————————

describe('PATCH /api/debriefings/[id]', () => {
  it('returns 401 for unauthenticated requests', async () => {
    mockUnauthenticated();
    const res = await updateDebriefing(
      createRequest('http://localhost/api/debriefings/d1', { status: 'submitted' }, 'PATCH'),
      { params: { id: 'd1' } },
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for civilian role', async () => {
    mockCivilianUser();
    const res = await updateDebriefing(
      createRequest('http://localhost/api/debriefings/d1', { status: 'submitted' }, 'PATCH'),
      { params: { id: 'd1' } },
    );
    expect(res.status).toBe(403);
  });

  it('updates an existing debriefing', async () => {
    mockOfficialUser();
    mockDebriefings.push({
      id: 'd1',
      fireRecordId: 'rec-1',
      status: 'draft',
      pistesForestieres: null,
      prochaineFois: '',
    });

    const res = await updateDebriefing(
      createRequest(
        'http://localhost/api/debriefings/d1',
        {
          pistesForestieres: true,
          pistesAmenagees: false,
          prochaineFois: 'Améliorer les accès',
          status: 'submitted',
        },
        'PATCH',
      ),
      { params: { id: 'd1' } },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pistesForestieres).toBe(true);
    expect(data.pistesAmenagees).toBe(false);
    expect(data.prochaineFois).toBe('Améliorer les accès');
    expect(data.status).toBe('submitted');
  });
});

// ——————————————————————————————————————————
// GET /api/debriefings/[id]
// ——————————————————————————————————————————

describe('GET /api/debriefings/[id]', () => {
  it('returns 400 for nonexistent debriefing', async () => {
    mockOfficialUser();
    const res = await getDebriefing(
      createRequest('http://localhost/api/debriefings/nonexistent'),
      { params: { id: 'nonexistent' } },
    );
    expect(res.status).toBe(400);
  });

  it('returns an existing debriefing', async () => {
    mockOfficialUser();
    mockDebriefings.push({
      id: 'd1',
      fireRecordId: 'rec-1',
      alertePrecoce: true,
      topographie: ['Crête'],
      participants: [{ nom: 'Test', poste: 'Chef' }],
    });

    const res = await getDebriefing(
      createRequest('http://localhost/api/debriefings/d1'),
      { params: { id: 'd1' } },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe('d1');
    expect(data.alertePrecoce).toBe(true);
    expect(data.topographie).toEqual(['Crête']);
  });
});

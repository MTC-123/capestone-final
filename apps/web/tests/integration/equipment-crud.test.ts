/**
 * Integration Test: Equipment / Retardant / Infrastructure CRUD
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { getCurrentUser } from '@/lib/auth';
import type { Scope } from '@/lib/auth';

import { GET as getEquipmentList, POST as createEquipment } from '@/app/api/equipment/route';
import { GET as getEquipment, PATCH as patchEquipment, DELETE as deleteEquipment } from '@/app/api/equipment/[id]/route';

import { GET as getRetardantList, POST as createRetardant } from '@/app/api/retardant/route';
import { GET as getRetardant, PATCH as patchRetardant, DELETE as deleteRetardant } from '@/app/api/retardant/[id]/route';

import { GET as getInfraList, POST as createInfra } from '@/app/api/infrastructure/route';
import { GET as getInfra, PATCH as patchInfra, DELETE as deleteInfra } from '@/app/api/infrastructure/[id]/route';

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

const mockEquipment: any[] = [];
const mockRetardant: any[] = [];
const mockInfra: any[] = [];

vi.mock('@/lib/prisma', () => ({
  prisma: {
    equipment: {
      findMany: vi.fn((args?: any) => {
        let result = [...mockEquipment];
        if (args?.where?.type) result = result.filter((e) => e.type === args.where.type);
        if (args?.where?.status) result = result.filter((e) => e.status === args.where.status);
        return Promise.resolve(result);
      }),
      findUnique: vi.fn((args: any) =>
        Promise.resolve(mockEquipment.find((e) => e.id === args.where.id) || null)
      ),
      create: vi.fn((args: any) => {
        const item = {
          id: `eq-${mockEquipment.length + 1}`,
          status: 'OPERATIONNEL',
          quantity: 1,
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockEquipment.push(item);
        return Promise.resolve(item);
      }),
      update: vi.fn((args: any) => {
        const item = mockEquipment.find((e) => e.id === args.where.id);
        if (!item) throw new Error('Not found');
        Object.assign(item, args.data, { updatedAt: new Date() });
        return Promise.resolve(item);
      }),
      delete: vi.fn((args: any) => {
        const idx = mockEquipment.findIndex((e) => e.id === args.where.id);
        if (idx === -1) throw new Error('Not found');
        return Promise.resolve(mockEquipment.splice(idx, 1)[0]);
      }),
    },
    retardantProduct: {
      findMany: vi.fn((args?: any) => {
        let result = [...mockRetardant];
        if (args?.where?.type) result = result.filter((r) => r.type === args.where.type);
        return Promise.resolve(result);
      }),
      findUnique: vi.fn((args: any) =>
        Promise.resolve(mockRetardant.find((r) => r.id === args.where.id) || null)
      ),
      create: vi.fn((args: any) => {
        const item = {
          id: `ret-${mockRetardant.length + 1}`,
          type: 'MOUSSE',
          unit: 'L',
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockRetardant.push(item);
        return Promise.resolve(item);
      }),
      update: vi.fn((args: any) => {
        const item = mockRetardant.find((r) => r.id === args.where.id);
        if (!item) throw new Error('Not found');
        Object.assign(item, args.data, { updatedAt: new Date() });
        return Promise.resolve(item);
      }),
      delete: vi.fn((args: any) => {
        const idx = mockRetardant.findIndex((r) => r.id === args.where.id);
        if (idx === -1) throw new Error('Not found');
        return Promise.resolve(mockRetardant.splice(idx, 1)[0]);
      }),
    },
    infrastructure: {
      findMany: vi.fn((args?: any) => {
        let result = [...mockInfra];
        if (args?.where?.type) result = result.filter((i) => i.type === args.where.type);
        if (args?.where?.status) result = result.filter((i) => i.status === args.where.status);
        return Promise.resolve(result);
      }),
      findUnique: vi.fn((args: any) =>
        Promise.resolve(mockInfra.find((i) => i.id === args.where.id) || null)
      ),
      create: vi.fn((args: any) => {
        const item = {
          id: `infra-${mockInfra.length + 1}`,
          status: 'OPERATIONNEL',
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockInfra.push(item);
        return Promise.resolve(item);
      }),
      update: vi.fn((args: any) => {
        const item = mockInfra.find((i) => i.id === args.where.id);
        if (!item) throw new Error('Not found');
        Object.assign(item, args.data, { updatedAt: new Date() });
        return Promise.resolve(item);
      }),
      delete: vi.fn((args: any) => {
        const idx = mockInfra.findIndex((i) => i.id === args.where.id);
        if (idx === -1) throw new Error('Not found');
        return Promise.resolve(mockInfra.splice(idx, 1)[0]);
      }),
    },
  },
}));

// ============================================
// Helpers
// ============================================

function makeRequest(url: string, method = 'GET', body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) init.body = JSON.stringify(body);
  return new Request(`http://localhost:3000${url}`, init);
}

const OFFICIAL_USER = {
  tokenUse: 'access' as const,
  userId: 'user-1',
  id: 'user-1',
  cin: 'OFF123',
  role: 'OFFICIAL' as const,
  scopes: ['map:read', 'map:write'] as Scope[],
};

const CIVILIAN_USER = {
  tokenUse: 'access' as const,
  userId: 'user-2',
  id: 'user-2',
  cin: 'CIV123',
  role: 'CIVILIAN' as const,
  scopes: ['map:read'] as Scope[],
};

// ============================================
// Equipment CRUD
// ============================================

describe('Equipment CRUD', () => {
  beforeEach(() => {
    mockEquipment.length = 0;
    mockRetardant.length = 0;
    mockInfra.length = 0;
    vi.mocked(getCurrentUser).mockResolvedValue(OFFICIAL_USER);
  });

  it('POST creates equipment and GET lists it', async () => {
    const createRes = await createEquipment(
      makeRequest('/api/equipment', 'POST', { type: 'VPI', name: 'VPI-01', department: 'DPEFLCD' })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.item.type).toBe('VPI');
    expect(created.item.name).toBe('VPI-01');
    expect(created.item.status).toBe('OPERATIONNEL');

    const listRes = await getEquipmentList(makeRequest('/api/equipment'));
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.items).toHaveLength(1);
  });

  it('POST validates required fields', async () => {
    const res = await createEquipment(makeRequest('/api/equipment', 'POST', {}));
    expect(res.status).toBe(400);
  });

  it('PATCH updates equipment', async () => {
    mockEquipment.push({ id: 'eq-1', type: 'VPI', name: 'VPI-01', status: 'OPERATIONNEL', quantity: 1 });
    const res = await patchEquipment(
      makeRequest('/api/equipment/eq-1', 'PATCH', { quantity: 5 }),
      { params: { id: 'eq-1' } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.item.quantity).toBe(5);
  });

  it('DELETE removes equipment', async () => {
    mockEquipment.push({ id: 'eq-1', type: 'VPI', name: 'VPI-01' });
    const res = await deleteEquipment(
      makeRequest('/api/equipment/eq-1', 'DELETE'),
      { params: { id: 'eq-1' } }
    );
    expect(res.status).toBe(200);
    expect(mockEquipment).toHaveLength(0);
  });

  it('returns 404 for non-existent equipment', async () => {
    const res = await getEquipment(
      makeRequest('/api/equipment/missing', 'GET'),
      { params: { id: 'missing' } }
    );
    expect(res.status).toBe(404);
  });

  it('returns 401 for unauthenticated requests', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await getEquipmentList(makeRequest('/api/equipment'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-OFFICIAL users', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(CIVILIAN_USER);
    const res = await getEquipmentList(makeRequest('/api/equipment'));
    expect(res.status).toBe(403);
  });
});

// ============================================
// Retardant CRUD
// ============================================

describe('Retardant CRUD', () => {
  beforeEach(() => {
    mockEquipment.length = 0;
    mockRetardant.length = 0;
    mockInfra.length = 0;
    vi.mocked(getCurrentUser).mockResolvedValue(OFFICIAL_USER);
  });

  it('POST creates retardant and GET lists it', async () => {
    const createRes = await createRetardant(
      makeRequest('/api/retardant', 'POST', {
        name: 'Mousse A',
        quantity: 500,
        storageLocation: 'Dépôt Ifrane',
        acquisitionDate: '2025-06-01',
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.item.name).toBe('Mousse A');

    const listRes = await getRetardantList(makeRequest('/api/retardant'));
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.items).toHaveLength(1);
  });

  it('POST validates required fields', async () => {
    const res = await createRetardant(makeRequest('/api/retardant', 'POST', { name: 'Test' }));
    expect(res.status).toBe(400);
  });

  it('PATCH updates retardant', async () => {
    mockRetardant.push({
      id: 'ret-1', name: 'Mousse A', type: 'MOUSSE', quantity: 500,
      unit: 'L', storageLocation: 'Dépôt', acquisitionDate: new Date(),
    });
    const res = await patchRetardant(
      makeRequest('/api/retardant/ret-1', 'PATCH', { quantity: 800 }),
      { params: { id: 'ret-1' } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.item.quantity).toBe(800);
  });

  it('DELETE removes retardant', async () => {
    mockRetardant.push({ id: 'ret-1', name: 'Mousse A' });
    const res = await deleteRetardant(
      makeRequest('/api/retardant/ret-1', 'DELETE'),
      { params: { id: 'ret-1' } }
    );
    expect(res.status).toBe(200);
    expect(mockRetardant).toHaveLength(0);
  });

  it('returns 404 for non-existent retardant', async () => {
    const res = await getRetardant(
      makeRequest('/api/retardant/missing', 'GET'),
      { params: { id: 'missing' } }
    );
    expect(res.status).toBe(404);
  });
});

// ============================================
// Infrastructure CRUD
// ============================================

describe('Infrastructure CRUD', () => {
  beforeEach(() => {
    mockEquipment.length = 0;
    mockRetardant.length = 0;
    mockInfra.length = 0;
    vi.mocked(getCurrentUser).mockResolvedValue(OFFICIAL_USER);
  });

  it('POST creates infrastructure and GET lists it', async () => {
    const createRes = await createInfra(
      makeRequest('/api/infrastructure', 'POST', {
        type: 'WATCHTOWER',
        name: 'Tour Nord',
        latitude: 33.54,
        longitude: -5.10,
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.item.type).toBe('WATCHTOWER');
    expect(created.item.latitude).toBe(33.54);

    const listRes = await getInfraList(makeRequest('/api/infrastructure'));
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.items).toHaveLength(1);
  });

  it('POST validates required fields', async () => {
    const res = await createInfra(makeRequest('/api/infrastructure', 'POST', {}));
    expect(res.status).toBe(400);
  });

  it('PATCH updates infrastructure', async () => {
    mockInfra.push({
      id: 'infra-1', type: 'WATCHTOWER', name: 'Tour Nord',
      status: 'OPERATIONNEL', latitude: 33.54, longitude: -5.10,
    });
    const res = await patchInfra(
      makeRequest('/api/infrastructure/infra-1', 'PATCH', { status: 'DEGRADE' }),
      { params: { id: 'infra-1' } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.item.status).toBe('DEGRADE');
  });

  it('DELETE removes infrastructure', async () => {
    mockInfra.push({ id: 'infra-1', type: 'WATCHTOWER', name: 'Tour Nord' });
    const res = await deleteInfra(
      makeRequest('/api/infrastructure/infra-1', 'DELETE'),
      { params: { id: 'infra-1' } }
    );
    expect(res.status).toBe(200);
    expect(mockInfra).toHaveLength(0);
  });

  it('returns 404 for non-existent infrastructure', async () => {
    const res = await getInfra(
      makeRequest('/api/infrastructure/missing', 'GET'),
      { params: { id: 'missing' } }
    );
    expect(res.status).toBe(404);
  });
});

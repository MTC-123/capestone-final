/**
 * Integration Test: Operations Checklist API Routes
 * Tests GET/POST /api/operations/checklists and PATCH/DELETE /api/operations/checklists/[id]
 */

import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { getCurrentUser } from '@/lib/auth';
import { GET, POST } from '@/app/api/operations/checklists/route';
import { PATCH, DELETE } from '@/app/api/operations/checklists/[id]/route';
import { GET as getSummary } from '@/app/api/operations/summary/route';

vi.mock('@/lib/auth');
vi.mock('@/lib/observability/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/observability/monitoring', () => ({
  captureException: vi.fn(),
}));

const mockItems: any[] = [];
let idCounter = 0;

vi.mock('@/lib/prisma', () => ({
  prisma: {
    phaseChecklist: {
      findMany: vi.fn((args: any) => {
        let items = [...mockItems];
        if (args.where?.campaignId) items = items.filter((i) => i.campaignId === args.where.campaignId);
        if (args.where?.phase) items = items.filter((i) => i.phase === args.where.phase);
        items.sort((a, b) => a.sortOrder - b.sortOrder);
        return Promise.resolve(items);
      }),
      findFirst: vi.fn((args: any) => {
        let items = [...mockItems];
        if (args.where?.campaignId) items = items.filter((i) => i.campaignId === args.where.campaignId);
        if (args.where?.phase) items = items.filter((i) => i.phase === args.where.phase);
        items.sort((a, b) => b.sortOrder - a.sortOrder);
        return Promise.resolve(items[0] || null);
      }),
      findUnique: vi.fn((args: any) =>
        Promise.resolve(mockItems.find((i) => i.id === args.where.id) || null)
      ),
      create: vi.fn((args: any) => {
        const item = {
          id: `item-${++idCounter}`,
          ...args.data,
          status: args.data.status || 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockItems.push(item);
        return Promise.resolve(item);
      }),
      update: vi.fn((args: any) => {
        const item = mockItems.find((i) => i.id === args.where.id);
        if (!item) throw new Error('Not found');
        Object.assign(item, args.data);
        item.updatedAt = new Date();
        return Promise.resolve(item);
      }),
      delete: vi.fn((args: any) => {
        const idx = mockItems.findIndex((i) => i.id === args.where.id);
        if (idx >= 0) mockItems.splice(idx, 1);
        return Promise.resolve({});
      }),
      groupBy: vi.fn((args: any) => {
        const items = mockItems.filter((i) => i.campaignId === args.where.campaignId);
        const groups: Record<string, Record<string, number>> = {};
        for (const item of items) {
          const key = `${item.phase}:${item.status}`;
          if (!groups[key]) groups[key] = { phase: item.phase, status: item.status, _count: 0 };
          (groups[key] as any)._count++;
        }
        return Promise.resolve(Object.values(groups));
      }),
    },
  },
}));

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

describe('Operations Checklists API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItems.length = 0;
    idCounter = 0;
  });
  afterEach(() => { vi.clearAllMocks(); });

  describe('GET /api/operations/checklists', () => {
    it('returns filtered items by campaignId and phase', async () => {
      mockOfficialUser();
      mockItems.push(
        { id: 'i1', campaignId: 'c1', phase: 'PREPARATION', task: 'Task A', status: 'PENDING', sortOrder: 0 },
        { id: 'i2', campaignId: 'c1', phase: 'PREPARATION', task: 'Task B', status: 'DONE', sortOrder: 1 },
        { id: 'i3', campaignId: 'c1', phase: 'ALERTE', task: 'Task C', status: 'PENDING', sortOrder: 0 }
      );

      const res = await GET(
        createRequest('/api/operations/checklists?campaignId=c1&phase=PREPARATION')
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items).toHaveLength(2);
    });
  });

  describe('POST /api/operations/checklists', () => {
    it('creates a new checklist item', async () => {
      mockOfficialUser();

      const res = await POST(
        createRequest('/api/operations/checklists', {
          campaignId: 'c1',
          phase: 'PREPARATION',
          task: 'New custom task',
        }, 'POST')
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.item.task).toBe('New custom task');
      expect(data.item.status).toBe('PENDING');
    });
  });

  describe('PATCH /api/operations/checklists/[id]', () => {
    it('stamps completedAt/completedBy when status=DONE', async () => {
      mockOfficialUser();
      mockItems.push({
        id: 'item-patch',
        campaignId: 'c1',
        phase: 'PREPARATION',
        task: 'Test',
        status: 'PENDING',
        sortOrder: 0,
      });

      const res = await PATCH(
        createRequest('/api/operations/checklists/item-patch', { status: 'DONE' }, 'PATCH'),
        { params: Promise.resolve({ id: 'item-patch' }) } as any
      );
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.item.status).toBe('DONE');
      expect(data.item.completedBy).toBe('OFF001');
      expect(data.item.completedAt).toBeTruthy();
    });
  });

  describe('DELETE /api/operations/checklists/[id]', () => {
    it('removes the item', async () => {
      mockOfficialUser();
      mockItems.push({
        id: 'item-del',
        campaignId: 'c1',
        phase: 'PREPARATION',
        task: 'Delete me',
        status: 'PENDING',
        sortOrder: 0,
      });

      const res = await DELETE(
        createRequest('/api/operations/checklists/item-del', undefined, 'DELETE'),
        { params: Promise.resolve({ id: 'item-del' }) } as any
      );
      expect(res.status).toBe(200);
      expect(mockItems).toHaveLength(0);
    });
  });

  describe('GET /api/operations/summary', () => {
    it('returns correct counts per phase', async () => {
      mockOfficialUser();
      mockItems.push(
        { id: 'i1', campaignId: 'c1', phase: 'PREPARATION', status: 'DONE', sortOrder: 0 },
        { id: 'i2', campaignId: 'c1', phase: 'PREPARATION', status: 'DONE', sortOrder: 1 },
        { id: 'i3', campaignId: 'c1', phase: 'PREPARATION', status: 'PENDING', sortOrder: 2 },
        { id: 'i4', campaignId: 'c1', phase: 'ALERTE', status: 'PENDING', sortOrder: 0 }
      );

      const res = await getSummary(
        createRequest('/api/operations/summary?campaignId=c1')
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.summary.PREPARATION.total).toBe(3);
      expect(data.summary.PREPARATION.done).toBe(2);
      expect(data.summary.ALERTE.total).toBe(1);
      expect(data.summary.ALERTE.done).toBe(0);
    });
  });
});

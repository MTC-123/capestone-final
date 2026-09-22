/**
 * Integration Test: Operations Campaign API Routes
 * Tests POST /api/operations/campaigns, GET, and advance
 */

import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { getCurrentUser } from '@/lib/auth';
import { GET, POST } from '@/app/api/operations/campaigns/route';
import { POST as advancePhase } from '@/app/api/operations/campaigns/[id]/advance/route';

vi.mock('@/lib/auth');
vi.mock('@/lib/observability/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/observability/monitoring', () => ({
  captureException: vi.fn(),
}));

const mockCampaigns: any[] = [];
const mockChecklists: any[] = [];
let idCounter = 0;

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: {
      findMany: vi.fn(() => Promise.resolve([...mockCampaigns].sort((a, b) => b.year - a.year))),
      findUnique: vi.fn((args: any) => {
        if (args.where.year !== undefined) {
          return Promise.resolve(mockCampaigns.find((c) => c.year === args.where.year) || null);
        }
        return Promise.resolve(mockCampaigns.find((c) => c.id === args.where.id) || null);
      }),
      create: vi.fn((args: any) => {
        const campaign = {
          id: `camp-${++idCounter}`,
          ...args.data,
          status: 'PLANNING',
          activePhase: 'PREPARATION',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockCampaigns.push(campaign);
        return Promise.resolve(campaign);
      }),
      update: vi.fn((args: any) => {
        const campaign = mockCampaigns.find((c) => c.id === args.where.id);
        if (!campaign) throw new Error('Not found');
        Object.assign(campaign, args.data);
        campaign.updatedAt = new Date();
        return Promise.resolve(campaign);
      }),
    },
    phaseChecklist: {
      createMany: vi.fn((args: any) => {
        for (const item of args.data) {
          mockChecklists.push({
            id: `check-${++idCounter}`,
            ...item,
            status: 'PENDING',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        return Promise.resolve({ count: args.data.length });
      }),
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

describe('Operations Campaigns API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaigns.length = 0;
    mockChecklists.length = 0;
    idCounter = 0;
  });
  afterEach(() => { vi.clearAllMocks(); });

  describe('POST /api/operations/campaigns', () => {
    it('creates campaign and seeds 38 default tasks', async () => {
      mockOfficialUser();

      const res = await POST(
        createRequest('/api/operations/campaigns', { year: 2026, label: 'Campagne 2026' })
      );
      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data.campaign.year).toBe(2026);
      expect(data.campaign.label).toBe('Campagne 2026');
      expect(data.campaign.status).toBe('PLANNING');
      expect(data.campaign.activePhase).toBe('PREPARATION');

      // 8+6+5+6+7+6 = 38 tasks seeded
      expect(mockChecklists).toHaveLength(38);
    });

    it('returns 409 for duplicate year', async () => {
      mockOfficialUser();

      // Create first
      await POST(
        createRequest('/api/operations/campaigns', { year: 2026, label: 'Campagne 2026' })
      );

      // Try duplicate
      const res = await POST(
        createRequest('/api/operations/campaigns', { year: 2026, label: 'Another' })
      );
      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/operations/campaigns', () => {
    it('returns campaigns ordered by year desc', async () => {
      mockOfficialUser();
      mockCampaigns.push(
        { id: 'c1', year: 2025, label: '2025', status: 'CLOSED', activePhase: 'POST_CAMPAGNE', createdAt: new Date(), updatedAt: new Date() },
        { id: 'c2', year: 2026, label: '2026', status: 'ACTIVE', activePhase: 'LUTTE', createdAt: new Date(), updatedAt: new Date() }
      );

      const res = await GET(
        createRequest('/api/operations/campaigns', undefined, 'GET')
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.campaigns).toHaveLength(2);
      expect(data.campaigns[0].year).toBe(2026);
    });
  });

  describe('POST /api/operations/campaigns/[id]/advance', () => {
    it('advances phase from PREPARATION to PREPOSITIONNEMENT', async () => {
      mockOfficialUser();
      mockCampaigns.push({
        id: 'camp-adv',
        year: 2026,
        label: 'Test',
        status: 'PLANNING',
        activePhase: 'PREPARATION',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await advancePhase(
        createRequest('/api/operations/campaigns/camp-adv/advance'),
        { params: Promise.resolve({ id: 'camp-adv' }) } as any
      );
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.campaign.activePhase).toBe('PREPOSITIONNEMENT');
      expect(data.campaign.status).toBe('ACTIVE');
    });

    it('returns 409 at POST_CAMPAGNE', async () => {
      mockOfficialUser();
      mockCampaigns.push({
        id: 'camp-last',
        year: 2026,
        label: 'Test',
        status: 'ACTIVE',
        activePhase: 'POST_CAMPAGNE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await advancePhase(
        createRequest('/api/operations/campaigns/camp-last/advance'),
        { params: Promise.resolve({ id: 'camp-last' }) } as any
      );
      expect(res.status).toBe(409);
    });
  });
});

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { getCurrentUser } from '@/lib/auth';
import { GET } from '@/app/api/operations/campaigns/[id]/pdf/route';

vi.mock('@/lib/auth');
vi.mock('@/lib/observability/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/observability/monitoring', () => ({
  captureException: vi.fn(),
}));

const mockCampaign = {
  id: 'camp-pdf',
  year: 2026,
  label: 'Campagne 2026',
  status: 'ACTIVE',
  activePhase: 'LUTTE',
  seasonStart: null,
  seasonEnd: null,
  notes: 'Phase de lutte terminee avec coordination interservices.',
  createdBy: 'OFF001',
  createdAt: new Date('2026-04-20T08:00:00.000Z'),
  updatedAt: new Date('2026-04-21T12:00:00.000Z'),
  checklists: [
    {
      id: 'task-1',
      campaignId: 'camp-pdf',
      phase: 'LUTTE',
      task: 'Mettre en place la structure ICS',
      responsibleUnit: 'PC avance',
      deadline: new Date('2026-04-21T14:00:00.000Z'),
      status: 'DONE',
      notes: 'Commandement unifie installe.',
      completedBy: 'OFF001',
      completedAt: new Date('2026-04-21T13:20:00.000Z'),
      sortOrder: 0,
      createdAt: new Date('2026-04-21T08:00:00.000Z'),
      updatedAt: new Date('2026-04-21T13:20:00.000Z'),
    },
  ],
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: {
      findUnique: vi.fn(() => Promise.resolve(mockCampaign)),
    },
  },
}));

function createRequest(url: string): Request {
  return new Request(`http://localhost${url}`, { method: 'GET' });
}

function mockOfficialUser() {
  vi.mocked(getCurrentUser).mockResolvedValue({
    tokenUse: 'access',
    userId: 'user-official-1',
    cin: 'OFF001',
    role: 'OFFICIAL',
    scopes: ['map:read', 'map:write', 'reports:read', 'reports:write'],
  });
}

describe('Operation phase PDF API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a PDF for officials', async () => {
    mockOfficialUser();

    const res = await GET(
      createRequest('/api/operations/campaigns/camp-pdf/pdf?phase=LUTTE&lang=fr'),
      { params: Promise.resolve({ id: 'camp-pdf' }) } as any
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('phase-operationnelle-Campagne-2026-lutte-fr.pdf');

    const header = Buffer.from(await res.arrayBuffer()).subarray(0, 4).toString('latin1');
    expect(header).toBe('%PDF');
  });

  it('rejects civilians', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      tokenUse: 'access',
      userId: 'civilian-1',
      cin: 'CIV001',
      role: 'CIVILIAN',
      scopes: ['reports:write'],
    });

    const res = await GET(
      createRequest('/api/operations/campaigns/camp-pdf/pdf?phase=LUTTE&lang=fr'),
      { params: Promise.resolve({ id: 'camp-pdf' }) } as any
    );

    expect(res.status).toBe(403);
  });
});

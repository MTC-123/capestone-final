import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { POST as assignPost } from '@/app/api/dispatch/assign/route';
import { POST as routePost } from '@/app/api/dispatch/route/route';
import { GET as teamsGet, POST as teamsPost } from '@/app/api/dispatch/teams/route';
import { PATCH as teamPatch } from '@/app/api/dispatch/teams/[id]/route';
import { getCurrentUser } from '@/lib/auth';
import type { AccessTokenPayload } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth');
vi.mock('@/lib/observability/logger');
vi.mock('@/lib/observability/monitoring', () => ({
  captureException: vi.fn(),
}));
vi.mock('@/lib/database/withRetry', () => ({
  withRetry: vi.fn((fn: () => unknown) => fn()),
}));

// -- Prisma --
const mockTeams: any[] = [];
const mockIncidents: any[] = [];
const mockDispatches: any[] = [];

vi.mock('@/lib/prisma', () => ({
  prisma: {
    team: {
      findMany: vi.fn(() => Promise.resolve(mockTeams)),
      findUnique: vi.fn((args: any) =>
        Promise.resolve(mockTeams.find((t) => t.id === args.where.id) ?? null),
      ),
      create: vi.fn((args: any) => {
        const team = {
          id: `team-${mockTeams.length + 1}`,
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockTeams.push(team);
        return Promise.resolve(team);
      }),
      update: vi.fn((args: any) => {
        const team = mockTeams.find((t) => t.id === args.where.id);
        if (!team) throw new Error('Team not found');
        Object.assign(team, args.data);
        team.updatedAt = new Date();
        return Promise.resolve(team);
      }),
    },
    incident: {
      findUnique: vi.fn((args: any) =>
        Promise.resolve(mockIncidents.find((i) => i.id === args.where.id) ?? null),
      ),
    },
    dispatch: {
      findFirst: vi.fn((args: any) =>
        Promise.resolve(
          mockDispatches.find(
            (d) =>
              d.teamId === args.where.teamId &&
              d.incidentId === args.where.incidentId,
          ) ?? null,
        ),
      ),
      create: vi.fn((args: any) => {
        const dispatch = {
          id: `dispatch-${mockDispatches.length + 1}`,
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockDispatches.push(dispatch);
        return Promise.resolve(dispatch);
      }),
    },
  },
}));

// -- GeoJSON validation (used by teams endpoint) --
vi.mock('@/lib/validation/geojson', () => ({
  validatePoint: vi.fn((val: any) => {
    if (
      val &&
      typeof val === 'object' &&
      val.type === 'Point' &&
      Array.isArray(val.coordinates) &&
      val.coordinates.length === 2
    ) {
      return val;
    }
    return null;
  }),
}));

// -- GraphHopper client --
vi.mock('@/lib/routing/graphhopper', () => ({
  GraphHopperClient: vi.fn().mockImplementation(() => ({
    getRoute: vi.fn().mockResolvedValue({
      primary: {
        coordinates: [
          [-5.1, 33.5],
          [-5.08, 33.55],
        ],
        distance_km: 5.2,
        duration_min: 12,
        instructions: [],
      },
      alternatives: [],
      metadata: {
        provider: 'graphhopper',
        cached: false,
        computed_at: new Date().toISOString(),
      },
    }),
  })),
}));

// -- Route cache --
vi.mock('@/lib/routing/cache', () => ({
  getCachedRoute: vi.fn().mockResolvedValue(null),
  setCachedRoute: vi.fn().mockResolvedValue(undefined),
}));

// -- Redis cache (used transitively by SlidingWindowRateLimiter) --
vi.mock('@/lib/cache/redis', () => ({
  getCacheClient: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  }),
  cacheJSON: vi.fn().mockResolvedValue(undefined),
  getCachedJSON: vi.fn().mockResolvedValue(null),
  deleteCached: vi.fn().mockResolvedValue(undefined),
}));

// -- Rate limiter -- mock class so it always allows
vi.mock('@/lib/ratelimit/slidingWindow', () => ({
  SlidingWindowRateLimiter: vi.fn().mockImplementation(() => ({
    checkLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 29, resetAt: Date.now() + 60_000 }),
    reset: vi.fn().mockResolvedValue(undefined),
  })),
  createFirmsRateLimiter: vi.fn().mockImplementation(() => ({
    checkLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 99, resetAt: Date.now() + 60_000 }),
    reset: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OFFICIAL_USER: AccessTokenPayload = {
  tokenUse: 'access',
  userId: 'user-official-1',
  cin: 'OFF123',
  role: 'OFFICIAL',
  scopes: ['map:read', 'map:write', 'reports:read', 'reports:write', 'equipment:read', 'equipment:write', 'analytics:read'],
};

const CIVILIAN_USER: AccessTokenPayload = {
  tokenUse: 'access',
  userId: 'user-civilian-1',
  cin: 'CIV456',
  role: 'CIVILIAN',
  scopes: ['map:read', 'reports:read', 'reports:write', 'analytics:read'],
};

function mockUser(user: AccessTokenPayload | null) {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
}

/** Build a Request suitable for the given method + optional JSON body. */
function createRequest(
  url: string,
  method: string,
  body?: Record<string, unknown>,
): Request {
  return new Request(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Seed helpers
function seedTeam(overrides?: Partial<any>) {
  const team = {
    id: `team-${mockTeams.length + 1}`,
    name: 'Station Alpha',
    type: 'GROUND_CREW',
    status: 'AVAILABLE',
    location: { type: 'Point', coordinates: [-5.1, 33.5] },
    assignedTo: null,
    capacity: 5,
    equipment: ['truck', 'hoses'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  mockTeams.push(team);
  return team;
}

function seedIncident(overrides?: Partial<any>) {
  const incident = {
    id: `incident-${mockIncidents.length + 1}`,
    location: { type: 'Point', coordinates: [-5.08, 33.55] },
    status: 'ALERTE',
    severity: 4,
    ...overrides,
  };
  mockIncidents.push(incident);
  return incident;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dispatch RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTeams.length = 0;
    mockIncidents.length = 0;
    mockDispatches.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. CIVILIAN gets 403 on every dispatch endpoint
  // =========================================================================
  describe('CIVILIAN role (403 Forbidden)', () => {
    beforeEach(() => {
      mockUser(CIVILIAN_USER);
    });

    it('POST /dispatch/assign returns 403 for CIVILIAN', async () => {
      const req = createRequest('http://localhost/api/dispatch/assign', 'POST', {
        incidentId: 'incident-1',
        teamIds: ['team-1'],
      });

      const res = await assignPost(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe(2001);
    });

    it('POST /dispatch/route returns 403 for CIVILIAN', async () => {
      const req = createRequest('http://localhost/api/dispatch/route', 'POST', {
        origin: [-5.1, 33.5],
        destination: [-5.08, 33.55],
        profile: 'fire_truck',
      });

      const res = await routePost(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe(2001);
    });

    it('GET /dispatch/teams returns 403 for CIVILIAN', async () => {
      const req = createRequest('http://localhost/api/dispatch/teams', 'GET');

      const res = await teamsGet(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe(2001);
    });

    it('POST /dispatch/teams returns 403 for CIVILIAN', async () => {
      const req = createRequest('http://localhost/api/dispatch/teams', 'POST', {
        name: 'New Team',
        type: 'GROUND_CREW',
        location: { type: 'Point', coordinates: [-5.1, 33.5] },
      });

      const res = await teamsPost(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe(2001);
    });

    it('PATCH /dispatch/teams/:id returns 403 for CIVILIAN', async () => {
      const team = seedTeam();
      const req = createRequest(`http://localhost/api/dispatch/teams/${team.id}`, 'PATCH', {
        status: 'UNAVAILABLE',
      });

      const res = await teamPatch(req, { params: { id: team.id } });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe(2001);
    });
  });

  // =========================================================================
  // 2. Unauthenticated (null user) gets 401 on every dispatch endpoint
  // =========================================================================
  describe('Unauthenticated (401)', () => {
    beforeEach(() => {
      mockUser(null);
    });

    it('POST /dispatch/assign returns 401 when unauthenticated', async () => {
      const req = createRequest('http://localhost/api/dispatch/assign', 'POST', {
        incidentId: 'incident-1',
        teamIds: ['team-1'],
      });

      const res = await assignPost(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe(2000);
    });

    it('POST /dispatch/route returns 401 when unauthenticated', async () => {
      const req = createRequest('http://localhost/api/dispatch/route', 'POST', {
        origin: [-5.1, 33.5],
        destination: [-5.08, 33.55],
        profile: 'fire_truck',
      });

      const res = await routePost(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe(2000);
    });

    it('GET /dispatch/teams returns 401 when unauthenticated', async () => {
      const req = createRequest('http://localhost/api/dispatch/teams', 'GET');

      const res = await teamsGet(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe(2000);
    });

    it('POST /dispatch/teams returns 401 when unauthenticated', async () => {
      const req = createRequest('http://localhost/api/dispatch/teams', 'POST', {
        name: 'New Team',
        type: 'GROUND_CREW',
        location: { type: 'Point', coordinates: [-5.1, 33.5] },
      });

      const res = await teamsPost(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe(2000);
    });

    it('PATCH /dispatch/teams/:id returns 401 when unauthenticated', async () => {
      const req = createRequest('http://localhost/api/dispatch/teams/team-1', 'PATCH', {
        status: 'UNAVAILABLE',
      });

      const res = await teamPatch(req, { params: { id: 'team-1' } });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe(2000);
    });
  });

  // =========================================================================
  // 3. OFFICIAL role succeeds (happy path, at least one per endpoint)
  // =========================================================================
  describe('OFFICIAL role (success)', () => {
    beforeEach(() => {
      mockUser(OFFICIAL_USER);
    });

    it('POST /dispatch/assign succeeds for OFFICIAL with valid data', async () => {
      const team = seedTeam();
      const incident = seedIncident();

      const req = createRequest('http://localhost/api/dispatch/assign', 'POST', {
        incidentId: incident.id,
        teamIds: [team.id],
      });

      const res = await assignPost(req);

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.incidentId).toBe(incident.id);
      expect(body.assignedTeams).toHaveLength(1);
      expect(body.assignedTeams[0].teamId).toBe(team.id);
      expect(body.assignedTeams[0].eta).toBeDefined();
      expect(body.assignedTeams[0].distance_km).toBeCloseTo(5.2);
      expect(body.assignedTeams[0].duration_min).toBeCloseTo(12);
      expect(body.assignedBy).toBe(OFFICIAL_USER.userId);
    });

    it('POST /dispatch/route succeeds for OFFICIAL with valid data', async () => {
      const req = createRequest('http://localhost/api/dispatch/route', 'POST', {
        origin: [-5.1, 33.5],
        destination: [-5.08, 33.55],
        profile: 'fire_truck',
        alternatives: 0,
      });

      const res = await routePost(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.primary).toBeDefined();
      expect(body.primary.distance_km).toBeCloseTo(5.2);
      expect(body.metadata.provider).toBe('graphhopper');
    });

    it('GET /dispatch/teams succeeds for OFFICIAL', async () => {
      seedTeam({ name: 'Alpha Squad' });
      seedTeam({ name: 'Bravo Squad' });

      const req = createRequest('http://localhost/api/dispatch/teams', 'GET');

      const res = await teamsGet(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.type).toBe('FeatureCollection');
      expect(body.features).toHaveLength(2);
      expect(body.features[0].properties.name).toBe('Alpha Squad');
      expect(body.features[1].properties.name).toBe('Bravo Squad');
    });

    it('POST /dispatch/teams succeeds for OFFICIAL', async () => {
      const req = createRequest('http://localhost/api/dispatch/teams', 'POST', {
        name: 'Charlie Team',
        type: 'GROUND_CREW',
        location: { type: 'Point', coordinates: [-5.1, 33.5] },
        capacity: 6,
        equipment: ['hose', 'axe'],
      });

      const res = await teamsPost(req);

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe('Charlie Team');
      expect(body.type).toBe('GROUND_CREW');
      expect(body.status).toBe('AVAILABLE');
      expect(body.capacity).toBe(6);
    });

    it('PATCH /dispatch/teams/:id succeeds for OFFICIAL', async () => {
      const team = seedTeam();

      const req = createRequest(`http://localhost/api/dispatch/teams/${team.id}`, 'PATCH', {
        status: 'UNAVAILABLE',
      });

      const res = await teamPatch(req, { params: { id: team.id } });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(team.id);
      expect(body.status).toBe('UNAVAILABLE');
    });
  });
});

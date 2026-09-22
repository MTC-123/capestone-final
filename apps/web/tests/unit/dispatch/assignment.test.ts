import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Team } from '@prisma/client';
import type { RouteResponse } from '@/lib/routing/types';

// ============================================
// Mocks
// ============================================

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    dispatch: {
      create: vi.fn(),
    },
    team: {
      update: vi.fn(),
    },
  },
}));

// Mock GraphHopperClient
vi.mock('@/lib/routing/graphhopper', () => ({
  GraphHopperClient: vi.fn().mockImplementation(() => ({
    getRoute: vi.fn(),
  })),
}));

// Mock routing cache
vi.mock('@/lib/routing/cache', () => ({
  getCachedRoute: vi.fn(),
  setCachedRoute: vi.fn(),
}));

// Mock logger (suppress output during tests)
vi.mock('@/lib/observability/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { GraphHopperClient } from '@/lib/routing/graphhopper';
import { getCachedRoute, setCachedRoute } from '@/lib/routing/cache';
import {
  assignTeamToIncident,
  assignTeamsToIncident,
} from '@/lib/dispatch/assignment';

// ============================================
// Fixtures
// ============================================

const TEAM_ORIGIN: [number, number] = [-5.1, 33.5];
const INCIDENT_DEST: [number, number] = [-5.08, 33.55];

function makeTeam(overrides?: Partial<Team>): Team {
  return {
    id: 'team-1',
    name: 'Station 1 Alpha',
    type: 'GROUND_CREW',
    status: 'AVAILABLE',
    location: { type: 'Point', coordinates: TEAM_ORIGIN },
    assignedTo: null,
    capacity: 5,
    equipment: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeIncident(overrides?: Partial<{ id: string; location: unknown }>) {
  return {
    id: 'incident-1',
    location: { type: 'Point', coordinates: INCIDENT_DEST },
    ...overrides,
  };
}

function makeRouteResponse(overrides?: Partial<RouteResponse>): RouteResponse {
  return {
    primary: {
      coordinates: [TEAM_ORIGIN, INCIDENT_DEST],
      distance_km: 8.5,
      duration_min: 12,
      instructions: [],
    },
    alternatives: [],
    metadata: {
      provider: 'graphhopper',
      cached: false,
      computed_at: '2026-02-19T10:00:00.000Z',
    },
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe('Dispatch Assignment', () => {
  let mockGetRoute: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-19T10:00:00.000Z'));

    // Default: no cache hit
    (getCachedRoute as any).mockResolvedValue(null);
    (setCachedRoute as any).mockResolvedValue(undefined);

    // Default: GraphHopper returns a valid route
    mockGetRoute = vi.fn().mockResolvedValue(makeRouteResponse());
    (GraphHopperClient as any).mockImplementation(() => ({
      getRoute: mockGetRoute,
    }));

    // Default: prisma creates dispatch and updates team
    (prisma.dispatch.create as any).mockResolvedValue({
      id: 'dispatch-001',
      teamId: 'team-1',
      incidentId: 'incident-1',
      status: 'ASSIGNED',
    });
    (prisma.team.update as any).mockResolvedValue({
      id: 'team-1',
      status: 'EN_ROUTE',
      assignedTo: 'incident-1',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ------------------------------------------
  // 1. Happy path
  // ------------------------------------------
  describe('assignTeamToIncident - happy path', () => {
    it('should assign a team, create dispatch record, and update team status to EN_ROUTE', async () => {
      const team = makeTeam();
      const incident = makeIncident();

      const result = await assignTeamToIncident(team, incident, 'user-admin');

      // Dispatch record created with correct data
      expect(prisma.dispatch.create).toHaveBeenCalledOnce();
      expect(prisma.dispatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          teamId: 'team-1',
          incidentId: 'incident-1',
          status: 'ASSIGNED',
          distance: 8.5,
          duration: 12,
          assignedBy: 'user-admin',
        }),
      });

      // Team status updated to EN_ROUTE
      expect(prisma.team.update).toHaveBeenCalledOnce();
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: {
          status: 'EN_ROUTE',
          assignedTo: 'incident-1',
        },
      });

      // Result shape
      expect(result).toEqual(
        expect.objectContaining({
          dispatchId: 'dispatch-001',
          teamId: 'team-1',
          teamName: 'Station 1 Alpha',
          incidentId: 'incident-1',
          distance_km: 8.5,
          duration_min: 12,
        })
      );
      expect(result.route).toBeDefined();
      expect(result.eta).toBeDefined();
    });

    it('should store the route LineString coordinates in the dispatch record', async () => {
      const team = makeTeam();
      const incident = makeIncident();

      await assignTeamToIncident(team, incident, 'user-admin');

      const createCall = (prisma.dispatch.create as any).mock.calls[0][0];
      expect(createCall.data.route).toEqual([TEAM_ORIGIN, INCIDENT_DEST]);
    });

    it('should return the full route response in the result', async () => {
      const team = makeTeam();
      const incident = makeIncident();

      const result = await assignTeamToIncident(team, incident, 'user-admin');

      expect(result.route.primary.coordinates).toEqual([
        TEAM_ORIGIN,
        INCIDENT_DEST,
      ]);
      expect(result.route.metadata.provider).toBe('graphhopper');
    });
  });

  // ------------------------------------------
  // 2. Route cache hit
  // ------------------------------------------
  describe('assignTeamToIncident - route cache', () => {
    it('should use cached route instead of calling GraphHopper', async () => {
      const cachedRoute = makeRouteResponse({
        metadata: {
          provider: 'graphhopper',
          cached: true,
          cache_age_seconds: 120,
          computed_at: '2026-02-19T09:58:00.000Z',
        },
      });
      (getCachedRoute as any).mockResolvedValue(cachedRoute);

      const team = makeTeam();
      const incident = makeIncident();

      const result = await assignTeamToIncident(team, incident, 'user-admin');

      // GraphHopper should NOT be called
      expect(mockGetRoute).not.toHaveBeenCalled();

      // setCachedRoute should NOT be called (already cached)
      expect(setCachedRoute).not.toHaveBeenCalled();

      // Result should still be valid
      expect(result.route).toEqual(cachedRoute);
      expect(result.distance_km).toBe(8.5);
      expect(result.duration_min).toBe(12);
    });

    it('should cache the route from GraphHopper on a cache miss', async () => {
      (getCachedRoute as any).mockResolvedValue(null);

      const team = makeTeam();
      const incident = makeIncident();

      await assignTeamToIncident(team, incident, 'user-admin');

      // GraphHopper was called
      expect(mockGetRoute).toHaveBeenCalledOnce();
      expect(mockGetRoute).toHaveBeenCalledWith({
        origin: TEAM_ORIGIN,
        destination: INCIDENT_DEST,
        profile: 'fire_truck',
        alternatives: 0,
      });

      // Route was cached
      expect(setCachedRoute).toHaveBeenCalledOnce();
      expect(setCachedRoute).toHaveBeenCalledWith(
        TEAM_ORIGIN,
        INCIDENT_DEST,
        'fire_truck',
        expect.objectContaining({
          primary: expect.objectContaining({ distance_km: 8.5 }),
        })
      );
    });
  });

  // ------------------------------------------
  // 3. Routing failure
  // ------------------------------------------
  describe('assignTeamToIncident - routing failure', () => {
    it('should fall back to Haversine on GraphHopper timeout', async () => {
      const timeoutError = new Error(
        'Request timed out after 10000ms'
      ) as Error & { code: string; provider: string };
      timeoutError.code = 'ROUTING_TIMEOUT';
      timeoutError.provider = 'graphhopper';

      mockGetRoute.mockRejectedValue(timeoutError);

      const team = makeTeam();
      const incident = makeIncident();

      const result = await assignTeamToIncident(team, incident, 'user-admin');

      // Fallback produces a straight-line route
      expect(result.route.primary.coordinates).toEqual([TEAM_ORIGIN, INCIDENT_DEST]);
      expect(result.route.primary.distance_km).toBeGreaterThan(0);
      expect(result.route.primary.duration_min).toBeGreaterThan(0);
      expect(result.route.primary.instructions).toEqual([]);
      // Dispatch record should still be created with the fallback route
      expect(prisma.dispatch.create).toHaveBeenCalled();
    });

    it('should fall back to Haversine on GraphHopper service unavailable', async () => {
      const serviceError = new Error(
        'GraphHopper service unavailable'
      ) as Error & { code: string; provider: string };
      serviceError.code = 'SERVICE_UNAVAILABLE';
      serviceError.provider = 'graphhopper';

      mockGetRoute.mockRejectedValue(serviceError);

      const team = makeTeam();
      const incident = makeIncident();

      const result = await assignTeamToIncident(team, incident, 'user-admin');

      // Fallback produces a straight-line route
      expect(result.route.primary.coordinates).toEqual([TEAM_ORIGIN, INCIDENT_DEST]);
      expect(result.route.primary.distance_km).toBeGreaterThan(0);
      expect(prisma.dispatch.create).toHaveBeenCalled();
    });

    it('should propagate generic errors from GraphHopper', async () => {
      mockGetRoute.mockRejectedValue(new Error('Network error'));

      const team = makeTeam();
      const incident = makeIncident();

      await expect(
        assignTeamToIncident(team, incident, 'user-admin')
      ).rejects.toThrow('Network error');

      expect(prisma.dispatch.create).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // 4. ETA calculation correctness
  // ------------------------------------------
  describe('assignTeamToIncident - ETA calculation', () => {
    it('should compute ETA as current time + route duration in minutes', async () => {
      // System time is frozen at 2026-02-19T10:00:00.000Z
      // Route duration is 12 minutes
      // Expected ETA: 2026-02-19T10:12:00.000Z

      const team = makeTeam();
      const incident = makeIncident();

      const result = await assignTeamToIncident(team, incident, 'user-admin');

      expect(result.eta).toBe('2026-02-19T10:12:00.000Z');
    });

    it('should compute ETA correctly for short duration (2 minutes)', async () => {
      const shortRoute = makeRouteResponse();
      shortRoute.primary.duration_min = 2;
      shortRoute.primary.distance_km = 1.5;
      mockGetRoute.mockResolvedValue(shortRoute);

      const team = makeTeam();
      const incident = makeIncident();

      const result = await assignTeamToIncident(team, incident, 'user-admin');

      // 10:00 + 2 min = 10:02
      expect(result.eta).toBe('2026-02-19T10:02:00.000Z');
      expect(result.duration_min).toBe(2);
    });

    it('should compute ETA correctly for long duration (90 minutes)', async () => {
      const longRoute = makeRouteResponse();
      longRoute.primary.duration_min = 90;
      longRoute.primary.distance_km = 75;
      mockGetRoute.mockResolvedValue(longRoute);

      const team = makeTeam();
      const incident = makeIncident();

      const result = await assignTeamToIncident(team, incident, 'user-admin');

      // 10:00 + 90 min = 11:30
      expect(result.eta).toBe('2026-02-19T11:30:00.000Z');
      expect(result.duration_min).toBe(90);
    });

    it('should compute ETA correctly for fractional duration (7.5 minutes)', async () => {
      const fractionalRoute = makeRouteResponse();
      fractionalRoute.primary.duration_min = 7.5;
      fractionalRoute.primary.distance_km = 5.2;
      mockGetRoute.mockResolvedValue(fractionalRoute);

      const team = makeTeam();
      const incident = makeIncident();

      const result = await assignTeamToIncident(team, incident, 'user-admin');

      // 10:00:00 + 7.5 min = 10:07:30
      expect(result.eta).toBe('2026-02-19T10:07:30.000Z');
    });

    it('should pass the computed ETA to the dispatch record', async () => {
      const team = makeTeam();
      const incident = makeIncident();

      await assignTeamToIncident(team, incident, 'user-admin');

      const createCall = (prisma.dispatch.create as any).mock.calls[0][0];
      const etaDate = createCall.data.eta;
      expect(etaDate).toBeInstanceOf(Date);
      expect(etaDate.toISOString()).toBe('2026-02-19T10:12:00.000Z');
    });
  });

  // ------------------------------------------
  // 5. assignTeamsToIncident (multi-team)
  // ------------------------------------------
  describe('assignTeamsToIncident', () => {
    it('should assign multiple teams sequentially', async () => {
      const team1 = makeTeam({ id: 'team-1', name: 'Alpha' });
      const team2 = makeTeam({ id: 'team-2', name: 'Bravo' });
      const incident = makeIncident();

      (prisma.dispatch.create as any)
        .mockResolvedValueOnce({
          id: 'dispatch-001',
          teamId: 'team-1',
          incidentId: 'incident-1',
          status: 'ASSIGNED',
        })
        .mockResolvedValueOnce({
          id: 'dispatch-002',
          teamId: 'team-2',
          incidentId: 'incident-1',
          status: 'ASSIGNED',
        });

      const results = await assignTeamsToIncident(
        [team1, team2],
        incident,
        'user-admin'
      );

      expect(results).toHaveLength(2);
      expect(results[0].dispatchId).toBe('dispatch-001');
      expect(results[0].teamName).toBe('Alpha');
      expect(results[1].dispatchId).toBe('dispatch-002');
      expect(results[1].teamName).toBe('Bravo');

      // Both teams updated to EN_ROUTE
      expect(prisma.team.update).toHaveBeenCalledTimes(2);
    });

    it('should stop assigning if a routing error occurs mid-batch', async () => {
      const team1 = makeTeam({ id: 'team-1', name: 'Alpha' });
      const team2 = makeTeam({ id: 'team-2', name: 'Bravo' });
      const incident = makeIncident();

      // First team succeeds, second team routing fails
      mockGetRoute
        .mockResolvedValueOnce(makeRouteResponse())
        .mockRejectedValueOnce(new Error('GraphHopper timeout'));

      await expect(
        assignTeamsToIncident([team1, team2], incident, 'user-admin')
      ).rejects.toThrow('GraphHopper timeout');

      // Only the first team's dispatch was created
      expect(prisma.dispatch.create).toHaveBeenCalledTimes(1);
    });
  });
});

/**
 * Integration Test: Incident Lifecycle (TODO 16 - QA Plan)
 *
 * Covers the full incident lifecycle:
 *   create -> dispatch -> resolve
 *
 * State transitions tested:
 *   VIGILANCE -> ALERTE -> INTERVENTION -> MAITRISE -> ETEINT
 *
 * Team status transitions tested:
 *   AVAILABLE -> EN_ROUTE -> ON_SCENE -> RETURNING -> AVAILABLE
 */

import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { getCurrentUser } from '@/lib/auth';
import { POST as createIncident, GET as listIncidents } from '@/app/api/incidents/route';
import {
  PATCH as patchIncident,
  GET as getIncident,
} from '@/app/api/incidents/[id]/route';
import { POST as assignPost } from '@/app/api/dispatch/assign/route';
import {
  POST as createTeam,
  GET as listTeams,
} from '@/app/api/dispatch/teams/route';
import { PATCH as patchTeam } from '@/app/api/dispatch/teams/[id]/route';

// ============================================
// Mocks
// ============================================

vi.mock('@/lib/auth');
vi.mock('@/lib/observability/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('@/lib/observability/monitoring', () => ({
  captureException: vi.fn(),
}));
vi.mock('@/lib/database/withRetry', () => ({
  withRetry: vi.fn((fn: () => unknown) => fn()),
}));
vi.mock('@/lib/validation/geojson', () => ({
  validatePoint: vi.fn((val: unknown) => {
    if (
      val &&
      typeof val === 'object' &&
      (val as Record<string, unknown>).type === 'Point' &&
      Array.isArray((val as Record<string, unknown>).coordinates)
    ) {
      return val;
    }
    return null;
  }),
}));

// In-memory stores
const mockIncidents: any[] = [];
const mockTeams: any[] = [];
const mockDispatches: any[] = [];
const mockReports: any[] = [];

vi.mock('@/lib/prisma', () => ({
  prisma: {
    incident: {
      findMany: vi.fn((args?: any) => {
        let result = [...mockIncidents].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const take = args?.take ?? 100;
        result = result.slice(0, take);
        return Promise.resolve(result);
      }),
      findUnique: vi.fn((args: any) =>
        Promise.resolve(
          mockIncidents.find((i) => i.id === args.where.id) || null
        )
      ),
      create: vi.fn((args: any) => {
        const incident = {
          id: `incident-${mockIncidents.length + 1}`,
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockIncidents.push(incident);
        return Promise.resolve(incident);
      }),
      update: vi.fn((args: any) => {
        const incident = mockIncidents.find((i) => i.id === args.where.id);
        if (!incident) throw new Error('Incident not found');
        Object.assign(incident, args.data);
        incident.updatedAt = new Date();
        return Promise.resolve(incident);
      }),
      count: vi.fn(() => Promise.resolve(mockIncidents.length)),
    },
    team: {
      findMany: vi.fn((args?: any) => {
        let result = [...mockTeams];
        if (args?.where) {
          if (args.where.status) {
            result = result.filter((t) => t.status === args.where.status);
          }
          if (args.where.type) {
            result = result.filter((t) => t.type === args.where.type);
          }
          if (args.where.id?.in) {
            result = result.filter((t: any) =>
              args.where.id.in.includes(t.id)
            );
          }
        }
        return Promise.resolve(result);
      }),
      findUnique: vi.fn((args: any) =>
        Promise.resolve(mockTeams.find((t) => t.id === args.where.id) || null)
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
    dispatch: {
      findFirst: vi.fn((args: any) => {
        const match = mockDispatches.find((d) => {
          const where = args.where;
          if (where.teamId && d.teamId !== where.teamId) return false;
          if (where.incidentId && d.incidentId !== where.incidentId) return false;
          if (where.status?.in && !where.status.in.includes(d.status)) return false;
          return true;
        });
        return Promise.resolve(match || null);
      }),
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
      update: vi.fn((args: any) => {
        const dispatch = mockDispatches.find((d) => d.id === args.where.id);
        if (!dispatch) throw new Error('Dispatch not found');
        Object.assign(dispatch, args.data);
        dispatch.updatedAt = new Date();
        return Promise.resolve(dispatch);
      }),
    },
    report: {
      findUnique: vi.fn((args: any) =>
        Promise.resolve(
          mockReports.find((r) => r.id === args.where.id) || null
        )
      ),
      update: vi.fn((args: any) => {
        const report = mockReports.find((r) => r.id === args.where.id);
        if (!report) throw new Error('Report not found');
        Object.assign(report, args.data);
        return Promise.resolve(report);
      }),
    },
    $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
      // Simple mock: pass the same prisma mock as the transaction client
      const { prisma } = await import('@/lib/prisma');
      return fn(prisma);
    }),
  },
}));

// Mock GraphHopper client
vi.mock('@/lib/routing/graphhopper', () => ({
  GraphHopperClient: vi.fn().mockImplementation(() => ({
    getRoute: vi.fn().mockResolvedValue({
      primary: {
        coordinates: [
          [-5.1, 33.5],
          [-5.08, 33.53],
          [-5.06, 33.55],
        ],
        distance_km: 6.3,
        duration_min: 14,
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

// Mock route cache
vi.mock('@/lib/routing/cache', () => ({
  getCachedRoute: vi.fn().mockResolvedValue(null),
  setCachedRoute: vi.fn().mockResolvedValue(undefined),
}));

// ============================================
// Helpers
// ============================================

function createRequest(
  url: string,
  body?: any,
  method = 'GET'
): Request {
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
    role: 'OFFICIAL' as const,
    scopes: ['map:read', 'map:write', 'reports:read', 'reports:write', 'equipment:read', 'equipment:write', 'analytics:read'],
  });
}

function mockCivilianUser() {
  vi.mocked(getCurrentUser).mockResolvedValue({
    tokenUse: 'access',
    userId: 'user-civilian-1',
    cin: 'CIV001',
    role: 'CIVILIAN' as const,
    scopes: ['map:read', 'reports:read', 'reports:write', 'analytics:read'],
  });
}

function mockUnauthenticated() {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
}

// ============================================
// Tests
// ============================================

describe('Incident Lifecycle Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIncidents.length = 0;
    mockTeams.length = 0;
    mockDispatches.length = 0;
    mockReports.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------
  // 1. Full lifecycle: create -> dispatch -> resolve
  // ------------------------------------------
  describe('Full lifecycle: create -> dispatch -> resolve', () => {
    it('should complete the full incident lifecycle from creation to resolution', async () => {
      mockOfficialUser();

      // ---- Step 1: Create incident (starts at VIGILANCE by default) ----
      const createRes = await createIncident(
        createRequest('/api/incidents', {
          latitude: 33.55,
          longitude: -5.06,
          cause: 'NATURAL',
          severity: 2,
          description: 'Smoke spotted near cedar forest',
        }, 'POST')
      );

      expect(createRes.status).toBe(200);
      const { incident } = await createRes.json();
      expect(incident.id).toBeDefined();
      expect(incident.status).toBe('VIGILANCE');
      expect(incident.severity).toBe(2);

      const incidentId = incident.id;

      // ---- Step 2: Escalate to ALERTE ----
      const alerteRes = await patchIncident(
        createRequest(`/api/incidents/${incidentId}`, {
          status: 'ALERTE',
          severity: 3,
        }, 'PATCH'),
        { params: { id: incidentId } }
      );

      expect(alerteRes.status).toBe(200);
      const alerteBody = await alerteRes.json();
      expect(alerteBody.incident.status).toBe('ALERTE');
      expect(alerteBody.incident.severity).toBe(3);

      // ---- Step 3: Create a team ----
      const teamRes = await createTeam(
        createRequest('/api/dispatch/teams', {
          name: 'Ifrane Station Alpha',
          type: 'GROUND_CREW',
          location: { type: 'Point', coordinates: [-5.1, 33.5] },
          capacity: 6,
          equipment: ['fire_truck', 'hoses', 'axes'],
        }, 'POST')
      );

      expect(teamRes.status).toBe(201);
      const team = await teamRes.json();
      expect(team.status).toBe('AVAILABLE');
      const teamId = team.id;

      // ---- Step 4: Assign team to incident (dispatch) ----
      const assignRes = await assignPost(
        createRequest('/api/dispatch/assign', {
          incidentId,
          teamIds: [teamId],
        }, 'POST')
      );

      expect(assignRes.status).toBe(201);
      const assignment = await assignRes.json();
      expect(assignment.incidentId).toBe(incidentId);
      expect(assignment.assignedTeams).toHaveLength(1);
      expect(assignment.assignedTeams[0].teamId).toBe(teamId);
      expect(assignment.assignedTeams[0].eta).toBeDefined();
      expect(assignment.assignedTeams[0].distance_km).toBeCloseTo(6.3, 0);

      // Verify team status changed to EN_ROUTE
      const updatedTeam = mockTeams.find((t) => t.id === teamId);
      expect(updatedTeam.status).toBe('EN_ROUTE');
      expect(updatedTeam.assignedTo).toBe(incidentId);

      // Verify dispatch record
      expect(mockDispatches).toHaveLength(1);
      expect(mockDispatches[0].status).toBe('ASSIGNED');

      // ---- Step 5: Escalate to INTERVENTION ----
      const interventionRes = await patchIncident(
        createRequest(`/api/incidents/${incidentId}`, {
          status: 'INTERVENTION',
          severity: 4,
        }, 'PATCH'),
        { params: { id: incidentId } }
      );

      expect(interventionRes.status).toBe(200);
      const interventionBody = await interventionRes.json();
      expect(interventionBody.incident.status).toBe('INTERVENTION');
      expect(interventionBody.incident.severity).toBe(4);

      // ---- Step 6: Update team to ON_SCENE ----
      const onSceneRes = await patchTeam(
        createRequest(`/api/dispatch/teams/${teamId}`, {
          status: 'ON_SCENE',
        }, 'PATCH'),
        { params: { id: teamId } }
      );

      expect(onSceneRes.status).toBe(200);
      const onSceneTeam = await onSceneRes.json();
      expect(onSceneTeam.status).toBe('ON_SCENE');

      // ---- Step 7: De-escalate to MAITRISE (fire under control) ----
      const maitriseRes = await patchIncident(
        createRequest(`/api/incidents/${incidentId}`, {
          status: 'MAITRISE',
        }, 'PATCH'),
        { params: { id: incidentId } }
      );

      expect(maitriseRes.status).toBe(200);
      const maitriseBody = await maitriseRes.json();
      expect(maitriseBody.incident.status).toBe('MAITRISE');

      // ---- Step 8: Team returns to base ----
      const returningRes = await patchTeam(
        createRequest(`/api/dispatch/teams/${teamId}`, {
          status: 'RETURNING',
          assignedTo: null,
        }, 'PATCH'),
        { params: { id: teamId } }
      );

      expect(returningRes.status).toBe(200);
      const returningTeam = await returningRes.json();
      expect(returningTeam.status).toBe('RETURNING');
      expect(returningTeam.assignedTo).toBeNull();

      // ---- Step 9: Close incident as ETEINT ----
      const eteintRes = await patchIncident(
        createRequest(`/api/incidents/${incidentId}`, {
          status: 'ETEINT',
        }, 'PATCH'),
        { params: { id: incidentId } }
      );

      expect(eteintRes.status).toBe(200);
      const eteintBody = await eteintRes.json();
      expect(eteintBody.incident.status).toBe('ETEINT');

      // ---- Step 10: Team back to AVAILABLE ----
      const availableRes = await patchTeam(
        createRequest(`/api/dispatch/teams/${teamId}`, {
          status: 'AVAILABLE',
        }, 'PATCH'),
        { params: { id: teamId } }
      );

      expect(availableRes.status).toBe(200);
      const availableTeam = await availableRes.json();
      expect(availableTeam.status).toBe('AVAILABLE');

      // ---- Final assertions: verify in-memory state ----
      const finalIncident = mockIncidents.find((i) => i.id === incidentId);
      expect(finalIncident.status).toBe('ETEINT');

      const finalTeam = mockTeams.find((t) => t.id === teamId);
      expect(finalTeam.status).toBe('AVAILABLE');
    });
  });

  // ------------------------------------------
  // 2. Incident status transitions (all valid)
  // ------------------------------------------
  describe('Incident status transitions', () => {
    it('should allow full forward transition: VIGILANCE -> ALERTE -> INTERVENTION -> MAITRISE -> ETEINT', async () => {
      mockOfficialUser();

      // Seed incident at VIGILANCE
      mockIncidents.push({
        id: 'inc-transition',
        location: { type: 'Point', coordinates: [-5.06, 33.55] },
        cause: 'NATURAL',
        severity: 2,
        status: 'VIGILANCE',
        description: null,
        reportId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const statuses = ['ALERTE', 'INTERVENTION', 'MAITRISE', 'ETEINT'];

      for (const status of statuses) {
        const res = await patchIncident(
          createRequest(`/api/incidents/inc-transition`, { status }, 'PATCH'),
          { params: { id: 'inc-transition' } }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.incident.status).toBe(status);
      }

      // Verify final state
      const finalIncident = mockIncidents.find((i) => i.id === 'inc-transition');
      expect(finalIncident.status).toBe('ETEINT');
    });

    it('should reject invalid status values', async () => {
      mockOfficialUser();

      mockIncidents.push({
        id: 'inc-invalid',
        location: { type: 'Point', coordinates: [-5.06, 33.55] },
        cause: 'ARSON',
        severity: 3,
        status: 'VIGILANCE',
        description: null,
        reportId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await patchIncident(
        createRequest(`/api/incidents/inc-invalid`, { status: 'EXPLODING' }, 'PATCH'),
        { params: { id: 'inc-invalid' } }
      );

      // Should be a validation error (4xx)
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it('should allow updating severity independently of status', async () => {
      mockOfficialUser();

      mockIncidents.push({
        id: 'inc-sev',
        location: { type: 'Point', coordinates: [-5.06, 33.55] },
        cause: 'NATURAL',
        severity: 2,
        status: 'ALERTE',
        description: null,
        reportId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await patchIncident(
        createRequest(`/api/incidents/inc-sev`, { severity: 5 }, 'PATCH'),
        { params: { id: 'inc-sev' } }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.incident.severity).toBe(5);
      expect(body.incident.status).toBe('ALERTE'); // Status unchanged
    });
  });

  // ------------------------------------------
  // 3. Team status transitions
  // ------------------------------------------
  describe('Team status transitions during lifecycle', () => {
    it('should track team through AVAILABLE -> EN_ROUTE -> ON_SCENE -> RETURNING -> AVAILABLE', async () => {
      mockOfficialUser();

      // Pre-seed team
      mockTeams.push({
        id: 'team-lifecycle',
        name: 'Lifecycle Team',
        type: 'GROUND_CREW',
        status: 'AVAILABLE',
        location: { type: 'Point', coordinates: [-5.1, 33.5] },
        assignedTo: null,
        capacity: 5,
        equipment: ['truck'],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const transitions: Array<{ status: string; assignedTo?: string | null }> = [
        { status: 'EN_ROUTE', assignedTo: 'inc-1' },
        { status: 'ON_SCENE' },
        { status: 'RETURNING', assignedTo: null },
        { status: 'AVAILABLE' },
      ];

      for (const update of transitions) {
        const res = await patchTeam(
          createRequest(`/api/dispatch/teams/team-lifecycle`, update, 'PATCH'),
          { params: { id: 'team-lifecycle' } }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe(update.status);
      }

      // Verify final state
      const finalTeam = mockTeams.find((t) => t.id === 'team-lifecycle');
      expect(finalTeam.status).toBe('AVAILABLE');
    });

    it('should reject invalid team status values', async () => {
      mockOfficialUser();

      mockTeams.push({
        id: 'team-bad-status',
        name: 'Bad Status Team',
        type: 'GROUND_CREW',
        status: 'AVAILABLE',
        location: { type: 'Point', coordinates: [-5.1, 33.5] },
        assignedTo: null,
        capacity: 5,
        equipment: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await patchTeam(
        createRequest(`/api/dispatch/teams/team-bad-status`, {
          status: 'DESTROYED',
        }, 'PATCH'),
        { params: { id: 'team-bad-status' } }
      );

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });
  });

  // ------------------------------------------
  // 4. Multi-team dispatch lifecycle
  // ------------------------------------------
  describe('Multi-team dispatch lifecycle', () => {
    it('should dispatch multiple teams and manage them independently', async () => {
      mockOfficialUser();

      // Create incident
      mockIncidents.push({
        id: 'inc-multi',
        location: { type: 'Point', coordinates: [-5.06, 33.55] },
        cause: 'ARSON',
        severity: 5,
        status: 'INTERVENTION',
        description: 'Large fire requiring multiple teams',
        reportId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create 3 teams
      const teamIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const res = await createTeam(
          createRequest('/api/dispatch/teams', {
            name: `Team ${String.fromCharCode(65 + i)}`,
            type: 'GROUND_CREW',
            location: { type: 'Point', coordinates: [-5.1 - i * 0.01, 33.5] },
            capacity: 5,
          }, 'POST')
        );
        expect(res.status).toBe(201);
        const team = await res.json();
        teamIds.push(team.id);
      }

      // Assign all teams
      const assignRes = await assignPost(
        createRequest('/api/dispatch/assign', {
          incidentId: 'inc-multi',
          teamIds,
        }, 'POST')
      );

      expect(assignRes.status).toBe(201);
      const assignment = await assignRes.json();
      expect(assignment.assignedTeams).toHaveLength(3);
      expect(assignment.totalTeams).toBe(3);

      // All teams should be EN_ROUTE
      teamIds.forEach((id) => {
        const team = mockTeams.find((t) => t.id === id);
        expect(team.status).toBe('EN_ROUTE');
        expect(team.assignedTo).toBe('inc-multi');
      });

      // First team arrives on scene
      const arriveRes = await patchTeam(
        createRequest(`/api/dispatch/teams/${teamIds[0]}`, {
          status: 'ON_SCENE',
        }, 'PATCH'),
        { params: { id: teamIds[0] } }
      );
      expect(arriveRes.status).toBe(200);

      // Verify mixed team statuses
      expect(mockTeams.find((t) => t.id === teamIds[0]).status).toBe('ON_SCENE');
      expect(mockTeams.find((t) => t.id === teamIds[1]).status).toBe('EN_ROUTE');
      expect(mockTeams.find((t) => t.id === teamIds[2]).status).toBe('EN_ROUTE');

      // Incident transitions to MAITRISE
      const maitriseRes = await patchIncident(
        createRequest(`/api/incidents/inc-multi`, { status: 'MAITRISE' }, 'PATCH'),
        { params: { id: 'inc-multi' } }
      );
      expect(maitriseRes.status).toBe(200);

      // Release teams one by one
      for (const teamId of teamIds) {
        const returnRes = await patchTeam(
          createRequest(`/api/dispatch/teams/${teamId}`, {
            status: 'RETURNING',
            assignedTo: null,
          }, 'PATCH'),
          { params: { id: teamId } }
        );
        expect(returnRes.status).toBe(200);
      }

      // Final incident close
      const eteintRes = await patchIncident(
        createRequest(`/api/incidents/inc-multi`, { status: 'ETEINT' }, 'PATCH'),
        { params: { id: 'inc-multi' } }
      );
      expect(eteintRes.status).toBe(200);

      // All teams return to AVAILABLE
      for (const teamId of teamIds) {
        const res = await patchTeam(
          createRequest(`/api/dispatch/teams/${teamId}`, {
            status: 'AVAILABLE',
          }, 'PATCH'),
          { params: { id: teamId } }
        );
        expect(res.status).toBe(200);
      }

      // Verify final state
      mockTeams.forEach((t) => {
        expect(t.status).toBe('AVAILABLE');
      });
      expect(mockIncidents.find((i) => i.id === 'inc-multi').status).toBe('ETEINT');
    });
  });

  // ------------------------------------------
  // 5. Authorization guards across lifecycle
  // ------------------------------------------
  describe('Authorization across lifecycle', () => {
    it('should block CIVILIAN from creating incidents', async () => {
      mockCivilianUser();

      const res = await createIncident(
        createRequest('/api/incidents', {
          latitude: 33.55,
          longitude: -5.06,
          cause: 'NATURAL',
          severity: 2,
        }, 'POST')
      );

      expect(res.status).toBe(403);
    });

    it('should block CIVILIAN from updating incident status', async () => {
      mockCivilianUser();

      mockIncidents.push({
        id: 'inc-civilian-patch',
        location: { type: 'Point', coordinates: [-5.06, 33.55] },
        cause: 'NATURAL',
        severity: 2,
        status: 'VIGILANCE',
        description: null,
        reportId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await patchIncident(
        createRequest(`/api/incidents/inc-civilian-patch`, {
          status: 'ALERTE',
        }, 'PATCH'),
        { params: { id: 'inc-civilian-patch' } }
      );

      expect(res.status).toBe(403);
    });

    it('should block CIVILIAN from assigning teams', async () => {
      mockCivilianUser();

      const res = await assignPost(
        createRequest('/api/dispatch/assign', {
          incidentId: 'inc-1',
          teamIds: ['team-1'],
        }, 'POST')
      );

      expect(res.status).toBe(403);
    });

    it('should block unauthenticated users from all lifecycle operations', async () => {
      mockUnauthenticated();

      const createRes = await createIncident(
        createRequest('/api/incidents', {
          latitude: 33.55,
          longitude: -5.06,
          cause: 'NATURAL',
          severity: 2,
        }, 'POST')
      );
      expect(createRes.status).toBe(401);

      const patchRes = await patchIncident(
        createRequest(`/api/incidents/inc-1`, { status: 'ALERTE' }, 'PATCH'),
        { params: { id: 'inc-1' } }
      );
      expect(patchRes.status).toBe(401);

      const assignRes = await assignPost(
        createRequest('/api/dispatch/assign', {
          incidentId: 'inc-1',
          teamIds: ['team-1'],
        }, 'POST')
      );
      expect(assignRes.status).toBe(401);
    });

    it('should allow CIVILIAN to read incidents', async () => {
      mockCivilianUser();

      mockIncidents.push({
        id: 'inc-readable',
        location: { type: 'Point', coordinates: [-5.06, 33.55] },
        cause: 'NATURAL',
        severity: 2,
        status: 'ALERTE',
        description: null,
        reportId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await getIncident(
        createRequest('/api/incidents/inc-readable'),
        { params: { id: 'inc-readable' } }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.incident.id).toBe('inc-readable');
    });
  });

  // ------------------------------------------
  // 6. Dispatch constraints during lifecycle
  // ------------------------------------------
  describe('Dispatch constraints during lifecycle', () => {
    it('should prevent assigning an already-dispatched team to a second incident', async () => {
      mockOfficialUser();

      // Seed an EN_ROUTE team
      mockTeams.push({
        id: 'team-busy',
        name: 'Busy Team',
        type: 'GROUND_CREW',
        status: 'EN_ROUTE',
        location: { type: 'Point', coordinates: [-5.1, 33.5] },
        assignedTo: 'inc-existing',
        capacity: 5,
        equipment: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockIncidents.push({
        id: 'inc-new',
        location: { type: 'Point', coordinates: [-5.0, 33.6] },
        status: 'ALERTE',
        severity: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await assignPost(
        createRequest('/api/dispatch/assign', {
          incidentId: 'inc-new',
          teamIds: ['team-busy'],
        }, 'POST')
      );

      // Should be rejected because team is not AVAILABLE
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe(6003); // TEAM_UNAVAILABLE
    });

    it('should prevent duplicate assignment of a team to the same incident', async () => {
      mockOfficialUser();

      mockTeams.push({
        id: 'team-dup',
        name: 'Dup Team',
        type: 'GROUND_CREW',
        status: 'AVAILABLE',
        location: { type: 'Point', coordinates: [-5.1, 33.5] },
        assignedTo: null,
        capacity: 5,
        equipment: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockIncidents.push({
        id: 'inc-dup',
        location: { type: 'Point', coordinates: [-5.06, 33.55] },
        status: 'ALERTE',
        severity: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Existing dispatch record
      mockDispatches.push({
        id: 'dispatch-existing',
        teamId: 'team-dup',
        incidentId: 'inc-dup',
        status: 'ASSIGNED',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await assignPost(
        createRequest('/api/dispatch/assign', {
          incidentId: 'inc-dup',
          teamIds: ['team-dup'],
        }, 'POST')
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe(6005); // DUPLICATE_ASSIGNMENT
    });

    it('should reject assignment to a non-existent incident', async () => {
      mockOfficialUser();

      mockTeams.push({
        id: 'team-orphan',
        name: 'Orphan Team',
        type: 'GROUND_CREW',
        status: 'AVAILABLE',
        location: { type: 'Point', coordinates: [-5.1, 33.5] },
        assignedTo: null,
        capacity: 5,
        equipment: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await assignPost(
        createRequest('/api/dispatch/assign', {
          incidentId: 'non-existent-incident',
          teamIds: ['team-orphan'],
        }, 'POST')
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe(6008); // INCIDENT_NOT_FOUND
    });
  });

  // ------------------------------------------
  // 7. Incident creation validation
  // ------------------------------------------
  describe('Incident creation validation', () => {
    it('should reject incident with invalid coordinates', async () => {
      mockOfficialUser();

      const res = await createIncident(
        createRequest('/api/incidents', {
          latitude: 'not-a-number',
          longitude: -5.06,
          cause: 'NATURAL',
          severity: 2,
        }, 'POST')
      );

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it('should reject incident with out-of-range severity', async () => {
      mockOfficialUser();

      const res = await createIncident(
        createRequest('/api/incidents', {
          latitude: 33.55,
          longitude: -5.06,
          cause: 'NATURAL',
          severity: 10,
        }, 'POST')
      );

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it('should default incident status to VIGILANCE when not specified', async () => {
      mockOfficialUser();

      const res = await createIncident(
        createRequest('/api/incidents', {
          latitude: 33.55,
          longitude: -5.06,
          cause: 'UNKNOWN',
          severity: 1,
        }, 'POST')
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.incident.status).toBe('VIGILANCE');
    });
  });

  // ------------------------------------------
  // 8. Severity escalation during lifecycle
  // ------------------------------------------
  describe('Severity escalation during lifecycle', () => {
    it('should allow severity to increase and decrease with status changes', async () => {
      mockOfficialUser();

      mockIncidents.push({
        id: 'inc-severity',
        location: { type: 'Point', coordinates: [-5.06, 33.55] },
        cause: 'NATURAL',
        severity: 1,
        status: 'VIGILANCE',
        description: null,
        reportId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Escalate severity with ALERTE
      const alerteRes = await patchIncident(
        createRequest(`/api/incidents/inc-severity`, {
          status: 'ALERTE',
          severity: 3,
        }, 'PATCH'),
        { params: { id: 'inc-severity' } }
      );
      expect(alerteRes.status).toBe(200);
      let body = await alerteRes.json();
      expect(body.incident.severity).toBe(3);
      expect(body.incident.status).toBe('ALERTE');

      // Max severity during INTERVENTION
      const interventionRes = await patchIncident(
        createRequest(`/api/incidents/inc-severity`, {
          status: 'INTERVENTION',
          severity: 5,
        }, 'PATCH'),
        { params: { id: 'inc-severity' } }
      );
      expect(interventionRes.status).toBe(200);
      body = await interventionRes.json();
      expect(body.incident.severity).toBe(5);

      // Decrease severity during MAITRISE
      const maitriseRes = await patchIncident(
        createRequest(`/api/incidents/inc-severity`, {
          status: 'MAITRISE',
          severity: 2,
        }, 'PATCH'),
        { params: { id: 'inc-severity' } }
      );
      expect(maitriseRes.status).toBe(200);
      body = await maitriseRes.json();
      expect(body.incident.severity).toBe(2);
      expect(body.incident.status).toBe('MAITRISE');
    });

    it('should reject severity outside valid range (1-5)', async () => {
      mockOfficialUser();

      mockIncidents.push({
        id: 'inc-sev-range',
        location: { type: 'Point', coordinates: [-5.06, 33.55] },
        cause: 'NATURAL',
        severity: 3,
        status: 'ALERTE',
        description: null,
        reportId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Severity 0 (below minimum)
      const res0 = await patchIncident(
        createRequest(`/api/incidents/inc-sev-range`, { severity: 0 }, 'PATCH'),
        { params: { id: 'inc-sev-range' } }
      );
      expect(res0.status).toBeGreaterThanOrEqual(400);

      // Severity 6 (above maximum)
      const res6 = await patchIncident(
        createRequest(`/api/incidents/inc-sev-range`, { severity: 6 }, 'PATCH'),
        { params: { id: 'inc-sev-range' } }
      );
      expect(res6.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ------------------------------------------
  // 9. Concurrent incidents with shared team pool
  // ------------------------------------------
  describe('Concurrent incidents with shared team pool', () => {
    it('should manage two simultaneous incidents with separate team allocations', async () => {
      mockOfficialUser();

      // Create 2 incidents
      mockIncidents.push(
        {
          id: 'inc-alpha',
          location: { type: 'Point', coordinates: [-5.06, 33.55] },
          cause: 'NATURAL',
          severity: 3,
          status: 'ALERTE',
          description: 'Forest fire A',
          reportId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'inc-beta',
          location: { type: 'Point', coordinates: [-5.2, 33.4] },
          cause: 'ARSON',
          severity: 4,
          status: 'INTERVENTION',
          description: 'Forest fire B',
          reportId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      );

      // Create 4 teams
      for (let i = 0; i < 4; i++) {
        mockTeams.push({
          id: `team-pool-${i}`,
          name: `Pool Team ${i}`,
          type: 'GROUND_CREW',
          status: 'AVAILABLE',
          location: { type: 'Point', coordinates: [-5.1 - i * 0.01, 33.5] },
          assignedTo: null,
          capacity: 5,
          equipment: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Assign teams 0,1 to incident alpha
      const assignAlphaRes = await assignPost(
        createRequest('/api/dispatch/assign', {
          incidentId: 'inc-alpha',
          teamIds: ['team-pool-0', 'team-pool-1'],
        }, 'POST')
      );
      expect(assignAlphaRes.status).toBe(201);

      // Assign teams 2,3 to incident beta
      const assignBetaRes = await assignPost(
        createRequest('/api/dispatch/assign', {
          incidentId: 'inc-beta',
          teamIds: ['team-pool-2', 'team-pool-3'],
        }, 'POST')
      );
      expect(assignBetaRes.status).toBe(201);

      // Verify each team is assigned to the correct incident
      expect(mockTeams.find((t) => t.id === 'team-pool-0').assignedTo).toBe('inc-alpha');
      expect(mockTeams.find((t) => t.id === 'team-pool-1').assignedTo).toBe('inc-alpha');
      expect(mockTeams.find((t) => t.id === 'team-pool-2').assignedTo).toBe('inc-beta');
      expect(mockTeams.find((t) => t.id === 'team-pool-3').assignedTo).toBe('inc-beta');

      // Verify 4 dispatch records, 2 per incident
      expect(mockDispatches).toHaveLength(4);
      const alphaDispatches = mockDispatches.filter(
        (d) => d.incidentId === 'inc-alpha'
      );
      const betaDispatches = mockDispatches.filter(
        (d) => d.incidentId === 'inc-beta'
      );
      expect(alphaDispatches).toHaveLength(2);
      expect(betaDispatches).toHaveLength(2);

      // Resolve incident alpha first
      await patchIncident(
        createRequest(`/api/incidents/inc-alpha`, { status: 'ETEINT' }, 'PATCH'),
        { params: { id: 'inc-alpha' } }
      );

      // Release alpha teams
      for (const teamId of ['team-pool-0', 'team-pool-1']) {
        await patchTeam(
          createRequest(`/api/dispatch/teams/${teamId}`, {
            status: 'AVAILABLE',
            assignedTo: null,
          }, 'PATCH'),
          { params: { id: teamId } }
        );
      }

      // Alpha teams should be AVAILABLE while beta teams still EN_ROUTE
      expect(mockTeams.find((t) => t.id === 'team-pool-0').status).toBe('AVAILABLE');
      expect(mockTeams.find((t) => t.id === 'team-pool-1').status).toBe('AVAILABLE');
      expect(mockTeams.find((t) => t.id === 'team-pool-2').status).toBe('EN_ROUTE');
      expect(mockTeams.find((t) => t.id === 'team-pool-3').status).toBe('EN_ROUTE');
    });
  });
});

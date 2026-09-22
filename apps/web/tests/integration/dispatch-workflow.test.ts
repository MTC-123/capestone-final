import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { POST as assignPost } from '@/app/api/dispatch/assign/route';
import { GET as teamsGet, POST as teamsPost } from '@/app/api/dispatch/teams/route';
import { getCurrentUser } from '@/lib/auth';

// Mock dependencies
vi.mock('@/lib/auth');
vi.mock('@/lib/observability/logger');
vi.mock('@/lib/database/withRetry', () => ({
  withRetry: vi.fn((fn) => fn()),
}));

// Mock Prisma
const mockTeams: any[] = [];
const mockVehicles: any[] = [];
const mockIncidents: any[] = [];
const mockDispatches: any[] = [];

vi.mock('@/lib/prisma', () => ({
  prisma: {
    team: {
      findMany: vi.fn(() => Promise.resolve(mockTeams)),
      findUnique: vi.fn((args: any) =>
        Promise.resolve(mockTeams.find((t) => t.id === args.where.id))
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
    vehicle: {
      findMany: vi.fn(() => Promise.resolve(mockVehicles)),
      findUnique: vi.fn((args: any) =>
        Promise.resolve(mockVehicles.find((v) => v.id === args.where.id))
      ),
      update: vi.fn((args: any) => {
        const vehicle = mockVehicles.find((v) => v.id === args.where.id);
        if (!vehicle) throw new Error('Vehicle not found');
        Object.assign(vehicle, args.data);
        vehicle.updatedAt = new Date();
        return Promise.resolve(vehicle);
      }),
    },
    incident: {
      findUnique: vi.fn((args: any) =>
        Promise.resolve(mockIncidents.find((i) => i.id === args.where.id))
      ),
    },
    dispatch: {
      findFirst: vi.fn((args: any) =>
        Promise.resolve(
          mockDispatches.find(
            (d) =>
              (d.teamId === args.where.teamId || d.vehicleId === args.where.vehicleId) &&
              d.incidentId === args.where.incidentId
          )
        )
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

// Mock GraphHopper client
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

// Mock route cache
vi.mock('@/lib/routing/cache', () => ({
  getCachedRoute: vi.fn().mockResolvedValue(null),
  setCachedRoute: vi.fn().mockResolvedValue(undefined),
}));

function createRequest(body?: any, method = 'GET') {
  return new Request('http://localhost/api/dispatch/test', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockOfficialUser() {
  vi.mocked(getCurrentUser).mockResolvedValue({
    tokenUse: 'access',
    userId: 'user-official',
    cin: 'OFF123',
    role: 'OFFICIAL' as const,
    scopes: ['map:read', 'equipment:read'],
  });
}

function mockCivilianUser() {
  vi.mocked(getCurrentUser).mockResolvedValue({
    tokenUse: 'access',
    userId: 'user-civilian',
    cin: 'CIV123',
    role: 'CIVILIAN' as const,
    scopes: ['map:read'],
  });
}

describe('Dispatch Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTeams.length = 0;
    mockVehicles.length = 0;
    mockIncidents.length = 0;
    mockDispatches.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Full dispatch flow', () => {
    it('should complete full workflow: create team → create incident → assign → verify', async () => {
      mockOfficialUser();

      // 1. Create team
      const teamResponse = await teamsPost(
        createRequest(
          {
            name: 'Station 1 Alpha',
            type: 'GROUND_CREW',
            location: { type: 'Point', coordinates: [-5.1, 33.5] },
            capacity: 5,
            equipment: ['truck', 'hoses'],
          },
          'POST'
        )
      );

      expect(teamResponse.status).toBe(201);
      const team = await teamResponse.json();
      expect(team.id).toBeDefined();
      expect(team.status).toBe('AVAILABLE');

      // 2. Create mock incident
      mockIncidents.push({
        id: 'incident-1',
        location: { type: 'Point', coordinates: [-5.08, 33.55] },
        status: 'ALERTE',
        severity: 4,
      });

      // 3. Assign team to incident
      const assignResponse = await assignPost(
        createRequest(
          {
            incidentId: 'incident-1',
            teamIds: [team.id],
          },
          'POST'
        )
      );

      expect(assignResponse.status).toBe(201);
      const assignment = await assignResponse.json();
      expect(assignment.incidentId).toBe('incident-1');
      expect(assignment.assignedTeams).toHaveLength(1);
      expect(assignment.assignedTeams[0].teamId).toBe(team.id);
      expect(assignment.assignedTeams[0].eta).toBeDefined();
      expect(assignment.assignedTeams[0].distance_km).toBeCloseTo(5.2);
      expect(assignment.assignedTeams[0].duration_min).toBeCloseTo(12);

      // 4. Verify team status updated
      const updatedTeam = mockTeams.find((t) => t.id === team.id);
      expect(updatedTeam.status).toBe('EN_ROUTE');
      expect(updatedTeam.assignedTo).toBe('incident-1');

      // 5. Verify dispatch record created
      expect(mockDispatches).toHaveLength(1);
      expect(mockDispatches[0].teamId).toBe(team.id);
      expect(mockDispatches[0].incidentId).toBe('incident-1');
      expect(mockDispatches[0].status).toBe('ASSIGNED');
    });

    it('should handle multiple team assignment', async () => {
      mockOfficialUser();

      // Create 3 teams
      const teamIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const response = await teamsPost(
          createRequest(
            {
              name: `Team ${i + 1}`,
              type: 'GROUND_CREW',
              location: { type: 'Point', coordinates: [-5.1 - i * 0.01, 33.5] },
              capacity: 5,
            },
            'POST'
          )
        );
        const team = await response.json();
        teamIds.push(team.id);
      }

      // Create incident
      mockIncidents.push({
        id: 'incident-multi',
        location: { type: 'Point', coordinates: [-5.08, 33.55] },
        status: 'INTERVENTION',
        severity: 5,
      });

      // Assign all 3 teams
      const assignResponse = await assignPost(
        createRequest(
          {
            incidentId: 'incident-multi',
            teamIds,
          },
          'POST'
        )
      );

      expect(assignResponse.status).toBe(201);
      const assignment = await assignResponse.json();
      expect(assignment.assignedTeams).toHaveLength(3);
      expect(assignment.totalTeams).toBe(3);

      // Verify all teams updated
      teamIds.forEach((id) => {
        const team = mockTeams.find((t) => t.id === id);
        expect(team.status).toBe('EN_ROUTE');
        expect(team.assignedTo).toBe('incident-multi');
      });

      // Verify 3 dispatch records
      expect(mockDispatches).toHaveLength(3);
    });

    it('should handle mixed team + vehicle assignment', async () => {
      mockOfficialUser();

      // Create 1 team
      const teamResponse = await teamsPost(
        createRequest(
          {
            name: 'Alpha Team',
            type: 'GROUND_CREW',
            location: { type: 'Point', coordinates: [-5.1, 33.5] },
            capacity: 5,
            equipment: ['truck'],
          },
          'POST'
        )
      );
      const team = await teamResponse.json();

      // Add 1 vehicle to mock store
      mockVehicles.push({
        id: 'vehicle-mix-1',
        callSign: 'FT-MIX',
        type: 'FIRE_TRUCK',
        status: 'AVAILABLE',
        capabilities: ['water_pump'],
        baseLocation: { type: 'Point', coordinates: [-5.12, 33.52] },
        location: { type: 'Point', coordinates: [-5.12, 33.52] },
        assignedTo: null,
        capacity: 5000,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create incident
      mockIncidents.push({
        id: 'incident-mixed',
        location: { type: 'Point', coordinates: [-5.08, 33.55] },
        status: 'INTERVENTION',
        severity: 4,
      });

      // Assign team + vehicle
      const assignResponse = await assignPost(
        createRequest(
          {
            incidentId: 'incident-mixed',
            teamIds: [team.id],
            vehicleIds: ['vehicle-mix-1'],
          },
          'POST'
        )
      );

      expect(assignResponse.status).toBe(201);
      const assignment = await assignResponse.json();

      // Verify team assignment
      expect(assignment.assignedTeams).toHaveLength(1);
      expect(assignment.assignedTeams[0].teamId).toBe(team.id);

      // Verify vehicle assignment
      expect(assignment.assignedVehicles).toHaveLength(1);
      expect(assignment.assignedVehicles[0].vehicleId).toBe('vehicle-mix-1');
      expect(assignment.assignedVehicles[0].callSign).toBe('FT-MIX');

      // Verify team status
      const updatedTeam = mockTeams.find((t) => t.id === team.id);
      expect(updatedTeam.status).toBe('EN_ROUTE');

      // Verify vehicle status
      const updatedVehicle = mockVehicles.find((v) => v.id === 'vehicle-mix-1');
      expect(updatedVehicle.status).toBe('EN_ROUTE');

      // Verify totals
      expect(assignment.totalTeams).toBe(1);
      expect(assignment.totalVehicles).toBe(1);
    });
  });

  describe('Validation and constraints', () => {
    it('should reject assignment with unavailable team', async () => {
      mockOfficialUser();

      // Create team already EN_ROUTE
      mockTeams.push({
        id: 'team-busy',
        name: 'Busy Team',
        type: 'GROUND_CREW',
        status: 'EN_ROUTE',
        location: { type: 'Point', coordinates: [-5.1, 33.5] },
        assignedTo: 'other-incident',
        capacity: 5,
        equipment: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockIncidents.push({
        id: 'incident-1',
        location: { type: 'Point', coordinates: [-5.08, 33.55] },
        status: 'ALERTE',
      });

      const response = await assignPost(
        createRequest(
          {
            incidentId: 'incident-1',
            teamIds: ['team-busy'],
          },
          'POST'
        )
      );

      expect(response.status).toBe(409); // Conflict
      const error = await response.json();
      expect(error.error.code).toBe(6003); // TEAM_UNAVAILABLE
    });

    it('should reject more than 5 teams', async () => {
      mockOfficialUser();

      // Create 6 teams
      for (let i = 0; i < 6; i++) {
        mockTeams.push({
          id: `team-${i}`,
          name: `Team ${i}`,
          type: 'GROUND_CREW',
          status: 'AVAILABLE',
          location: { type: 'Point', coordinates: [-5.1, 33.5] },
          assignedTo: null,
          capacity: 5,
          equipment: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      mockIncidents.push({
        id: 'incident-1',
        location: { type: 'Point', coordinates: [-5.08, 33.55] },
        status: 'ALERTE',
      });

      const response = await assignPost(
        createRequest(
          {
            incidentId: 'incident-1',
            teamIds: mockTeams.map((t) => t.id),
          },
          'POST'
        )
      );

      expect(response.status).toBe(422); // Unprocessable
      const error = await response.json();
      expect(error.error.code).toBe(6004); // MAX_TEAMS_EXCEEDED
    });

    it('should reject duplicate assignment', async () => {
      mockOfficialUser();

      mockTeams.push({
        id: 'team-1',
        name: 'Team 1',
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
        id: 'incident-1',
        location: { type: 'Point', coordinates: [-5.08, 33.55] },
        status: 'ALERTE',
      });

      // Create existing dispatch
      mockDispatches.push({
        id: 'dispatch-existing',
        teamId: 'team-1',
        incidentId: 'incident-1',
        status: 'ASSIGNED',
      });

      const response = await assignPost(
        createRequest(
          {
            incidentId: 'incident-1',
            teamIds: ['team-1'],
          },
          'POST'
        )
      );

      expect(response.status).toBe(409); // Conflict
      const error = await response.json();
      expect(error.error.code).toBe(6005); // DUPLICATE_ASSIGNMENT
    });

    it('should reject assignment to non-existent incident', async () => {
      mockOfficialUser();

      mockTeams.push({
        id: 'team-1',
        name: 'Team 1',
        type: 'GROUND_CREW',
        status: 'AVAILABLE',
        location: { type: 'Point', coordinates: [-5.1, 33.5] },
        assignedTo: null,
        capacity: 5,
        equipment: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await assignPost(
        createRequest(
          {
            incidentId: 'non-existent',
            teamIds: ['team-1'],
          },
          'POST'
        )
      );

      expect(response.status).toBe(404);
      const error = await response.json();
      expect(error.error.code).toBe(6008); // INCIDENT_NOT_FOUND
    });
  });

  describe('Authorization', () => {
    it('should allow OFFICIAL to create teams', async () => {
      mockOfficialUser();

      const response = await teamsPost(
        createRequest(
          {
            name: 'Test Team',
            type: 'GROUND_CREW',
            location: { type: 'Point', coordinates: [-5.1, 33.5] },
          },
          'POST'
        )
      );

      expect(response.status).toBe(201);
    });

    it('should reject CIVILIAN from creating teams', async () => {
      mockCivilianUser();

      const response = await teamsPost(
        createRequest(
          {
            name: 'Test Team',
            type: 'GROUND_CREW',
            location: { type: 'Point', coordinates: [-5.1, 33.5] },
          },
          'POST'
        )
      );

      expect(response.status).toBe(403);
      const error = await response.json();
      expect(error.error.code).toBe(2001); // FORBIDDEN
    });

    it('should reject CIVILIAN from assigning teams', async () => {
      mockCivilianUser();

      const response = await assignPost(
        createRequest(
          {
            incidentId: 'incident-1',
            teamIds: ['team-1'],
          },
          'POST'
        )
      );

      expect(response.status).toBe(403);
      const error = await response.json();
      expect(error.error.code).toBe(2001);
    });
  });
});

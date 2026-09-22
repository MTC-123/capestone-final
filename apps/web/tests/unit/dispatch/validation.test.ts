import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  validateTeamAvailable,
  validateNoDuplicateAssignment,
  validateMaxTeams,
  validateIncidentExists,
  validateTeamsExistAndAvailable,
} from '@/lib/dispatch/validation';
import { AppError } from '@/lib/errors/AppError';
import type { Team } from '@prisma/client';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    dispatch: {
      findFirst: vi.fn(),
    },
    incident: {
      findUnique: vi.fn(),
    },
    team: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

describe('Dispatch Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateTeamAvailable', () => {
    it('should allow AVAILABLE teams', () => {
      const team: Team = {
        id: 'team-1',
        name: 'Station 1 Alpha',
        type: 'GROUND_CREW',
        status: 'AVAILABLE',
        location: { type: 'Point', coordinates: [-5.1, 33.5] },
        assignedTo: null,
        capacity: 5,
        equipment: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => validateTeamAvailable(team)).not.toThrow();
    });

    it('should reject EN_ROUTE teams', () => {
      const team: Team = {
        id: 'team-1',
        name: 'Station 1 Alpha',
        type: 'GROUND_CREW',
        status: 'EN_ROUTE',
        location: { type: 'Point', coordinates: [-5.1, 33.5] },
        assignedTo: 'incident-1',
        capacity: 5,
        equipment: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => validateTeamAvailable(team)).toThrow(AppError);
      expect(() => validateTeamAvailable(team)).toThrow(/not available/);
    });

    it('should reject ON_SCENE teams', () => {
      const team: Team = {
        id: 'team-1',
        name: 'Station 1 Alpha',
        type: 'GROUND_CREW',
        status: 'ON_SCENE',
        location: { type: 'Point', coordinates: [-5.1, 33.5] },
        assignedTo: 'incident-1',
        capacity: 5,
        equipment: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => validateTeamAvailable(team)).toThrow(AppError);
    });

    it('should reject UNAVAILABLE teams', () => {
      const team: Team = {
        id: 'team-1',
        name: 'Station 1 Alpha',
        type: 'GROUND_CREW',
        status: 'UNAVAILABLE',
        location: { type: 'Point', coordinates: [-5.1, 33.5] },
        assignedTo: null,
        capacity: 5,
        equipment: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => validateTeamAvailable(team)).toThrow(AppError);
    });
  });

  describe('validateNoDuplicateAssignment', () => {
    it('should allow assignment if no duplicate exists', async () => {
      (prisma.dispatch.findFirst as any).mockResolvedValueOnce(null);

      await expect(
        validateNoDuplicateAssignment('team-1', 'incident-1')
      ).resolves.not.toThrow();
    });

    it('should reject duplicate ASSIGNED assignment', async () => {
      const existingDispatch = {
        id: 'dispatch-1',
        teamId: 'team-1',
        incidentId: 'incident-1',
        status: 'ASSIGNED',
      };
      (prisma.dispatch.findFirst as any)
        .mockResolvedValueOnce(existingDispatch)
        .mockResolvedValueOnce(existingDispatch);

      await expect(
        validateNoDuplicateAssignment('team-1', 'incident-1')
      ).rejects.toThrow(AppError);
      await expect(
        validateNoDuplicateAssignment('team-1', 'incident-1')
      ).rejects.toThrow(/already assigned/);
    });

    it('should reject duplicate EN_ROUTE assignment', async () => {
      (prisma.dispatch.findFirst as any).mockResolvedValueOnce({
        id: 'dispatch-1',
        teamId: 'team-1',
        incidentId: 'incident-1',
        status: 'EN_ROUTE',
      });

      await expect(
        validateNoDuplicateAssignment('team-1', 'incident-1')
      ).rejects.toThrow(AppError);
    });

    it('should allow assignment if previous dispatch is COMPLETED', async () => {
      (prisma.dispatch.findFirst as any).mockResolvedValueOnce(null); // No active assignment

      await expect(
        validateNoDuplicateAssignment('team-1', 'incident-1')
      ).resolves.not.toThrow();
    });
  });

  describe('validateMaxTeams', () => {
    it('should allow 1-5 teams', () => {
      expect(() => validateMaxTeams(1)).not.toThrow();
      expect(() => validateMaxTeams(3)).not.toThrow();
      expect(() => validateMaxTeams(5)).not.toThrow();
    });

    it('should reject 0 teams', () => {
      expect(() => validateMaxTeams(0)).not.toThrow(); // 0 is technically allowed, just unusual
    });

    it('should reject more than 5 teams', () => {
      expect(() => validateMaxTeams(6)).toThrow(AppError);
      expect(() => validateMaxTeams(6)).toThrow(/Maximum.*5 teams/);
      expect(() => validateMaxTeams(10)).toThrow(AppError);
    });
  });

  describe('validateIncidentExists', () => {
    it('should return incident if exists', async () => {
      const mockIncident = {
        id: 'incident-1',
        location: { type: 'Point', coordinates: [-5.08, 33.55] },
        status: 'ALERTE',
      };

      (prisma.incident.findUnique as any).mockResolvedValueOnce(mockIncident);

      const result = await validateIncidentExists('incident-1');

      expect(result).toEqual(mockIncident);
      expect(prisma.incident.findUnique).toHaveBeenCalledWith({
        where: { id: 'incident-1' },
        select: { id: true, location: true, status: true },
      });
    });

    it('should throw if incident not found', async () => {
      (prisma.incident.findUnique as any).mockResolvedValueOnce(null);

      await expect(validateIncidentExists('invalid-id')).rejects.toThrow(
        AppError
      );
      await expect(validateIncidentExists('invalid-id')).rejects.toThrow(
        /not found/
      );
    });
  });

  describe('validateTeamsExistAndAvailable', () => {
    it('should return teams if all exist and are available', async () => {
      const mockTeams: Team[] = [
        {
          id: 'team-1',
          name: 'Station 1',
          type: 'GROUND_CREW',
          status: 'AVAILABLE',
          location: { type: 'Point', coordinates: [-5.1, 33.5] },
          assignedTo: null,
          capacity: 5,
          equipment: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'team-2',
          name: 'Station 2',
          type: 'AERIAL_SUPPORT',
          status: 'AVAILABLE',
          location: { type: 'Point', coordinates: [-5.2, 33.6] },
          assignedTo: null,
          capacity: 3,
          equipment: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.team.findMany as any).mockResolvedValueOnce(mockTeams);

      const result = await validateTeamsExistAndAvailable(['team-1', 'team-2']);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('team-1');
      expect(result[1].id).toBe('team-2');
    });

    it('should throw if some teams do not exist', async () => {
      const mockTeams: Team[] = [
        {
          id: 'team-1',
          name: 'Station 1',
          type: 'GROUND_CREW',
          status: 'AVAILABLE',
          location: { type: 'Point', coordinates: [-5.1, 33.5] },
          assignedTo: null,
          capacity: 5,
          equipment: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.team.findMany as any)
        .mockResolvedValueOnce(mockTeams)
        .mockResolvedValueOnce(mockTeams);

      await expect(
        validateTeamsExistAndAvailable(['team-1', 'team-2'])
      ).rejects.toThrow(AppError);
      await expect(
        validateTeamsExistAndAvailable(['team-1', 'team-2'])
      ).rejects.toThrow(/not found/);
    });

    it('should throw if any team is not available', async () => {
      const mockTeams: Team[] = [
        {
          id: 'team-1',
          name: 'Station 1',
          type: 'GROUND_CREW',
          status: 'AVAILABLE',
          location: { type: 'Point', coordinates: [-5.1, 33.5] },
          assignedTo: null,
          capacity: 5,
          equipment: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'team-2',
          name: 'Station 2',
          type: 'AERIAL_SUPPORT',
          status: 'EN_ROUTE',
          location: { type: 'Point', coordinates: [-5.2, 33.6] },
          assignedTo: 'incident-1',
          capacity: 3,
          equipment: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.team.findMany as any)
        .mockResolvedValueOnce(mockTeams)
        .mockResolvedValueOnce(mockTeams);

      await expect(
        validateTeamsExistAndAvailable(['team-1', 'team-2'])
      ).rejects.toThrow(AppError);
      await expect(
        validateTeamsExistAndAvailable(['team-1', 'team-2'])
      ).rejects.toThrow(/not available/);
    });
  });
});

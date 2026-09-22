/**
 * Dispatch Validation Logic - MVP Phase
 * Validates team availability and dispatch constraints
 */

import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors/AppError';
import type { Team } from '@prisma/client';

const MAX_TEAMS_PER_INCIDENT = 5;

/**
 * Validate team is available for dispatch
 */
export function validateTeamAvailable(team: Team): void {
  if (team.status !== 'AVAILABLE') {
    throw new AppError(6003, {
      message: `Team ${team.name} is not available (status: ${team.status})`,
      meta: { teamId: team.id, teamName: team.name, currentStatus: team.status },
    });
  }
}

/**
 * Validate team is not already assigned to this incident
 */
export async function validateNoDuplicateAssignment(
  teamId: string,
  incidentId: string
): Promise<void> {
  const existingAssignment = await prisma.dispatch.findFirst({
    where: {
      teamId,
      incidentId,
      status: { in: ['ASSIGNED', 'EN_ROUTE', 'ARRIVED'] }, // Active statuses
    },
  });

  if (existingAssignment) {
    throw new AppError(6005, {
      message: `Team is already assigned to this incident`,
      meta: { teamId, incidentId, dispatchId: existingAssignment.id },
    });
  }
}

/**
 * Validate number of teams doesn't exceed maximum
 */
export function validateMaxTeams(teamCount: number): void {
  if (teamCount > MAX_TEAMS_PER_INCIDENT) {
    throw new AppError(6004, {
      message: `Maximum ${MAX_TEAMS_PER_INCIDENT} teams per incident`,
      meta: { requestedTeams: teamCount, maxAllowed: MAX_TEAMS_PER_INCIDENT },
    });
  }
}

/**
 * Validate incident exists and get its location
 */
export async function validateIncidentExists(incidentId: string): Promise<{
  id: string;
  location: unknown;
  status: string;
}> {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { id: true, location: true, status: true },
  });

  if (!incident) {
    throw new AppError(6008, {
      message: 'Incident not found',
      meta: { incidentId },
    });
  }

  return incident;
}

/**
 * Validate teams exist and are available
 */
export async function validateTeamsExistAndAvailable(teamIds: string[]): Promise<Team[]> {
  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds } },
  });

  // Check all requested teams exist
  if (teams.length !== teamIds.length) {
    const foundIds = teams.map((t) => t.id);
    const missingIds = teamIds.filter((id) => !foundIds.includes(id));
    throw new AppError(6009, {
      message: `Team(s) not found: ${missingIds.join(', ')}`,
      meta: { missingTeamIds: missingIds },
    });
  }

  // Validate each team is available
  for (const team of teams) {
    validateTeamAvailable(team);
  }

  return teams;
}

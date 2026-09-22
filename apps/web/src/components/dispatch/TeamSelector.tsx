'use client';

/**
 * TeamSelector - MVP Phase
 * Lists available teams with checkboxes for selection
 * Supports filtering by status and type
 */

import { useEffect, useState, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useDispatchStore } from '@/store/useDispatchStore';
import type { SelectedTeam } from '@/store/useDispatchStore';
import { Icon } from '@/components/ui/Icon';

interface TeamSelectorProps {
  incidentId: string;
}

interface TeamFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    id: string;
    name: string;
    type: string;
    status: string;
    capacity: number;
    equipment: string[];
    assignedTo?: string;
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TeamSelector({ incidentId }: TeamSelectorProps) {
  const { t } = useTranslation();
  const { selectedTeams, addTeam, removeTeam, isTeamSelected } = useDispatchStore();

  const [teams, setTeams] = useState<TeamFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('AVAILABLE');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const fetchingRef = useRef(false);

  // Fetch teams
  useEffect(() => {
    let cancelled = false;

    const fetchTeams = async () => {
      // Prevent concurrent fetches
      if (fetchingRef.current) return;

      fetchingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (statusFilter && statusFilter !== 'all') {
          params.append('status', statusFilter);
        }
        if (typeFilter && typeFilter !== 'all') {
          params.append('type', typeFilter);
        }

        const response = await fetch(`/api/dispatch/teams?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch teams');
        }

        const data = await response.json();

        if (!cancelled) {
          setTeams(data.features || []);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load teams');
        }
      } finally {
        fetchingRef.current = false;
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchTeams();

    return () => {
      cancelled = true;
      fetchingRef.current = false; // Reset ref on cleanup
    };
  }, [statusFilter, typeFilter]);

  const handleToggleTeam = (team: TeamFeature) => {
    const teamData: SelectedTeam = {
      id: team.properties.id,
      name: team.properties.name,
      type: team.properties.type,
      status: team.properties.status,
      location: team.geometry,
      capacity: team.properties.capacity,
    };

    if (isTeamSelected(team.properties.id)) {
      removeTeam(team.properties.id);
    } else {
      addTeam(teamData);
    }
  };

  const teamTypeLabels: Record<string, string> = {
    GROUND_CREW: t('groundCrew') || 'Ground Crew',
    AERIAL_SUPPORT: t('aerialSupport') || 'Aerial Support',
    COMMAND_UNIT: t('commandUnit') || 'Command Unit',
    MEDICAL: t('medical') || 'Medical',
  };

  const statusColors: Record<string, string> = {
    AVAILABLE: 'text-green-500',
    EN_ROUTE: 'text-yellow-500',
    ON_SCENE: 'text-blue-500',
    RETURNING: 'text-purple-500',
    UNAVAILABLE: 'text-red-500',
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-muted rounded-lg p-3 h-16"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3">
        <Icon name="warning" className="inline mr-1" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex gap-2">
        <select
          data-testid="team-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex-1 text-xs bg-muted border border-border rounded px-2 py-1"
        >
          <option value="all">{t('allStatuses') || 'All Statuses'}</option>
          <option value="AVAILABLE">{t('available') || 'Available'}</option>
          <option value="EN_ROUTE">{t('enRoute') || 'En Route'}</option>
          <option value="ON_SCENE">{t('onScene') || 'On Scene'}</option>
        </select>

        <select
          data-testid="team-type-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="flex-1 text-xs bg-muted border border-border rounded px-2 py-1"
        >
          <option value="all">{t('allTypes') || 'All Types'}</option>
          <option value="GROUND_CREW">{teamTypeLabels.GROUND_CREW}</option>
          <option value="AERIAL_SUPPORT">{teamTypeLabels.AERIAL_SUPPORT}</option>
          <option value="COMMAND_UNIT">{teamTypeLabels.COMMAND_UNIT}</option>
          <option value="MEDICAL">{teamTypeLabels.MEDICAL}</option>
        </select>
      </div>

      {/* Team List */}
      {teams.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-4">
          {t('noTeamsAvailable') || 'No teams available'}
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {teams.map((team) => {
            const isSelected = isTeamSelected(team.properties.id);
            const isDisabled = selectedTeams.length >= 5 && !isSelected;

            return (
              <label
                key={team.properties.id}
                className={`
                  flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                  ${isSelected ? 'bg-primary/10 border-primary' : 'bg-muted/50 border-border hover:bg-muted'}
                  ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                data-testid={`team-checkbox-${team.properties.id}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggleTeam(team)}
                  disabled={isDisabled}
                  className="mt-1"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {team.properties.name}
                    </span>
                    <span className={`text-xs ${statusColors[team.properties.status] || 'text-muted-foreground'}`}>
                      •
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{teamTypeLabels[team.properties.type] || team.properties.type}</span>
                    <span>•</span>
                    <span>{team.properties.capacity} {t('personnel') || 'personnel'}</span>
                  </div>

                  {team.properties.assignedTo && (
                    <div className="mt-1 text-xs text-yellow-600">
                      {t('assignedTo') || 'Assigned to'} {team.properties.assignedTo.slice(-6)}
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}

      {/* Selection Counter */}
      {selectedTeams.length > 0 && (
        <div className="text-xs text-muted-foreground text-center">
          {selectedTeams.length} / 5 {t('teamsSelected') || 'teams selected'}
        </div>
      )}
    </div>
  );
}

'use client';

import { useAuthStore } from '@/store/useAuthStore';
import type { Role, AgencyType } from '@/types';

export type Scope =
  | 'map:read'
  | 'map:write'
  | 'reports:read'
  | 'reports:write'
  | 'equipment:read'
  | 'equipment:write'
  | 'analytics:read'
  | 'coordination:read'
  | 'coordination:write'
  | 'admin';

function deriveClientScopes(role: Role, agencyType?: AgencyType): Scope[] {
  const base: Scope[] = ['map:read', 'reports:read', 'analytics:read'];

  if (role === 'OFFICIAL') {
    base.push('map:write', 'reports:write', 'equipment:read', 'coordination:read', 'coordination:write');

    switch (agencyType) {
      case 'COORDINATEUR':
        base.push('equipment:write', 'admin');
        break;
      case 'FORESTIER':
      case 'PROTECTION_CIVILE':
        base.push('equipment:write');
        break;
      case 'OBSERVATEUR':
        // Read-only official — no additional write scopes
        break;
      default:
        base.push('equipment:write');
    }
  } else {
    base.push('reports:write');
  }

  return base;
}

export function useScope() {
  const user = useAuthStore((s) => s.user);

  const scopes = user
    ? deriveClientScopes(user.role, user.agencyType)
    : [];

  function hasScope(scope: Scope): boolean {
    return scopes.includes(scope);
  }

  return { hasScope, user, scopes };
}

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuthStore } from '@/store/useAuthStore';
import { useScope } from '@/hooks/useScope';
import type { User } from '@/types';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    cin: 'AB123',
    phone: '+212600000000',
    role: 'CIVILIAN',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('useScope', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isLoading: false });
  });

  describe('no user (logged out)', () => {
    it('returns empty scopes when no user is set', () => {
      const { result } = renderHook(() => useScope());
      expect(result.current.scopes).toEqual([]);
      expect(result.current.user).toBeNull();
    });

    it('hasScope returns false for any scope when logged out', () => {
      const { result } = renderHook(() => useScope());
      expect(result.current.hasScope('map:read')).toBe(false);
      expect(result.current.hasScope('admin')).toBe(false);
    });
  });

  describe('CIVILIAN role', () => {
    beforeEach(() => {
      useAuthStore.setState({ user: makeUser({ role: 'CIVILIAN' }) });
    });

    it('has base read scopes', () => {
      const { result } = renderHook(() => useScope());
      expect(result.current.hasScope('map:read')).toBe(true);
      expect(result.current.hasScope('reports:read')).toBe(true);
      expect(result.current.hasScope('analytics:read')).toBe(true);
    });

    it('has reports:write', () => {
      const { result } = renderHook(() => useScope());
      expect(result.current.hasScope('reports:write')).toBe(true);
    });

    it('does NOT have map:write', () => {
      const { result } = renderHook(() => useScope());
      expect(result.current.hasScope('map:write')).toBe(false);
    });

    it('does NOT have equipment scopes', () => {
      const { result } = renderHook(() => useScope());
      expect(result.current.hasScope('equipment:read')).toBe(false);
      expect(result.current.hasScope('equipment:write')).toBe(false);
    });

    it('does NOT have admin', () => {
      const { result } = renderHook(() => useScope());
      expect(result.current.hasScope('admin')).toBe(false);
    });

    it('does NOT have coordination scopes', () => {
      const { result } = renderHook(() => useScope());
      expect(result.current.hasScope('coordination:read')).toBe(false);
      expect(result.current.hasScope('coordination:write')).toBe(false);
    });
  });

  describe('OFFICIAL role — COORDINATEUR agency', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: makeUser({ role: 'OFFICIAL', agencyType: 'COORDINATEUR' }),
      });
    });

    it('has all base + official scopes', () => {
      const { result } = renderHook(() => useScope());
      expect(result.current.hasScope('map:read')).toBe(true);
      expect(result.current.hasScope('map:write')).toBe(true);
      expect(result.current.hasScope('reports:read')).toBe(true);
      expect(result.current.hasScope('reports:write')).toBe(true);
      expect(result.current.hasScope('equipment:read')).toBe(true);
      expect(result.current.hasScope('equipment:write')).toBe(true);
      expect(result.current.hasScope('coordination:read')).toBe(true);
      expect(result.current.hasScope('coordination:write')).toBe(true);
      expect(result.current.hasScope('analytics:read')).toBe(true);
    });

    it('has admin scope', () => {
      const { result } = renderHook(() => useScope());
      expect(result.current.hasScope('admin')).toBe(true);
    });
  });

  describe('OFFICIAL role — FORESTIER agency', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: makeUser({ role: 'OFFICIAL', agencyType: 'FORESTIER' }),
      });
    });

    it('has equipment:write but NOT admin', () => {
      const { result } = renderHook(() => useScope());
      expect(result.current.hasScope('equipment:write')).toBe(true);
      expect(result.current.hasScope('admin')).toBe(false);
    });

    it('has coordination scopes', () => {
      const { result } = renderHook(() => useScope());
      expect(result.current.hasScope('coordination:read')).toBe(true);
      expect(result.current.hasScope('coordination:write')).toBe(true);
    });
  });

  describe('OFFICIAL role — PROTECTION_CIVILE agency', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: makeUser({ role: 'OFFICIAL', agencyType: 'PROTECTION_CIVILE' }),
      });
    });

    it('has equipment:write but NOT admin', () => {
      const { result } = renderHook(() => useScope());
      expect(result.current.hasScope('equipment:write')).toBe(true);
      expect(result.current.hasScope('admin')).toBe(false);
    });
  });

  describe('OFFICIAL role — OBSERVATEUR agency', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: makeUser({ role: 'OFFICIAL', agencyType: 'OBSERVATEUR' }),
      });
    });

    it('has official base scopes (map:write, reports:write, equipment:read)', () => {
      const { result } = renderHook(() => useScope());
      expect(result.current.hasScope('map:write')).toBe(true);
      expect(result.current.hasScope('reports:write')).toBe(true);
      expect(result.current.hasScope('equipment:read')).toBe(true);
    });

    it('does NOT have equipment:write', () => {
      const { result } = renderHook(() => useScope());
      expect(result.current.hasScope('equipment:write')).toBe(false);
    });

    it('does NOT have admin', () => {
      const { result } = renderHook(() => useScope());
      expect(result.current.hasScope('admin')).toBe(false);
    });
  });

  describe('OFFICIAL role — no agencyType (default branch)', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: makeUser({ role: 'OFFICIAL' }),
      });
    });

    it('falls through to default: gets equipment:write', () => {
      const { result } = renderHook(() => useScope());
      expect(result.current.hasScope('equipment:write')).toBe(true);
    });

    it('does NOT have admin', () => {
      const { result } = renderHook(() => useScope());
      expect(result.current.hasScope('admin')).toBe(false);
    });
  });

  describe('return shape', () => {
    it('returns user object from the store', () => {
      const user = makeUser({ id: 'test-id' });
      useAuthStore.setState({ user });
      const { result } = renderHook(() => useScope());
      expect(result.current.user).toEqual(user);
    });

    it('scopes is an array', () => {
      useAuthStore.setState({ user: makeUser() });
      const { result } = renderHook(() => useScope());
      expect(Array.isArray(result.current.scopes)).toBe(true);
    });

    it('hasScope is a function', () => {
      const { result } = renderHook(() => useScope());
      expect(typeof result.current.hasScope).toBe('function');
    });
  });
});

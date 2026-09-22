import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/useAuthStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isLoading: true });
  });

  it('starts with null user and loading true', () => {
    const { user, isLoading } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(isLoading).toBe(true);
  });

  it('setUser sets user and clears loading', () => {
    useAuthStore.getState().setUser({ id: '1', cin: 'AB123456', role: 'OFFICIAL' } as any);
    const { user, isLoading } = useAuthStore.getState();
    expect(user?.cin).toBe('AB123456');
    expect(isLoading).toBe(false);
  });

  it('setLoading updates isLoading', () => {
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('logout clears user', () => {
    useAuthStore.getState().setUser({ id: '1', cin: 'AB123456', role: 'OFFICIAL' } as any);
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
  });
});

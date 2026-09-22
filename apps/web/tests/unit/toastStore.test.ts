import { describe, it, expect, beforeEach } from 'vitest';
import { useToastStore } from '@/store/useToastStore';

describe('useToastStore', () => {
  beforeEach(() => {
    useToastStore.getState().clearAll();
  });

  it('adds a toast with defaults', () => {
    useToastStore.getState().addToast('Hello', 'success');
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Hello');
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].duration).toBe(4000);
  });

  it('adds a toast with custom duration', () => {
    useToastStore.getState().addToast('Persists', 'info', 0);
    expect(useToastStore.getState().toasts[0].duration).toBe(0);
  });

  it('caps at 3 toasts, dropping oldest', () => {
    const { addToast } = useToastStore.getState();
    addToast('A', 'info');
    addToast('B', 'info');
    addToast('C', 'info');
    addToast('D', 'info');

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(3);
    expect(toasts[0].message).toBe('B');
    expect(toasts[2].message).toBe('D');
  });

  it('removes a toast by id', () => {
    useToastStore.getState().addToast('X', 'error');
    const id = useToastStore.getState().toasts[0].id;

    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('clearAll removes all toasts', () => {
    useToastStore.getState().addToast('A', 'warning');
    useToastStore.getState().addToast('B', 'success');
    useToastStore.getState().clearAll();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

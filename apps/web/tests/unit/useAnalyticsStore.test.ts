import { describe, it, expect, beforeEach } from 'vitest';
import { useAnalyticsStore, computeDateRange } from '@/store/useAnalyticsStore';

describe('useAnalyticsStore', () => {
  beforeEach(() => {
    useAnalyticsStore.getState().reset();
  });

  it('has correct initial state', () => {
    const state = useAnalyticsStore.getState();
    expect(state.dateRange).toBe('30d');
    expect(state.activeTab).toBe('overview');
    expect(state.data).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('setDateRange updates preset', () => {
    useAnalyticsStore.getState().setDateRange('7d');
    expect(useAnalyticsStore.getState().dateRange).toBe('7d');
  });

  it('setActiveTab updates tab', () => {
    useAnalyticsStore.getState().setActiveTab('temporal');
    expect(useAnalyticsStore.getState().activeTab).toBe('temporal');
  });

  it('setCustomFrom/To updates custom dates', () => {
    useAnalyticsStore.getState().setCustomFrom('2025-01-01');
    useAnalyticsStore.getState().setCustomTo('2025-06-30');
    expect(useAnalyticsStore.getState().customFrom).toBe('2025-01-01');
    expect(useAnalyticsStore.getState().customTo).toBe('2025-06-30');
  });

  it('reset restores initial state', () => {
    useAnalyticsStore.getState().setDateRange('year');
    useAnalyticsStore.getState().setActiveTab('causes');
    useAnalyticsStore.getState().reset();
    expect(useAnalyticsStore.getState().dateRange).toBe('30d');
    expect(useAnalyticsStore.getState().activeTab).toBe('overview');
  });
});

describe('computeDateRange', () => {
  it('computes 7d range', () => {
    const range = computeDateRange('7d', '', '');
    const from = new Date(range.from);
    const to = new Date(range.to);
    const diffDays = (to.getTime() - from.getTime()) / 86400000;
    expect(diffDays).toBeGreaterThanOrEqual(6.9);
    expect(diffDays).toBeLessThanOrEqual(7.1);
  });

  it('computes 30d range', () => {
    const range = computeDateRange('30d', '', '');
    const from = new Date(range.from);
    const to = new Date(range.to);
    const diffDays = (to.getTime() - from.getTime()) / 86400000;
    expect(diffDays).toBeGreaterThanOrEqual(29.9);
    expect(diffDays).toBeLessThanOrEqual(30.1);
  });

  it('computes season range (Jun 1 – Nov 1)', () => {
    const range = computeDateRange('season', '', '');
    const from = new Date(range.from);
    const to = new Date(range.to);
    expect(from.getMonth()).toBe(5); // June
    expect(from.getDate()).toBe(1);
    expect(to.getMonth()).toBe(10); // November
  });

  it('computes year range', () => {
    const range = computeDateRange('year', '', '');
    const from = new Date(range.from);
    const to = new Date(range.to);
    const diffDays = (to.getTime() - from.getTime()) / 86400000;
    expect(diffDays).toBeGreaterThanOrEqual(364);
    expect(diffDays).toBeLessThanOrEqual(366);
  });

  it('computes custom range', () => {
    const range = computeDateRange('custom', '2025-03-01', '2025-06-15');
    expect(range.from).toContain('2025-03-01');
    expect(range.to).toContain('2025-06-15');
  });

  it('computes all range from epoch', () => {
    const range = computeDateRange('all', '', '');
    expect(new Date(range.from).getFullYear()).toBe(1970);
  });
});

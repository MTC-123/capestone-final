import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatTimeAgo } from '@/lib/utils/time';

describe('formatTimeAgo', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeDate(secondsAgo: number): Date {
    return new Date(Date.now() - secondsAgo * 1000);
  }

  describe('seconds', () => {
    it('returns "0s ago" for the current time', () => {
      expect(formatTimeAgo(new Date())).toBe('0s ago');
    });

    it('returns "30s ago" for 30 seconds ago', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:00:30Z'));
      const date = new Date('2025-01-01T12:00:00Z');
      expect(formatTimeAgo(date)).toBe('30s ago');
    });

    it('returns "59s ago" for 59 seconds ago', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:00:59Z'));
      const date = new Date('2025-01-01T12:00:00Z');
      expect(formatTimeAgo(date)).toBe('59s ago');
    });
  });

  describe('minutes', () => {
    it('returns "1m ago" for exactly 60 seconds ago', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:01:00Z'));
      const date = new Date('2025-01-01T12:00:00Z');
      expect(formatTimeAgo(date)).toBe('1m ago');
    });

    it('returns "5m ago" for 5 minutes ago', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:05:00Z'));
      const date = new Date('2025-01-01T12:00:00Z');
      expect(formatTimeAgo(date)).toBe('5m ago');
    });

    it('returns "59m ago" for 59 minutes ago', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:59:00Z'));
      const date = new Date('2025-01-01T12:00:00Z');
      expect(formatTimeAgo(date)).toBe('59m ago');
    });

    it('floors partial minutes (90 seconds = 1m)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:01:30Z'));
      const date = new Date('2025-01-01T12:00:00Z');
      expect(formatTimeAgo(date)).toBe('1m ago');
    });
  });

  describe('hours', () => {
    it('returns "1h ago" for exactly 60 minutes ago', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T13:00:00Z'));
      const date = new Date('2025-01-01T12:00:00Z');
      expect(formatTimeAgo(date)).toBe('1h ago');
    });

    it('returns "23h ago" for 23 hours ago', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-02T11:00:00Z'));
      const date = new Date('2025-01-01T12:00:00Z');
      expect(formatTimeAgo(date)).toBe('23h ago');
    });

    it('floors partial hours (90 minutes = 1h)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T13:30:00Z'));
      const date = new Date('2025-01-01T12:00:00Z');
      expect(formatTimeAgo(date)).toBe('1h ago');
    });
  });

  describe('days', () => {
    it('returns "1d ago" for exactly 24 hours ago', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-02T12:00:00Z'));
      const date = new Date('2025-01-01T12:00:00Z');
      expect(formatTimeAgo(date)).toBe('1d ago');
    });

    it('returns "7d ago" for 7 days ago', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-08T12:00:00Z'));
      const date = new Date('2025-01-01T12:00:00Z');
      expect(formatTimeAgo(date)).toBe('7d ago');
    });

    it('returns "365d ago" for a year ago', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
      const date = new Date('2025-01-01T12:00:00Z');
      expect(formatTimeAgo(date)).toBe('365d ago');
    });
  });

  describe('edge cases', () => {
    it('handles boundary at exactly 0 seconds', () => {
      vi.useFakeTimers();
      const now = new Date('2025-01-01T12:00:00Z');
      vi.setSystemTime(now);
      expect(formatTimeAgo(now)).toBe('0s ago');
    });

    it('handles future dates (negative diff floors to 0 or negative)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      const futureDate = new Date('2025-01-01T12:00:10Z');
      // Math.floor of negative number: (now - future) / 1000 < 0
      // seconds = -10, which is < 60, so returns "-10s ago"
      const result = formatTimeAgo(futureDate);
      expect(result).toContain('s ago');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { computeIncidentPriority, getPriorityLabel } from '@/lib/risk/priorityScore';

describe('computeIncidentPriority', () => {
  it('returns 0 for a severity-1 incident with no wind and no heat', () => {
    const score = computeIncidentPriority(
      { severity: 1, status: 'VIGILANCE' },
      { temperature: 0, windSpeed: 0, humidity: 100 }
    );
    expect(score).toBe(0);
  });

  it('returns 50 for max severity with neutral weather', () => {
    const score = computeIncidentPriority(
      { severity: 5, status: 'ALERTE' },
      { temperature: 0, windSpeed: 0, humidity: 100 }
    );
    expect(score).toBe(50);
  });

  it('high severity + high wind + low humidity > 75', () => {
    const score = computeIncidentPriority(
      { severity: 5, status: 'ALERTE' },
      { temperature: 38, windSpeed: 45, humidity: 10 }
    );
    // severity=5 (50pts) + FWI(temp/wind/dry) (~28pts) = ~78
    expect(score).toBeGreaterThan(75);
  });

  it('returns same score regardless of status field', () => {
    const s1 = computeIncidentPriority({ severity: 3, status: 'VIGILANCE' }, null);
    const s2 = computeIncidentPriority({ severity: 3, status: 'ETEINT' }, null);
    expect(s1).toBe(s2);
  });

  it('handles null weather gracefully (no FWI component)', () => {
    const score = computeIncidentPriority({ severity: 3, status: 'ALERTE' }, null);
    // Should only get severity component: ((3-1)/4)*50 = 25
    expect(score).toBe(25);
  });

  it('caps at 100', () => {
    const score = computeIncidentPriority(
      { severity: 5, status: 'ALERTE' },
      { temperature: 100, windSpeed: 100, humidity: 0 }
    );
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('getPriorityLabel', () => {
  it('score >= 80 → critical', () => expect(getPriorityLabel(85)).toBe('critical'));
  it('score 60-79 → high', () => expect(getPriorityLabel(65)).toBe('high'));
  it('score 40-59 → medium', () => expect(getPriorityLabel(50)).toBe('medium'));
  it('score < 40 → low', () => expect(getPriorityLabel(20)).toBe('low'));
});

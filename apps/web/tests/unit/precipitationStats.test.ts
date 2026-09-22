import { describe, it, expect } from 'vitest';

/**
 * Helpers extracted from the precipitation API route logic
 * for unit testing stat computations.
 */

function computeDaysSinceRain(precipitation: number[]): number {
  let days = 0;
  for (let i = precipitation.length - 1; i >= 0; i--) {
    if (precipitation[i] > 0.1) break;
    days++;
  }
  return days;
}

function computeDeficitPercent(rainfall30d: number, monthlyNormal = 30): number {
  return Math.round(Math.max(0, (1 - rainfall30d / monthlyNormal) * 100));
}

function computeCumulative(precipitation: number[]): number[] {
  const cumulative: number[] = [];
  let total = 0;
  for (const val of precipitation) {
    total += val;
    cumulative.push(+total.toFixed(2));
  }
  return cumulative;
}

describe('precipitation stats', () => {
  describe('daysSinceRain', () => {
    it('returns 0 when last day had rain', () => {
      expect(computeDaysSinceRain([0, 0, 5.2])).toBe(0);
    });

    it('counts consecutive dry days from the end', () => {
      expect(computeDaysSinceRain([10, 0, 0, 0])).toBe(3);
    });

    it('ignores trace precipitation <= 0.1mm', () => {
      expect(computeDaysSinceRain([5, 0.1, 0.05, 0])).toBe(3);
    });

    it('returns full length when no rain at all', () => {
      const data = new Array(90).fill(0);
      expect(computeDaysSinceRain(data)).toBe(90);
    });

    it('handles single day', () => {
      expect(computeDaysSinceRain([3])).toBe(0);
      expect(computeDaysSinceRain([0])).toBe(1);
    });
  });

  describe('deficitPercent', () => {
    it('returns 0% when rainfall meets or exceeds normal', () => {
      expect(computeDeficitPercent(30)).toBe(0);
      expect(computeDeficitPercent(50)).toBe(0);
    });

    it('returns 100% when no rainfall', () => {
      expect(computeDeficitPercent(0)).toBe(100);
    });

    it('returns 50% when half normal', () => {
      expect(computeDeficitPercent(15)).toBe(50);
    });

    it('clamps to 0 for excess rainfall', () => {
      expect(computeDeficitPercent(100, 30)).toBe(0);
    });
  });

  describe('cumulative', () => {
    it('computes running total', () => {
      expect(computeCumulative([1, 2, 3])).toEqual([1, 3, 6]);
    });

    it('handles zeros', () => {
      expect(computeCumulative([5, 0, 0, 3])).toEqual([5, 5, 5, 8]);
    });

    it('handles empty array', () => {
      expect(computeCumulative([])).toEqual([]);
    });

    it('rounds to 2 decimal places', () => {
      const result = computeCumulative([0.1, 0.2, 0.3]);
      expect(result).toEqual([0.1, 0.3, 0.6]);
    });
  });
});

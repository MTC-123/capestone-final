import { describe, expect, it } from 'vitest';
import { coordKey, ringOffsets } from '@/lib/map/helpers';

const STATION: [number, number] = [-5.1112, 33.5232];
const ELSEWHERE: [number, number] = [-5.2198, 33.4352];

describe('ringOffsets', () => {
  it('leaves a lone marker on its true position', () => {
    expect(ringOffsets([ELSEWHERE], 22)).toEqual([[0, 0]]);
  });

  it('fans co-located markers onto a ring of the given radius, all distinct', () => {
    const offsets = ringOffsets([STATION, STATION, STATION, STATION, ELSEWHERE], 22);
    expect(offsets[4]).toEqual([0, 0]);
    const ring = offsets.slice(0, 4);
    for (const [x, y] of ring) expect(Math.round(Math.hypot(x, y))).toBe(22);
    expect(new Set(ring.map((o) => o.join(','))).size).toBe(4);
    expect(ring[0]).toEqual([0, -22]); // first marker straight up (startDeg -90)
  });

  it('moves a lone marker off a spot another layer occupies', () => {
    const [offset] = ringOffsets([STATION], 40, -45, new Set([coordKey(STATION)]));
    expect(Math.round(Math.hypot(...offset))).toBe(40);
  });

  it('widens the ring for large groups so neighbours do not overlap', () => {
    const offsets = ringOffsets(Array.from({ length: 10 }, () => STATION), 22);
    expect(Math.round(Math.hypot(...offsets[0]))).toBe(22 + 4 * 4);
  });
});

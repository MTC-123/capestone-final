import { describe, it, expect } from 'vitest';
import { circleIcon, hexToRgba, formatCoordinates } from '@/lib/map/helpers';

describe('circleIcon', () => {
  it('returns a data:image/svg+xml data URL', () => {
    const result = circleIcon('#ff0000');
    expect(result).toMatch(/^data:image\/svg\+xml/);
  });

  it('embeds provided color in SVG fill attribute', () => {
    const result = decodeURIComponent(circleIcon('#ef4444'));
    expect(result).toContain('fill="#ef4444"');
  });

  it('SVG has width="24" height="24" and r="10"', () => {
    const result = decodeURIComponent(circleIcon('#000'));
    expect(result).toContain('width="24"');
    expect(result).toContain('height="24"');
    expect(result).toContain('r="10"');
  });
});

describe('hexToRgba', () => {
  it('parses 6-char hex with # prefix', () => {
    expect(hexToRgba('#ef4444')).toEqual([239, 68, 68, 255]);
  });

  it('parses 6-char hex without # prefix', () => {
    expect(hexToRgba('ef4444')).toEqual([239, 68, 68, 255]);
  });

  it('returns fallback [100,100,100,255] for invalid hex', () => {
    expect(hexToRgba('notahex')).toEqual([100, 100, 100, 255]);
  });

  it('returns fallback for 3-char hex (known limitation)', () => {
    // The regex requires exactly 6 hex digits, so 3-char shorthand is not supported
    expect(hexToRgba('#f00')).toEqual([100, 100, 100, 255]);
  });

  it('respects custom alpha parameter', () => {
    expect(hexToRgba('#ef4444', 128)).toEqual([239, 68, 68, 128]);
  });

  it('uses default alpha=255', () => {
    const result = hexToRgba('#000000');
    expect(result[3]).toBe(255);
  });

  it('handles empty string with fallback', () => {
    expect(hexToRgba('')).toEqual([100, 100, 100, 255]);
  });
});

describe('formatCoordinates', () => {
  it('positive lat/lng returns N/E suffixes', () => {
    const result = formatCoordinates(33.5312, 5.1234);
    expect(result).toContain('N');
    expect(result).toContain('E');
    expect(result).not.toContain('S');
    expect(result).not.toContain('W');
  });

  it('negative lat/lng returns S/W suffixes', () => {
    const result = formatCoordinates(-33.5, -5.1);
    expect(result).toContain('S');
    expect(result).toContain('W');
  });

  it('zero values return N/E (not S/W)', () => {
    const result = formatCoordinates(0, 0);
    expect(result).toContain('N');
    expect(result).toContain('E');
    expect(result).not.toContain('S');
    expect(result).not.toContain('W');
  });

  it('rounds to 4 decimal places', () => {
    const result = formatCoordinates(33.123456789, 5.987654321);
    expect(result).toBe('33.1235\u00b0N, 5.9877\u00b0E');
  });
});

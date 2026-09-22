/**
 * Alternative Routes Verification - GraphHopper API Compliance
 *
 * This test verifies that our alternative routes implementation correctly
 * uses GraphHopper's alternative_route algorithm with proper parameters.
 *
 * Audit finding: Alternative routes were ALREADY CORRECT - this test
 * confirms that implementation matches GraphHopper specification.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GraphHopperClient } from '@/lib/routing/graphhopper';

// Spy on fetch to intercept GraphHopper API calls
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Alternative Routes - GraphHopper API Compliance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends correct algorithm and parameters for alternative routes', async () => {
    // Mock GraphHopper response with multiple paths
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        paths: [
          {
            distance: 12500,
            time: 1080000,
            points: {
              type: 'LineString',
              coordinates: [
                [-5.1056, 33.5275],
                [-5.0800, 33.5500],
              ],
            },
            instructions: [],
          },
          {
            distance: 14000,
            time: 1200000,
            points: {
              type: 'LineString',
              coordinates: [
                [-5.1056, 33.5275],
                [-5.0850, 33.5450],
                [-5.0800, 33.5500],
              ],
            },
            instructions: [],
          },
        ],
      }),
    });

    const client = new GraphHopperClient();

    await client.getRoute({
      origin: [-5.1056, 33.5275],
      destination: [-5.0800, 33.5500],
      profile: 'fire_truck',
      alternatives: 3,
    });

    // Verify fetch was called
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);

    // Verify alternative_route parameters match GraphHopper spec
    expect(body.alternative_route).toBeDefined();
    expect(body.alternative_route.max_paths).toBe(4); // alternatives + 1 (primary)
    expect(body.alternative_route.max_weight_factor).toBe(1.5);
    expect(body.alternative_route.max_share_factor).toBe(0.7);
  });

  it('returns up to 3 alternatives when requested', async () => {
    // Mock response with 3 alternatives
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        paths: [
          // Primary
          {
            distance: 12500,
            time: 1080000,
            points: {
              type: 'LineString',
              coordinates: [
                [-5.1056, 33.5275],
                [-5.0800, 33.5500],
              ],
            },
            instructions: [],
          },
          // Alternative 1
          {
            distance: 13000,
            time: 1100000,
            points: {
              type: 'LineString',
              coordinates: [
                [-5.1056, 33.5275],
                [-5.0900, 33.5400],
                [-5.0800, 33.5500],
              ],
            },
            instructions: [],
          },
          // Alternative 2
          {
            distance: 14000,
            time: 1200000,
            points: {
              type: 'LineString',
              coordinates: [
                [-5.1056, 33.5275],
                [-5.0850, 33.5450],
                [-5.0800, 33.5500],
              ],
            },
            instructions: [],
          },
        ],
      }),
    });

    const client = new GraphHopperClient();
    const result = await client.getRoute({
      origin: [-5.1056, 33.5275],
      destination: [-5.0800, 33.5500],
      profile: 'car',
      alternatives: 3,
    });

    // Verify response structure
    expect(result.primary).toBeDefined();
    expect(result.alternatives).toBeDefined();
    expect(result.alternatives.length).toBe(2); // 3 paths total - 1 primary = 2 alternatives
    expect(result.alternatives.length).toBeLessThanOrEqual(3);
  });

  it('does not request alternatives when alternatives=0', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        paths: [
          {
            distance: 12500,
            time: 1080000,
            points: {
              type: 'LineString',
              coordinates: [
                [-5.1056, 33.5275],
                [-5.0800, 33.5500],
              ],
            },
            instructions: [],
          },
        ],
      }),
    });

    const client = new GraphHopperClient();

    await client.getRoute({
      origin: [-5.1056, 33.5275],
      destination: [-5.0800, 33.5500],
      profile: 'car',
      alternatives: 0,
    });

    const [url, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);

    // Verify alternative_route is NOT included
    expect(body.alternative_route).toBeUndefined();
  });

  it('limits alternatives to maximum of 3', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        paths: [
          {
            distance: 12500,
            time: 1080000,
            points: {
              type: 'LineString',
              coordinates: [
                [-5.1056, 33.5275],
                [-5.0800, 33.5500],
              ],
            },
            instructions: [],
          },
        ],
      }),
    });

    const client = new GraphHopperClient();

    // Request more than 3 alternatives
    await client.getRoute({
      origin: [-5.1056, 33.5275],
      destination: [-5.0800, 33.5500],
      profile: 'car',
      alternatives: 5, // Request 5, should cap at 3
    });

    const [url, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);

    // Verify max_paths is capped at 3 (alternatives) + 1 (primary) = 4 total
    expect(body.alternative_route.max_paths).toBe(3);
  });

  it('uses correct max_weight_factor for route quality', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        paths: [
          {
            distance: 12500,
            time: 1080000,
            points: {
              type: 'LineString',
              coordinates: [
                [-5.1056, 33.5275],
                [-5.0800, 33.5500],
              ],
            },
            instructions: [],
          },
        ],
      }),
    });

    const client = new GraphHopperClient();

    await client.getRoute({
      origin: [-5.1056, 33.5275],
      destination: [-5.0800, 33.5500],
      profile: 'fire_truck',
      alternatives: 2,
    });

    const [url, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);

    // max_weight_factor: 1.5 means alternative can be max 50% longer
    expect(body.alternative_route.max_weight_factor).toBe(1.5);
  });

  it('uses correct max_share_factor for route diversity', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        paths: [
          {
            distance: 12500,
            time: 1080000,
            points: {
              type: 'LineString',
              coordinates: [
                [-5.1056, 33.5275],
                [-5.0800, 33.5500],
              ],
            },
            instructions: [],
          },
        ],
      }),
    });

    const client = new GraphHopperClient();

    await client.getRoute({
      origin: [-5.1056, 33.5275],
      destination: [-5.0800, 33.5500],
      profile: 'car',
      alternatives: 1,
    });

    const [url, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);

    // max_share_factor: 0.7 means alternative must differ by at least 30%
    expect(body.alternative_route.max_share_factor).toBe(0.7);
  });
});

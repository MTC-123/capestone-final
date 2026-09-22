import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GraphHopperClient } from '@/lib/routing/graphhopper';
import type { Coordinates } from '@/lib/routing/types';

// Mock fetch
global.fetch = vi.fn();

describe('GraphHopper Client', () => {
  let client: GraphHopperClient;

  beforeEach(() => {
    client = new GraphHopperClient({
      baseUrl: 'http://localhost:8989',
      timeout: 5000,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getRoute', () => {
    it('should calculate basic route successfully', async () => {
      const mockResponse = {
        paths: [
          {
            distance: 12500, // meters
            time: 1080000, // milliseconds
            points: {
              type: 'LineString',
              coordinates: [
                [-5.1056, 33.5275],
                [-5.1000, 33.5300],
                [-5.0800, 33.5500],
              ],
            },
            instructions: [
              { text: 'Start', distance: 0, time: 0, sign: 0 },
              { text: 'Turn left', distance: 500, time: 60000, sign: -2 },
            ],
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const origin: Coordinates = [-5.1056, 33.5275];
      const destination: Coordinates = [-5.0800, 33.5500];

      const result = await client.getRoute({
        origin,
        destination,
        profile: 'fire_truck',
      });

      expect(result.primary).toBeDefined();
      expect(result.primary.distance_km).toBeCloseTo(12.5);
      expect(result.primary.duration_min).toBeCloseTo(18);
      expect(result.primary.coordinates.length).toBe(3);
      expect(result.metadata.provider).toBe('graphhopper');
    });

    it('should handle route not found error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const origin: Coordinates = [-5.1056, 33.5275];
      const destination: Coordinates = [-5.0800, 33.5500];

      await expect(
        client.getRoute({ origin, destination, profile: 'car' })
      ).rejects.toThrow();
    });

    it('should handle timeout error', async () => {
      const timeoutClient = new GraphHopperClient({ timeout: 100 });

      (global.fetch as any).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ paths: [] }),
                }),
              200
            )
          )
      );

      const origin: Coordinates = [-5.1056, 33.5275];
      const destination: Coordinates = [-5.0800, 33.5500];

      await expect(
        timeoutClient.getRoute({ origin, destination, profile: 'car' })
      ).rejects.toThrow();
    });

    it('should validate coordinates', async () => {
      const invalidOrigin: Coordinates = [200, 100]; // Invalid lon/lat

      await expect(
        client.getRoute({
          origin: invalidOrigin,
          destination: [-5.0800, 33.5500],
          profile: 'car',
        })
      ).rejects.toThrow(/longitude/);
    });

    it('should handle service unavailable', async () => {
      (global.fetch as any).mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      );

      const origin: Coordinates = [-5.1056, 33.5275];
      const destination: Coordinates = [-5.0800, 33.5500];

      await expect(
        client.getRoute({ origin, destination, profile: 'car' })
      ).rejects.toThrow();
    });

    it('should map fire_truck profile to car', async () => {
      const mockResponse = {
        paths: [
          {
            distance: 10000,
            time: 600000,
            points: {
              type: 'LineString',
              coordinates: [
                [-5.1056, 33.5275],
                [-5.0800, 33.5500],
              ],
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await client.getRoute({
        origin: [-5.1056, 33.5275],
        destination: [-5.0800, 33.5500],
        profile: 'fire_truck',
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.profile).toBe('car');
    });

    it('should retry on network error', async () => {
      const retryClient = new GraphHopperClient({ retries: 2, timeout: 1000 });

      // First call fails, second succeeds
      (global.fetch as any)
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            paths: [
              {
                distance: 5000,
                time: 300000,
                points: {
                  type: 'LineString',
                  coordinates: [
                    [-5.1, 33.5],
                    [-5.0, 33.6],
                  ],
                },
              },
            ],
          }),
        });

      const result = await retryClient.getRoute({
        origin: [-5.1, 33.5],
        destination: [-5.0, 33.6],
        profile: 'car',
      });

      expect(result.primary).toBeDefined();
      expect((global.fetch as any).mock.calls.length).toBe(2);
    });

    it('should return empty alternatives for MVP', async () => {
      const mockResponse = {
        paths: [
          {
            distance: 10000,
            time: 600000,
            points: {
              type: 'LineString',
              coordinates: [
                [-5.1, 33.5],
                [-5.0, 33.6],
              ],
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getRoute({
        origin: [-5.1, 33.5],
        destination: [-5.0, 33.6],
        profile: 'car',
        alternatives: 0,
      });

      expect(result.alternatives).toHaveLength(0);
    });

    it('should throw RATE_LIMIT_EXCEEDED on 429 response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
      });

      const origin: Coordinates = [-5.1056, 33.5275];
      const destination: Coordinates = [-5.0800, 33.5500];

      try {
        await client.getRoute({ origin, destination, profile: 'car' });
        expect.unreachable('should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(Error);
        expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(error.message).toMatch(/rate limit/i);
        expect(error.provider).toBe('graphhopper');
      }
    });

    it('should return primary plus alternatives when multiple paths returned', async () => {
      const mockResponse = {
        paths: [
          {
            distance: 10000,
            time: 600000,
            points: {
              type: 'LineString',
              coordinates: [
                [-5.1, 33.5],
                [-5.05, 33.55],
                [-5.0, 33.6],
              ],
            },
          },
          {
            distance: 12000,
            time: 720000,
            points: {
              type: 'LineString',
              coordinates: [
                [-5.1, 33.5],
                [-5.06, 33.52],
                [-5.0, 33.6],
              ],
            },
          },
          {
            distance: 14000,
            time: 840000,
            points: {
              type: 'LineString',
              coordinates: [
                [-5.1, 33.5],
                [-5.03, 33.58],
                [-5.0, 33.6],
              ],
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getRoute({
        origin: [-5.1, 33.5],
        destination: [-5.0, 33.6],
        profile: 'car',
        alternatives: 2,
      });

      // Primary route
      expect(result.primary).toBeDefined();
      expect(result.primary.distance_km).toBeCloseTo(10);
      expect(result.primary.duration_min).toBeCloseTo(10);
      expect(result.primary.coordinates).toHaveLength(3);

      // Two alternatives
      expect(result.alternatives).toHaveLength(2);
      expect(result.alternatives[0].distance_km).toBeCloseTo(12);
      expect(result.alternatives[0].duration_min).toBeCloseTo(12);
      expect(result.alternatives[1].distance_km).toBeCloseTo(14);
      expect(result.alternatives[1].duration_min).toBeCloseTo(14);

      // Verify alternative_route was sent in the request body
      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.alternative_route).toBeDefined();
      expect(requestBody.alternative_route.max_paths).toBe(3);
    });

    it('should throw ROUTE_NOT_FOUND when paths array is empty', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ paths: [] }),
      });

      const origin: Coordinates = [-5.1056, 33.5275];
      const destination: Coordinates = [-5.0800, 33.5500];

      try {
        await client.getRoute({ origin, destination, profile: 'car' });
        expect.unreachable('should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(Error);
        expect(error.code).toBe('ROUTE_NOT_FOUND');
        expect(error.message).toMatch(/no route found/i);
        expect(error.provider).toBe('graphhopper');
      }
    });
  });

  describe('getIsochrone', () => {
    it('should return polygon features for each time bucket', async () => {
      const mockIsochroneResponse = {
        polygons: [
          {
            properties: { bucket: 0 },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-5.12, 33.50],
                  [-5.10, 33.54],
                  [-5.08, 33.50],
                  [-5.12, 33.50],
                ],
              ],
            },
          },
        ],
      };

      // Two time buckets means two fetch calls
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockIsochroneResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            polygons: [
              {
                properties: { bucket: 0 },
                geometry: {
                  type: 'Polygon',
                  coordinates: [
                    [
                      [-5.15, 33.48],
                      [-5.08, 33.56],
                      [-5.05, 33.48],
                      [-5.15, 33.48],
                    ],
                  ],
                },
              },
            ],
          }),
        });

      const result = await client.getIsochrone({
        origin: [-5.1056, 33.5275],
        profile: 'car',
        times: [5, 10],
      });

      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(2);
      expect(result.metadata.provider).toBe('graphhopper');
      expect(result.metadata.computed_at).toBeDefined();

      // First feature: 5-minute isochrone
      expect(result.features[0].type).toBe('Feature');
      expect(result.features[0].properties.time_minutes).toBe(5);
      expect(result.features[0].geometry.type).toBe('Polygon');
      expect(result.features[0].geometry.coordinates).toHaveLength(1);

      // Second feature: 10-minute isochrone
      expect(result.features[1].properties.time_minutes).toBe(10);
      expect(result.features[1].geometry.type).toBe('Polygon');

      // Verify fetch was called twice (once per time bucket)
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Verify URL params include correct time_limit (seconds)
      const firstCallUrl = (global.fetch as any).mock.calls[0][0];
      expect(firstCallUrl).toContain('time_limit=300'); // 5 * 60
      const secondCallUrl = (global.fetch as any).mock.calls[1][0];
      expect(secondCallUrl).toContain('time_limit=600'); // 10 * 60
    });
  });

  describe('coordinate validation', () => {
    it('should reject invalid longitude', async () => {
      await expect(
        client.getRoute({
          origin: [200, 33.5],
          destination: [-5.0, 33.6],
          profile: 'car',
        })
      ).rejects.toThrow(/longitude/);
    });

    it('should reject invalid latitude', async () => {
      await expect(
        client.getRoute({
          origin: [-5.1, 100],
          destination: [-5.0, 33.6],
          profile: 'car',
        })
      ).rejects.toThrow(/latitude/);
    });

    it('should reject non-array coordinates', async () => {
      await expect(
        client.getRoute({
          origin: 'invalid' as any,
          destination: [-5.0, 33.6],
          profile: 'car',
        })
      ).rejects.toThrow();
    });
  });
});

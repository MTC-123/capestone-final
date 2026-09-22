import { test, expect } from '@playwright/test';

/**
 * E2E: Vehicle Dispatch Flow
 * Uses route interception to mock API responses
 */

const MOCK_VEHICLES = [
  {
    id: 'v-e2e-1',
    callSign: 'FT-E2E-001',
    type: 'FIRE_TRUCK',
    status: 'AVAILABLE',
    capabilities: ['water_pump'],
    location: { type: 'Point', coordinates: [-5.1, 33.5] },
    baseLocation: { type: 'Point', coordinates: [-5.1, 33.5] },
    capacity: 5000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'v-e2e-2',
    callSign: 'WT-E2E-001',
    type: 'WATER_TANKER',
    status: 'AVAILABLE',
    capabilities: ['water_tank'],
    location: { type: 'Point', coordinates: [-5.12, 33.52] },
    baseLocation: { type: 'Point', coordinates: [-5.12, 33.52] },
    capacity: 10000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const MOCK_GEO_VEHICLES = {
  type: 'FeatureCollection',
  features: MOCK_VEHICLES.map((v) => ({
    type: 'Feature',
    geometry: v.location,
    properties: {
      id: v.id,
      callSign: v.callSign,
      type: v.type,
      status: v.status,
      assignedTo: undefined,
    },
  })),
};

test.describe('Vehicle Dispatch E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept vehicle API endpoints
    await page.route('**/api/vehicles**', async (route) => {
      const url = route.request().url();
      if (route.request().method() === 'GET') {
        if (url.includes('status=AVAILABLE')) {
          await route.fulfill({ status: 200, json: MOCK_VEHICLES.filter((v) => v.status === 'AVAILABLE') });
        } else {
          await route.fulfill({ status: 200, json: MOCK_VEHICLES });
        }
      } else {
        await route.fulfill({ status: 201, json: MOCK_VEHICLES[0] });
      }
    });

    await page.route('**/api/geo/vehicles', async (route) => {
      await route.fulfill({ status: 200, json: MOCK_GEO_VEHICLES });
    });

    await page.route('**/api/dispatch/assign', async (route) => {
      await route.fulfill({
        status: 201,
        json: {
          incidentId: 'inc-e2e',
          assignedTeams: [],
          assignedVehicles: [{
            dispatchId: 'd-e2e-v1',
            vehicleId: 'v-e2e-1',
            callSign: 'FT-E2E-001',
            eta: new Date(Date.now() + 8 * 60 * 1000).toISOString(),
            distance_km: 5,
            duration_min: 8,
            route: { type: 'LineString', coordinates: [[-5.1, 33.5], [-5.08, 33.55]] },
          }],
          totalTeams: 0,
          totalVehicles: 1,
        },
      });
    });

    await page.route('**/api/dispatch/route', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          primary: { coordinates: [[-5.1, 33.5], [-5.08, 33.55]], distance_km: 5, duration_min: 8, instructions: [] },
          alternatives: [],
          metadata: { provider: 'graphhopper', cached: false, computed_at: new Date().toISOString() },
        },
      });
    });

    // Intercept other needed APIs
    await page.route('**/api/geo/incidents', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.08, 33.55] },
            properties: { id: 'inc-e2e', cause: 'test', severity: 3, status: 'INTERVENTION', createdAt: new Date().toISOString() },
          }],
        },
      });
    });

    await page.route('**/api/realtime/token', async (route) => {
      await route.fulfill({ status: 501, json: { error: { code: 'REALTIME_NOT_CONFIGURED' } } });
    });
  });

  test('vehicles appear in geo endpoint response', async ({ page }) => {
    const res = await page.request.get('/api/geo/vehicles');
    // This is intercepted, so it should succeed
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.features).toHaveLength(2);
    expect(data.features[0].properties.callSign).toBe('FT-E2E-001');
  });

  test('vehicle list API returns available vehicles', async ({ page }) => {
    const res = await page.request.get('/api/vehicles?status=AVAILABLE');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data[0].callSign).toBe('FT-E2E-001');
  });

  test('dispatch assign endpoint accepts vehicleIds', async ({ page }) => {
    const res = await page.request.post('/api/dispatch/assign', {
      data: { incidentId: 'inc-e2e', vehicleIds: ['v-e2e-1'] },
    });
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.assignedVehicles).toHaveLength(1);
    expect(data.assignedVehicles[0].callSign).toBe('FT-E2E-001');
  });

  test('route card renders for vehicle routes in RouteViewer', async ({ page }) => {
    // Mock auth
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          userId: 'user-e2e',
          cin: 'E2E001',
          role: 'OFFICIAL',
          scopes: ['map:read', 'equipment:read'],
        },
      });
    });

    // Mock teams endpoint (empty — vehicle-only)
    await page.route('**/api/dispatch/teams**', async (route) => {
      if (route.request().url().includes('/nearest')) return route.continue();
      await route.fulfill({
        status: 200,
        json: { type: 'FeatureCollection', features: [] },
      });
    });

    await page.goto('/map');
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 10000 });

    // Open dispatch panel and inject vehicle selection + route via store
    await page.evaluate(() => {
      const store = (window as any).__DISPATCH_STORE__;
      if (!store) return;
      const state = store.getState();
      state.setSelectedIncidentId('inc-e2e');
      state.setIsPanelOpen(true);

      // Add vehicle to selection
      state.addVehicle({
        id: 'v-e2e-1',
        callSign: 'FT-E2E-001',
        type: 'FIRE_TRUCK',
        status: 'AVAILABLE',
        location: { type: 'Point', coordinates: [-5.1, 33.5] },
        capacity: 5000,
      });

      // Set active routes (simulate route generation)
      state.setActiveRoutes([
        {
          routeId: 'route-v-e2e-1',
          teamId: 'v-e2e-1',
          incidentId: 'inc-e2e',
          route: {
            primary: { coordinates: [[-5.1, 33.5], [-5.08, 33.55]], distance_km: 5, duration_min: 8, instructions: [] },
            alternatives: [],
            metadata: { provider: 'graphhopper', cached: false, computed_at: new Date().toISOString() },
          },
          selected: false,
        },
      ]);
    });

    // Verify route card shows vehicle callSign
    await expect(page.getByTestId('route-card').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('FT-E2E-001')).toBeVisible();
    await expect(page.getByText('5.0 km')).toBeVisible();
  });
});

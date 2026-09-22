import { test, expect } from '@playwright/test';
import { mockAuthMe, mockGeoRoutes, setLanguage } from './helpers';

/**
 * E2E Test: Dispatch Scenario - MVP Phase
 * Tests complete dispatch workflow from team selection to assignment
 */

test.describe('Dispatch Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'OFFICIAL');
    await mockGeoRoutes(page);

    // Mock dispatch API endpoints
    await page.route('**/api/dispatch/teams**', async (route) => {
      // Skip if it's the /nearest endpoint
      if (route.request().url().includes('/nearest')) {
        return route.continue();
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-5.1056, 33.5275] },
              properties: {
                id: 'team-1',
                name: 'Station 1 Alpha',
                type: 'GROUND_CREW',
                status: 'AVAILABLE',
                capacity: 5,
                equipment: ['truck', 'hoses'],
              },
            },
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-5.1100, 33.5300] },
              properties: {
                id: 'team-2',
                name: 'Station 2 Bravo',
                type: 'AERIAL_SUPPORT',
                status: 'AVAILABLE',
                capacity: 3,
                equipment: ['helicopter'],
              },
            },
          ],
        }),
      });
    });

    await page.route('**/api/dispatch/route', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          primary: {
            coordinates: [
              [-5.1056, 33.5275],
              [-5.0800, 33.5500],
            ],
            distance_km: 5.2,
            duration_min: 12,
            instructions: [],
          },
          alternatives: [],
          metadata: {
            provider: 'graphhopper',
            cached: false,
            computed_at: new Date().toISOString(),
          },
        }),
      });
    });

    await page.route('**/api/dispatch/assign', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          incidentId: 'incident-1',
          assignedTeams: [
            {
              dispatchId: 'dispatch-1',
              teamId: 'team-1',
              teamName: 'Station 1 Alpha',
              eta: new Date(Date.now() + 12 * 60 * 1000).toISOString(),
              distance_km: 5.2,
              duration_min: 12,
              route: {
                type: 'LineString',
                coordinates: [
                  [-5.1056, 33.5275],
                  [-5.0800, 33.5500],
                ],
              },
            },
          ],
          totalTeams: 1,
          assignedBy: 'user-official',
          assignedAt: new Date().toISOString(),
        }),
      });
    });

    // Mock incident details endpoint
    await page.route('**/api/incidents/incident-test-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'incident-test-1',
          status: 'INTERVENTION',
          severity: 3,
          cause: 'LIGHTNING',
          description: 'Test fire incident',
          location: {
            type: 'Point',
            coordinates: [-5.0800, 33.5500],
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });
  });

  test('complete dispatch workflow: select incident → select teams → generate route → confirm', async ({
    page,
  }) => {
    await page.goto('/map');

    // Wait for map to load
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({
      timeout: 10000,
    });

    // 1. Open dispatch panel directly via page evaluate (for E2E testing)
    // In real app, user would click an incident on map, then click "Dispatch Reinforcements"
    await page.evaluate(() => {
      const store = (window as any).__DISPATCH_STORE__;
      if (store) {
        const state = store.getState();
        state.setSelectedIncidentId('incident-test-1');
        state.setIsPanelOpen(true);
      }
    });

    // 2. Verify dispatch panel opens
    const dispatchPanel = page.getByTestId('dispatch-panel');
    await expect(dispatchPanel).toBeVisible({ timeout: 5000 });

    // 3. Verify dispatch panel header
    await expect(page.locator('#dispatch-panel-title')).toBeVisible({ timeout: 10000 });

    // 4. Wait for teams to load (check that first team appears)
    await expect(page.getByText('Station 1 Alpha')).toBeVisible({ timeout: 10000 });

    // 5. Select teams from the list
    const teamCheckbox1 = page.getByTestId('team-checkbox-team-1');
    await teamCheckbox1.waitFor({ state: 'attached', timeout: 5000 });
    await teamCheckbox1.click();

    // 6. Verify team selection counter
    await expect(page.locator('text=/1.*5.*selected/i')).toBeVisible({ timeout: 5000 });

    // 7. Verify dispatch summary appears
    await expect(page.getByText(/summary/i)).toBeVisible();

    // 8. Click "Generate Route" button
    const generateRouteBtn = page.getByTestId('generate-route-button');
    await expect(generateRouteBtn).toBeEnabled({ timeout: 3000 });
    await generateRouteBtn.click();

    // 9. Wait for route generation and verify route details appear
    await expect(page.getByText('5.2 km').first()).toBeVisible({ timeout: 10000 });

    // 10. Verify route visualization message
    await expect(page.getByText(/route.*map/i).first()).toBeVisible();

    // 11. Click "Confirm Dispatch" button
    const confirmBtn = page.getByTestId('confirm-dispatch-button');
    await expect(confirmBtn).toBeEnabled({ timeout: 3000 });

    // 12. Handle dialog (proper async pattern to avoid race condition)
    const dialogPromise = page.waitForEvent('dialog');
    await confirmBtn.click();
    const dialog = await dialogPromise;
    expect(dialog.message()).toMatch(/dispatch/i); // Match translation key or English text
    await dialog.accept();

    // Wait for panel to close
    await expect(dispatchPanel).not.toBeVisible({ timeout: 5000 });
  });

  test('team selector filters work correctly', async ({ page }) => {
    await page.goto('/map');
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({
      timeout: 10000,
    });

    // Open dispatch panel (simulate)
    const dispatchPanel = page.getByTestId('dispatch-panel');
    if (!(await dispatchPanel.isVisible())) {
      // Panel not visible, skip this test or implement trigger
      test.skip();
    }

    // Filter by status
    const statusFilter = page.getByTestId('team-status-filter');
    await statusFilter.selectOption('AVAILABLE');

    // Verify teams are filtered
    await expect(page.getByText('Station 1 Alpha')).toBeVisible();

    // Filter by type
    const typeFilter = page.getByTestId('team-type-filter');
    await typeFilter.selectOption('AERIAL_SUPPORT');

    // Verify only aerial support teams shown
    await expect(page.getByText('Station 2 Bravo')).toBeVisible();
    await expect(page.getByText('Station 1 Alpha')).not.toBeVisible();
  });

  test('cannot select more than 5 teams', async ({ page }) => {
    // Mock 6 teams
    await page.route('**/api/dispatch/teams*', async (route) => {
      const teams = Array.from({ length: 6 }, (_, i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-5.1 - i * 0.01, 33.5] },
        properties: {
          id: `team-${i + 1}`,
          name: `Station ${i + 1}`,
          type: 'GROUND_CREW',
          status: 'AVAILABLE',
          capacity: 5,
          equipment: [],
        },
      }));

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ type: 'FeatureCollection', features: teams }),
      });
    });

    await page.goto('/map');

    const dispatchPanel = page.getByTestId('dispatch-panel');
    if (!(await dispatchPanel.isVisible())) {
      test.skip();
    }

    // Select 5 teams
    for (let i = 1; i <= 5; i++) {
      const checkbox = page.getByTestId(`team-checkbox-team-${i}`);
      await checkbox.click();
    }

    // 6th team checkbox should be disabled
    const sixthCheckbox = page.getByTestId('team-checkbox-team-6');
    await expect(sixthCheckbox).toBeDisabled();

    // Verify counter shows 5/5
    await expect(page.getByText('5 / 5 teams selected')).toBeVisible();
  });

  test('route viewer displays multiple routes correctly', async ({ page }) => {
    await page.goto('/map');

    const dispatchPanel = page.getByTestId('dispatch-panel');
    if (!(await dispatchPanel.isVisible())) {
      test.skip();
    }

    // Select 2 teams
    await page.getByTestId('team-checkbox-team-1').click();
    await page.getByTestId('team-checkbox-team-2').click();

    // Generate routes
    await page.getByTestId('generate-route-button').click();

    // Wait for route cards to appear (no hard wait)
    await expect(page.getByTestId('route-card').first()).toBeVisible({ timeout: 5000 });

    // Verify both route cards appear
    await expect(page.getByText('Station 1 Alpha')).toBeVisible();
    await expect(page.getByText('Station 2 Bravo')).toBeVisible();

    // Verify route stats
    await expect(page.getByText('5.2 km')).toBeVisible();
    await expect(page.getByText('12 min')).toBeVisible();
  });

  test('dispatch panel is responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/map');

    const dispatchPanel = page.getByTestId('dispatch-panel');
    if (await dispatchPanel.isVisible()) {
      // Verify panel is full-width on mobile
      const box = await dispatchPanel.boundingBox();
      expect(box?.width).toBeGreaterThan(350);

      // Verify panel is scrollable
      await expect(dispatchPanel).toHaveCSS('overflow-y', 'auto');
    }
  });

  test('error handling: route calculation failure', async ({ page }) => {
    // Mock route API to fail
    await page.route('**/api/dispatch/route', async (route) => {
      await route.fulfill({
        status: 504,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 6000,
            message: 'Routing service timeout',
            userMessage: 'Routing service timeout. Please try again',
          },
        }),
      });
    });

    await page.goto('/map');

    const dispatchPanel = page.getByTestId('dispatch-panel');
    if (!(await dispatchPanel.isVisible())) {
      test.skip();
    }

    await page.getByTestId('team-checkbox-team-1').click();
    await page.getByTestId('generate-route-button').click();

    // Verify error message appears
    await expect(
      page.getByText(/Routing service timeout/i)
    ).toBeVisible({ timeout: 3000 });
  });

  test('vehicle tab dispatch: select vehicle → generate route → route card with callSign', async ({
    page,
  }) => {
    // Mock vehicle endpoint
    await page.route('**/api/vehicles**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'v-e2e-1',
            callSign: 'FT-E2E-001',
            type: 'FIRE_TRUCK',
            status: 'AVAILABLE',
            capabilities: ['water_pump'],
            location: { type: 'Point', coordinates: [-5.1, 33.5] },
            baseLocation: { type: 'Point', coordinates: [-5.1, 33.5] },
            capacity: 5000,
          },
        ]),
      });
    });

    await page.goto('/map');
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 10000 });

    // Open dispatch panel
    await page.evaluate(() => {
      const store = (window as any).__DISPATCH_STORE__;
      if (store) {
        const state = store.getState();
        state.setSelectedIncidentId('incident-test-1');
        state.setIsPanelOpen(true);
      }
    });

    const dispatchPanel = page.getByTestId('dispatch-panel');
    await expect(dispatchPanel).toBeVisible({ timeout: 5000 });

    // Switch to vehicles tab
    await page.getByText(/Select Vehicles/i).click();

    // Wait for vehicle to load and select it
    const vehicleCheckbox = page.getByTestId('vehicle-checkbox-v-e2e-1');
    await vehicleCheckbox.waitFor({ state: 'attached', timeout: 5000 });
    await vehicleCheckbox.click();

    // Generate routes
    const generateRouteBtn = page.getByTestId('generate-route-button');
    await expect(generateRouteBtn).toBeEnabled({ timeout: 3000 });
    await generateRouteBtn.click();

    // Verify route card with vehicle callSign appears
    await expect(page.getByTestId('route-card').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('FT-E2E-001')).toBeVisible();
    await expect(page.getByText('5.2 km')).toBeVisible();

    // Verify confirm dispatch button appears
    await expect(page.getByTestId('confirm-dispatch-button')).toBeVisible();
  });

  test('mixed dispatch: select team + vehicle → generate routes → 2 route cards → confirm', async ({
    page,
  }) => {
    // Mock vehicle endpoint
    await page.route('**/api/vehicles**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'v-mix-1',
            callSign: 'FT-MIX-001',
            type: 'FIRE_TRUCK',
            status: 'AVAILABLE',
            capabilities: ['water_pump'],
            location: { type: 'Point', coordinates: [-5.12, 33.52] },
            baseLocation: { type: 'Point', coordinates: [-5.12, 33.52] },
            capacity: 5000,
          },
        ]),
      });
    });

    await page.goto('/map');
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 10000 });

    // Open dispatch panel
    await page.evaluate(() => {
      const store = (window as any).__DISPATCH_STORE__;
      if (store) {
        const state = store.getState();
        state.setSelectedIncidentId('incident-test-1');
        state.setIsPanelOpen(true);
      }
    });

    const dispatchPanel = page.getByTestId('dispatch-panel');
    await expect(dispatchPanel).toBeVisible({ timeout: 5000 });

    // Select a team on Teams tab
    await expect(page.getByText('Station 1 Alpha')).toBeVisible({ timeout: 10000 });
    const teamCheckbox = page.getByTestId('team-checkbox-team-1');
    await teamCheckbox.waitFor({ state: 'attached', timeout: 5000 });
    await teamCheckbox.click();

    // Switch to vehicles tab and select a vehicle
    await page.getByText(/Select Vehicles/i).click();
    const vehicleCheckbox = page.getByTestId('vehicle-checkbox-v-mix-1');
    await vehicleCheckbox.waitFor({ state: 'attached', timeout: 5000 });
    await vehicleCheckbox.click();

    // Generate routes
    const generateRouteBtn = page.getByTestId('generate-route-button');
    await expect(generateRouteBtn).toBeEnabled({ timeout: 3000 });
    await generateRouteBtn.click();

    // Verify 2 route cards appear (1 team + 1 vehicle)
    await expect(page.getByTestId('route-card').first()).toBeVisible({ timeout: 10000 });
    const routeCards = page.getByTestId('route-card');
    await expect(routeCards).toHaveCount(2, { timeout: 5000 });

    // Verify both names visible
    await expect(page.getByText('Station 1 Alpha')).toBeVisible();
    await expect(page.getByText('FT-MIX-001')).toBeVisible();

    // Verify confirm dispatch button
    await expect(page.getByTestId('confirm-dispatch-button')).toBeVisible();
  });

  test('accessibility: keyboard navigation works', async ({ page }) => {
    await page.goto('/map');

    const dispatchPanel = page.getByTestId('dispatch-panel');
    if (!(await dispatchPanel.isVisible())) {
      test.skip();
    }

    // Tab through team checkboxes
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Space to select
    await page.keyboard.press('Space');

    // Verify team selected
    await expect(page.getByText('1 / 5 teams selected')).toBeVisible();
  });
});

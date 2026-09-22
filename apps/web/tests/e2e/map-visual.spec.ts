/**
 * Map Visual Regression Tests
 *
 * Uses Playwright's built-in toHaveScreenshot() for automated CI comparison.
 * Runs only in chromium to avoid cross-browser antialiasing diffs.
 *
 * Tiles are mocked (blank PNGs), so tests verify UI chrome, markers,
 * popups, and layout — not tile content.
 *
 * First run: npx playwright test map-visual.spec.ts --update-snapshots
 */
import { test, expect } from '@playwright/test';
import { mockAuthMe, mockGeoRoutes, mockWeather, mockNotifications, mockTokenRefresh, setLanguage } from './helpers';

// Only run in chromium to avoid cross-browser antialiasing diffs
test.skip(({ browserName }) => browserName !== 'chromium', 'Visual tests only run in Chromium');

async function setupMapMocks(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('theme', 'dark');
    document.documentElement.classList.add('dark');
  });
  await setLanguage(page, 'en');
  await mockAuthMe(page, 'OFFICIAL');
  await mockGeoRoutes(page);
  await mockWeather(page);
  await mockNotifications(page);
  await mockTokenRefresh(page);

  // Mock all remaining fetch endpoints
  await page.route('**/api/detections/combined', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-5.108, 33.530] },
            properties: { confidence: 'high', source: 'VIIRS', brightness: 340, acq_date: '2026-03-12' },
          },
        ],
      }),
    });
  });

  await page.route('**/api/geo/vehicles', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: [] }) });
  });

  await page.route('**/api/retardant', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });

  await page.route('**/api/effis/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: [] }) });
  });

  await page.route('**/api/weather/wind', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: [] }) });
  });

  await page.route('**/api/weather/soil-moisture', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: [] }) });
  });

  await page.route('**/api/ndvi/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ date: '2026-03-01' }) });
  });

  // Mock all WMS tile endpoints with blank PNG
  const blankPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
    'base64',
  );
  await page.route('**/api/effis/tiles**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: blankPng });
  });
  await page.route('**/api/cams/tiles**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: blankPng });
  });
  await page.route('**/api/population/tiles**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: blankPng });
  });
  await page.route('**/gibs.earthdata.nasa.gov/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: blankPng });
  });
  await page.route('**/storage.googleapis.com/global-surface-water/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: blankPng });
  });
}

test.describe('Map Visual Regression', () => {
  test('default map view after idle', async ({ page }) => {
    await setupMapMocks(page);
    await page.goto('/map');
    await expect(page.locator('[data-ricer-map-ready="true"]')).toBeVisible({ timeout: 30_000 });
    // Wait for tiles to load and map to settle
    await page.waitForTimeout(4000);

    await expect(page).toHaveScreenshot('map-default-view.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.3,
    });
  });

  test('map with legend expanded', async ({ page }) => {
    await setupMapMocks(page);
    await page.goto('/map');
    await expect(page.locator('[data-ricer-map-ready="true"]')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(3000);

    // Expand the legend if it has a toggle button
    const legendToggle = page.locator('[data-testid="legend-toggle"], [aria-label*="legend" i]').first();
    if (await legendToggle.isVisible()) {
      await legendToggle.click();
      await page.waitForTimeout(500);
    }

    await expect(page).toHaveScreenshot('map-legend-expanded.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.3,
    });
  });

  test('error state banner when incident fetch fails', async ({ page }) => {
    await setupMapMocks(page);

    // Override incidents to return error
    await page.route('**/api/geo/incidents', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.goto('/map');
    await expect(page.locator('[data-ricer-map-ready="true"]')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(3000);

    await expect(page).toHaveScreenshot('map-error-state.png', {
      maxDiffPixelRatio: 0.03,
      threshold: 0.3,
    });
  });

  test('map UI chrome layout is stable', async ({ page }) => {
    await setupMapMocks(page);
    await page.goto('/map');
    await expect(page.locator('[data-ricer-map-ready="true"]')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(3000);

    // Capture just the controls area (top-right corner)
    const controlsArea = page.locator('.maplibregl-ctrl-top-right');
    if (await controlsArea.isVisible()) {
      await expect(controlsArea).toHaveScreenshot('map-controls-area.png', {
        maxDiffPixelRatio: 0.02,
        threshold: 0.3,
      });
    }
  });

  test('mobile map dock layout is stable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMapMocks(page);
    await page.goto('/map');
    await expect(page.locator('[data-ricer-map-ready="true"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('map-mobile-dock')).toBeVisible();
    await page.waitForTimeout(3000);

    await expect(page).toHaveScreenshot('map-mobile-default.png', {
      maxDiffPixelRatio: 0.03,
      threshold: 0.3,
    });
  });

  test('mobile layers sheet layout is stable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMapMocks(page);
    await page.goto('/map');
    await expect(page.getByTestId('map-mobile-dock')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /layers/i }).click();
    await expect(page.getByTestId('map-layers-panel')).toBeVisible();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('map-mobile-layers-sheet.png', {
      maxDiffPixelRatio: 0.03,
      threshold: 0.3,
    });
  });

  test('mobile incident sheet layout is stable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMapMocks(page);
    await page.goto('/map?selected=inc-1');
    await expect(page.getByRole('dialog', { name: /incident details/i })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('map-mobile-incident-sheet.png', {
      maxDiffPixelRatio: 0.03,
      threshold: 0.3,
    });
  });
});

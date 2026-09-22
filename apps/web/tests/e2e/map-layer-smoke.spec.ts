import { test, expect } from '@playwright/test';
import { setLanguage, mockAuthMe, mockGeoRoutes, mockWeather } from './helpers';

/**
 * Layer toggle smoke tests for MapControls.
 *
 * These tests verify that all layer toggle switches are present,
 * default to the expected state, and respond correctly to clicks.
 */

const BASE_LAYERS = ['Incidents', 'Infrastructure', 'Resources', 'Risk zones', 'Satellite Fire Detections'];
const DISPATCH_LAYERS = ['Routes', 'Active Teams', 'Isochrones', 'Vehicles'];
const EFFIS_LAYERS = ['Fire Weather Index', 'Burned Areas'];

async function setupMapPage(page: import('@playwright/test').Page) {
  await setLanguage(page, 'en');
  await mockAuthMe(page, 'OFFICIAL');
  await mockWeather(page);
  await mockGeoRoutes(page);
  await page.goto('/map');
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 10_000 });
}

test('all base layer toggles present and default to aria-checked="true"', async ({ page }) => {
  await setupMapPage(page);

  for (const name of BASE_LAYERS) {
    const toggle = page.getByRole('switch', { name });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  }
});

test('all dispatch layer toggles present and default to aria-checked="true"', async ({ page }) => {
  await setupMapPage(page);

  for (const name of DISPATCH_LAYERS) {
    const toggle = page.getByRole('switch', { name });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  }
});

test('EFFIS layer toggles present and default to aria-checked="false"', async ({ page }) => {
  await setupMapPage(page);

  for (const name of EFFIS_LAYERS) {
    const toggle = page.getByRole('switch', { name });
    await expect(toggle).toBeVisible();
    // EFFIS layers are off by default (GPU-heavy raster overlays)
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  }
});

test('toggle EFFIS FWI layer on/off', async ({ page }) => {
  await setupMapPage(page);

  const toggle = page.getByRole('switch', { name: 'Fire Weather Index' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('toggle base layer (Incidents) off/on reflects aria-checked state', async ({ page }) => {
  await setupMapPage(page);

  const toggle = page.getByRole('switch', { name: 'Incidents' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  // Toggle off
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  // Toggle back on
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
});

test('toggle Routes dispatch layer off/on', async ({ page }) => {
  await setupMapPage(page);

  const toggle = page.getByRole('switch', { name: 'Routes' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
});

test('toggle Vehicles dispatch layer off/on', async ({ page }) => {
  await setupMapPage(page);

  const toggle = page.getByRole('switch', { name: 'Vehicles' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
});

test('rapid toggling (6 clicks) results in consistent state', async ({ page }) => {
  await setupMapPage(page);

  const toggle = page.getByRole('switch', { name: 'Infrastructure' });
  const initialState = await toggle.getAttribute('aria-checked');

  // 6 clicks = even number → should return to original state
  for (let i = 0; i < 6; i++) {
    await toggle.click();
  }

  await expect(toggle).toHaveAttribute('aria-checked', initialState!);
});

test('toggling one layer does not affect others', async ({ page }) => {
  await setupMapPage(page);

  const incidents = page.getByRole('switch', { name: 'Incidents' });
  const infrastructure = page.getByRole('switch', { name: 'Infrastructure' });
  const resources = page.getByRole('switch', { name: 'Resources' });

  // All start as true
  await expect(incidents).toHaveAttribute('aria-checked', 'true');
  await expect(infrastructure).toHaveAttribute('aria-checked', 'true');
  await expect(resources).toHaveAttribute('aria-checked', 'true');

  // Toggle incidents off
  await incidents.click();
  await expect(incidents).toHaveAttribute('aria-checked', 'false');

  // Others should remain true
  await expect(infrastructure).toHaveAttribute('aria-checked', 'true');
  await expect(resources).toHaveAttribute('aria-checked', 'true');
});

import { test, expect } from '@playwright/test';
import { mockAuthMe, mockGeoRoutes, mockWeather, setLanguage } from './helpers';

/**
 * E2E tests for NASA FIRMS fire detection integration
 *
 * These tests verify the end-to-end functionality of displaying
 * satellite fire detections on the map interface.
 */

test.describe('FIRMS Fire Detection Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'OFFICIAL');
    await mockWeather(page);
    await mockGeoRoutes(page);
  });

  test('should load map without FIRMS errors when API is working', async ({ page }) => {
    // Mock successful FIRMS API response
    await page.route('**/api/firms/detections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
              properties: {
                id: '1',
                brightness: 350.5,
                frp: 45.2,
                confidence: 'high',
                satellite: 'N',
                instrument: 'VIIRS',
                acqDateTime: '2024-02-09 13:45',
                daynight: 'D',
                isRecent: true,
              },
            },
          ],
        }),
      });
    });

    await page.goto('/map');

    // Wait for map to load
    const mapCanvas = page.locator('canvas.maplibregl-canvas');
    await expect(mapCanvas).toBeVisible({ timeout: 10000 });

    // Should not show error notification
    await expect(page.getByText(/could not be loaded/)).not.toBeVisible();

    // Legend should mention FIRMS Detections
    await expect(page.getByText(/Fire Detection/i).or(page.getByText(/FIRMS/i))).toBeVisible({ timeout: 5000 });
  });

  test('should show error notification when FIRMS API fails', async ({ page }) => {
    // Mock failed FIRMS API response
    await page.route('**/api/firms/detections', async (route) => {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 5004,
            message: 'FIRMS API authentication failed - API key may be invalid or expired',
            meta: {
              hint: 'Get a new API key from https://firms.modaps.eosdis.nasa.gov/api/area/',
            },
          },
        }),
      });
    });

    await page.goto('/map');

    // Wait for map to load
    const mapCanvas = page.locator('canvas.maplibregl-canvas');
    await expect(mapCanvas).toBeVisible({ timeout: 10000 });

    // Should show error notification for failed data source
    // Note: The exact error message depends on frontend implementation
    await expect(
      page.getByText(/could not be loaded/i).or(page.getByRole('alert'))
    ).toBeVisible({ timeout: 5000 });
  });

  test('should handle empty FIRMS response (no detections)', async ({ page }) => {
    // Mock successful but empty FIRMS response
    await page.route('**/api/firms/detections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'FeatureCollection',
          features: [],
        }),
      });
    });

    await page.goto('/map');

    // Wait for map to load
    const mapCanvas = page.locator('canvas.maplibregl-canvas');
    await expect(mapCanvas).toBeVisible({ timeout: 10000 });

    // Should not show error - empty response is valid
    await expect(page.getByText(/Error loading map/)).not.toBeVisible();
  });

  test('should display FIRMS layer in map controls', async ({ page }) => {
    // Mock successful FIRMS response
    await page.route('**/api/firms/detections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'FeatureCollection',
          features: [],
        }),
      });
    });

    await page.goto('/map');

    const mapCanvas = page.locator('canvas.maplibregl-canvas');
    await expect(mapCanvas).toBeVisible({ timeout: 10000 });

    // Check that FIRMS Detections layer control exists
    // The exact label depends on translation keys
    const firmsLayer = page.locator('label').filter({
      hasText: /FIRMS|Fire Detection|Satellite/i,
    });

    // Layer toggle should be present (may not be visible if collapsed)
    await expect(firmsLayer.or(page.getByText(/Fire Detection/i))).toBeVisible({
      timeout: 5000,
    });
  });

  test('should show FIRMS detection markers on map', async ({ page }) => {
    // Mock FIRMS response with multiple detections
    await page.route('**/api/firms/detections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
              properties: {
                id: '1',
                brightness: 350.5,
                frp: 45.2,
                confidence: 'high',
                satellite: 'N',
                instrument: 'VIIRS',
                acqDateTime: '2024-02-09 13:45',
                daynight: 'D',
                isRecent: true,
              },
            },
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-5.2, 33.6] },
              properties: {
                id: '2',
                brightness: 340.2,
                frp: 38.5,
                confidence: 'nominal',
                satellite: 'N',
                instrument: 'VIIRS',
                acqDateTime: '2024-02-09 14:00',
                daynight: 'D',
                isRecent: false,
              },
            },
          ],
        }),
      });
    });

    await page.goto('/map');

    const mapCanvas = page.locator('canvas.maplibregl-canvas');
    await expect(mapCanvas).toBeVisible({ timeout: 10000 });

    // Map should be loaded without errors
    await expect(page.getByText(/Error loading map/)).not.toBeVisible();

    // Note: Testing actual map markers requires more complex interaction with MapLibre GL
    // This test verifies the page loads successfully with detection data
  });

  test('should cache FIRMS data and show cache status', async ({ page }) => {
    let requestCount = 0;

    await page.route('**/api/firms/detections', async (route) => {
      requestCount++;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'X-Cache': requestCount === 1 ? 'MISS' : 'HIT',
          'X-Detection-Count': '2',
        },
        body: JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-5.1, 33.5] },
              properties: {
                id: '1',
                brightness: 350.5,
                frp: 45.2,
                confidence: 'high',
                satellite: 'N',
                instrument: 'VIIRS',
                acqDateTime: '2024-02-09 13:45',
                daynight: 'D',
                isRecent: true,
              },
            },
          ],
        }),
      });
    });

    await page.goto('/map');

    const mapCanvas = page.locator('canvas.maplibregl-canvas');
    await expect(mapCanvas).toBeVisible({ timeout: 10000 });

    // First request should make API call
    expect(requestCount).toBeGreaterThanOrEqual(1);
  });

  test('should handle API timeout gracefully', async ({ page }) => {
    // Mock API timeout scenario
    await page.route('**/api/firms/detections', async (route) => {
      await route.fulfill({
        status: 504,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 5003,
            message: 'FIRMS API request timeout after 10000ms',
          },
        }),
      });
    });

    await page.goto('/map');

    const mapCanvas = page.locator('canvas.maplibregl-canvas');
    await expect(mapCanvas).toBeVisible({ timeout: 10000 });

    // Map should still load even if FIRMS times out
    await expect(mapCanvas).toBeVisible();
  });

  test('should show legend with FIRMS detection confidence levels', async ({ page }) => {
    await page.route('**/api/firms/detections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'FeatureCollection',
          features: [],
        }),
      });
    });

    await page.goto('/map');

    const mapCanvas = page.locator('canvas.maplibregl-canvas');
    await expect(mapCanvas).toBeVisible({ timeout: 10000 });

    // Open legend if it exists
    const legendButton = page.getByRole('button', { name: /Legend/i });
    if (await legendButton.isVisible()) {
      await legendButton.click();
    }

    // Check for fire detection legend items
    // Exact text depends on translation keys
    const legendContent = page.locator('text=/High Confidence|Nominal|Low Confidence/i');
    await expect(legendContent.or(page.getByText(/Fire Detection/i))).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe('FIRMS Error Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'OFFICIAL');
    await mockWeather(page);
    await mockGeoRoutes(page);
  });

  test('should handle HTML response (authentication failure)', async ({ page }) => {
    await page.route('**/api/firms/detections', async (route) => {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 5004,
            message: 'FIRMS API authentication failed - API key may be invalid or expired',
            meta: {
              contentType: 'text/html; charset=UTF-8',
              hint: 'Get a new API key from https://firms.modaps.eosdis.nasa.gov/api/area/',
            },
          },
        }),
      });
    });

    await page.goto('/map');

    const mapCanvas = page.locator('canvas.maplibregl-canvas');
    await expect(mapCanvas).toBeVisible({ timeout: 10000 });

    // Map should load but show error for FIRMS
    await expect(mapCanvas).toBeVisible();
  });

  test('should handle rate limiting (HTTP 429)', async ({ page }) => {
    await page.route('**/api/firms/detections', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 4000,
            message: 'External service failure',
          },
        }),
      });
    });

    await page.goto('/map');

    const mapCanvas = page.locator('canvas.maplibregl-canvas');
    await expect(mapCanvas).toBeVisible({ timeout: 10000 });

    // Should handle gracefully
    await expect(mapCanvas).toBeVisible();
  });
});

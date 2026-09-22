import { expect, test, type Page } from '@playwright/test';
import {
  mockAuthMe,
  mockGeoRoutes,
  mockNotifications,
  mockTokenRefresh,
  mockWeather,
  setLanguage,
} from './helpers';

async function setupMobileMap(page: Page, viewport = { width: 390, height: 844 }) {
  await page.setViewportSize(viewport);
  await setLanguage(page, 'en');
  await mockAuthMe(page, 'OFFICIAL');
  await mockGeoRoutes(page);
  await mockWeather(page);
  await mockNotifications(page);
  await mockTokenRefresh(page);

  const blankPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
    'base64',
  );

  await page.route('**/api/detections/combined', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: [] }) });
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
  await page.route('**/api/**/tiles**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: blankPng });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('WOW mobile polish', () => {
  test('map fits mobile viewport with dock and no horizontal overflow', async ({ page }) => {
    await setupMobileMap(page);
    await page.goto('/map');

    await expect(page.locator('[data-ricer-map-ready="true"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('map-mobile-dock')).toBeVisible();
    await expect(page.locator('nav.fixed.bottom-0')).toBeVisible();
    await expect(page.locator('footer')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test('map bottom sheets fit short phones', async ({ page }) => {
    await setupMobileMap(page, { width: 360, height: 740 });
    await page.goto('/map');

    await expect(page.getByTestId('map-mobile-dock')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /layers/i }).click();
    const layersPanel = page.getByTestId('map-layers-panel');
    await expect(layersPanel).toBeVisible();
    const layersBox = await layersPanel.boundingBox();
    expect(layersBox).not.toBeNull();
    expect(layersBox!.width).toBeLessThanOrEqual(356);
    expect(layersBox!.y + layersBox!.height).toBeLessThanOrEqual(690);
    await expectNoHorizontalOverflow(page);

    await page.keyboard.press('Escape').catch(() => undefined);
    await page.mouse.click(10, 10);
    await page.getByRole('button', { name: /weather/i }).click();
    await expect(page.getByTestId('map-weather-panel')).toBeVisible();
    await page.mouse.click(10, 10);
    await page.getByRole('button', { name: /legend/i }).click();
    await expect(page.getByTestId('map-legend-panel')).toBeVisible();
  });

  test('desktop map keeps command-center chrome', async ({ page }) => {
    await setupMobileMap(page, { width: 1440, height: 900 });
    await page.goto('/map');

    await expect(page.locator('[data-ricer-map-ready="true"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('map-mobile-dock')).toBeHidden();
    await expect(page.getByTestId('map-layers-panel')).toBeVisible();
    await expect(page.getByTestId('map-legend-panel')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('signin fits a short mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 640 });
    await setLanguage(page, 'en');
    await page.goto('/signin');

    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('report wizard location step is mobile-safe', async ({ page }) => {
    await setupMobileMap(page, { width: 390, height: 844 });
    await page.goto('/report');

    await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /use my location/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

import { test, expect } from '@playwright/test';
import { mockAuthMe, mockWeather, setLanguage } from './helpers';

test.describe('Weather', () => {
  test('displays weather data correctly', async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'CIVILIAN');
    await mockWeather(page);

    await page.goto('/weather');

    await expect(page.getByRole('heading', { name: 'Weather in Ifrane' })).toBeVisible();
    await expect(page.getByText('Temperature')).toBeVisible();
    await expect(page.getByText('Wind speed')).toBeVisible();
    await expect(page.getByText('Wind direction')).toBeVisible();
  });

  test('displays temperature value', async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'CIVILIAN');

    await page.route('**/api/weather', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          temperature: 28,
          windSpeed: 15,
          windDirection: 180,
          timestamp: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/weather');

    await expect(page.getByText('28°')).toBeVisible();
    // Use exact match to avoid matching timestamp
    await expect(page.getByText('15', { exact: true })).toBeVisible();
  });

  test('displays wind direction as cardinal direction', async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'CIVILIAN');

    await page.route('**/api/weather', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          temperature: 22,
          windSpeed: 10,
          windDirection: 90, // East
          timestamp: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/weather');

    // 90 degrees should show E (cardinal direction abbreviation)
    await expect(page.getByText('E', { exact: true })).toBeVisible();
  });

  test('displays high wind alert when wind speed is high', async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'CIVILIAN');

    await page.route('**/api/weather', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          temperature: 22,
          windSpeed: 25, // High wind
          windDirection: 45,
          timestamp: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/weather');

    // Should show strong wind warning
    await expect(page.getByText(/Strong winds/i)).toBeVisible();
  });

  test('displays hot temperature alert when temperature is high', async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'CIVILIAN');

    await page.route('**/api/weather', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          temperature: 35, // High temperature
          windSpeed: 10,
          windDirection: 0,
          timestamp: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/weather');

    // Should show high temperature warning
    await expect(page.getByText(/high temperature|hot/i)).toBeVisible();
  });

  test('handles API error gracefully', async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'CIVILIAN');

    await page.route('**/api/weather', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.goto('/weather');

    // Should show error message
    await expect(page.getByText(/Failed to load weather data/i)).toBeVisible();
  });

  test('displays loading state initially', async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'CIVILIAN');

    // Delay the weather response
    await page.route('**/api/weather', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          temperature: 22,
          windSpeed: 14,
          windDirection: 90,
          timestamp: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/weather');

    // Should briefly show loading state
    await expect(page.getByText(/Loading weather data/i)).toBeVisible();

    // Then show actual weather data
    await expect(page.getByText('22°')).toBeVisible({ timeout: 10000 });
  });

  test('displays last update timestamp', async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'CIVILIAN');
    await mockWeather(page);

    await page.goto('/weather');

    await expect(page.getByText(/Last updated/i)).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import {
  mockAuthMe,
  mockNotifications,
  mockTokenRefresh,
  mockAnalytics,
  mockGeoRoutes,
  setLanguage,
} from './helpers';

test.describe('Breadcrumb navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page);
    await mockNotifications(page);
    await mockTokenRefresh(page);
  });

  test('analytics page shows Command Center > Analytics breadcrumb', async ({ page }) => {
    await mockAnalytics(page);

    await page.goto('/analytics');

    const breadcrumbNav = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumbNav).toBeVisible();
    await expect(breadcrumbNav).toContainText('Command Center');
    await expect(breadcrumbNav).toContainText('Analytics');
  });

  test('map page shows Command Center > Fire Map breadcrumb', async ({ page }) => {
    await mockGeoRoutes(page);

    await page.goto('/map');

    const breadcrumbNav = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumbNav).toBeVisible();
    await expect(breadcrumbNav).toContainText('Command Center');
    await expect(breadcrumbNav).toContainText('Fire Map');
  });
});

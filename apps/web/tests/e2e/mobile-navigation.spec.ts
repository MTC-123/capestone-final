import { test, expect } from '@playwright/test';
import {
  mockAuthMe,
  mockNotifications,
  mockTokenRefresh,
  mockGeoRoutes,
  setMobileViewport,
} from './helpers';

test.describe('Mobile bottom tab bar navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setMobileViewport(page);
    await mockAuthMe(page);
    await mockNotifications(page);
    await mockTokenRefresh(page);
    await mockGeoRoutes(page);
  });

  test('mobile tab bar is visible and desktop sidebar is hidden', async ({ page }) => {
    await page.goto('/map');

    // The mobile bottom tab bar should be visible (the <nav> with md:hidden)
    const mobileTabBar = page.locator('nav.fixed.bottom-0');
    await expect(mobileTabBar).toBeVisible();

    // The desktop sidebar wrapper should not be visible at 390px width
    // The sidebar is inside a div with class "hidden md:block"
    const sidebarWrapper = page.locator('div.hidden.md\\:block');
    await expect(sidebarWrapper).toBeHidden();
  });

  test('tab bar shows main navigation items', async ({ page }) => {
    await page.goto('/map');

    const mobileTabBar = page.locator('nav.fixed.bottom-0');

    // Verify main tab items are present
    await expect(mobileTabBar.locator('a[href="/map"]')).toBeVisible();
    await expect(mobileTabBar.locator('a[href="/analytics"]')).toBeVisible();
    await expect(mobileTabBar.locator('a[href="/report"]')).toBeVisible();
  });

  test('clicking More button opens flyout with additional pages', async ({ page }) => {
    await page.goto('/map');

    // Click the More button in the tab bar
    const moreButton = page.locator('nav.fixed.bottom-0 button');
    await expect(moreButton).toBeVisible();
    await moreButton.click();

    // Verify the flyout with additional navigation items is visible
    const flyout = page.locator('a[href="/reports-list"]');
    await expect(flyout).toBeVisible();

    const equipmentLink = page.locator('a[href="/equipment"]');
    await expect(equipmentLink).toBeVisible();

    const weatherLink = page.locator('a[href="/weather"]');
    await expect(weatherLink).toBeVisible();

    const fireDatabaseLink = page.locator('a[href="/fire-database"]');
    await expect(fireDatabaseLink).toBeVisible();
  });
});

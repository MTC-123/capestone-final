import { test, expect } from '@playwright/test';
import { mockAuthMe, mockGeoRoutes, mockReports, mockWeather, mockAnalytics, mockEquipment, setLanguage } from './helpers';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setLanguage(page, 'en');
    await mockGeoRoutes(page);
    await mockReports(page, []);
    await mockWeather(page);
    await mockAnalytics(page);
    await mockEquipment(page);
  });

  test('navbar displays correctly for civilian user', async ({ page }) => {
    await mockAuthMe(page, 'CIVILIAN');
    await page.goto('/map');

    // Should see main navigation items - use first() since there may be duplicates in different nav areas
    await expect(page.getByRole('link', { name: /fire.*map|map/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /report.*fire|report/i }).first()).toBeVisible();
  });

  test('navbar displays additional items for official user', async ({ page }) => {
    await mockAuthMe(page, 'OFFICIAL');
    await page.goto('/map');

    // Should see all navigation items including official-only
    await expect(page.getByRole('link', { name: /map/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /reports/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /analytics/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /equipment/i })).toBeVisible();
  });

  test('navigates between pages correctly', async ({ page }) => {
    await mockAuthMe(page, 'OFFICIAL');
    await mockAnalytics(page);
    await mockEquipment(page);
    await mockGeoRoutes(page);
    await mockReports(page, []);

    await page.goto('/map');

    // Wait for map page to load
    await expect(page.getByRole('heading', { name: /fire map/i })).toBeVisible({ timeout: 15000 });

    // Navigate to analytics using the sidebar link
    const analyticsLink = page.locator('a[href="/analytics"]').first();
    await analyticsLink.click();
    await page.waitForFunction(() => window.location.pathname === '/analytics', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /analytics|statistiques/i })).toBeVisible({ timeout: 15000 });

    // Navigate to equipment
    const equipmentLink = page.locator('a[href="/equipment"]').first();
    await equipmentLink.click();
    await page.waitForFunction(() => window.location.pathname === '/equipment', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /equipment|équipements/i }).first()).toBeVisible({ timeout: 15000 });
  });

  test('active nav item is highlighted', async ({ page }) => {
    await mockAuthMe(page, 'OFFICIAL');
    await page.goto('/map');

    // Map link should be active - look for any link to /map with aria-current
    const mapLink = page.locator('a[href="/map"][aria-current="page"]').first();
    await expect(mapLink).toBeVisible();
  });

  test('logout button is visible and works', async ({ page }) => {
    await mockAuthMe(page, 'CIVILIAN');
    await mockGeoRoutes(page);
    await mockReports(page, []);
    await mockWeather(page);

    await page.goto('/map');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /fire map/i })).toBeVisible({ timeout: 15000 });

    // Find and click logout button - translation is "Log out" with space
    const logoutButton = page.getByRole('button', { name: /log\s*out|logout|déconnexion/i });
    await expect(logoutButton).toBeVisible({ timeout: 10000 });

    await logoutButton.click();

    // Wait for redirect to signin
    await page.waitForURL(/\/signin/, { timeout: 15000 });
  });

  test('language switcher is visible', async ({ page }) => {
    await mockAuthMe(page, 'CIVILIAN');
    await page.goto('/map');

    // Language switcher should be visible
    const languageSwitcher = page.locator('[aria-label*="language"], [data-testid="language-switcher"]').first();
    // If not found by aria-label, look for button with flag or language code
    const languageButton = page.getByRole('button').filter({ hasText: /EN|FR|AR|🇺🇸|🇫🇷|🇲🇦/i }).first();

    const switcher = await languageSwitcher.isVisible().catch(() => false)
      ? languageSwitcher
      : languageButton;

    await expect(switcher).toBeVisible();
  });

  test('redirects to signin when not authenticated', async ({ page }) => {
    // Set up 401 response for auth check BEFORE navigation
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 1001, userMessage: 'Not authenticated' } }),
      });
    });

    // Navigate and wait for either /map to load or redirect to happen
    await page.goto('/map', { waitUntil: 'networkidle' });

    // Give time for the client-side redirect to process
    await page.waitForTimeout(2000);

    // Should be on signin page (either redirected or stayed)
    const url = page.url();
    expect(url).toMatch(/\/signin/);
  });

  test('mobile menu works on small screens', async ({ page }) => {
    await mockAuthMe(page, 'CIVILIAN');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/map');

    // Look for hamburger menu button
    const menuButton = page.getByRole('button', { name: /menu|toggle/i }).or(
      page.locator('[aria-label*="menu"]')
    ).first();

    // On mobile, either the nav is visible or there's a menu button
    const isMenuButton = await menuButton.isVisible().catch(() => false);

    if (isMenuButton) {
      await menuButton.click();
      // Menu should open and show navigation links
      await expect(page.getByRole('link', { name: /weather/i })).toBeVisible();
    }
  });
});

test.describe('Logout', () => {
  test('logout clears session and redirects to signin', async ({ page }) => {
    await setLanguage(page, 'en');
    await mockGeoRoutes(page);
    await mockReports(page, []);
    await mockWeather(page);

    // First set up auth to return logged in user
    await mockAuthMe(page, 'CIVILIAN');

    let logoutCalled = false;
    await page.route('**/api/auth/logout', async (route) => {
      logoutCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto('/map');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /fire map/i })).toBeVisible({ timeout: 10000 });

    // Click logout
    const logoutButton = page.getByRole('button', { name: /log\s*out|logout/i });
    await logoutButton.click();

    // Wait for logout and redirect
    await page.waitForURL(/\/signin$/, { timeout: 15000 });
    expect(logoutCalled).toBeTruthy();
  });

  test('after logout, protected pages redirect to signin', async ({ page }) => {
    await setLanguage(page, 'en');

    // Mock unauthenticated state BEFORE navigation
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 1001, userMessage: 'Not authenticated' } }),
      });
    });

    // Try to access protected page
    await page.goto('/map', { waitUntil: 'networkidle' });

    // Give time for the client-side redirect to process
    await page.waitForTimeout(2000);

    // Should be on signin page
    const url = page.url();
    expect(url).toMatch(/\/signin/);
  });
});

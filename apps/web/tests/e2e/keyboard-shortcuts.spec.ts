import { test, expect } from '@playwright/test';
import {
  mockAuthMe,
  mockNotifications,
  mockTokenRefresh,
  mockGeoRoutes,
} from './helpers';

test.describe('Keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthMe(page);
    await mockNotifications(page);
    await mockTokenRefresh(page);
    await mockGeoRoutes(page);
  });

  test('pressing ? opens the shortcuts overlay dialog', async ({ page }) => {
    await page.goto('/map');

    // The overlay should not be visible initially
    await expect(page.locator('role=dialog')).toBeHidden();

    // Press the ? key to open shortcuts overlay
    await page.keyboard.press('?');

    // Verify the shortcuts dialog is visible
    const dialog = page.locator('role=dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  test('pressing Escape closes the shortcuts overlay', async ({ page }) => {
    await page.goto('/map');

    // Open the shortcuts overlay
    await page.keyboard.press('?');
    const dialog = page.locator('role=dialog');
    await expect(dialog).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');

    // Verify the dialog is no longer visible
    await expect(dialog).toBeHidden();
  });
});

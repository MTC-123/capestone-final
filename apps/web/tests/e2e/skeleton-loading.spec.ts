import { test, expect } from '@playwright/test';
import { mockAuthMe, mockNotifications, mockTokenRefresh } from './helpers';

test.describe('Skeleton loading states', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthMe(page);
    await mockNotifications(page);
    await mockTokenRefresh(page);
  });

  test('shows skeleton with aria-busy while analytics data is loading', async ({ page }) => {
    // Intercept analytics API with a delayed response
    await page.route('**/api/analytics', async (route) => {
      // Delay the response so the skeleton is visible
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          timeline: [{ date: new Date().toISOString().slice(0, 10), count: 1 }],
          causes: [{ cause: 'CIGARETTE', count: 1 }],
          stats: { totalIncidents: 1, daysWithFires: 1, dailyAverage: '1.0' },
        }),
      });
    });

    await page.goto('/analytics');

    // Verify the skeleton container has aria-busy="true"
    const skeleton = page.locator('[aria-busy="true"]');
    await expect(skeleton).toBeVisible();

    // Wait for content to load and verify aria-busy is gone
    await expect(skeleton).toBeHidden({ timeout: 10_000 });

    // Verify actual analytics content is now rendered
    await expect(page.locator('text=1')).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { mockAnalytics, mockAuthMe, mockNotifications, mockTokenRefresh, setLanguage } from './helpers';

test('notifications bell opens the drawer and keeps read state after refresh', async ({ page }) => {
  await setLanguage(page, 'en');
  await mockAuthMe(page);
  await mockNotifications(page);
  await mockTokenRefresh(page);
  await mockAnalytics(page);

  await page.goto('/analytics');

  const bell = page.getByRole('button', { name: /Notifications/ });
  await expect(bell).toHaveAttribute('aria-label', 'Notifications (1)');

  await bell.click();

  await expect(page.getByRole('dialog', { name: 'Notifications' })).toBeVisible();
  await expect(page.getByText('New fire detected')).toBeVisible();
  await expect(page.getByText('Report approved')).toBeVisible();
  await expect(bell).toHaveAttribute('aria-label', 'Notifications');
});

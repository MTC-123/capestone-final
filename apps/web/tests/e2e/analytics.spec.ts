import { test, expect } from '@playwright/test';
import { mockAnalytics, mockAuthMe, setLanguage } from './helpers';

test('analytics page loads and renders KPIs and charts shell', async ({ page }) => {
  await setLanguage(page, 'en');
  await mockAuthMe(page, 'OFFICIAL');
  await mockAnalytics(page);

  await page.goto('/analytics');

  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(page.getByText('Total fires')).toBeVisible();
  await expect(page.getByText('Distribution by cause')).toBeVisible();
});


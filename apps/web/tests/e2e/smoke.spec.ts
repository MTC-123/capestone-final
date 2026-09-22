import { test, expect } from '@playwright/test';
import { setLanguage } from './helpers';

test('signin page loads without horizontal overflow (mobile + desktop)', async ({ page }) => {
  await setLanguage(page, 'en');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/signin');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByLabel('CIN')).toBeVisible();

  const mobileOverflowPx = await page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - doc.clientWidth);
  });
  expect(mobileOverflowPx).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/signin');
  const desktopOverflowPx = await page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - doc.clientWidth);
  });
  expect(desktopOverflowPx).toBeLessThanOrEqual(1);
});

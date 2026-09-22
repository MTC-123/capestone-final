import { expect, test } from '@playwright/test';
import { setLanguage } from './helpers';

test.skip(({ browserName }) => browserName !== 'chromium', 'Visual tests only run in Chromium');

test('mobile sign-in layout is stable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await setLanguage(page, 'en');
  await page.goto('/signin');

  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  await expect(page).toHaveScreenshot('signin-mobile.png', {
    maxDiffPixelRatio: 0.03,
    threshold: 0.3,
  });
});

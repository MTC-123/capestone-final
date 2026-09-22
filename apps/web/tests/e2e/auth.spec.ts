import { test, expect } from '@playwright/test';
import { mockAuthMe, mockGeoRoutes, setLanguage } from './helpers';

test('signin validates required fields', async ({ page }) => {
  await setLanguage(page, 'en');
  await page.goto('/signin');

  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(/This field is required/i).first()).toBeVisible();
});

test('signin succeeds and navigates to protected area', async ({ page }) => {
  await setLanguage(page, 'en');
  await mockAuthMe(page, 'CIVILIAN');
  await mockGeoRoutes(page);

  await page.route('**/api/auth/signin', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'civilian-1',
          cin: 'AB123456',
          phone: '+212600000002',
          role: 'CIVILIAN',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    });
  });

  await page.goto('/signin');
  await page.getByLabel('CIN').fill('AB123456');
  await page.getByLabel('Password').fill('password123');
  const [response] = await Promise.all([
    page.waitForResponse('**/api/auth/signin'),
    page.getByRole('button', { name: 'Sign in' }).click(),
  ]);

  expect(response.ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/map$/, { timeout: 30_000 });
});


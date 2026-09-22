import { test, expect } from '@playwright/test';
import { mockAuthMe, mockGeoRoutes, setLanguage } from './helpers';

test.describe('Signup', () => {
  test('validates required fields', async ({ page }) => {
    await setLanguage(page, 'en');
    await page.goto('/signup');

    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText(/This field is required/i).first()).toBeVisible();
  });

  test('validates CIN format', async ({ page }) => {
    await setLanguage(page, 'en');
    await page.goto('/signup');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /create.*account|sign.*up/i })).toBeVisible({ timeout: 10000 });

    await page.locator('#signup-cin').fill('invalid');
    await page.locator('#signup-phone').fill('+212612345678');
    await page.locator('#signup-password').fill('password123');
    await page.locator('#signup-confirm-password').fill('password123');

    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/Invalid CIN/i)).toBeVisible();
  });

  test('validates phone format', async ({ page }) => {
    await setLanguage(page, 'en');
    await page.goto('/signup');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /create.*account|sign.*up/i })).toBeVisible({ timeout: 10000 });

    await page.locator('#signup-cin').fill('AB123456');
    await page.locator('#signup-phone').fill('invalid');
    await page.locator('#signup-password').fill('password123');
    await page.locator('#signup-confirm-password').fill('password123');

    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/Invalid phone/i)).toBeVisible();
  });

  test('validates password match', async ({ page }) => {
    await setLanguage(page, 'en');
    await page.goto('/signup');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /create.*account|sign.*up/i })).toBeVisible({ timeout: 10000 });

    await page.locator('#signup-cin').fill('AB123456');
    await page.locator('#signup-phone').fill('+212612345678');
    await page.locator('#signup-password').fill('password123');
    await page.locator('#signup-confirm-password').fill('different123');

    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/Passwords do not match/i)).toBeVisible();
  });

  test('validates password length', async ({ page }) => {
    await setLanguage(page, 'en');
    await page.goto('/signup');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /create.*account|sign.*up/i })).toBeVisible({ timeout: 10000 });

    await page.locator('#signup-cin').fill('AB123456');
    await page.locator('#signup-phone').fill('+212612345678');
    await page.locator('#signup-password').fill('short');
    await page.locator('#signup-confirm-password').fill('short');

    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/at least 8 characters/i).first()).toBeVisible();
  });

  test('requires department for official role', async ({ page }) => {
    await setLanguage(page, 'en');
    await page.goto('/signup');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /create.*account|sign.*up/i })).toBeVisible({ timeout: 10000 });

    await page.locator('#signup-cin').fill('AB123456');
    await page.locator('#signup-phone').fill('+212612345678');
    await page.locator('#signup-password').fill('password123');
    await page.locator('#signup-confirm-password').fill('password123');

    // Select official role
    await page.locator('#signup-role').selectOption('OFFICIAL');

    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.locator('#signup-department-error')).toBeVisible();
  });

  test('shows department field only for official role', async ({ page }) => {
    await setLanguage(page, 'en');
    await page.goto('/signup');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /create.*account|sign.*up/i })).toBeVisible({ timeout: 10000 });

    // Initially civilian - no department field
    await expect(page.locator('#signup-department')).not.toBeVisible();

    // Switch to official - department field appears
    await page.locator('#signup-role').selectOption('OFFICIAL');
    await expect(page.locator('#signup-department')).toBeVisible();

    // Switch back to civilian - department field disappears
    await page.locator('#signup-role').selectOption('CIVILIAN');
    await expect(page.locator('#signup-department')).not.toBeVisible();
  });

  test('signup succeeds and navigates to map', async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'CIVILIAN');
    await mockGeoRoutes(page);

    await page.route('**/api/auth/signup', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'new-user-1',
            cin: 'AB123456',
            phone: '+212612345678',
            role: 'CIVILIAN',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    });

    await page.goto('/signup');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /create.*account|sign.*up/i })).toBeVisible({ timeout: 10000 });

    await page.locator('#signup-cin').fill('AB123456');
    await page.locator('#signup-phone').fill('+212612345678');
    await page.locator('#signup-password').fill('password123');
    await page.locator('#signup-confirm-password').fill('password123');

    const [response] = await Promise.all([
      page.waitForResponse('**/api/auth/signup'),
      page.getByRole('button', { name: /create account/i }).click(),
    ]);

    expect(response.ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/map$/, { timeout: 30_000 });
  });

  test('shows link to signin page', async ({ page }) => {
    await setLanguage(page, 'en');
    await page.goto('/signup');

    const signinLink = page.getByRole('link', { name: 'Sign in' });
    await expect(signinLink).toBeVisible();
    await expect(signinLink).toHaveAttribute('href', '/signin');
  });

  test('button stays disabled after successful signup until navigation completes', async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'CIVILIAN');
    await mockGeoRoutes(page);

    // Mock signup API — respond successfully but don't resolve navigation instantly
    await page.route('**/api/auth/signup', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'new-user-1',
            cin: 'AB123456',
            phone: '+212612345678',
            role: 'CIVILIAN',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    });

    await page.goto('/signup');

    await expect(page.getByRole('heading', { name: /create.*account|sign.*up/i })).toBeVisible({ timeout: 10000 });

    await page.locator('#signup-cin').fill('AB123456');
    await page.locator('#signup-phone').fill('+212612345678');
    await page.locator('#signup-password').fill('password123');
    await page.locator('#signup-confirm-password').fill('password123');

    const submitButton = page.getByRole('button', { name: /create account|creating account/i });

    await Promise.all([
      page.waitForResponse('**/api/auth/signup'),
      submitButton.click(),
    ]);

    // After API success, button must stay disabled (loading) while navigating
    await expect(submitButton).toBeDisabled();

    // No error alert should be visible
    await expect(page.getByRole('alert')).not.toBeVisible();

    // Eventually navigates to /map
    await expect(page).toHaveURL(/\/map$/, { timeout: 30_000 });
  });

  test('handles server error gracefully', async ({ page }) => {
    await setLanguage(page, 'en');

    await page.route('**/api/auth/signup', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 1001,
            userMessage: 'This CIN is already registered.',
            requestId: 'test-123',
          },
        }),
      });
    });

    await page.goto('/signup');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /create.*account|sign.*up/i })).toBeVisible({ timeout: 10000 });

    await page.locator('#signup-cin').fill('AB123456');
    await page.locator('#signup-phone').fill('+212612345678');
    await page.locator('#signup-password').fill('password123');
    await page.locator('#signup-confirm-password').fill('password123');

    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/already registered/i)).toBeVisible();
  });
});

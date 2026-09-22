import { test, expect } from '@playwright/test';
import { mockAuthMe, mockGeoRoutes, mockReports, mockWeather, setLanguage } from './helpers';

test.describe('Language Switching', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthMe(page, 'CIVILIAN');
    await mockGeoRoutes(page);
    await mockReports(page, []);
    await mockWeather(page);
  });

  test('displays English text when language is set to English', async ({ page }) => {
    await setLanguage(page, 'en');
    await page.goto('/map');

    await expect(page.getByRole('heading', { name: /fire map/i })).toBeVisible();
  });

  test('displays French text when language is set to French', async ({ page }) => {
    await setLanguage(page, 'fr');
    await page.goto('/map', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /carte.*feu|carte.*incendie/i })).toBeVisible({ timeout: 15000 });
  });

  test('displays Arabic text when language is set to Arabic', async ({ page }) => {
    await setLanguage(page, 'ar');
    await page.goto('/map', { waitUntil: 'networkidle' });

    // Arabic heading for fire map
    await expect(page.getByRole('heading', { name: /خريطة/ })).toBeVisible({ timeout: 15000 });
  });

  test('sets RTL direction for Arabic', async ({ page }) => {
    await setLanguage(page, 'ar');
    await page.goto('/map');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'rtl');
  });

  test('sets LTR direction for English', async ({ page }) => {
    await setLanguage(page, 'en');
    await page.goto('/map');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'ltr');
  });

  test('sets LTR direction for French', async ({ page }) => {
    await setLanguage(page, 'fr');
    await page.goto('/map');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'ltr');
  });

  test('signin page respects language setting', async ({ page }) => {
    await setLanguage(page, 'fr');
    await page.goto('/signin');

    await expect(page.getByRole('heading', { name: /connexion/i })).toBeVisible();
  });

  test('signup page respects language setting', async ({ page }) => {
    await setLanguage(page, 'fr');
    await page.goto('/signup');

    await expect(page.getByRole('heading', { name: /créer.*compte|inscription/i })).toBeVisible();
  });

  test('weather page respects language setting', async ({ page }) => {
    await setLanguage(page, 'fr');
    await page.goto('/weather', { waitUntil: 'networkidle' });

    // Wait for heading to be visible (page loaded)
    await expect(page.getByRole('heading', { name: /météo|weather/i })).toBeVisible({ timeout: 15000 });

    // Check for French translations
    await expect(page.getByText(/température/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/vitesse|vent/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('form validation messages appear in selected language', async ({ page }) => {
    await setLanguage(page, 'fr');
    await page.goto('/signin');

    // Submit empty form
    await page.getByRole('button', { name: /connexion|se connecter/i }).click();

    // Error should be in French
    await expect(page.getByText(/champ.*obligatoire|requis/i).first()).toBeVisible();
  });

  test('Arabic form validation messages', async ({ page }) => {
    await setLanguage(page, 'ar');
    await page.goto('/signin');

    // Submit empty form
    await page.getByRole('button').filter({ hasText: /دخول|تسجيل/ }).click();

    // Error should be in Arabic
    await expect(page.getByText(/مطلوب|إلزامي/).first()).toBeVisible();
  });
});

test.describe('Language Persistence', () => {
  test('language setting persists across page navigations', async ({ page }) => {
    await setLanguage(page, 'fr');
    await mockAuthMe(page, 'CIVILIAN');
    await mockGeoRoutes(page);
    await mockReports(page, []);
    await mockWeather(page);

    await page.goto('/map', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /carte/i })).toBeVisible({ timeout: 15000 });

    // Navigate to weather
    await page.goto('/weather', { waitUntil: 'networkidle' });
    await expect(page.getByText(/température/i).first()).toBeVisible({ timeout: 15000 });

    // Navigate back to map
    await page.goto('/map', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /carte/i })).toBeVisible({ timeout: 15000 });
  });
});

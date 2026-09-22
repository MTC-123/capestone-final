import { test, expect } from '@playwright/test';
import { mockAuthMe, mockGeoRoutes, mockNotifications, mockTokenRefresh, setLanguage } from './helpers';

test.describe('Report Fire — Wizard Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'CIVILIAN');
    await mockGeoRoutes(page);
    await mockNotifications(page);
    await mockTokenRefresh(page);
  });

  test('page loads with wizard progress bar and step 1', async ({ page }) => {
    await page.goto('/report');

    await expect(page.getByRole('heading', { name: /report.*fire/i })).toBeVisible();
    // Progress bar should be visible with step navigation
    await expect(page.getByRole('navigation', { name: /progress/i })).toBeVisible();
    // Should show "Next" button (step 1)
    await expect(page.getByRole('button', { name: /next/i })).toBeVisible();
  });

  test('Next button is disabled without location selected', async ({ page }) => {
    await page.goto('/report');
    await expect(page.getByRole('heading', { name: /report.*fire/i })).toBeVisible({ timeout: 10000 });

    const nextButton = page.getByRole('button', { name: /next/i });
    await expect(nextButton).toBeDisabled();
  });

  test('can select location on map and proceed to step 2', async ({ page }) => {
    await page.goto('/report');
    await expect(page.getByRole('heading', { name: /report.*fire/i })).toBeVisible({ timeout: 10000 });

    // Wait for map to load
    await page.locator('[data-map-ready="true"]').first().waitFor({ timeout: 30000 });
    const mapCanvas = page.locator('canvas').first();

    // Click on map to set location
    await mapCanvas.click({ position: { x: 200, y: 200 }, force: true });
    await page.waitForTimeout(1000);

    // Coordinates should appear
    await expect(page.getByText(/location selected|selected location/i)).toBeVisible({ timeout: 5000 });

    // Next button should now be enabled — click it
    await page.getByRole('button', { name: /next/i }).click();

    // Should now be on step 2 — description field visible
    await expect(page.getByText(/fire description/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('step 2 validates description before allowing step 3', async ({ page }) => {
    await page.goto('/report');
    await expect(page.getByRole('heading', { name: /report.*fire/i })).toBeVisible({ timeout: 10000 });

    // Select location
    await page.locator('[data-map-ready="true"]').first().waitFor({ timeout: 30000 });
    await page.locator('canvas').first().click({ position: { x: 200, y: 200 }, force: true });
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /next/i }).click();

    // On step 2 — try to go to step 3 without filling description
    await page.getByRole('button', { name: /next/i }).click();

    // Should show validation error
    await expect(page.getByText(/description.*required|add.*description/i)).toBeVisible();
  });

  test('full wizard flow — submit and see confirmation', async ({ page }) => {
    await page.route('**/api/reports', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          report: {
            id: 'new-report-1',
            userId: 'civilian-1',
            latitude: 33.531,
            longitude: -5.105,
            description: 'Test fire report with wizard',
            cause: 'CIGARETTE',
            status: 'PENDING',
            images: [],
            referenceNumber: 'RPT-20260224-A3F2',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          referenceNumber: 'RPT-20260224-A3F2',
        }),
      });
    });
    await page.route(/\/api\/reports\/new-report-1\/pdf(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        headers: { 'Content-Disposition': 'attachment; filename="report-test.pdf"' },
        body: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF', 'utf8'),
      });
    });

    await page.goto('/report', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /report.*fire/i })).toBeVisible({ timeout: 15000 });

    // Step 1: Select location
    await page.locator('[data-map-ready="true"]').first().waitFor({ timeout: 30000 });
    await page.locator('canvas').first().click({ position: { x: 200, y: 200 }, force: true });
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /next/i }).click();

    // Step 2: Fill details
    await page.locator('textarea').fill('Smoke visible from the highway near the forest');

    // Select cause
    await page.locator('select#report-cause').selectOption('CIGARETTE');

    // Go to review
    await page.getByRole('button', { name: /next/i }).click();

    // Step 3: Review — should show description summary
    await expect(page.getByText('Smoke visible from the highway near the forest')).toBeVisible();

    // Submit
    await page.getByRole('button', { name: /submit report/i }).click();

    // Should show confirmation screen with reference number
    await expect(page.getByText(/report.*submitted|success/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('RPT-20260224-A3F2')).toBeVisible();
    await expect(page.getByRole('link', { name: /Arabic/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /French/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /English/i })).toHaveAttribute(
      'href',
      '/api/reports/new-report-1/pdf?lang=en'
    );
  });

  test('GPS button is visible on location step', async ({ page }) => {
    await page.goto('/report');
    await expect(page.getByRole('heading', { name: /report.*fire/i })).toBeVisible({ timeout: 10000 });

    // Wait for map
    await page.locator('[data-map-ready="true"]').first().waitFor({ timeout: 30000 });

    // GPS button should be present
    await expect(page.getByText(/use my location/i)).toBeVisible();
  });

  test('shows "Click the map" on desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile'), 'Desktop-only helper text');

    await page.goto('/report');
    await page.locator('[data-map-ready="true"]').first().waitFor({ timeout: 30000 });

    // On desktop viewport, should say "Click the map"
    await expect(page.getByText(/click the map/i)).toBeVisible();
  });

  test('can navigate back through wizard steps', async ({ page }) => {
    await page.goto('/report');
    await expect(page.getByRole('heading', { name: /report.*fire/i })).toBeVisible({ timeout: 10000 });

    // Step 1: Select location and go to step 2
    await page.locator('[data-map-ready="true"]').first().waitFor({ timeout: 30000 });
    await page.locator('canvas').first().click({ position: { x: 200, y: 200 }, force: true });
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /next/i }).click();

    // Should be on step 2
    await expect(page.getByText(/fire description/i).first()).toBeVisible();

    // Click Back
    await page.getByRole('button', { name: /back/i }).click();

    // Should be back on step 1 — map visible
    await expect(page.locator('[data-map-ready="true"]').first()).toBeVisible();
  });

  test('handles API error gracefully on submit', async ({ page }) => {
    await page.route('**/api/reports', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 1000,
            userMessage: 'Server error occurred',
            requestId: 'test-123',
          },
        }),
      });
    });

    await page.goto('/report');
    await expect(page.getByRole('heading', { name: /report.*fire/i })).toBeVisible({ timeout: 10000 });

    // Navigate to step 3
    await page.locator('[data-map-ready="true"]').first().waitFor({ timeout: 30000 });
    await page.locator('canvas').first().click({ position: { x: 200, y: 200 }, force: true });
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /next/i }).click();
    await page.locator('textarea').fill('Fire report description for error test');
    await page.getByRole('button', { name: /next/i }).click();

    // Submit
    await page.getByRole('button', { name: /submit report/i }).click();

    // Should show error message
    await expect(page.getByText(/server error|error occurred/i)).toBeVisible();
  });
});

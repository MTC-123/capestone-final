import { test, expect } from '@playwright/test';
import {
  mockAuthMe,
  mockGeoRoutes,
  mockNotifications,
  mockReports,
  mockTokenRefresh,
  setLanguage,
  type MockReport,
} from './helpers';

test.skip(({ browserName }) => browserName !== 'chromium', 'Report visual tests only run in Chromium');

const CREATED_AT = '2026-04-21T12:00:00.000Z';
const SAMPLE_REPORTS: MockReport[] = [
  {
    id: 'report-visual-1',
    userId: 'civilian-1',
    latitude: 33.531,
    longitude: -5.105,
    description: 'Smoke visible near the cedar forest access road.',
    images: [],
    status: 'IN_PROGRESS',
    cause: 'CIGARETTE',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    user: {
      id: 'civilian-1',
      cin: 'CIVILIAN123',
      phone: '+212600000002',
      role: 'CIVILIAN',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    },
  },
];

async function setupSharedMocks(page: import('@playwright/test').Page) {
  await setLanguage(page, 'en');
  await mockAuthMe(page, 'OFFICIAL');
  await mockReports(page, SAMPLE_REPORTS);
  await mockNotifications(page);
  await mockTokenRefresh(page);
}

test('reports history visual layout is stable on desktop and mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Visual baselines are captured in desktop Chromium');

  await setupSharedMocks(page);

  await page.goto('/reports-list');
  await expect(page.getByText('Smoke visible near the cedar forest access road.')).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot('reports-history-desktop.png', {
    maxDiffPixelRatio: 0.02,
    threshold: 0.3,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/reports-list');
  await expect(page.getByText('Smoke visible near the cedar forest access road.')).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot('reports-history-mobile.png', {
    maxDiffPixelRatio: 0.02,
    threshold: 0.3,
  });
});

test('report confirmation visual layout is stable on desktop and mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Visual baselines are captured in desktop Chromium');

  await setupSharedMocks(page);
  await mockGeoRoutes(page);

  await page.route('**/api/reports', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        report: {
          id: 'report-confirmation-1',
          userId: 'civilian-1',
          latitude: 33.531,
          longitude: -5.105,
          description: 'Smoke visible near the cedar forest access road.',
          cause: 'CIGARETTE',
          status: 'PENDING',
          images: [],
          referenceNumber: 'RPT-20260421-DEMO',
          createdAt: CREATED_AT,
          updatedAt: CREATED_AT,
        },
        referenceNumber: 'RPT-20260421-DEMO',
      }),
    });
  });

  await page.goto('/report');
  await page.locator('[data-map-ready="true"]').first().waitFor({ timeout: 30_000 });
  await page.locator('canvas').first().click({ position: { x: 200, y: 200 }, force: true });
  await page.getByRole('button', { name: /next/i }).click();
  await page.locator('textarea').fill('Smoke visible near the cedar forest access road.');
  await page.getByRole('button', { name: /next/i }).click();
  await page.getByRole('button', { name: /submit report/i }).click();
  await expect(page.getByText('RPT-20260421-DEMO')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot('report-confirmation-desktop.png', {
    maxDiffPixelRatio: 0.02,
    threshold: 0.3,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot('report-confirmation-mobile.png', {
    maxDiffPixelRatio: 0.02,
    threshold: 0.3,
  });
});

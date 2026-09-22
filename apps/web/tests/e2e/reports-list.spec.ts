import { test, expect } from '@playwright/test';
import { mockAuthMe, mockNotifications, mockReports, mockTokenRefresh, setLanguage, type MockReport } from './helpers';

const NOW = new Date().toISOString();

const SAMPLE_REPORTS: MockReport[] = [
  {
    id: 'report-1',
    userId: 'civilian-1',
    latitude: 33.531,
    longitude: -5.105,
    description: 'Smoke near the road.',
    images: [],
    status: 'PENDING',
    cause: 'CIGARETTE',
    createdAt: NOW,
    updatedAt: NOW,
    user: {
      id: 'civilian-1',
      cin: 'CIVILIAN123',
      phone: '+212600000002',
      role: 'CIVILIAN',
      createdAt: NOW,
      updatedAt: NOW,
    },
  },
];

test('reports list renders and updates status without errors', async ({ page }) => {
  await setLanguage(page, 'en');
  await mockAuthMe(page, 'OFFICIAL');
  await mockNotifications(page);
  await mockTokenRefresh(page);
  await mockReports(page, SAMPLE_REPORTS);

  await page.goto('/reports-list');

  await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
  await expect(page.getByText('Smoke near the road.')).toBeVisible();

  const reportCard = page.getByTestId('report-card').first();
  const pendingButton = reportCard.getByRole('button', { name: 'Pending' });
  const inProgressButton = reportCard.getByRole('button', { name: 'In progress' });

  await expect(pendingButton).toBeDisabled();
  await expect(inProgressButton).toBeEnabled();

  await inProgressButton.click();

  await expect(inProgressButton).toBeDisabled();
  await expect(pendingButton).toBeEnabled();
});

test('renders reports after delayed load', async ({ page }) => {
  await setLanguage(page, 'en');
  await mockAuthMe(page, 'OFFICIAL');
  await mockNotifications(page);
  await mockTokenRefresh(page);

  // Delay the /api/reports response to exercise the loading path
  await page.route(/\/api\/reports(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await new Promise((r) => setTimeout(r, 2000));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: SAMPLE_REPORTS,
        pagination: { cursor: null, hasMore: false, total: SAMPLE_REPORTS.length },
      }),
    });
  });

  await page.goto('/reports-list');

  await expect(page.getByText('Smoke near the road.')).toBeVisible({ timeout: 5000 });
});

test('timeout shows retry', async ({ page }) => {
  await setLanguage(page, 'en');
  await mockAuthMe(page, 'OFFICIAL');
  await mockNotifications(page);
  await mockTokenRefresh(page);

  // Never respond to /api/reports — let it hang
  await page.route(/\/api\/reports(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    // Never fulfill — simulate a hang
    await new Promise(() => {});
  });

  await page.goto('/reports-list');

  // After ~5s the timeout alert should appear
  const alert = page.getByRole('alert').filter({ hasText: 'Unable to load reports' });
  await expect(alert).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});

test('retry reloads data after timeout', async ({ page }) => {
  await setLanguage(page, 'en');
  await mockAuthMe(page, 'OFFICIAL');
  await mockNotifications(page);
  await mockTokenRefresh(page);

  let shouldSucceed = false;

  await page.route(/\/api\/reports(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    if (!shouldSucceed) {
      // Initial calls can run more than once in dev mode; keep them failing until the retry click.
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { userMessage: 'Unable to load reports' } }),
      });
    } else {
      // Second call: return data
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: SAMPLE_REPORTS,
          pagination: { cursor: null, hasMore: false, total: SAMPLE_REPORTS.length },
        }),
      });
    }
  });

  await page.goto('/reports-list');

  // Wait for retry action after the first failed load
  const retryButton = page.getByRole('button', { name: 'Retry' });
  await expect(retryButton).toBeVisible({ timeout: 15000 });

  // Click retry
  shouldSucceed = true;
  await retryButton.click();

  // Data should now be visible
  await expect(page.getByText('Smoke near the road.')).toBeVisible({ timeout: 10000 });
});

test('opens report details and downloads PDFs from history', async ({ page }) => {
  await setLanguage(page, 'en');
  await mockAuthMe(page, 'OFFICIAL');
  await mockNotifications(page);
  await mockTokenRefresh(page);
  await mockReports(page, SAMPLE_REPORTS);

  await page.goto('/reports-list', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Smoke near the road.')).toBeVisible();

  await page.getByRole('button', { name: 'View details' }).click();
  const dialog = page.getByTestId('report-detail-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('CIVILIAN123')).toBeVisible();

  await expect(dialog.getByRole('link', { name: /English/i })).toHaveAttribute(
    'href',
    '/api/reports/report-1/pdf?lang=en'
  );
});

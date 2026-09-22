import { expect, test, type Page } from '@playwright/test';
import {
  mockAnalytics,
  mockAuthMe,
  mockEquipment,
  mockGeoRoutes,
  mockNotifications,
  mockReports,
  mockTokenRefresh,
  mockWeather,
  setLanguage,
} from './helpers';

const now = new Date('2026-04-21T12:00:00.000Z').toISOString();

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - width;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

async function mockWholeSite(page: Page) {
  await setLanguage(page, 'en');
  await mockAuthMe(page, 'OFFICIAL');
  await mockNotifications(page);
  await mockTokenRefresh(page);
  await mockAnalytics(page);
  await mockWeather(page);
  await mockGeoRoutes(page);
  await mockEquipment(page);
  await mockReports(page, [
    {
      id: 'report-responsive-1',
      userId: 'civilian-1',
      latitude: 33.531,
      longitude: -5.105,
      description: 'Smoke visible near the cedar trail with moderate wind.',
      images: [],
      status: 'PENDING',
      cause: 'CIGARETTE',
      createdAt: now,
      updatedAt: now,
      user: {
        id: 'civilian-1',
        cin: 'CIVILIAN123',
        phone: '+212600000002',
        role: 'CIVILIAN',
        createdAt: now,
        updatedAt: now,
      },
    },
  ]);

  await page.route('**/api/equipment?**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'truck-1',
            name: 'VPI-01',
            status: 'Disponible',
            latitude: 33.53,
            longitude: -5.11,
          },
        ],
      }),
    });
  });

  await page.route('**/api/operations/campaigns', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        campaigns: [
          {
            id: 'campaign-1',
            year: 2026,
            label: 'Demo Readiness',
            status: 'ACTIVE',
            activePhase: 'ALERTE',
            createdBy: 'official-1',
            createdAt: now,
            updatedAt: now,
          },
        ],
      }),
    });
  });
  await page.route('**/api/operations/summary?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary: {
          PREPARATION: { total: 4, done: 4 },
          PREPOSITIONNEMENT: { total: 3, done: 2 },
          ALERTE: { total: 5, done: 2 },
        },
      }),
    });
  });
  await page.route('**/api/operations/checklists?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'task-1',
            campaignId: 'campaign-1',
            phase: 'ALERTE',
            task: 'Confirm first response units and command channel.',
            status: 'IN_PROGRESS',
            sortOrder: 1,
            createdAt: now,
          },
        ],
      }),
    });
  });

  await page.route('**/api/coordination/agencies', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        agencies: [
          {
            id: 'agency-1',
            agency: 'PROTECTION_CIVILE',
            status: 'ONLINE',
            unitsAvailable: 4,
            unitsDeployed: 2,
            contactName: 'Ops Lead',
            createdAt: now,
            updatedAt: now,
          },
        ],
      }),
    });
  });
  await page.route('**/api/coordination/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], activations: [], assignments: [], requests: [], workflows: [] }) });
  });

  const fireRecord = {
    id: 'record-responsive-1',
    incidentId: 'inc-1',
    alertSource: 'OTHER',
    recordStatus: 'DRAFT',
    burnAreaHa: 1.8,
    alertReceivedAt: now,
    firstResponseAt: now,
    locationDetail: { commune: 'Ifrane', locationName: 'Cedar trail', coordinates: [-5.105, 33.531] },
    causeDetail: { category: 'HUMAN' },
    responseDetail: { responseTimeMinutes: 18 },
    lockedSections: [],
    auditTrail: [],
    createdAt: now,
    updatedAt: now,
  };
  await page.route('**/api/fire-records/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalFiresThisYear: 12,
        totalHectaresBurned: 43,
        avgResponseTimeMinutes: 18,
        mostAffectedCommune: 'Ifrane',
      }),
    });
  });
  await page.route('**/api/fire-records?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [fireRecord], pagination: { cursor: null, hasMore: false, total: 1 } }),
    });
  });
  await page.route('**/api/fire-records', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [fireRecord], pagination: { cursor: null, hasMore: false, total: 1 } }),
    });
  });
}

test.describe('responsive site polish', () => {
  test('core protected pages do not horizontally overflow on phones', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await mockWholeSite(page);

    for (const route of ['/analytics', '/reports-list', '/weather', '/equipment', '/coordination', '/operations', '/fire-database']) {
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      await page.waitForTimeout(300);
      await expectNoHorizontalOverflow(page);
    }
  });

  test('sign-up form fits a short phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await setLanguage(page, 'en');
    await page.goto('/signup');

    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

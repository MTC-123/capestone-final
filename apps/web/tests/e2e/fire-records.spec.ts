import { test, expect } from '@playwright/test';
import { mockAuthMe, setLanguage } from './helpers';

const mockRecord: {
  id: string;
  incidentId: string;
  alertSource: string;
  recordStatus: string;
  burnAreaHa: number | null;
  lockedSections: string[];
  auditTrail: { userId: string; cin: string; action: string; timestamp: string }[];
  createdAt: string;
  updatedAt: string;
} = {
  id: 'rec-e2e-1',
  incidentId: 'inc-e2e-1',
  alertSource: 'OTHER',
  recordStatus: 'DRAFT',
  burnAreaHa: null,
  lockedSections: [],
  auditTrail: [{ userId: 'u1', cin: 'OFF001', action: 'CREATE', timestamp: new Date().toISOString() }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

async function mockFireRecordRoutes(page: import('@playwright/test').Page) {
  let records = [{ ...mockRecord }];

  await page.route('**/api/fire-records?**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: records,
        pagination: { cursor: null, hasMore: false, total: records.length },
      }),
    });
  });

  await page.route('**/api/fire-records', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const newRecord = {
        ...mockRecord,
        id: `rec-new-${Date.now()}`,
        incidentId: body.incidentId as string,
      };
      records.push(newRecord);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newRecord),
      });
      return;
    }
    return route.fallback();
  });

  await page.route('**/api/fire-records/rec-e2e-1', async (route) => {
    if (route.request().method() === 'GET') {
      const record = records.find((r) => r.id === 'rec-e2e-1');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ record, incident: null }),
      });
      return;
    }
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const record = records.find((r) => r.id === 'rec-e2e-1');
      if (record) {
        if (record.recordStatus === 'APPROVED') {
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ error: { code: 8005, message: 'Already approved' } }),
          });
          return;
        }
        Object.assign(record, body);
        record.updatedAt = new Date().toISOString();
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ record }),
      });
      return;
    }
    return route.fallback();
  });

  await page.route('**/api/fire-records/rec-e2e-1/perimeter', async (route) => {
    const record = records.find((r) => r.id === 'rec-e2e-1');
    if (record) {
      record.burnAreaHa = 12.5;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ record }),
    });
  });

  await page.route('**/api/fire-records/rec-e2e-1/lock', async (route) => {
    const body = route.request().postDataJSON() as { section: string };
    const record = records.find((r) => r.id === 'rec-e2e-1');
    if (record && !record.lockedSections.includes(body.section)) {
      record.lockedSections.push(body.section);
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ record }),
    });
  });

  await page.route('**/api/fire-records/rec-e2e-1/approve', async (route) => {
    const record = records.find((r) => r.id === 'rec-e2e-1');
    if (record) {
      record.recordStatus = 'APPROVED';
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ record }),
    });
  });

  await page.route('**/api/fire-records/export**', async (route) => {
    const url = new URL(route.request().url());
    const format = url.searchParams.get('format');
    if (format === 'geojson') {
      await route.fulfill({
        status: 200,
        contentType: 'application/geo+json',
        headers: { 'Content-Disposition': 'attachment; filename="fire-records.geojson"' },
        body: JSON.stringify({ type: 'FeatureCollection', features: [] }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'text/csv',
        headers: { 'Content-Disposition': 'attachment; filename="fire-records.csv"' },
        body: 'id,incidentId\nrec-e2e-1,inc-e2e-1\n',
      });
    }
  });
}

test.describe('Fire Database Page', () => {
  test('navigates to /fire-database and sees table', async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'OFFICIAL');
    await mockFireRecordRoutes(page);

    await page.goto('/fire-database');

    await expect(page.getByRole('heading', { name: 'Fire Database' })).toBeVisible();
    await expect(page.getByTestId('fire-record-table')).toBeVisible();
  });

  test('shows empty state when no records', async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'OFFICIAL');

    await page.route('**/api/fire-records?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], pagination: { cursor: null, hasMore: false, total: 0 } }),
      });
    });
    // Also catch the route without query params
    await page.route('**/api/fire-records', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], pagination: { cursor: null, hasMore: false, total: 0 } }),
      });
    });

    await page.goto('/fire-database');

    await expect(page.getByTestId('fire-record-empty')).toBeVisible({ timeout: 10000 });
  });

  test('shows record status badge', async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'OFFICIAL');
    await mockFireRecordRoutes(page);

    await page.goto('/fire-database');

    await expect(page.getByTestId('record-status-badge')).toBeVisible({ timeout: 10000 });
  });

  test('shows filter controls', async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'OFFICIAL');
    await mockFireRecordRoutes(page);

    await page.goto('/fire-database');

    await expect(page.getByTestId('fire-record-filters')).toBeVisible();
  });

  test('shows export buttons for OFFICIAL', async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'OFFICIAL');
    await mockFireRecordRoutes(page);

    await page.goto('/fire-database');

    await expect(page.getByTestId('export-csv')).toBeVisible();
    await expect(page.getByTestId('export-geojson')).toBeVisible();
  });

  test('export CSV triggers download', async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'OFFICIAL');
    await mockFireRecordRoutes(page);

    await page.goto('/fire-database');

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-csv').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('fire-records');
  });
});

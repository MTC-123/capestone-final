import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mockAuthMe, setLanguage } from './helpers';

const now = new Date().toISOString();

const pendingRequest = {
  id: 'req-1',
  department: 'Forestry',
  position: 'Warden',
  justification: 'I coordinate patrols in the Ifrane sector.',
  status: 'PENDING',
  reviewedBy: null,
  reviewedAt: null,
  reviewNote: null,
  createdAt: now,
  user: {
    id: 'user-1',
    cin: 'AB123456',
    fullName: 'Youssef Amrani',
    phone: '+212600000001',
    email: 'youssef@example.com',
    role: 'CIVILIAN',
    createdAt: now,
  },
};

async function mockOfficialRequests(page: Page, options: { patchStatus?: number; patchBody?: unknown } = {}) {
  await page.route('**/api/admin/official-requests', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = new URL(route.request().url());
    const status = url.searchParams.get('status');
    const items = !status || status === 'PENDING' ? [pendingRequest] : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items, pending: 1 }),
    });
  });

  await page.route('**/api/admin/official-requests/*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    const status = options.patchStatus ?? 200;
    const body =
      options.patchBody ??
      (status === 200
        ? { request: { ...pendingRequest, status: 'APPROVED' } }
        : {
            error: {
              code: 3000,
              userMessage: 'This request was already decided.',
            },
          });
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function mockAudit(page: Page) {
  const rows = Array.from({ length: 3 }).map((_, i) => ({
    id: `audit-${i}`,
    actorId: 'user-1',
    actorCin: 'CD789012',
    actorRole: 'OFFICIAL',
    action: i === 0 ? 'official_request.approve' : 'auth.signin',
    targetType: 'user',
    targetId: `target-${i}`,
    outcome: 'SUCCESS',
    meta: { note: 'test' },
    ip: '127.0.0.1',
    userAgent: 'Mozilla/5.0 (Test)',
    createdAt: now,
  }));

  await page.route('**/api/admin/audit**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = new URL(route.request().url());
    const cursor = url.searchParams.get('cursor');
    if (!cursor) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: rows, nextCursor: 'audit-2' }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ ...rows[0], id: 'audit-page2', action: 'report.create' }],
          nextCursor: null,
        }),
      });
    }
  });

  await page.route('**/api/notifications/deliveries**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ deliveries: [] }),
    });
  });
}

test('approvals list renders pending requests', async ({ page }) => {
  await setLanguage(page, 'en');
  await mockAuthMe(page, 'OFFICIAL');
  await mockOfficialRequests(page);

  await page.goto('/admin/approvals');

  await expect(page.getByText('Youssef Amrani')).toBeVisible();
  await expect(page.getByText('AB123456')).toBeVisible();
  await expect(page.getByText('Forestry')).toBeVisible();
});

test('approving a request opens a confirm dialog and succeeds', async ({ page }) => {
  await setLanguage(page, 'en');
  await mockAuthMe(page, 'OFFICIAL');
  await mockOfficialRequests(page);

  await page.goto('/admin/approvals');
  await expect(page.getByText('Youssef Amrani')).toBeVisible();

  await page.getByRole('button', { name: 'Approve' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Approve' }).click();
  await expect(dialog).toBeHidden();
});

test('shows a friendly message when a request was already decided (409)', async ({ page }) => {
  await setLanguage(page, 'en');
  await mockAuthMe(page, 'OFFICIAL');
  await mockOfficialRequests(page, { patchStatus: 409 });

  await page.goto('/admin/approvals');
  await expect(page.getByText('Youssef Amrani')).toBeVisible();

  await page.getByRole('button', { name: 'Approve' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Approve' }).click();

  await expect(page.getByText(/already decided/i)).toBeVisible();
});

test('audit log supports filtering and load more', async ({ page }) => {
  await setLanguage(page, 'en');
  await mockAuthMe(page, 'OFFICIAL');
  await mockAudit(page);

  await page.goto('/admin/audit');

  await expect(page.getByText('CD789012').first()).toBeVisible();

  const actorInput = page.getByLabel('Actor CIN');
  await actorInput.fill('CD789012');
  await page.waitForTimeout(500);

  const loadMore = page.getByRole('button', { name: 'Load More' });
  await expect(loadMore).toBeVisible();
  await loadMore.click();

  await expect(page.getByText('No more results')).toBeVisible();
});

test('civilian users see access denied on both admin pages', async ({ page }) => {
  await setLanguage(page, 'en');
  await mockAuthMe(page, 'CIVILIAN');

  await page.goto('/admin/approvals');
  await expect(page.getByText(/access/i)).toBeVisible();

  await page.goto('/admin/audit');
  await expect(page.getByText(/access/i)).toBeVisible();
});

import { test, expect, expectAccessible, expectNoHorizontalOverflow, OFFICIAL_STATE } from './fixtures';

test.use({ storageState: OFFICIAL_STATE });

const ROUTES = [
  '/map',
  '/reports-list',
  '/equipment',
  '/coordination',
  '/operations',
  '/fire-database',
  '/analytics',
  '/weather',
  '/admin/approvals',
  '/admin/audit',
];

for (const path of ROUTES) {
  test(`official ${path} loads cleanly`, async ({ page, consoleErrors }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('main#main')).toBeVisible();
    // Let data requests settle before scanning.
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page);
    expect(consoleErrors).toEqual([]);
  });
}

test('the command palette opens with the keyboard and navigates', async ({ page }, testInfo) => {
  test.skip(/pixel|iphone/.test(testInfo.project.name), 'no hardware keyboard on phones');
  await page.goto('/reports-list');
  // The shortcut is registered on hydration; press it once the page is interactive.
  await page.waitForLoadState('networkidle');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.type('audit');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/admin\/audit/);
});

test('health endpoint reports the database as healthy', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.services.database.status).toBe('healthy');
});

test('fire-record filters narrow the results and sort in both directions', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'API behaviour, one run is enough');
  type Page = { data: { causeDetail?: { category?: string }; locationDetail?: { commune?: string }; burnAreaHa?: number }[]; pagination: { total: number } };
  const get = async (query: string) => {
    const res = await request.get(`/api/fire-records?${query}`);
    expect(res.status(), query).toBe(200);
    return (await res.json()) as Page;
  };

  const all = await get('');
  const byCause = await get('cause=NEGLIGENCE');
  expect(byCause.pagination.total).toBeGreaterThan(0);
  expect(byCause.pagination.total).toBeLessThan(all.pagination.total);
  expect(byCause.data.every((r) => r.causeDetail?.category === 'NEGLIGENCE')).toBe(true);

  const byCommune = await get('commune=azrou');
  expect(byCommune.pagination.total).toBeGreaterThan(0);
  expect(byCommune.data.every((r) => r.locationDetail?.commune === 'Azrou')).toBe(true);

  // Search text is literal, never a regular expression.
  expect((await get(`search=${encodeURIComponent('[(.*')}`)).pagination.total).toBe(0);

  const areas = (await get('sortBy=burnAreaHa&sortOrder=asc')).data.map((r) => r.burnAreaHa ?? 0);
  expect(areas).toEqual([...areas].sort((a, b) => a - b));
});

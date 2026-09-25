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

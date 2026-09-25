import { test, expect, expectAccessible, expectNoHorizontalOverflow, RESIDENT_STATE } from './fixtures';

test.use({ storageState: RESIDENT_STATE });

test('residents are kept out of official pages (server-side)', async ({ page }) => {
  for (const path of ['/equipment', '/coordination', '/operations', '/fire-database', '/admin/approvals']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/map\?denied=/);
  }
});

test('residents get 403 from official APIs', async ({ request }) => {
  for (const url of ['/api/equipment', '/api/admin/audit', '/api/admin/official-requests', '/api/fire-records']) {
    const res = await request.get(url);
    expect(res.status(), url).toBe(403);
  }
});

for (const path of ['/report', '/reports-list', '/map', '/weather']) {
  test(`resident ${path} loads cleanly`, async ({ page, consoleErrors }) => {
    await page.goto(path);
    await expect(page.locator('main#main')).toBeVisible();
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page);
    expect(consoleErrors).toEqual([]);
  });
}

test('a report written offline is kept on the device and sent once the network returns', async ({ page, context, request }, testInfo) => {
  test.skip(!['chromium', 'pixel-7'].includes(testInfo.project.name), 'IndexedDB/offline flow checked on Chromium engines');
  const description = `E2E offline report ${Date.now()}`;

  await page.goto('/report');
  // Step 1: pick a location on the map.
  const map = page.locator('.maplibregl-canvas').first();
  await expect(map).toBeVisible({ timeout: 20_000 });
  await map.click({ position: { x: 120, y: 120 } });
  await page.getByRole('button', { name: /Suivant|Next|التالي/ }).first().click();

  // Step 2: details.
  await page.locator('textarea').first().fill(description);
  await page.getByRole('button', { name: /Suivant|Next|التالي/ }).first().click();

  // Step 3: submit while offline.
  await context.setOffline(true);
  await page.getByRole('button', { name: /Soumettre|Submit|إرسال/ }).first().click();
  await expect(page.getByText(/hors ligne|offline|غير متصل/i).first()).toBeVisible();

  // Back online: the queue syncs by itself.
  await context.setOffline(false);
  await expect(page.getByRole("button", { name: /RPT-\d{8}-[0-9A-F]{6}/ }).first()).toBeVisible({ timeout: 30_000 });

  const list = await request.get('/api/reports?limit=20');
  const body = await list.json();
  const matches = body.data.filter((r: { description: string }) => r.description === description);
  expect(matches).toHaveLength(1);
});

test('signing up cannot grant official privileges', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'single run is enough');
  const cin = `E${String(Date.now()).slice(-7)}`;
  const res = await request.post('/api/auth/signup', {
    headers: { 'x-forwarded-for': `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
    data: { cin, phone: '0612345678', password: 'long-enough-pass', role: 'OFFICIAL' },
  });
  expect(res.status()).toBe(200);
  expect((await res.json()).user.role).toBe('CIVILIAN');
});

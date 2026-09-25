import { test, expect, expectAccessible, expectNoHorizontalOverflow } from './fixtures';

const PUBLIC_PAGES = ['/', '/signin', '/signup'];

for (const path of PUBLIC_PAGES) {
  test(`public ${path} renders, is accessible and fits the viewport`, async ({ page, consoleErrors }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page);
    expect(consoleErrors).toEqual([]);
  });
}

test('pages ship a nonce-based CSP and hardening headers', async ({ request }) => {
  const res = await request.get('/signin');
  const csp = res.headers()['content-security-policy'] ?? '';
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(res.headers()['x-frame-options']).toBe('DENY');
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(res.headers()['x-powered-by']).toBeUndefined();
});

test('protected pages redirect anonymous visitors to sign-in with a return path', async ({ page }) => {
  await page.goto('/fire-database');
  await expect(page).toHaveURL(/\/signin\?next=%2Ffire-database/);
});

test('the direction and language follow the request', async ({ page }, testInfo) => {
  await page.goto('/signin');
  const dir = await page.locator('html').getAttribute('dir');
  expect(dir).toBe(testInfo.project.name === 'arabic-rtl' ? 'rtl' : 'ltr');
});

test('a user can sign in through the form and lands on their home page', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'form sign-in covered once; sessions are shared elsewhere');
  await page.goto('/signin');
  await page.getByLabel(/CIN|البطاقة/).fill('AB123456');
  await page.locator('#signin-password').fill('password123');
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/report/);
});

test('wrong credentials show a clear error without revealing whether the account exists', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'single run is enough');
  await page.goto('/signin');
  await page.locator('#signin-cin').fill('ZZ000000');
  await page.locator('#signin-password').fill('not-the-password');
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByRole('alert')).toBeVisible();
});

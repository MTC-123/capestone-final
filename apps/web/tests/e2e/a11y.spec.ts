import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockAuthMe, mockReports, mockWeather, setLanguage, type MockReport } from './helpers';

async function expectNoA11yViolations(page: any, opts?: { exclude?: string[] }) {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']);
  for (const selector of opts?.exclude ?? []) builder = builder.exclude(selector);
  const results = await builder.analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test.describe('accessibility', () => {
  test('signin page has no critical WCAG A/AA violations', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.getByRole('heading', { name: /sign in|تسجيل الدخول|connexion/i })).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('map page has no critical WCAG A/AA violations', async ({ page }) => {
    await setLanguage(page, 'en');
    await mockAuthMe(page, 'OFFICIAL');
    await mockWeather(page);
    const now = new Date().toISOString();
    const reports: MockReport[] = [
      {
        id: 'report-1',
        userId: 'civilian-1',
        latitude: 33.531,
        longitude: -5.105,
        description: 'Test report',
        images: [],
        status: 'PENDING',
        createdAt: now,
        updatedAt: now,
        user: { id: 'civilian-1', cin: 'CIVILIAN123', phone: '+212600000002', role: 'CIVILIAN', createdAt: now, updatedAt: now },
      },
    ];
    await mockReports(page, reports);

    await page.route('**/api/map/layers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          layers: [
            {
              id: 'gibs_truecolor',
              label: 'NASA GIBS True Color',
              providerId: 'gibs',
              type: 'wms',
              defaultOpacity: 85,
              wms: { layerName: 'MODIS_Terra_CorrectedReflectance_TrueColor', format: 'image/jpeg', supports3857Bbox: true },
            },
          ],
        }),
      });
    });

    const blankPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
      'base64'
    );
    await page.route('**/api/tiles/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: blankPng });
    });
    await page.goto('/map');
    await expect(page.getByRole('heading', { name: /fire map|خريطة الحرائق|carte/i })).toBeVisible();
    await expectNoA11yViolations(page, { exclude: ['.maplibregl-canvas', '.maplibregl-control-container'] });
  });
});

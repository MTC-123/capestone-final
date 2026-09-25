import { test as base, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export const OFFICIAL_STATE = 'tests/e2e/.auth/official.json';
export const RESIDENT_STATE = 'tests/e2e/.auth/resident.json';

/** Third-party noise that is not an application defect (tiles, dev tooling). */
const IGNORED_CONSOLE = [
  /Download the React DevTools/,
  /\[Fast Refresh\]/,
  /webpack-hmr|_next\/hmr/,
  /Failed to load resource: .*(cartocdn|arcgisonline|openstreetmap|effis|ecmwf|worldpop|open-meteo|elevation-tiles)/i,
  /status of 5\d\d .*\/api\/(effis|cams|population|detections)/,
];

export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (!IGNORED_CONSOLE.some((re) => re.test(text))) errors.push(text);
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    await use(errors);
  },
});

export { expect };

/** WCAG 2.2 A/AA scan; fails on serious and critical violations. */
export async function expectAccessible(page: Page, options: { exclude?: string[] } = {}) {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
  // Map canvases are graphical; their controls are covered separately.
  for (const selector of ['.maplibregl-canvas', ...(options.exclude ?? [])]) builder = builder.exclude(selector);
  const results = await builder.analyze();
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    blocking.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`),
    'axe serious/critical violations'
  ).toEqual([]);
}

/** No horizontal page scroll at the current viewport. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(1);
}

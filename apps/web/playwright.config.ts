import { defineConfig, devices } from '@playwright/test';

/**
 * Two suites:
 *  - tests/e2e/*.spec.ts       component-level flows with mocked APIs
 *  - tests/e2e/live/*.spec.ts  the real app against a seeded database (no mocks):
 *                              auth, every route, accessibility, devices, RTL, offline
 *
 * The device matrix covers desktop engines, a phone per mobile engine, a
 * tablet, and an Arabic right-to-left profile.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, threshold: 0.3 },
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Signs in once per persona (official, resident) for the live suite.
    { name: 'setup', testMatch: /live\/auth\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-14', use: { ...devices['iPhone 14'] } },
    { name: 'ipad-pro', use: { ...devices['iPad Pro 11'] } },
    {
      name: 'arabic-rtl',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'ar-MA',
        extraHTTPHeaders: { 'Accept-Language': 'ar-MA,ar;q=0.9' },
      },
    },
  ].map((project) => (project.name === 'setup' ? project : { ...project, dependencies: ['setup'] })),
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npx next dev -p 3000',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});

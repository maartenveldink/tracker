import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Tracker's end-to-end suite.
 *
 * The app is an offline-first, mobile-first PWA with no backend, so tests run
 * against a real dev server and a mobile Chromium context. Each test gets a
 * fresh browser context (and therefore a fresh IndexedDB), which keeps tests
 * isolated without any manual database teardown.
 *
 * See docs/e2e-testing.md for the architecture and the reasoning behind it.
 */
export default defineConfig({
  testDir: './e2e/tests',
  // Fail the build on a stray `test.only` in CI.
  forbidOnly: !!process.env.CI,
  // Tests are independent, so run them in parallel locally.
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:5173',
    // Keep artifacts small: only capture when something actually fails.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },
  ],

  // Boot the Vite dev server for the suite; reuse a running one locally.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

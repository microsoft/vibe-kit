import { defineConfig, devices } from '@playwright/test'

/**
 * E3: Playwright E2E configuration.
 *
 * Runs against a locally-built vite preview on port 4173. Tests assume the
 * cached demo workflows are available so they don't require a live AML
 * endpoint — perfect for CI and offline smoke testing of the 4 demo presets.
 *
 * To run locally:
 *   npm run build
 *   npx playwright install chromium   # one-time
 *   npm run e2e
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})

import { defineConfig, devices } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// Replit/Nix ships a system Chromium at a fixed path. Use it only if present;
// otherwise fall back to Playwright's managed browser (CI: `npx playwright install`).
const NIX_CHROMIUM = '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium'
const chromiumPath = fs.existsSync(NIX_CHROMIUM) ? NIX_CHROMIUM : undefined
const AUTH_FILE = path.join(__dirname, 'playwright/.auth/user.json')
const isCI = !!process.env.CI

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],

  use: {
    baseURL: 'http://localhost:5000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: {
      ...(chromiumPath ? { executablePath: chromiumPath } : {}),
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    },
  },

  // Boot the app for the test run. Locally, reuse an already-running dev server;
  // in CI, start fresh (the workflow provides DATABASE_URL + a seeded Postgres).
  webServer: [
    {
      command: 'cd backend && npm run dev',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'cd frontend && npm run dev',
      url: 'http://localhost:5000',
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],

  projects: [
    // 1. Auth setup — runs once, mints an admin token via the API
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // 2. Auth tests — login/logout flows
    {
      name: 'auth-tests',
      testMatch: /auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // 3. App tests — smoke + FoxPro lifecycle, using saved auth state
    {
      name: 'app',
      testMatch: /(smoke|foxpro)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
      },
      dependencies: ['setup'],
    },
  ],
})

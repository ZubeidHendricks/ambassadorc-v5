import { defineConfig } from '@playwright/test'
import * as path from 'path'

const CHROMIUM_PATH = '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium'
const AUTH_FILE = path.join(__dirname, 'playwright/.auth/user.json')

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /prod-audit\.spec\.ts/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5000',
    storageState: AUTH_FILE,
    launchOptions: {
      executablePath: CHROMIUM_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    },
  },
})

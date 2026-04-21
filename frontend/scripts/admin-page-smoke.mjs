import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'

const FRONTEND_BASE = process.env.FRONTEND_BASE ?? 'http://127.0.0.1:5000'
const API_BASE = process.env.API_BASE ?? 'http://127.0.0.1:3001/api'
const requiresExplicitCredentials = process.env.CI === 'true' || process.env.NODE_ENV === 'production'
const ADMIN_MOBILE = process.env.SMOKE_ADMIN_MOBILE
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD

const adminPaths = [
  '/admin',
  '/admin/sales',
  '/admin/qa',
  '/admin/agents',
  '/admin/export-status',
  '/admin/reports',
  '/admin/ambassador-backend',
  '/admin/documents',
  '/admin/sms',
]

const operationsReportDownloads = [
  { type: 'export-status', button: 'Download Export Status' },
  { type: 'monthly-premium', button: 'Download Monthly Premium' },
  { type: 'global-book', button: 'Download Global Book' },
]


function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function chromiumLaunchOptions() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
    return { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
  }

  try {
    const executablePath = execFileSync('which', ['chromium'], { encoding: 'utf8' }).trim()
    return executablePath ? { executablePath } : {}
  } catch {
    return {}
  }
}

async function login() {
  if (requiresExplicitCredentials && (!ADMIN_MOBILE || !ADMIN_PASSWORD)) {
    throw new Error('Set SMOKE_ADMIN_MOBILE and SMOKE_ADMIN_PASSWORD before running smoke checks in CI or production')
  }

  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mobileNo: ADMIN_MOBILE ?? '0800000000',
      password: ADMIN_PASSWORD ?? 'Admin@2024',
    }),
  })
  const body = await response.json()
  assert(response.ok && body?.data?.token, 'Admin login failed for frontend smoke checks')
  return body.data.token
}

async function checkReportsDownloadControls(token) {
  const browser = await chromium.launch(chromiumLaunchOptions())
  const context = await browser.newContext()
  await context.addInitScript((adminToken) => {
    localStorage.setItem('ambassador_token', adminToken)
  }, token)
  const page = await context.newPage()
  const currentYear = String(new Date().getFullYear())

  try {
    await page.route('**/api/reports/operations/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: 'smoke',
      })
    })

    await page.goto(`${FRONTEND_BASE}/admin/reports`, { waitUntil: 'networkidle' })
    await page.getByRole('main').getByRole('heading', { name: 'Reports', exact: true }).waitFor()

    for (const report of operationsReportDownloads) {
      const button = page.getByRole('button', { name: report.button })
      await button.waitFor()
      assert(await button.isVisible(), `${report.button} control is not visible`)

      const [request] = await Promise.all([
        page.waitForRequest((candidate) => candidate.url().includes(`/api/reports/operations/${report.type}`)),
        button.click(),
      ])

      const url = new URL(request.url())
      assert(url.pathname === `/api/reports/operations/${report.type}`, `${report.button} requested ${url.pathname}`)
      assert(url.searchParams.get('year') === currentYear, `${report.button} did not include the selected report year`)
      await page.waitForFunction((name) => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const target = buttons.find((element) => element.textContent?.includes(name))
        return target && !target.disabled
      }, report.button)
    }
  } finally {
    await browser.close()
  }
}

async function main() {
  for (const path of adminPaths) {
    const response = await fetch(`${FRONTEND_BASE}${path}`)
    const body = await response.text()
    assert(response.ok, `${path} returned ${response.status}`)
    assert(body.includes('<div id="root">') || body.includes('<div id="root"></div>'), `${path} did not return the app shell`)
    assert(body.includes('/src/main.tsx') || body.includes('assets/'), `${path} did not include app assets`)
  }
  const token = await login()
  await checkReportsDownloadControls(token)
  console.log('Admin page smoke checks passed')
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})

import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const PROD = process.env.PROD_URL || 'https://lifesavercrm.com'
const OUT = path.join(process.cwd(), 'user-manual', 'screenshots')
const NIX_CHROMIUM = '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium'
const execPath = fs.existsSync(NIX_CHROMIUM) ? NIX_CHROMIUM : undefined

// name -> route. Order = manual flow.
const PAGES = [
  ['01-login', '/login', false],
  ['02-admin-dashboard', '/admin', true],
  ['03-clients', '/admin/clients', true],
  ['04-sales-pipeline', '/admin/sales', true],
  ['05-qa-mailbox', '/admin/qa', true],
  ['06-commissions', '/admin/commissions', true],
  ['07-policies', '/admin/policies', true],
  ['08-agents', '/admin/agents', true],
  ['09-premium-changes', '/admin/premium-changes', true],
  ['10-export-status', '/admin/export-status', true],
  ['11-reports', '/admin/reports', true],
  ['12-ambassador-backend', '/admin/ambassador-backend', true],
  ['13-documents', '/admin/documents', true],
  ['14-sms', '/admin/sms', true],
  ['15-products', '/admin/products', true],
  ['16-integrations', '/admin/integrations', true],
  ['17-sync-dashboard', '/admin/sync', true],
  ['18-ai-agents', '/admin/ai-agents', true],
  ['19-workflows', '/admin/workflows', true],
  ['20-lead-pipeline', '/admin/lead-pipeline', true],
  ['21-dialler', '/admin/dialler', true],
  ['22-leaderboard', '/leaderboard', true],
  ['23-ambassador-dashboard', '/dashboard', true],
  ['24-referrals', '/referrals', true],
  ['25-leads', '/leads', true],
]

const ERR_RE = /unexpected error|something went wrong|does not exist|failed to fetch|internal server error|cannot read propert|404 not found/i
const LOG = '/tmp/prodshots.log'
const START = Number(process.env.START || 0)
function logln(s) { process.stdout.write(s + '\n'); try { fs.appendFileSync(LOG, s + '\n') } catch {} }

async function main() {
  fs.mkdirSync(OUT, { recursive: true })

  // 1. login via API (credentials must be supplied via env, never hardcoded)
  const mobileNo = process.env.PROD_ADMIN_MOBILE
  const password = process.env.PROD_ADMIN_PASSWORD
  if (!mobileNo || !password) {
    throw new Error('Set PROD_ADMIN_MOBILE and PROD_ADMIN_PASSWORD env vars before running.')
  }
  const res = await fetch(`${PROD}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobileNo, password }),
  })
  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 300)
    throw new Error(`prod login HTTP ${res.status}: ${body}`)
  }
  const j = await res.json().catch(() => null)
  const token = j?.data?.token
  if (!token) throw new Error('prod login returned no token: ' + JSON.stringify(j))
  logln('Prod login OK, token acquired.\n')

  const browser = await chromium.launch({
    executablePath: execPath,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  let page = await ctx.newPage()
  page.setDefaultTimeout(25000)
  page.setDefaultNavigationTimeout(25000)

  // seed token into localStorage for the prod origin
  await page.goto(`${PROD}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((t) => localStorage.setItem('ambassador_token', t), token)

  const results = []
  const list = PAGES.slice(START)
  for (const [name, route, authed] of list) {
    const url = `${PROD}${route}`
    let status = 'ok'
    let detail = ''
    let consoleErrs = 0
    // recover the page if a previous renderer crash left it closed
    if (page.isClosed()) { page = await ctx.newPage(); page.setDefaultTimeout(25000); page.setDefaultNavigationTimeout(25000) }
    const onErr = (m) => { if (m.type() === 'error') consoleErrs++ }
    page.on('console', onErr)
    try {
      if (!authed) {
        // logged-out view: clear token
        await page.context().clearCookies()
        await page.goto(`${PROD}${route}`, { waitUntil: 'domcontentloaded' })
        await page.evaluate(() => localStorage.removeItem('ambassador_token'))
        await page.goto(`${PROD}${route}`, { waitUntil: 'domcontentloaded' })
      } else {
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        // re-seed token if it got cleared (after the logged-out page)
        await page.evaluate((t) => { if (!localStorage.getItem('ambassador_token')) localStorage.setItem('ambassador_token', t) }, token)
        await page.goto(url, { waitUntil: 'domcontentloaded' })
      }
      await page.waitForLoadState('networkidle', { timeout: 9000 }).catch(() => {})
      await page.waitForTimeout(2200)
      const body = await page.locator('body').innerText().catch(() => '')
      if (ERR_RE.test(body)) { status = 'ERROR_TEXT'; detail = (body.match(ERR_RE) || [''])[0] }
      else if (body.trim().length < 40) { status = 'EMPTY'; detail = `body ${body.trim().length} chars` }
      await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
    } catch (e) {
      status = 'NAV_FAIL'; detail = e.message.split('\n')[0]
    }
    page.off('console', onErr)
    if (status === 'ok' && consoleErrs > 0) detail = `${consoleErrs} console err(s)`
    results.push({ name, route, status, detail })
    const icon = status === 'ok' ? 'PASS' : 'WARN'
    logln(`[${icon}] ${route.padEnd(28)} ${status}${detail ? '  — ' + detail : ''}`)
  }

  await browser.close()

  const pass = results.filter(r => r.status === 'ok').length
  logln(`\n${'='.repeat(56)}`)
  logln(`SUMMARY: ${pass}/${results.length} pages rendered cleanly`)
  const bad = results.filter(r => r.status !== 'ok')
  if (bad.length) logln('Needs attention: ' + bad.map(r => `${r.route}(${r.status})`).join(', '))
  logln(`Screenshots: ${OUT}`)
}

main().catch((e) => { console.error(e); process.exit(1) })

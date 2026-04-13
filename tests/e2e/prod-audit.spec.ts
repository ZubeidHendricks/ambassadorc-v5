import { test, expect, Page } from '@playwright/test'

// Uses stored auth state from playwright/.auth/user.json
// Visits every main page and reports which have data

interface PageResult {
  page: string
  url: string
  hasData: boolean
  detail: string
}

const results: PageResult[] = []

function log(r: PageResult) {
  results.push(r)
  const icon = r.hasData ? '✅' : '❌'
  console.log(`${icon} ${r.page.padEnd(24)} ${r.detail}`)
}

async function countRows(page: Page, selectors = 'table tbody tr'): Promise<number> {
  try { return await page.locator(selectors).count() } catch { return 0 }
}

async function bodyText(page: Page): Promise<string> {
  try { return await page.locator('body').innerText() } catch { return '' }
}

test('Production data audit', async ({ page }) => {
  console.log('\n' + '═'.repeat(60))
  console.log('  PRODUCTION DATA AUDIT — ' + new Date().toISOString())
  console.log('═'.repeat(60))

  // ── ADMIN DASHBOARD ───────────────────────────────────────────────────────
  await page.goto('/admin', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  const dashText = await bodyText(page)
  const dashNumbers = dashText.match(/[\d,]{2,}/g) ?? []
  log({ page: 'Admin Dashboard', url: '/admin',
    hasData: dashNumbers.length >= 3,
    detail: dashNumbers.length >= 3 ? `${dashNumbers.slice(0,4).join(', ')}` : 'No stat numbers' })

  // ── CLIENTS ──────────────────────────────────────────────────────────────
  await page.goto('/admin/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  const clientRows = await countRows(page)
  const clientText = await bodyText(page)
  const clientTotal = clientText.match(/(\d[\d,]+)\s*(client|total|result)/i)?.[1]
  log({ page: 'Clients', url: '/admin/clients',
    hasData: clientRows > 0,
    detail: clientRows > 0 ? `${clientRows} rows visible` : clientTotal ? `Total: ${clientTotal}` : 'No rows' })

  // ── CLIENT DETAIL ────────────────────────────────────────────────────────
  await page.goto('/admin/clients/103451', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  const detailText = await bodyText(page)
  const has404 = /not found|404|doesn.t exist/i.test(detailText)
  const hasClientName = /[A-Z][a-z]{2,} [A-Z][a-z]{2,}/.test(detailText) && !has404
  log({ page: 'Client Detail', url: '/admin/clients/103451',
    hasData: hasClientName,
    detail: has404 ? '404 Not Found' : hasClientName ? 'Client data visible' : 'Empty/no data' })

  // ── AGENTS ───────────────────────────────────────────────────────────────
  await page.goto('/admin/agents', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  const agentRows = await countRows(page, 'table tbody tr, .agent-row, [data-agent]')
  const agentText = await bodyText(page)
  const agentTotal = agentText.match(/(\d[\d,]+)\s*(agent|ambassador)/i)?.[1]
  log({ page: 'Agents', url: '/admin/agents',
    hasData: agentRows > 0,
    detail: agentRows > 0 ? `${agentRows} rows` : agentTotal ? `Total: ${agentTotal}` : 'No data' })

  // ── SALES (kanban default view — cards are plain divs) ───────────────────
  await page.goto('/admin/sales', { waitUntil: 'networkidle' })
  await page.waitForTimeout(4000)
  const salesRows = await countRows(page)
  // Kanban cards: each sale is a rounded-xl div inside a space-y-3 container
  const salesKanbanCols = await page.locator('div.w-72.shrink-0').count()
  const salesCardDivs = await page.locator('div.space-y-3 > div.rounded-xl').count()
  const salesText = await bodyText(page)
  // Check for client names or agent names in the body text (at least 3 proper names)
  const salesNames = (salesText.match(/[A-Z][a-z]{2,} [A-Z][a-z]{2,}/g) ?? []).length
  log({ page: 'Sales', url: '/admin/sales',
    hasData: salesRows > 0 || salesCardDivs > 0 || salesKanbanCols >= 5 || salesNames >= 5,
    detail: salesRows > 0 ? `${salesRows} table rows` : salesCardDivs > 0 ? `${salesCardDivs} kanban cards` : salesKanbanCols >= 5 ? `${salesKanbanCols} kanban columns loaded` : salesNames >= 5 ? `${salesNames} names visible` : 'No data detected' })

  // ── POLICIES ─────────────────────────────────────────────────────────────
  await page.goto('/admin/policies', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  const policyRows = await countRows(page)
  const policyText = await bodyText(page)
  const policyTotal = policyText.match(/(\d[\d,]+)/)?.[1]
  log({ page: 'Policies', url: '/admin/policies',
    hasData: policyRows > 0,
    detail: policyRows > 0 ? `${policyRows} rows` : `Total counter: ${policyTotal ?? 'none'}` })

  // ── COMMISSIONS ──────────────────────────────────────────────────────────
  await page.goto('/admin/commissions', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  const commRows = await countRows(page)
  const commText = await bodyText(page)
  const commAmount = commText.match(/R\s*[\d,.]+/)?.[0]
  log({ page: 'Commissions', url: '/admin/commissions',
    hasData: commRows > 0 || !!commAmount,
    detail: commRows > 0 ? `${commRows} rows` : commAmount ? `Amount: ${commAmount}` : 'No data' })

  // ── QA (renders as cards not table rows) ─────────────────────────────────
  await page.goto('/admin/qa', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  const qaRows = await countRows(page)
  const qaCards = await page.locator('[class*="card"], [class*="qa"], [class*="check"]').count()
  const qaText = await bodyText(page)
  // Also check total from pagination text
  const qaTotal = qaText.match(/(\d[\d,]+)\s*(check|result|total|item|record)/i)?.[1]
  const qaHasClientName = (qaText.match(/[A-Z][a-z]+ [A-Z][a-z]+/g) ?? []).length >= 2
  log({ page: 'QA', url: '/admin/qa',
    hasData: qaRows > 0 || qaCards > 2 || !!qaTotal || qaHasClientName,
    detail: qaRows > 0 ? `${qaRows} rows` : qaCards > 2 ? `${qaCards} cards` : qaTotal ? `Total: ${qaTotal}` : qaHasClientName ? 'Client names visible' : 'No data' })

  // ── DOCUMENTS ────────────────────────────────────────────────────────────
  await page.goto('/admin/documents', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  const docRows = await countRows(page)
  log({ page: 'Documents', url: '/admin/documents',
    hasData: docRows > 0,
    detail: docRows > 0 ? `${docRows} rows` : 'No rows' })

  // ── PRODUCTS ─────────────────────────────────────────────────────────────
  await page.goto('/admin/products', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  const productText = await bodyText(page)
  const hasProductNames = /Life Saver|LegalNet|Five.In.One/i.test(productText)
  const productCards = await page.locator('[class*="card"], [class*="product"]').count()
  log({ page: 'Products', url: '/admin/products',
    hasData: hasProductNames || productCards > 0,
    detail: hasProductNames ? 'Product names visible' : productCards > 0 ? `${productCards} cards` : 'No products' })

  // ── PREMIUM CHANGES ───────────────────────────────────────────────────────
  await page.goto('/admin/premium-changes', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  const premRows = await countRows(page)
  log({ page: 'Premium Changes', url: '/admin/premium-changes',
    hasData: premRows > 0,
    detail: premRows > 0 ? `${premRows} rows` : 'No rows' })

  // ── LEADERBOARD ───────────────────────────────────────────────────────────
  await page.goto('/leaderboard', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  const lbRows = await countRows(page, 'table tbody tr, [class*="rank"], [class*="leaderboard"] > *')
  const lbText = await bodyText(page)
  const hasAmbassadorNames = (lbText.match(/[A-Z][a-z]+ [A-Z][a-z]+/g) ?? []).length >= 2
  log({ page: 'Leaderboard', url: '/leaderboard',
    hasData: lbRows > 0 || hasAmbassadorNames,
    detail: lbRows > 0 ? `${lbRows} entries` : hasAmbassadorNames ? 'Names visible' : 'Empty' })

  // ── WORKFLOWS ────────────────────────────────────────────────────────────
  await page.goto('/admin/workflows', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  const wfRows = await countRows(page, 'table tbody tr, [class*="workflow"]')
  const wfText = await bodyText(page)
  const hasWfNames = /onboard|referral|policy|commission/i.test(wfText)
  log({ page: 'Workflows', url: '/admin/workflows',
    hasData: wfRows > 0 || hasWfNames,
    detail: wfRows > 0 ? `${wfRows} items` : hasWfNames ? 'Workflow names visible' : 'No data' })

  // ── INTEGRATIONS ─────────────────────────────────────────────────────────
  await page.goto('/admin/integrations', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  const intgText = await bodyText(page)
  const hasIntgNames = /QLink|SagePay|NetCash|GuardRisk|WATI|Vici/i.test(intgText)
  log({ page: 'Integrations', url: '/admin/integrations',
    hasData: hasIntgNames,
    detail: hasIntgNames ? 'Integration cards visible' : 'No integrations' })

  // ── SYNC ─────────────────────────────────────────────────────────────────
  await page.goto('/admin/sync', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  const syncText = await bodyText(page)
  const hasSyncData = /sync_|row|synced|checkpoint/i.test(syncText)
  log({ page: 'Sync Dashboard', url: '/admin/sync',
    hasData: hasSyncData,
    detail: hasSyncData ? 'Sync info visible' : 'No sync data' })

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60))
  const withData = results.filter(r => r.hasData)
  const noData = results.filter(r => !r.hasData)
  console.log(`SUMMARY: ${withData.length} pages have data, ${noData.length} are empty`)
  if (noData.length) {
    console.log('Empty pages: ' + noData.map(r => r.page).join(', '))
  }
  console.log('═'.repeat(60) + '\n')

  expect(results.length).toBeGreaterThan(0)
})

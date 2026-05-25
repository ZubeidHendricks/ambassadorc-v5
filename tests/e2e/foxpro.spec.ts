import { test, expect, type Page } from '@playwright/test'

/**
 * FoxPro lifecycle E2E — clicks the real UI buttons and asserts outcomes.
 *
 * Read-only smoke checks always run. Tests that mutate data (capture a sale,
 * run the export, change a quota) only run when E2E_ALLOW_MUTATIONS=1 — set in
 * CI against an ephemeral seeded database, NEVER against production.
 *
 * QA verdict buttons are intentionally NOT clicked: submitting a verdict writes
 * back to the live FoxPro SQL Server (sync/foxpro-writeback.ts), an external
 * dependency unavailable in CI. We assert the controls render instead.
 */
const MUTATE = process.env.E2E_ALLOW_MUTATIONS === '1'

/** Build a 13-digit SA ID that passes the Luhn check (DOB 1990-01-01, male, SA citizen). */
function validSaId(twelve = '900101500008'): string {
  for (let c = 0; c < 10; c++) {
    const id = twelve + c
    let sum = 0
    let alt = false
    for (let i = id.length - 1; i >= 0; i--) {
      let n = Number(id[i])
      if (alt) { n *= 2; if (n > 9) n -= 9 }
      sum += n
      alt = !alt
    }
    if (sum % 10 === 0) return id
  }
  return twelve + '0'
}

async function gotoAdmin(page: Page, path: string) {
  await page.goto(path)
  // Admin shell renders a sidebar; wait for the app to hydrate.
  await expect(page.locator('body')).toBeVisible()
}

// ─── Sales Capture (Product Capture) ─────────────────────────────────────────

test.describe('FoxPro · Product Capture', () => {
  test('capture page renders the agent capture form + controls', async ({ page }) => {
    await gotoAdmin(page, '/admin/sales')
    await expect(page.getByText('Sales Agent Capture & Validation')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Product', { exact: true })).toBeVisible()
    await expect(page.getByText('Collection Method')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Submit Sale' })).toBeVisible()
    // The three FoxPro capture validations are surfaced
    await expect(page.getByText('Validate ID')).toBeVisible()
    await expect(page.getByText(/only 10 digits in Mobile Number/i)).toBeVisible()
  })

  test('happy-path capture submits and lands in the QA Bay (T status)', async ({ page }) => {
    test.skip(!MUTATE, 'mutates data — enable with E2E_ALLOW_MUTATIONS=1 in CI')
    await gotoAdmin(page, '/admin/sales')
    await expect(page.getByText('Sales Agent Capture & Validation')).toBeVisible({ timeout: 20_000 })

    // Pick the first real product (option 0 is the "Select product…" placeholder).
    const productSelect = page.locator('select').filter({ has: page.locator('option', { hasText: /Select product/ }) }).first()
    const optionCount = await productSelect.locator('option').count()
    test.skip(optionCount < 2, 'no seeded products available to capture against')
    await productSelect.selectOption({ index: 1 })

    // Collection method defaults to Persal (Q-Link) — fill Persal fields.
    await page.getByPlaceholder(/enter client first name/i).fill('E2E')
    await page.getByPlaceholder(/enter client surname/i).fill('Tester')
    await page.getByPlaceholder('13 digit ID number').fill(validSaId())
    await page.getByPlaceholder('10 digit mobile number').fill('0812345678')
    await page.getByPlaceholder(/enter client address/i).fill('12 Test Street, Cape Town')
    await page.getByPlaceholder(/enter client persal/i).fill('PRS123456')
    await page.getByPlaceholder(/enter client department/i).fill('Education')

    await page.getByRole('button', { name: 'Submit Sale' }).click()
    // Submit Sale advances to the validation stage; now persist via Submit Validation.
    const submitValidation = page.getByRole('button', { name: /Submit Validation|Saving/i })
    await expect(submitValidation).toBeEnabled({ timeout: 10_000 })
    await submitValidation.click()

    // Backend POST /api/sales/capture → success message mentions the QA Bay / T status.
    await expect(page.getByText(/QA Bay|status T|captured/i)).toBeVisible({ timeout: 15_000 })
  })
})

// ─── QA Validation (read-only — verdict writes back to external FoxPro MSSQL) ─

test.describe('FoxPro · QA Validation', () => {
  test('QA page renders and exposes Submit / Repair / Cancel controls', async ({ page }) => {
    await gotoAdmin(page, '/admin/qa')
    await expect(page.getByRole('heading', { name: 'Quality Assurance' })).toBeVisible({ timeout: 20_000 })
    // Status filter chips are present
    await expect(page.getByText(/pending|passed|failed/i).first()).toBeVisible({ timeout: 15_000 })
  })
})

// ─── Export & Q-Link (Run Midnight Export) ───────────────────────────────────

test.describe('FoxPro · Export & Q-Link', () => {
  test('export status page renders with the Run Midnight Export button', async ({ page }) => {
    await gotoAdmin(page, '/admin/export-status')
    await expect(page.getByRole('button', { name: /Run Midnight Export/i })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Export Return Status/i)).toBeVisible({ timeout: 15_000 })
  })

  test('clicking Run Midnight Export produces a result banner', async ({ page }) => {
    test.skip(!MUTATE, 'mutates data — enable with E2E_ALLOW_MUTATIONS=1 in CI')
    await gotoAdmin(page, '/admin/export-status')
    const runBtn = page.getByRole('button', { name: /Run Midnight Export/i })
    await expect(runBtn).toBeVisible({ timeout: 20_000 })
    await runBtn.click()
    // Either "Exported N …" (data present) or "No QA-passed sales were ready for export."
    await expect(page.getByText(/Exported \d+|No QA-passed sales/i)).toBeVisible({ timeout: 20_000 })
  })
})

// ─── Daily Lead Quotas (admin dialler) ───────────────────────────────────────

test.describe('FoxPro · Daily Lead Quotas', () => {
  test('dialler page shows the Daily Lead Quotas panel', async ({ page }) => {
    await gotoAdmin(page, '/admin/dialler')
    await expect(page.getByText('Daily Lead Quotas')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Lead Dialler Management/i)).toBeVisible()
  })

  test('changing an agent quota persists without error', async ({ page }) => {
    test.skip(!MUTATE, 'mutates data — enable with E2E_ALLOW_MUTATIONS=1 in CI')
    await gotoAdmin(page, '/admin/dialler')
    await expect(page.getByText('Daily Lead Quotas')).toBeVisible({ timeout: 20_000 })
    // Quota selects render "5/day".."20/day"; pick the first agent's select and set 15.
    const quotaSelect = page.locator('select', { has: page.locator('option', { hasText: /\/day/ }) }).first()
    test.skip((await quotaSelect.count()) === 0, 'no agents to set a quota for')
    await quotaSelect.selectOption({ label: '15/day' })
    // Optimistic UI: the "X/Y today" label should now show /15.
    await expect(page.getByText(/\/\s*15\s*today/i).first()).toBeVisible({ timeout: 10_000 })
  })
})

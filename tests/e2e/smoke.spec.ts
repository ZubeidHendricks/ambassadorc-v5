import { test, expect } from '@playwright/test'

// All tests run with pre-authenticated storageState (ambassador_token in localStorage)
// Set via auth.setup.ts → playwright/.auth/user.json

test.describe('Dashboard', () => {
  test('loads stat cards after auth', async ({ page }) => {
    await page.goto('/dashboard')
    // Wait for any stat card with a number
    await expect(page.locator('text=/\\d{1,3}(,\\d{3})*|\\d+K\\+/').first()).toBeVisible({ timeout: 15_000 })
  })
})

// ─── Clients ─────────────────────────────────────────────────────────────────

test.describe('Clients', () => {
  test('list loads with at least one row', async ({ page }) => {
    await page.goto('/admin/clients')
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 20_000 })
  })

  test('search input is present', async ({ page }) => {
    await page.goto('/admin/clients')
    await page.waitForSelector('table tbody tr', { timeout: 20_000 })
    await expect(page.locator('input[placeholder*="earch"]').first()).toBeVisible()
  })

  test('client detail page loads for real client', async ({ page }) => {
    // Verify client detail page loads by navigating directly (row click uses React synthetic events)
    await page.goto('/admin/clients')
    await page.waitForSelector('table tbody tr', { timeout: 20_000 })
    // Get the first row's ID via the data or navigate to a known valid client
    await page.goto('/admin/clients/103451')
    await page.waitForURL(/\/admin\/clients\/\d+/, { timeout: 10_000 })
    await expect(page.locator('text=/Thabang|policy|Policy|Payment|payment/i').first()).toBeVisible({ timeout: 15_000 })
  })
})

// ─── Policies ────────────────────────────────────────────────────────────────

test.describe('Policies', () => {
  test('list loads with rows', async ({ page }) => {
    await page.goto('/admin/policies')
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 20_000 })
  })

  test('premium amounts visible (R129 or R199)', async ({ page }) => {
    await page.goto('/admin/policies')
    await page.waitForSelector('table tbody tr', { timeout: 20_000 })
    const amount = page.locator('text=/R1[23][0-9]|R199|R129/')
    await expect(amount.first()).toBeVisible({ timeout: 10_000 })
  })

  test('row count is above zero', async ({ page }) => {
    await page.goto('/admin/policies')
    await page.waitForSelector('table tbody tr', { timeout: 20_000 })
    const count = await page.locator('table tbody tr').count()
    expect(count).toBeGreaterThan(0)
  })
})

// ─── QA ──────────────────────────────────────────────────────────────────────

test.describe('QA', () => {
  test('mailbox worksheet table renders', async ({ page }) => {
    await page.goto('/admin/qa')
    // QA mailbox is a worksheet-style table, not cards
    await expect(page.locator('table thead').first()).toBeVisible({ timeout: 20_000 })
  })

  test('shows mailbox columns (client name, agent, actions)', async ({ page }) => {
    await page.goto('/admin/qa')
    await page.waitForSelector('table thead', { timeout: 20_000 })
    await expect(page.locator('th:has-text("Client Name")')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('th:has-text("Sales Verification Agent")')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('th:has-text("SUBMIT")')).toBeVisible({ timeout: 10_000 })
  })
})

// ─── Commissions ─────────────────────────────────────────────────────────────

test.describe('Commissions', () => {
  test('page loads with rows', async ({ page }) => {
    await page.goto('/admin/commissions')
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 20_000 })
  })

  test('commission amounts are R129 or R199 (not zero)', async ({ page }) => {
    await page.goto('/admin/commissions')
    await page.waitForSelector('table tbody tr', { timeout: 20_000 })
    await expect(page.locator('text=/R1[23][0-9]|R199|R129/').first()).toBeVisible({ timeout: 10_000 })
  })

  test('summary banner shows non-zero total amount', async ({ page }) => {
    await page.goto('/admin/commissions')
    // Summary should show something like R15,154,338 or R15M+
    await expect(page.locator('text=/R\\d{1,3}(,\\d{3})+|R\\d{4,}/').first()).toBeVisible({ timeout: 20_000 })
  })
})

// ─── Agents ──────────────────────────────────────────────────────────────────

test.describe('Agents', () => {
  test('call centre control page loads', async ({ page }) => {
    await page.goto('/admin/agents')
    await page.waitForSelector('text=Agents & Campaign Assignment', { timeout: 20_000 })
  })

  test('agent table loads with at least one agent row', async ({ page }) => {
    await page.goto('/admin/agents')
    await page.waitForSelector('text=Agents & Campaign Assignment', { timeout: 20_000 })
    // System Admin is the permanent admin fixture and must always be listed
    await expect(page.locator('text=System Admin').first()).toBeVisible({ timeout: 10_000 })
  })

  test('agents show Active status badge', async ({ page }) => {
    await page.goto('/admin/agents')
    await page.waitForSelector('text=Agents & Campaign Assignment', { timeout: 20_000 })
    // Status badge renders exactly "Active" (distinct from "Active Campaigns" labels)
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('leaderboard and earnings sections render', async ({ page }) => {
    await page.goto('/admin/agents')
    await page.waitForSelector('text=Agents & Campaign Assignment', { timeout: 20_000 })
    await expect(page.locator('text=Monthly Leaderboard').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Top Performer').first()).toBeVisible({ timeout: 10_000 })
  })
})

// ─── Premium Changes ──────────────────────────────────────────────────────────

test.describe('Premium Changes', () => {
  test('page loads with product rows', async ({ page }) => {
    await page.goto('/admin/premium-changes')
    // Worksheet renders product rows as a CSS grid, not a <table>
    await expect(page.locator('text=Lifesaver 24 Basic').first()).toBeVisible({ timeout: 20_000 })
  })

  test('current premium values shown (not zero)', async ({ page }) => {
    await page.goto('/admin/premium-changes')
    await page.waitForSelector('text=Lifesaver 24 Basic', { timeout: 20_000 })
    await expect(page.locator('text=/R\\s?[1-9]\\d{2}/').first()).toBeVisible({ timeout: 10_000 })
  })
})

// ─── Documents / Welcome Packs ────────────────────────────────────────────────

test.describe('Documents', () => {
  test('page loads with heading', async ({ page }) => {
    await page.goto('/admin/documents')
    await expect(page.locator('text=/Welcome|Document/i').first()).toBeVisible({ timeout: 15_000 })
  })

  test('welcome pack records load in table', async ({ page }) => {
    await page.goto('/admin/documents')
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 20_000 })
  })
})

// ─── Workflows ───────────────────────────────────────────────────────────────

test.describe('Workflows', () => {
  test('page heading is visible', async ({ page }) => {
    await page.goto('/admin/workflows')
    await expect(page.locator('text=Workflow Management')).toBeVisible({ timeout: 15_000 })
  })

  test('stat cards show numbers (not "undefined")', async ({ page }) => {
    await page.goto('/admin/workflows')
    await expect(page.locator('text=Active Workflows')).toBeVisible({ timeout: 15_000 })
    // "undefined" must not appear anywhere on the page
    await expect(page.locator('text=undefined')).not.toBeVisible()
  })

  test('workflow templates are listed', async ({ page }) => {
    await page.goto('/admin/workflows')
    await expect(page.locator('text=/Premium Increase|Payment Failed|Onboarding|New Client/').first()).toBeVisible({ timeout: 15_000 })
  })

  test('expanding a workflow card shows step pipeline', async ({ page }) => {
    await page.goto('/admin/workflows')
    // Wait for workflow template names (from the API)
    await page.waitForSelector('text=/Premium Increase|Payment Failed|Onboarding/', { timeout: 15_000 })
    // Click the first workflow card (which contains the title text)
    const firstCard = page.locator('text=/Premium Increase|Payment Failed|New Client|Onboarding/').first()
    await firstCard.click()
    // After expanding, step pipeline nodes should appear
    await expect(page.locator('text=/Send|Approval|Wait|Update|Webhook|Agent/').first()).toBeVisible({ timeout: 8_000 })
  })
})

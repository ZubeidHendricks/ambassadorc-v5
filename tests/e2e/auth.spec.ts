import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5000'
const LOGIN = `${BASE}/login`

test.describe('Auth', () => {
  test('login page loads with form', async ({ page }) => {
    await page.goto(LOGIN)
    await expect(page.locator('text=Welcome back')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('input[type="tel"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible()
  })

  test('invalid credentials shows error message', async ({ page }) => {
    await page.goto(LOGIN)
    await page.waitForSelector('input[type="tel"]', { timeout: 10_000 })
    await page.fill('input[type="tel"]', '0700000000')
    await page.fill('input[type="password"]', 'WrongPass123')
    await page.click('button:has-text("Sign In")')
    const error = page.locator('[class*="red"],[class*="error"],[class*="destructive"],text=Invalid,text=incorrect')
    await expect(error.first()).toBeVisible({ timeout: 8_000 })
  })

  test('valid credentials redirect away from login', async ({ page }) => {
    await page.goto(LOGIN)
    await page.waitForSelector('input[type="tel"]', { timeout: 10_000 })
    await page.fill('input[type="tel"]', '0800000000')
    await page.fill('input[type="password"]', 'Admin@2024')
    await page.click('button:has-text("Sign In")')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 })
  })
})

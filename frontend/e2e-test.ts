import { chromium } from 'playwright';

const BASE = 'http://142.93.44.48';
const ADMIN_MOBILE = '0800000000';
const ADMIN_PASS = 'Admin@2024';

interface TestResult {
  page: string;
  path: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
  apiCalls: { url: string; status: number; hasData: boolean }[];
  errors: string[];
}

async function main() {
  const results: TestResult[] = [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Track API calls and console errors
  const apiCalls: { url: string; status: number; body: string }[] = [];
  const consoleErrors: string[] = [];

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/')) {
      let body = '';
      try { body = await response.text(); } catch {}
      apiCalls.push({ url: url.replace(BASE, ''), status: response.status(), body });
    }
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(`PAGE ERROR: ${err.message}`);
  });

  function resetTracking() {
    apiCalls.length = 0;
    consoleErrors.length = 0;
  }

  function getApiSummary() {
    return apiCalls.map((c) => {
      let hasData = false;
      try {
        const json = JSON.parse(c.body);
        hasData = json.success === true && json.data !== undefined;
      } catch {}
      return { url: c.url, status: c.status, hasData };
    });
  }

  // ─── Test 1: Landing page ───
  console.log('\n═══ Testing Landing Page ═══');
  resetTracking();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const landingTitle = await page.title();
  const hasGetStarted = await page.locator('text=Get Started').count();
  results.push({
    page: 'Landing',
    path: '/',
    status: hasGetStarted > 0 ? 'PASS' : 'FAIL',
    details: `Title: "${landingTitle}", Get Started button: ${hasGetStarted > 0 ? 'YES' : 'NO'}`,
    apiCalls: getApiSummary(),
    errors: [...consoleErrors],
  });

  // ─── Test 2: Login ───
  console.log('═══ Testing Login ═══');
  resetTracking();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[id="mobileNo"]', ADMIN_MOBILE);
  await page.fill('input[id="password"]', ADMIN_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin**', { timeout: 10000 }).catch(() => {});
  const currentUrl = page.url();
  const loginSuccess = currentUrl.includes('/admin');
  results.push({
    page: 'Login',
    path: '/login',
    status: loginSuccess ? 'PASS' : 'FAIL',
    details: `Redirected to: ${currentUrl}`,
    apiCalls: getApiSummary(),
    errors: [...consoleErrors],
  });

  if (!loginSuccess) {
    console.log('LOGIN FAILED - cannot continue testing protected pages');
    printResults(results);
    await browser.close();
    return;
  }

  // ─── Define all pages to test ───
  const pagesToTest = [
    // Admin pages
    { name: 'Admin Dashboard', path: '/admin' },
    { name: 'Clients', path: '/admin/clients' },
    { name: 'Sales', path: '/admin/sales' },
    { name: 'Commissions', path: '/admin/commissions' },
    { name: 'Quality Assurance', path: '/admin/qa' },
    { name: 'Policies', path: '/admin/policies' },
    { name: 'Products', path: '/admin/products' },
    { name: 'Premium Changes', path: '/admin/premium-changes' },
    { name: 'Agents', path: '/admin/agents' },
    { name: 'AI Agents', path: '/admin/ai-agents' },
    { name: 'Workflows', path: '/admin/workflows' },
    { name: 'Documents', path: '/admin/documents' },
    { name: 'SMS Center', path: '/admin/sms' },
    { name: 'Integrations', path: '/admin/integrations' },
    // Ambassador pages
    { name: 'Ambassador Dashboard', path: '/dashboard' },
    { name: 'Submit Referrals', path: '/referrals' },
    { name: 'Referral History', path: '/referrals/history' },
    { name: 'Submit Lead', path: '/leads' },
    { name: 'Lead History', path: '/leads/history' },
    { name: 'Leaderboard', path: '/leaderboard' },
    { name: 'Profile', path: '/profile' },
  ];

  for (const p of pagesToTest) {
    console.log(`═══ Testing ${p.name} (${p.path}) ═══`);
    resetTracking();

    try {
      await page.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500); // Let async data load

      // Check for blank page
      const bodyText = await page.locator('body').innerText().catch(() => '');
      const isBlank = bodyText.trim().length < 20;

      // Check for React error boundaries
      const hasErrorBoundary = await page.locator('text=Something went wrong').count();

      // Check for visible content
      const hasHeading = await page.locator('h1, h2').first().isVisible().catch(() => false);

      // Check for "No data" or empty states (not failures)
      const hasEmptyState = await page.locator('text=No data,text=No results,text=no activity,text=No referrals,text=No leads,text=No agents,text=empty').count();

      // Check for mock data markers
      const pageContent = await page.content();
      const hasMockData = /Sarah Mbeki|James Nkosi|Thandi Zulu|85766|156400|34200/.test(pageContent);

      // Determine status
      let status: 'PASS' | 'FAIL' | 'WARN' = 'PASS';
      let details = '';

      if (isBlank || hasErrorBoundary > 0) {
        status = 'FAIL';
        details = isBlank ? 'BLANK PAGE - no visible content' : 'React error boundary triggered';
      } else if (hasMockData) {
        status = 'FAIL';
        details = 'MOCK DATA still present on page';
      } else if (!hasHeading) {
        status = 'WARN';
        details = 'Page loaded but no heading found';
      } else {
        const failedApis = apiCalls.filter((c) => c.status >= 400);
        if (failedApis.length > 0) {
          status = 'WARN';
          details = `Page rendered but ${failedApis.length} API call(s) failed: ${failedApis.map((c) => `${c.url}=${c.status}`).join(', ')}`;
        } else {
          details = `OK - ${apiCalls.filter((c) => c.status < 400).length} API calls succeeded`;
          if (hasEmptyState > 0) details += ' (empty state shown - no data yet)';
        }
      }

      results.push({
        page: p.name,
        path: p.path,
        status,
        details,
        apiCalls: getApiSummary(),
        errors: [...consoleErrors],
      });
    } catch (err: any) {
      results.push({
        page: p.name,
        path: p.path,
        status: 'FAIL',
        details: `EXCEPTION: ${err.message}`,
        apiCalls: getApiSummary(),
        errors: [...consoleErrors],
      });
    }
  }

  await browser.close();
  printResults(results);
}

function printResults(results: TestResult[]) {
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                        E2E TEST RESULTS SUMMARY                             ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');

  const passed = results.filter((r) => r.status === 'PASS').length;
  const warned = results.filter((r) => r.status === 'WARN').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  for (const r of results) {
    const icon = r.status === 'PASS' ? 'OK' : r.status === 'WARN' ? '!!' : 'XX';
    console.log(`  [${icon}] ${r.page.padEnd(22)} ${r.path.padEnd(24)} ${r.details}`);
    if (r.errors.length > 0) {
      for (const e of r.errors.slice(0, 3)) {
        console.log(`       ERROR: ${e.substring(0, 100)}`);
      }
    }
    if (r.status !== 'PASS') {
      for (const api of r.apiCalls) {
        if (api.status >= 400) {
          console.log(`       API FAIL: ${api.url} -> ${api.status}`);
        }
      }
    }
  }

  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  console.log(`║  TOTAL: ${results.length}  |  PASS: ${passed}  |  WARN: ${warned}  |  FAIL: ${failed}${' '.repeat(30)}║`);
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

  // Detailed API call log
  console.log('\n── API CALLS PER PAGE ──');
  for (const r of results) {
    if (r.apiCalls.length > 0) {
      console.log(`\n  ${r.page} (${r.path}):`);
      for (const api of r.apiCalls) {
        const icon = api.status < 400 ? (api.hasData ? 'OK+DATA' : 'OK-EMPTY') : 'FAILED';
        console.log(`    [${icon}] ${api.status} ${api.url}`);
      }
    }
  }
}

main().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});

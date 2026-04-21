import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

const FRONTEND_BASE = process.env.FRONTEND_BASE ?? 'http://127.0.0.1:5000'

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

const dashboardRequiredText = [
  'Marketing &amp; Ambassador App',
  'Engagement, Onboarding &amp; Collections',
  'Client Communications',
  'FoxPro Operations Center',
  'QA validation passed',
  'Exported awaiting outcome',
  'Q-Link uploaded',
  'RC/C',
  't1',
  'u',
  'Policy Attachment',
  'Commission Ratio',
  'Operations Activity',
  'Current workflow focus',
  'First App: Ambassador Marketing',
  'Ambassador Backend &amp; FNB Cycle',
  'Admin required',
]

const smokeUserBase = {
  firstName: 'Smoke',
  lastName: 'User',
  mobileNo: '0000000000',
  email: 'smoke@example.com',
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function visibleRoutesForRole(sections, role) {
  return sections
    .filter((section) => !section.roles || section.roles.includes(role))
    .flatMap((section) => section.items)
    .filter((item) => !item.roles || item.roles.includes(role))
    .map((item) => item.to)
}

function assertRouteVisible(routes, route, role) {
  assert(routes.includes(route), `${role} cannot see ${route} navigation`)
}

function assertRouteHidden(routes, route, role) {
  assert(!routes.includes(route), `${role} should not see ${route} navigation`)
}

async function assertRoleNavigation(sections) {
  const marketingSection = sections.find((section) => section.id === 'marketing-agents')
  assert(marketingSection, 'Marketing navigation section is missing')
  assert(marketingSection.roles?.includes('AMBASSADOR'), 'Marketing navigation is not visible to ambassadors')

  const ambassadorRoutes = visibleRoutesForRole(sections, 'AMBASSADOR')
  assertRouteVisible(ambassadorRoutes, '/referrals', 'AMBASSADOR')
  assertRouteVisible(ambassadorRoutes, '/leads', 'AMBASSADOR')
  assertRouteHidden(ambassadorRoutes, '/admin/agents', 'AMBASSADOR')
  assertRouteHidden(ambassadorRoutes, '/admin/ambassador-backend', 'AMBASSADOR')

  const qaRoutes = visibleRoutesForRole(sections, 'QA_OFFICER')
  assertRouteVisible(qaRoutes, '/admin', 'QA_OFFICER')
  assertRouteVisible(qaRoutes, '/admin/qa', 'QA_OFFICER')
  assertRouteVisible(qaRoutes, '/admin/export-status', 'QA_OFFICER')
  assertRouteVisible(qaRoutes, '/admin/documents', 'QA_OFFICER')
  assertRouteHidden(qaRoutes, '/referrals/history', 'QA_OFFICER')
  assertRouteHidden(qaRoutes, '/leads/history', 'QA_OFFICER')
  assertRouteHidden(qaRoutes, '/payments', 'QA_OFFICER')
  assertRouteHidden(qaRoutes, '/referrals', 'QA_OFFICER')
  assertRouteHidden(qaRoutes, '/leads', 'QA_OFFICER')
  assertRouteHidden(qaRoutes, '/admin/reports', 'QA_OFFICER')
  assertRouteHidden(qaRoutes, '/admin/sms', 'QA_OFFICER')

  const adminRoutes = visibleRoutesForRole(sections, 'ADMIN')
  assertRouteVisible(adminRoutes, '/admin', 'ADMIN')
  assertRouteVisible(adminRoutes, '/admin/agents', 'ADMIN')
  assertRouteVisible(adminRoutes, '/admin/ambassador-backend', 'ADMIN')
  assertRouteVisible(adminRoutes, '/admin/reports', 'ADMIN')
  assertRouteVisible(adminRoutes, '/admin/sms', 'ADMIN')
  assertRouteHidden(adminRoutes, '/referrals/history', 'ADMIN')
  assertRouteHidden(adminRoutes, '/leads/history', 'ADMIN')
  assertRouteHidden(adminRoutes, '/payments', 'ADMIN')
  assertRouteHidden(adminRoutes, '/referrals', 'ADMIN')
  assertRouteHidden(adminRoutes, '/leads', 'ADMIN')
}

async function assertDashboardContent() {
  const vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
    resolve: {
      alias: [
        {
          find: 'react-router-dom',
          replacement: new URL('./smoke-router-dom.mjs', import.meta.url).pathname,
        },
        {
          find: '@/context/AuthContext',
          replacement: new URL('./smoke-auth-context.mjs', import.meta.url).pathname,
        },
      ],
    },
  })
  const originalWarn = console.warn
  try {
    const [{ default: AdminDashboard }, { default: Sidebar }, authModule] = await Promise.all([
      vite.ssrLoadModule('/src/pages/admin/AdminDashboard.tsx'),
      vite.ssrLoadModule('/src/components/layout/Sidebar.tsx'),
      vite.ssrLoadModule('/scripts/smoke-auth-context.mjs'),
    ])
    const setRole = (role) => authModule.setSmokeUser({ ...smokeUserBase, role })

    console.warn = () => {}
    setRole('QA_OFFICER')
    const html = renderToString(React.createElement(AdminDashboard))
    console.warn = originalWarn
    for (const requiredText of dashboardRequiredText) {
      assert(html.includes(requiredText), `/admin workspace is missing required rendered text: ${requiredText}`)
    }

    const renderSidebar = (role) => {
      setRole(role)
      return renderToString(
        React.createElement(Sidebar, {
          collapsed: false,
          onToggle: () => {},
          mobileOpen: false,
          onMobileClose: () => {},
        }),
      )
    }

    const ambassadorSidebar = renderSidebar('AMBASSADOR')
    assert(ambassadorSidebar.includes('Submit Referrals'), 'AMBASSADOR sidebar is missing Submit Referrals')
    assert(ambassadorSidebar.includes('Submit Lead'), 'AMBASSADOR sidebar is missing Submit Lead')
    assert(!ambassadorSidebar.includes('Agent Management'), 'AMBASSADOR sidebar should not render Agent Management')
    assert(!ambassadorSidebar.includes('Ambassador Backend'), 'AMBASSADOR sidebar should not render Ambassador Backend')

    const qaSidebar = renderSidebar('QA_OFFICER')
    assert(qaSidebar.includes('Operations Center'), 'QA_OFFICER sidebar is missing Operations Center')
    assert(qaSidebar.includes('QA Validation'), 'QA_OFFICER sidebar is missing QA Validation')
    assert(qaSidebar.includes('Export &amp; Q-Link'), 'QA_OFFICER sidebar is missing Export & Q-Link')
    assert(qaSidebar.includes('Document Delivery'), 'QA_OFFICER sidebar is missing Document Delivery')
    assert(!qaSidebar.includes('Submit Referrals'), 'QA_OFFICER sidebar should not render Submit Referrals')
    assert(!qaSidebar.includes('Submit Lead'), 'QA_OFFICER sidebar should not render Submit Lead')
    assert(!qaSidebar.includes('Operations Exports'), 'QA_OFFICER sidebar should not render Operations Exports')
    assert(!qaSidebar.includes('SMS Center'), 'QA_OFFICER sidebar should not render SMS Center')

    const adminSidebar = renderSidebar('ADMIN')
    assert(adminSidebar.includes('Agent Management'), 'ADMIN sidebar is missing Agent Management')
    assert(adminSidebar.includes('Ambassador Backend'), 'ADMIN sidebar is missing Ambassador Backend')
    assert(adminSidebar.includes('Operations Exports'), 'ADMIN sidebar is missing Operations Exports')
    assert(adminSidebar.includes('SMS Center'), 'ADMIN sidebar is missing SMS Center')
    assert(!adminSidebar.includes('Submit Referrals'), 'ADMIN sidebar should not render Submit Referrals')
    assert(!adminSidebar.includes('Submit Lead'), 'ADMIN sidebar should not render Submit Lead')
  } finally {
    console.warn = originalWarn
    await vite.close()
  }
}

async function main() {
  const navVite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  let sections
  try {
    ;({ sections } = await navVite.ssrLoadModule('/src/components/layout/navConfig.ts'))
  } finally {
    await navVite.close()
  }

  await assertRoleNavigation(sections)
  await assertDashboardContent()

  for (const path of adminPaths) {
    const response = await fetch(`${FRONTEND_BASE}${path}`)
    const body = await response.text()
    assert(response.ok, `${path} returned ${response.status}`)
    assert(body.includes('<div id="root">') || body.includes('<div id="root"></div>'), `${path} did not return the app shell`)
    assert(body.includes('/src/main.tsx') || body.includes('assets/'), `${path} did not include app assets`)
  }
  console.log('Admin page smoke checks passed')
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})

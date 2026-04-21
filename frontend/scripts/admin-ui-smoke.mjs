import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

const smokeUserBase = {
  firstName: 'Smoke',
  lastName: 'User',
  mobileNo: '0000000000',
  email: 'smoke@example.com',
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function normalizeRenderedText(html) {
  return html
    .replaceAll('&amp;', '&')
    .replaceAll('&#x27;', "'")
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function assertIncludesAll(text, label, terms) {
  const missing = terms.filter((term) => !text.includes(term))
  assert(missing.length === 0, `${label} is missing: ${missing.join(', ')}`)
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

async function assertDashboardContent(vite, setRole) {
  const { default: AdminDashboard } = await vite.ssrLoadModule('/src/pages/admin/AdminDashboard.tsx')
  const originalWarn = console.warn
  try {
    console.warn = () => {}
    setRole('QA_OFFICER')
    const text = normalizeRenderedText(renderToString(React.createElement(AdminDashboard)))
    assertIncludesAll(text, '/admin workspace lanes', [
      'FoxPro Operations Center',
      'Marketing & Ambassador App',
      'Engagement, Onboarding & Collections',
      'Client Communications',
    ])
    assertIncludesAll(text, '/admin FoxPro status coverage', [
      'QA validation passed',
      'Exported awaiting outcome',
      'Q-Link uploaded',
      'RC/C',
      't1',
      'u',
    ])
    assertIncludesAll(text, '/admin operational dashboard coverage', [
      'Policy Attachment',
      'Commission Ratio',
      'Operations Activity',
      'First App: Ambassador Marketing',
      'Ambassador Backend & FNB Cycle',
      'Admin required',
    ])
  } finally {
    console.warn = originalWarn
  }
}

async function assertRenderedSidebar(vite, setRole) {
  const { default: Sidebar } = await vite.ssrLoadModule('/src/components/layout/Sidebar.tsx')
  const renderSidebar = (role) => {
    setRole(role)
    return normalizeRenderedText(renderToString(
      React.createElement(Sidebar, {
        collapsed: false,
        onToggle: () => {},
        mobileOpen: false,
        onMobileClose: () => {},
      }),
    ))
  }

  const ambassadorSidebar = renderSidebar('AMBASSADOR')
  assertIncludesAll(ambassadorSidebar, 'AMBASSADOR sidebar', ['Submit Referrals', 'Submit Lead'])
  assert(!ambassadorSidebar.includes('Agent Management'), 'AMBASSADOR sidebar should not render Agent Management')
  assert(!ambassadorSidebar.includes('Ambassador Backend'), 'AMBASSADOR sidebar should not render Ambassador Backend')

  const qaSidebar = renderSidebar('QA_OFFICER')
  assertIncludesAll(qaSidebar, 'QA_OFFICER sidebar', ['Operations Center', 'QA Validation', 'Export & Q-Link', 'Document Delivery'])
  assert(!qaSidebar.includes('Submit Referrals'), 'QA_OFFICER sidebar should not render Submit Referrals')
  assert(!qaSidebar.includes('Submit Lead'), 'QA_OFFICER sidebar should not render Submit Lead')
  assert(!qaSidebar.includes('Operations Exports'), 'QA_OFFICER sidebar should not render Operations Exports')
  assert(!qaSidebar.includes('SMS Center'), 'QA_OFFICER sidebar should not render SMS Center')

  const adminSidebar = renderSidebar('ADMIN')
  assertIncludesAll(adminSidebar, 'ADMIN sidebar', ['Agent Management', 'Ambassador Backend', 'Operations Exports', 'SMS Center'])
  assert(!adminSidebar.includes('Submit Referrals'), 'ADMIN sidebar should not render Submit Referrals')
  assert(!adminSidebar.includes('Submit Lead'), 'ADMIN sidebar should not render Submit Lead')
}

async function main() {
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
  try {
    const [{ sections }, authModule] = await Promise.all([
      vite.ssrLoadModule('/src/components/layout/navConfig.ts'),
      vite.ssrLoadModule('/scripts/smoke-auth-context.mjs'),
    ])
    const setRole = (role) => authModule.setSmokeUser({ ...smokeUserBase, role })
    await assertRoleNavigation(sections)
    await assertDashboardContent(vite, setRole)
    await assertRenderedSidebar(vite, setRole)
    console.log('Admin UI smoke checks passed')
  } finally {
    await vite.close()
  }
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})
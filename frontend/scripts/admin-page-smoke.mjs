import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'
import { sections } from '../src/components/layout/navConfig.mjs'

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
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function visibleRoutesForRole(role) {
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

async function assertRoleNavigation() {
  const marketingSection = sections.find((section) => section.id === 'marketing-agents')
  assert(marketingSection, 'Marketing navigation section is missing')
  assert(marketingSection.roles?.includes('AMBASSADOR'), 'Marketing navigation is not visible to ambassadors')

  const ambassadorRoutes = visibleRoutesForRole('AMBASSADOR')
  assertRouteVisible(ambassadorRoutes, '/referrals', 'AMBASSADOR')
  assertRouteVisible(ambassadorRoutes, '/leads', 'AMBASSADOR')
  assertRouteHidden(ambassadorRoutes, '/admin/agents', 'AMBASSADOR')
  assertRouteHidden(ambassadorRoutes, '/admin/ambassador-backend', 'AMBASSADOR')

  const qaRoutes = visibleRoutesForRole('QA_OFFICER')
  assertRouteVisible(qaRoutes, '/admin', 'QA_OFFICER')
  assertRouteVisible(qaRoutes, '/admin/qa', 'QA_OFFICER')
  assertRouteVisible(qaRoutes, '/admin/export-status', 'QA_OFFICER')
  assertRouteVisible(qaRoutes, '/admin/documents', 'QA_OFFICER')
  assertRouteHidden(qaRoutes, '/admin/reports', 'QA_OFFICER')
  assertRouteHidden(qaRoutes, '/admin/sms', 'QA_OFFICER')

  const adminRoutes = visibleRoutesForRole('ADMIN')
  assertRouteVisible(adminRoutes, '/admin', 'ADMIN')
  assertRouteVisible(adminRoutes, '/admin/agents', 'ADMIN')
  assertRouteVisible(adminRoutes, '/admin/ambassador-backend', 'ADMIN')
  assertRouteVisible(adminRoutes, '/admin/reports', 'ADMIN')
  assertRouteVisible(adminRoutes, '/admin/sms', 'ADMIN')
}

async function assertDashboardContent() {
  const vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
    plugins: [
      {
        name: 'smoke-router-mock',
        enforce: 'pre',
        transform(code, id) {
          if (!id.endsWith('/src/pages/admin/AdminDashboard.tsx')) return null
          return code.replace(
            "import { Link } from 'react-router-dom'",
            "const Link = ({ to, children, ...props }: any) => <a href={typeof to === 'string' ? to : '#'} {...props}>{children}</a>",
          )
        },
      },
    ],
  })
  const originalWarn = console.warn
  try {
    const module = await vite.ssrLoadModule('/src/pages/admin/AdminDashboard.tsx')
    console.warn = () => {}
    const html = renderToString(React.createElement(module.default))
    console.warn = originalWarn
    for (const requiredText of dashboardRequiredText) {
      assert(html.includes(requiredText), `/admin workspace is missing required rendered text: ${requiredText}`)
    }
  } finally {
    console.warn = originalWarn
    await vite.close()
  }
}

async function main() {
  await assertRoleNavigation()
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

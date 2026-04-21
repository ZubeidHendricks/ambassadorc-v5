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

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function assertAmbassadorMarketingNav() {
  const marketingSection = sections.find((section) => section.title === 'Marketing & Agents')
  assert(marketingSection, 'Marketing navigation section is missing')
  assert(marketingSection.roles?.includes('AMBASSADOR'), 'Marketing navigation is not visible to ambassadors')
  const visibleToAmbassador = marketingSection.items.filter((item) => !item.roles || item.roles.includes('AMBASSADOR'))
  assert(visibleToAmbassador.some((item) => item.to === '/referrals'), 'Ambassadors cannot see referral submission navigation')
  assert(visibleToAmbassador.some((item) => item.to === '/leads'), 'Ambassadors cannot see lead submission navigation')
}

async function main() {
  await assertAmbassadorMarketingNav()

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
  console.error(error.message)
  process.exit(1)
})

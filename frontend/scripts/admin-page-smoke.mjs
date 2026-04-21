import { readFile } from 'node:fs/promises'

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
  const sidebarSource = await readFile(new URL('../src/components/layout/Sidebar.tsx', import.meta.url), 'utf8')
  const marketingSection = /title: 'Marketing & Agents'[\s\S]*?title: 'Engagement & Collections'/.exec(sidebarSource)?.[0] ?? ''
  assert(marketingSection.includes("'AMBASSADOR'"), 'Marketing navigation is not visible to ambassadors')
  assert(marketingSection.includes("to: '/referrals'"), 'Ambassadors cannot see referral submission navigation')
  assert(marketingSection.includes("to: '/leads'"), 'Ambassadors cannot see lead submission navigation')
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

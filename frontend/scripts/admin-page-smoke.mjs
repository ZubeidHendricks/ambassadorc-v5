const FRONTEND_BASE = process.env.FRONTEND_BASE ?? 'http://127.0.0.1:5000'

const adminPaths = [
  '/admin/sales',
  '/admin/qa',
  '/admin/agents',
  '/admin/export-status',
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function main() {
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

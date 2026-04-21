const API_BASE = process.env.API_BASE ?? 'http://127.0.0.1:3001/api'
const requiresExplicitCredentials = process.env.CI === 'true' || process.env.NODE_ENV === 'production'
const ADMIN_MOBILE = process.env.SMOKE_ADMIN_MOBILE
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD

const requiredGroups = [
  'new',
  'qa_pending',
  'qa_passed',
  'exported_awaiting_outcome',
  'qlink_uploaded',
  'cancelled',
  'repair',
  'unknown',
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  const text = await response.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { response, body }
}

async function expectSuccess(token, path, validate) {
  const { response, body } = await request(path, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert(response.ok, `${path} returned ${response.status}`)
  assert(body?.success === true, `${path} did not return success: true`)
  validate?.(body.data)
  return body.data
}

async function expectFailure(token, method, path, payload, expectedStatus, expectedText) {
  const { response, body } = await request(path, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  assert(response.status === expectedStatus, `${path} returned ${response.status}, expected ${expectedStatus}`)
  assert(body?.success === false, `${path} did not return success: false`)
  if (expectedText) assert(String(body.error ?? '').includes(expectedText), `${path} error did not include ${expectedText}`)
}

async function expectWorkbook(token, path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const buffer = Buffer.from(await response.arrayBuffer())
  assert(response.ok, `${path} returned ${response.status}`)
  assert(
    response.headers.get('content-type')?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    `${path} did not return an xlsx content type`
  )
  assert(buffer.length > 1024, `${path} returned an unexpectedly small workbook`)
  assert(buffer.subarray(0, 2).toString('utf8') === 'PK', `${path} did not return a zipped xlsx payload`)
}

async function main() {
  if (requiresExplicitCredentials && (!ADMIN_MOBILE || !ADMIN_PASSWORD)) {
    throw new Error('Set SMOKE_ADMIN_MOBILE and SMOKE_ADMIN_PASSWORD before running smoke checks in CI or production')
  }

  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      mobileNo: ADMIN_MOBILE ?? '0800000000',
      password: ADMIN_PASSWORD ?? 'Admin@2024',
    }),
  })
  assert(login.response.ok && login.body?.data?.token, 'Admin login failed for smoke checks')
  const token = login.body.data.token

  await expectSuccess(token, '/sales/status-dictionary', (data) => {
    assert(Array.isArray(data.statuses), 'Status dictionary missing statuses array')
    const groups = data.statuses.map((status) => status.group)
    for (const group of requiredGroups) assert(groups.includes(group), `Missing status group ${group}`)
  })

  await expectSuccess(token, '/sales?limit=1&status=qa_pending', (data) => {
    assert(Array.isArray(data.sales), 'Sales grouping missing sales array')
    assert(typeof data.pagination?.total === 'number', 'Sales grouping missing numeric pagination total')
  })

  await expectSuccess(token, '/sales/export-status?limit=1', (data) => {
    assert(Array.isArray(data.summary), 'Export status missing summary array')
    assert(Array.isArray(data.statuses), 'Export status missing statuses array')
    assert(typeof data.pagination?.total === 'number', 'Export status missing numeric pagination total')
  })

  await expectFailure(token, 'POST', '/qa/not-a-number/verdict', { verdict: 'passed' }, 400, 'Invalid QA check ID')
  await expectFailure(token, 'PUT', '/admin/agents/not-a-number/campaign', { campaignId: null }, 400, 'Invalid agent or campaign ID')
  await expectWorkbook(token, '/reports/operations/export-status')
  await expectWorkbook(token, '/reports/operations/monthly-premium')
  await expectWorkbook(token, `/reports/operations/global-book?year=${new Date().getFullYear()}`)

  console.log('FoxPro operations API smoke checks passed')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})

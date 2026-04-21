const API_BASE = process.env.API_BASE ?? 'http://127.0.0.1:3001/api'
const ADMIN_MOBILE = process.env.SMOKE_ADMIN_MOBILE ?? '0800000000'
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD ?? 'Admin@2024'

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

async function main() {
  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ mobileNo: ADMIN_MOBILE, password: ADMIN_PASSWORD }),
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

  console.log('FoxPro operations API smoke checks passed')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})

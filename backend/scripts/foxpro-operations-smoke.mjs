import ExcelJS from 'exceljs'

const API_BASE = process.env.API_BASE ?? 'http://127.0.0.1:3001/api'
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

const reportLayouts = {
  exportStatus: {
    sheets: [
      {
        name: 'EXPORT STATUS PAGE',
        headers: ['Product', 'Premium', 'Status Group', 'FoxPro Group', 'Count', 'Estimated Premium', 'Next Action'],
      },
      {
        name: 'Export Status Detail',
        headers: [
          'Record ID',
          'Client',
          'ID Number',
          'Cellphone',
          'Product',
          'Premium',
          'Agent',
          'Status',
          'Raw FoxPro Status',
          'Sub Status',
          'Last Outcome',
          'Date Loaded',
          'Last Updated',
        ],
      },
      {
        name: 'Status Dictionary',
        headers: ['Group', 'Label', 'Stage', 'Action', 'Examples', 'Description'],
      },
      {
        name: 'Report Metadata',
        headers: ['Field', 'Value'],
      },
    ],
  },
  monthlyPremium: {
    sheets: [
      {
        name: 'MONTHLY PREMIUM',
        headers: [
          'Product',
          'Prem',
          'Exported Sales',
          'Debit Order',
          'Successful',
          'Banked Revenue',
          'Failed',
          'Lost Revenue',
          'Persal',
          'Successful',
          'Banked Revenue',
          'Failed',
          'Lost Revenue',
          'Total Banked Revenue',
          'Total Lost Revenue',
        ],
      },
      {
        name: 'Status Dictionary',
        headers: ['Group', 'Label', 'Stage', 'Action', 'Examples', 'Description'],
      },
      {
        name: 'Report Metadata',
        headers: ['Field', 'Value'],
      },
    ],
  },
  globalBook: {
    sheets: (year) => {
      const monthNames = Array.from({ length: 12 }, (_, index) =>
        new Date(year, index, 1).toLocaleString('en-ZA', { month: 'short' })
      )
      return [
        {
          name: 'GLOBAL BOOK',
          headers: ['Code', 'Description', ...monthNames, 'Total', 'Total Premium'],
        },
        {
          name: 'Product Monthly Book',
          headers: ['Product', ...monthNames, 'Total', 'Total Premium'],
        },
        {
          name: 'Status Dictionary',
          headers: ['Group', 'Label', 'Stage', 'Action', 'Examples', 'Description'],
        },
        {
          name: 'Report Metadata',
          headers: ['Field', 'Value'],
        },
      ]
    },
  },
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function cellText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && 'text' in value) return String(value.text)
  if (typeof value === 'object' && 'richText' in value) return value.richText.map((part) => part.text).join('')
  return String(value)
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

function expectSheetNames(workbook, path, expectedSheets) {
  const actualNames = workbook.worksheets.map((sheet) => sheet.name)
  const expectedNames = expectedSheets.map((sheet) => sheet.name)
  assert(actualNames.length === expectedNames.length, `${path} returned sheets [${actualNames.join(', ')}], expected [${expectedNames.join(', ')}]`)
  for (const name of expectedNames) {
    assert(actualNames.includes(name), `${path} missing sheet "${name}"`)
  }
}

function expectSheetHeaders(workbook, path, sheetLayout) {
  const sheet = workbook.getWorksheet(sheetLayout.name)
  assert(sheet, `${path} missing sheet "${sheetLayout.name}"`)
  assert(sheet.rowCount > 0, `${path} sheet "${sheetLayout.name}" is empty`)
  const actualHeaders = sheet.getRow(1).values.slice(1).map(cellText)
  assert(
    actualHeaders.length >= sheetLayout.headers.length,
    `${path} sheet "${sheetLayout.name}" has ${actualHeaders.length} headers, expected at least ${sheetLayout.headers.length}`
  )
  for (const [index, expectedHeader] of sheetLayout.headers.entries()) {
    assert(
      actualHeaders[index] === expectedHeader,
      `${path} sheet "${sheetLayout.name}" header ${index + 1} was "${actualHeaders[index] ?? ''}", expected "${expectedHeader}"`
    )
  }
}

async function expectWorkbook(token, path, layout) {
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
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  assert(workbook.worksheets.length > 0, `${path} returned an empty workbook`)
  expectSheetNames(workbook, path, layout.sheets)
  for (const sheetLayout of layout.sheets) expectSheetHeaders(workbook, path, sheetLayout)
}

async function main() {
  assert(ADMIN_MOBILE && ADMIN_PASSWORD, 'Set SMOKE_ADMIN_MOBILE and SMOKE_ADMIN_PASSWORD before running FoxPro operations smoke checks')

  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      mobileNo: ADMIN_MOBILE,
      password: ADMIN_PASSWORD,
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
  await expectWorkbook(token, '/reports/operations/export-status', reportLayouts.exportStatus)
  await expectWorkbook(token, '/reports/operations/monthly-premium', reportLayouts.monthlyPremium)
  const reportYear = new Date().getFullYear()
  await expectWorkbook(token, `/reports/operations/global-book?year=${reportYear}`, {
    sheets: reportLayouts.globalBook.sheets(reportYear),
  })

  console.log('FoxPro operations API smoke checks passed')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})

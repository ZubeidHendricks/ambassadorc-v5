import { useState, useEffect, useCallback, useMemo } from 'react'
import { ClipboardCheck, Edit3, LayoutGrid, List, Send, ShieldCheck, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import { getSales, updateSaleStatus, type Sale, type PaginationInfo } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

const pipelineStatuses = ['new', 'qa_pending', 'qa_passed', 'exported_awaiting_outcome', 'qlink_uploaded', 'repair', 'cancelled']
const pipelineLabels: Record<string, string> = {
  new: 'Sales Capture',
  qa_pending: 'In QA Validation',
  qa_passed: 'QA Passed',
  exported_awaiting_outcome: 'Exported Awaiting Outcome',
  qlink_uploaded: 'Q-Link Uploaded',
  repair: 'Repair',
  cancelled: 'Client Cancelled',
}

const saleStatusUpdateMap: Record<string, string> = {
  new: 'NEW',
  qa_pending: 'QA_PENDING',
  qa_passed: 'QA_APPROVED',
  exported_awaiting_outcome: 'QA_APPROVED',
  qlink_uploaded: 'ACTIVE',
  repair: 'QA_REJECTED',
  cancelled: 'CANCELLED',
}

const tableColumns: Column<Sale>[] = [
  { key: 'clientName', header: 'Client', render: (r) => <span className="font-medium text-gray-900">{r.clientName}</span> },
  { key: 'productName', header: 'Product' },
  { key: 'agentName', header: 'Agent' },
  { key: 'premiumAmount', header: 'Premium', render: (r) => `R${r.premiumAmount}` },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  { key: 'rawStatus', header: 'FoxPro Status', render: (r) => r.rawStatus || '-' },
  { key: 'campaignName', header: 'Campaign', render: (r) => r.campaignName || '-' },
  { key: 'createdAt', header: 'Date', render: (r) => new Date(r.createdAt).toLocaleDateString('en-ZA') },
]

type SalesAgentForm = {
  clientSurname: string
  clientId: string
  clientMobile: string
  clientAddress: string
  clientPersal: string
  clientDepartment: string
  clientFirstDebitDate: string
  dependants: string
  validationAgentName: string
}

type SalesAgentValidation = {
  id: boolean
  mobile: boolean
  spelling: boolean
}

const initialSalesAgentForm: SalesAgentForm = {
  clientSurname: '',
  clientId: '',
  clientMobile: '',
  clientAddress: '',
  clientPersal: '',
  clientDepartment: '',
  clientFirstDebitDate: '',
  dependants: '',
  validationAgentName: '',
}

const salesAgentFields: Array<{
  key: keyof SalesAgentForm
  label: string
  type?: string
  area?: boolean
}> = [
  { key: 'clientSurname', label: 'Client Surname' },
  { key: 'clientId', label: 'Client ID' },
  { key: 'clientMobile', label: 'Client Mobile Number' },
  { key: 'clientAddress', label: 'Client Address', area: true },
  { key: 'clientPersal', label: 'Client Persal' },
  { key: 'clientDepartment', label: 'Client Department' },
  { key: 'clientFirstDebitDate', label: 'Client First Debit Date', type: 'date' },
  { key: 'dependants', label: 'Dependants', area: true },
]

const worksheetProductRows = [
  { productName: 'Lifesaver 24 Basic', premiumAmount: 259, sales: 400, value: 103600 },
  { productName: 'Lifesaver 24 Plus', premiumAmount: 349, sales: 5, value: 1745 },
  { productName: 'Lifesaver legal Basic', premiumAmount: 179, sales: 65, value: 11635 },
  { productName: 'Lifesaver legal Plus', premiumAmount: 299, sales: 1, value: 299 },
]

const worksheetAgentRows = [
  { agentId: 1, agentName: 'Agent 1', sales: 40, value: 10000 },
  { agentId: 2, agentName: 'Agent 2', sales: 40, value: 10000 },
  { agentId: 3, agentName: 'Agent 3', sales: 20, value: 5000 },
  { agentId: 4, agentName: 'Agent 4', sales: 20, value: 5000 },
  { agentId: 5, agentName: 'Agent 5', sales: 38, value: 9500 },
  { agentId: 6, agentName: 'Agent 6', sales: 30, value: 7500 },
  { agentId: 7, agentName: 'Agent 7', sales: 25, value: 6250 },
  { agentId: 8, agentName: 'Agent 8', sales: 30, value: 7500 },
  { agentId: 9, agentName: 'Agent 9', sales: 50, value: 12500 },
  { agentId: 10, agentName: 'Agent 10', sales: 25, value: 6250 },
  { agentId: 11, agentName: 'Agent 11', sales: 20, value: 5000 },
  { agentId: 12, agentName: 'Agent 12', sales: 40, value: 10000 },
  { agentId: 13, agentName: 'Agent 13', sales: 40, value: 10000 },
  { agentId: 14, agentName: 'Agent 14', sales: 30, value: 7500 },
  { agentId: 15, agentName: 'Agent 15', sales: 23, value: 5750 },
]

type SalesDashboardRow = {
  productName?: string
  premiumAmount?: number
  agentId?: number
  agentName?: string
  sales: number
  value: number
}

function formatNumber(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function validateSalesAgentForm(form: SalesAgentForm): SalesAgentValidation {
  const compactId = form.clientId.replace(/\D/g, '')
  const compactMobile = form.clientMobile.replace(/\D/g, '')
  return {
    id: compactId.length === 13,
    mobile: compactMobile.length === 10,
    spelling: form.clientSurname.trim().length >= 2 && form.clientAddress.trim().length >= 6 && !/\s{2,}/.test(`${form.clientSurname} ${form.clientAddress}`),
  }
}

function validationStatusText(validation: SalesAgentValidation) {
  const passed = Object.values(validation).filter(Boolean).length
  return `${passed}/3 checks passed`
}

export default function Sales() {
  const { user } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [agentFilter, setAgentFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 })
  const [salesAgentForm, setSalesAgentForm] = useState<SalesAgentForm>({
    ...initialSalesAgentForm,
    validationAgentName: user ? `${user.firstName} ${user.lastName}` : '',
  })
  const [salesAgentStage, setSalesAgentStage] = useState<'capture' | 'validation' | 'qa-bay'>('capture')
  const [salesAgentStatus, setSalesAgentStatus] = useState<'Draft' | 'A' | 'T'>('Draft')
  const [salesAgentValidation, setSalesAgentValidation] = useState<SalesAgentValidation>(validateSalesAgentForm(initialSalesAgentForm))
  const [salesAgentMessage, setSalesAgentMessage] = useState('Capture the sale details, then submit for validation.')

  const loadSales = useCallback(async () => {
    try {
      const result = await getSales(
        { agentId: agentFilter ? Number(agentFilter) : undefined },
        view === 'table' ? page : 1,
        view === 'table' ? PAGE_SIZE : 200
      )
      setSales(result.data)
      setPagination(result.pagination)
    } catch {
      // handle
    }
  }, [agentFilter, page, view])

  useEffect(() => {
    loadSales()
  }, [loadSales])

  useEffect(() => {
    setPage(1)
  }, [agentFilter, view])

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await updateSaleStatus(id, saleStatusUpdateMap[newStatus] ?? newStatus)
      setSales((prev) => prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s)))
    } catch {
    }
  }

  const updateSalesAgentField = (field: keyof SalesAgentForm, value: string) => {
    setSalesAgentForm((prev) => ({ ...prev, [field]: value }))
    if (salesAgentStage === 'qa-bay') {
      setSalesAgentStage('validation')
      setSalesAgentStatus('A')
    }
  }

  const handleSubmitSale = () => {
    const validation = validateSalesAgentForm(salesAgentForm)
    setSalesAgentValidation(validation)
    if (!validation.id || !validation.mobile || !validation.spelling) {
      setSalesAgentMessage('Submit Sale blocked: validate ID, allow only 10 digits in Mobile Number, and correct possible spelling issues.')
      setSalesAgentStage('capture')
      setSalesAgentStatus('Draft')
      return
    }
    setSalesAgentStage('validation')
    setSalesAgentStatus('A')
    setSalesAgentMessage('Next page displays all details for Validation Agent.')
  }

  const handleValidationEdit = () => {
    setSalesAgentStage('capture')
    setSalesAgentStatus('Draft')
    setSalesAgentMessage('Validation Agent can edit and make corrections before final submit.')
  }

  const handleSubmitValidation = () => {
    const validation = validateSalesAgentForm(salesAgentForm)
    setSalesAgentValidation(validation)
    if (!validation.id || !validation.mobile || !validation.spelling || !salesAgentForm.validationAgentName.trim()) {
      setSalesAgentMessage('Validation cannot submit until all checks pass and Validation Agent Name is captured.')
      return
    }
    setSalesAgentStage('qa-bay')
    setSalesAgentStatus('T')
    setSalesAgentMessage('Sale gets a T status and lies in the QA Bay for second check.')
  }

  const agents = [...new Map(sales.map((s) => [s.agentId, { id: s.agentId, name: s.agentName }])).values()]
  const filtered = agentFilter
    ? sales.filter((s) => String(s.agentId) === agentFilter)
    : sales
  const productSpreadRows = useMemo<SalesDashboardRow[]>(() => {
    if (sales.length === 0) return worksheetProductRows
    const rows = new Map<string, SalesDashboardRow>()
    sales.forEach((sale) => {
      const productName = sale.productName || 'Unknown Product'
      const premiumAmount = Number(sale.premiumAmount || 0)
      const key = `${productName}|${premiumAmount}`
      const row = rows.get(key) ?? { productName, premiumAmount, sales: 0, value: 0 }
      row.sales += 1
      row.value += premiumAmount
      rows.set(key, row)
    })
    return Array.from(rows.values()).sort((a, b) => (a.productName ?? '').localeCompare(b.productName ?? ''))
  }, [sales])
  const activeAgentRows = useMemo<SalesDashboardRow[]>(() => {
    if (sales.length === 0) return worksheetAgentRows
    const rows = new Map<number, SalesDashboardRow>()
    sales.forEach((sale) => {
      const row = rows.get(sale.agentId) ?? { agentId: sale.agentId, agentName: sale.agentName || 'Unassigned Agent', sales: 0, value: 0 }
      row.sales += 1
      row.value += Number(sale.premiumAmount || 0)
      rows.set(sale.agentId, row)
    })
    return Array.from(rows.values()).sort((a, b) => b.sales - a.sales || (a.agentName ?? '').localeCompare(b.agentName ?? ''))
  }, [sales])
  const productTotal = productSpreadRows.reduce((sum, row) => sum + row.sales, 0)
  const productValueTotal = productSpreadRows.reduce((sum, row) => sum + row.value, 0)
  const agentTotal = activeAgentRows.reduce((sum, row) => sum + row.sales, 0)
  const agentValueTotal = activeAgentRows.reduce((sum, row) => sum + row.value, 0)

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Follow the FoxPro operations flow from sales capture through QA, export, Q-Link upload, repair, and cancellation.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Native records use best-effort stages; exact export outcome granularity is available when FoxPro sync status is present.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Agents</option>
            {agents.map((a) => (
              <option key={a.id} value={String(a.id)}>{a.name}</option>
            ))}
          </select>
          <div className="flex rounded-lg border border-gray-200 p-0.5">
            <button
              onClick={() => setView('kanban')}
              className={cn(
                'rounded-md p-2 transition-colors',
                view === 'kanban' ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-700'
              )}
              aria-label="Kanban view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('table')}
              className={cn(
                'rounded-md p-2 transition-colors',
                view === 'table' ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-700'
              )}
              aria-label="Table view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Sales dashboard</p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">Product spread</h2>
          <p className="mt-1 text-sm text-gray-500">Product totals at the top, then Active Agents with linked names to see each agent product spread.</p>
        </div>
        <div className="grid gap-0 lg:grid-cols-[1fr_1.1fr]">
          <div className="border-b border-gray-200 lg:border-b-0 lg:border-r">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-600">
                    <th className="border-b border-gray-200 px-4 py-3">Product</th>
                    <th className="border-b border-gray-200 px-4 py-3 text-right">Premium</th>
                    <th className="border-b border-gray-200 px-4 py-3 text-right">Sales</th>
                    <th className="border-b border-gray-200 px-4 py-3 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {productSpreadRows.map((row) => (
                    <tr key={`${row.productName}-${row.premiumAmount}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{row.productName}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{formatNumber(row.premiumAmount ?? 0)}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{formatNumber(row.sales)}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{formatNumber(row.value)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold text-gray-900">
                    <td className="px-4 py-3" colSpan={2}>Total</td>
                    <td className="px-4 py-3 text-right">{formatNumber(productTotal)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(productValueTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <div className="border-b border-gray-200 px-5 py-3">
              <h3 className="text-sm font-bold text-gray-900">Active Agents</h3>
              <p className="text-xs text-gray-500">Click link & see Product spread</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-600">
                    <th className="border-b border-gray-200 px-4 py-3">Agent</th>
                    <th className="border-b border-gray-200 px-4 py-3 text-right">Sales</th>
                    <th className="border-b border-gray-200 px-4 py-3 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAgentRows.map((row) => (
                    <tr key={`${row.agentId}-${row.agentName}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (row.agentId && agents.some((agent) => agent.id === row.agentId)) setAgentFilter(String(row.agentId))
                          }}
                          className="text-left font-medium text-primary hover:underline"
                        >
                          {row.agentName}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">{formatNumber(row.sales)}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{formatNumber(row.value)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold text-gray-900">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right">{formatNumber(agentTotal)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(agentValueTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Sales agents page</p>
              <h2 className="mt-1 text-xl font-bold text-gray-900">Sales Agent Capture & Validation</h2>
              <p className="mt-1 text-sm text-gray-500">Capture client details, submit sale checks, and hand the full record to the validation agent.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">Status: {salesAgentStatus}</span>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">{validationStatusText(salesAgentValidation)}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="border-b border-gray-200 lg:border-b-0 lg:border-r">
            <div className="grid gap-0">
              {salesAgentFields.map((field) => (
                <label key={field.key} className="grid gap-0 border-b border-gray-200 sm:grid-cols-[230px_1fr]">
                  <span className="bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800">{field.label}</span>
                  {field.area ? (
                    <textarea
                      value={salesAgentForm[field.key]}
                      onChange={(e) => updateSalesAgentField(field.key, e.target.value)}
                      rows={field.key === 'dependants' ? 3 : 2}
                      className="min-h-12 w-full resize-none border-0 px-4 py-3 text-sm text-gray-900 outline-none focus:bg-blue-50"
                      placeholder={field.key === 'dependants' ? 'Dependant name, ID, relationship' : `Enter ${field.label.toLowerCase()}`}
                    />
                  ) : (
                    <input
                      type={field.type ?? 'text'}
                      value={salesAgentForm[field.key]}
                      onChange={(e) => updateSalesAgentField(field.key, e.target.value)}
                      className="h-12 w-full border-0 px-4 text-sm text-gray-900 outline-none focus:bg-blue-50"
                      placeholder={field.key === 'clientId' ? '13 digit ID number' : field.key === 'clientMobile' ? '10 digit mobile number' : `Enter ${field.label.toLowerCase()}`}
                    />
                  )}
                </label>
              ))}
            </div>

            <div className="grid gap-4 border-t border-gray-900 bg-white p-4 md:grid-cols-[190px_1fr]">
              <Button type="button" onClick={handleSubmitSale} className="justify-start">
                <Send className="h-4 w-4" /> Submit Sale
              </Button>
              <div className="space-y-2 text-sm">
                <div className={cn('flex items-center gap-2 font-medium', salesAgentValidation.id ? 'text-emerald-700' : 'text-amber-700')}>
                  <ClipboardCheck className="h-4 w-4" /> Validate ID
                </div>
                <div className={cn('flex items-center gap-2 font-medium', salesAgentValidation.mobile ? 'text-emerald-700' : 'text-amber-700')}>
                  <ClipboardCheck className="h-4 w-4" /> Validate only 10 digits in Mobile Number
                </div>
                <div className={cn('flex items-center gap-2 font-medium', salesAgentValidation.spelling ? 'text-emerald-700' : 'text-amber-700')}>
                  <ClipboardCheck className="h-4 w-4" /> If possible Spelling Validation
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white">
            <div className="border-b border-gray-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">Next page displays all details for Validation Agent</h3>
              </div>
              <p className="mt-2 text-sm text-gray-500">{salesAgentMessage}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Sale gets a T status and lies in the QA Bay for second check
              </p>
            </div>

            <div className="divide-y divide-gray-200">
              {salesAgentFields.map((field) => (
                <div key={field.key} className="grid grid-cols-[150px_1fr] gap-3 px-5 py-3 text-sm">
                  <span className="font-semibold text-gray-600">{field.label}</span>
                  <span className="whitespace-pre-wrap text-gray-900">{salesAgentForm[field.key] || '-'}</span>
                </div>
              ))}
            </div>

            <div className="space-y-4 border-t border-gray-900 p-5">
              <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
                <label className="text-sm font-semibold text-gray-700" htmlFor="validation-agent-name">Validation Agent Name:</label>
                <input
                  id="validation-agent-name"
                  value={salesAgentForm.validationAgentName}
                  onChange={(e) => updateSalesAgentField('validationAgentName', e.target.value)}
                  className="h-10 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Validation Agent Name"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={handleValidationEdit} disabled={salesAgentStage === 'capture'}>
                  <Edit3 className="h-4 w-4" /> Edit
                </Button>
                <Button type="button" variant="success" onClick={handleSubmitValidation} disabled={salesAgentStage === 'capture'}>
                  <ShieldCheck className="h-4 w-4" /> Submit Validation
                </Button>
              </div>
              <div className={cn(
                'rounded-xl border px-4 py-3 text-sm font-medium',
                salesAgentStage === 'qa-bay' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'
              )}>
                {salesAgentStage === 'qa-bay' ? 'Sale gets a T status and lies in the QA Bay for second check' : 'Validation Agent for edit and corrections'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {pipelineStatuses.map((status) => {
            const items = filtered.filter((s) => s.status === status)
            return (
              <div key={status} className="w-72 shrink-0">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {pipelineLabels[status]}
                  </h3>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 px-1.5 text-xs font-medium text-gray-600">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {items.map((sale) => (
                    <div
                      key={sale.id}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <p className="font-medium text-gray-900">{sale.clientName}</p>
                      <p className="mt-0.5 text-sm text-gray-500">{sale.productName}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-primary">
                          R{sale.premiumAmount}/mo
                        </span>
                        <span className="text-xs text-gray-400">{sale.agentName}</span>
                      </div>
                      {sale.campaignName && (
                        <p className="mt-1.5 text-xs text-gray-400">{sale.campaignName}</p>
                      )}
                      <div className="mt-3">
                        {sale.rawStatus ? (
                          <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-500">
                            FoxPro source: {sale.rawStatus}
                          </div>
                        ) : (
                          <select
                            value={sale.status}
                            onChange={(e) => handleStatusChange(sale.id, e.target.value)}
                            className="w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs focus:border-primary focus:outline-none"
                          >
                            {pipelineStatuses.map((s) => (
                              <option key={s} value={s} disabled={s === 'exported_awaiting_outcome'}>
                                Move to: {pipelineLabels[s]}{s === 'exported_awaiting_outcome' ? ' (FoxPro sync only)' : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-xl border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                      No sales
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          searchable={false}
          serverPagination={{
            page: pagination.page,
            totalPages: pagination.totalPages,
            total: pagination.total,
            pageSize: PAGE_SIZE,
            onPageChange: setPage,
          }}
        />
      )}
    </div>
  )
}

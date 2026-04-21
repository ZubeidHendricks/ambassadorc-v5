import { useState, useEffect, useCallback } from 'react'
import { LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import { getSales, updateSaleStatus, type Sale, type PaginationInfo } from '@/lib/api'
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

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([])
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [agentFilter, setAgentFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 })

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

  const agents = [...new Map(sales.map((s) => [s.agentId, { id: s.agentId, name: s.agentName }])).values()]
  const filtered = agentFilter
    ? sales.filter((s) => String(s.agentId) === agentFilter)
    : sales

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Pipeline</h1>
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

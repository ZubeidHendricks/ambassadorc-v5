import { useState, useEffect } from 'react'
import { LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import { getSales, updateSaleStatus, type Sale } from '@/lib/api'
import { cn } from '@/lib/utils'

const demoSales: Sale[] = [
  { id: 1, clientId: 1, clientName: 'John Doe', productId: 1, productName: 'Family Cover', agentId: 1, agentName: 'Sarah Mbeki', premiumAmount: 350, status: 'new', campaignName: 'Spring 2025', createdAt: '2025-04-10' },
  { id: 2, clientId: 2, clientName: 'Maria Santos', productId: 2, productName: 'Funeral Plan', agentId: 2, agentName: 'James Nkosi', premiumAmount: 150, status: 'qa_pending', createdAt: '2025-04-09' },
  { id: 3, clientId: 3, clientName: 'Sipho Ndlovu', productId: 1, productName: 'Family Cover', agentId: 1, agentName: 'Sarah Mbeki', premiumAmount: 250, status: 'qa_pending', campaignName: 'Spring 2025', createdAt: '2025-04-08' },
  { id: 4, clientId: 4, clientName: 'Nomsa Dlamini', productId: 2, productName: 'Funeral Plan', agentId: 3, agentName: 'Thandi Zulu', premiumAmount: 80, status: 'approved', createdAt: '2025-04-07' },
  { id: 5, clientId: 5, clientName: 'David Pillay', productId: 1, productName: 'Family Cover', agentId: 2, agentName: 'James Nkosi', premiumAmount: 450, status: 'active', createdAt: '2025-04-05' },
  { id: 6, clientId: 6, clientName: 'Lisa van Wyk', productId: 3, productName: 'Accident Cover', agentId: 4, agentName: 'David Moyo', premiumAmount: 120, status: 'cancelled', createdAt: '2025-04-01' },
]

const pipelineStatuses = ['new', 'qa_pending', 'approved', 'active', 'cancelled']
const pipelineLabels: Record<string, string> = {
  new: 'New',
  qa_pending: 'QA Pending',
  approved: 'QA Approved',
  active: 'Active',
  cancelled: 'Cancelled',
}

const tableColumns: Column<Sale>[] = [
  { key: 'clientName', header: 'Client', render: (r) => <span className="font-medium text-gray-900">{r.clientName}</span> },
  { key: 'productName', header: 'Product' },
  { key: 'agentName', header: 'Agent' },
  { key: 'premiumAmount', header: 'Premium', render: (r) => `R${r.premiumAmount}` },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  { key: 'campaignName', header: 'Campaign', render: (r) => r.campaignName || '-' },
  { key: 'createdAt', header: 'Date', render: (r) => new Date(r.createdAt).toLocaleDateString('en-ZA') },
]

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>(demoSales)
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [agentFilter, setAgentFilter] = useState('')

  useEffect(() => {
    getSales().then(setSales).catch(() => {})
  }, [])

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await updateSaleStatus(id, newStatus)
    } catch {
      // revert
    }
    setSales((prev) => prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s)))
  }

  const agents = [...new Set(sales.map((s) => s.agentName))]
  const filtered = agentFilter
    ? sales.filter((s) => s.agentName === agentFilter)
    : sales

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Pipeline</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track and manage your sales from lead to active policy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
          >
            <option value="">All Agents</option>
            {agents.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <div className="flex rounded-lg border border-gray-200 p-0.5">
            <button
              onClick={() => setView('kanban')}
              className={cn(
                'rounded-md p-2 transition-colors',
                view === 'kanban' ? 'bg-[#128FAF] text-white' : 'text-gray-500 hover:text-gray-700'
              )}
              aria-label="Kanban view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('table')}
              className={cn(
                'rounded-md p-2 transition-colors',
                view === 'table' ? 'bg-[#128FAF] text-white' : 'text-gray-500 hover:text-gray-700'
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
                        <span className="text-sm font-semibold text-[#128FAF]">
                          R{sale.premiumAmount}/mo
                        </span>
                        <span className="text-xs text-gray-400">{sale.agentName}</span>
                      </div>
                      {sale.campaignName && (
                        <p className="mt-1.5 text-xs text-gray-400">{sale.campaignName}</p>
                      )}
                      <div className="mt-3">
                        <select
                          value={sale.status}
                          onChange={(e) => handleStatusChange(sale.id, e.target.value)}
                          className="w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs focus:border-[#128FAF] focus:outline-none"
                        >
                          {pipelineStatuses.map((s) => (
                            <option key={s} value={s}>
                              Move to: {pipelineLabels[s]}
                            </option>
                          ))}
                        </select>
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
        <DataTable data={filtered} columns={tableColumns} pageSize={10} searchable searchPlaceholder="Search sales..." />
      )}
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import { getPolicies, updatePolicyStatus, type Policy, type PaginationInfo } from '@/lib/api'

const PAGE_SIZE = 20

const statusFilters = ['', 'active', 'pending', 'qa_pending', 'cancelled', 'lapsed']
const statusOptions = ['active', 'pending', 'qa_pending', 'cancelled', 'lapsed', 'suspended']

export default function Policies() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 })

  const loadPolicies = useCallback(async () => {
    try {
      const result = await getPolicies(
        { status: statusFilter || undefined, search: search || undefined },
        page,
        PAGE_SIZE
      )
      setPolicies(result.data)
      setPagination(result.pagination)
    } catch {
      // handle
    }
  }, [statusFilter, search, page])

  useEffect(() => {
    loadPolicies()
  }, [loadPolicies])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, search])

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await updatePolicyStatus(id, status)
      setPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)))
    } catch {
      // revert on fail
    }
  }

  const columns: Column<Policy>[] = [
    {
      key: 'policyNumber',
      header: 'Policy #',
      render: (r) => <span className="font-mono text-sm font-medium text-gray-900">{r.policyNumber}</span>,
    },
    {
      key: 'clientName',
      header: 'Client',
      render: (r) => <span className="font-medium">{r.clientName}</span>,
    },
    { key: 'productName', header: 'Product' },
    {
      key: 'premiumAmount',
      header: 'Premium',
      render: (r) => `R${r.premiumAmount}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'startDate',
      header: 'Start Date',
      render: (r) => new Date(r.startDate).toLocaleDateString('en-ZA'),
    },
    { key: 'agentName', header: 'Agent' },
    {
      key: 'actions',
      header: 'Update',
      sortable: false,
      render: (r) => (
        <select
          value={r.status}
          onChange={(e) => handleStatusChange(r.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Policies</h1>
        <p className="mt-1 text-sm text-gray-500">
          View and manage all insurance policies.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'All'}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search policies..."
          className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <DataTable
        data={policies}
        columns={columns}
        pageSize={PAGE_SIZE}
        serverPagination={{
          page: pagination.page,
          totalPages: pagination.totalPages,
          total: pagination.total,
          pageSize: PAGE_SIZE,
          onPageChange: setPage,
        }}
      />
    </div>
  )
}

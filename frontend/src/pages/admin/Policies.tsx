import { useState, useEffect } from 'react'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import { getPolicies, updatePolicyStatus, type Policy } from '@/lib/api'

const demoPolicies: Policy[] = [
  { id: 1, policyNumber: 'POL-1234', clientId: 1, clientName: 'John Doe', productId: 1, productName: 'Family Cover', premiumAmount: 350, status: 'active', startDate: '2024-11-15', agentName: 'Sarah Mbeki', createdAt: '2024-11-15' },
  { id: 2, policyNumber: 'POL-1235', clientId: 1, clientName: 'John Doe', productId: 2, productName: 'Funeral Plan', premiumAmount: 150, status: 'active', startDate: '2025-01-10', agentName: 'Sarah Mbeki', createdAt: '2025-01-10' },
  { id: 3, policyNumber: 'POL-1236', clientId: 2, clientName: 'Maria Santos', productId: 1, productName: 'Family Cover', premiumAmount: 250, status: 'pending', startDate: '2025-03-01', agentName: 'James Nkosi', createdAt: '2025-03-01' },
  { id: 4, policyNumber: 'POL-1237', clientId: 3, clientName: 'Sipho Ndlovu', productId: 3, productName: 'Accident Cover', premiumAmount: 120, status: 'cancelled', startDate: '2024-09-01', endDate: '2025-02-01', agentName: 'Thandi Zulu', createdAt: '2024-09-01' },
  { id: 5, policyNumber: 'POL-1238', clientId: 4, clientName: 'Nomsa Dlamini', productId: 2, productName: 'Funeral Plan', premiumAmount: 80, status: 'lapsed', startDate: '2024-08-01', agentName: 'David Moyo', createdAt: '2024-08-01' },
]

const statusFilters = ['', 'active', 'pending', 'qa_pending', 'cancelled', 'lapsed']
const statusOptions = ['active', 'pending', 'qa_pending', 'cancelled', 'lapsed', 'suspended']

export default function Policies() {
  const [policies, setPolicies] = useState<Policy[]>(demoPolicies)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    getPolicies({ status: statusFilter || undefined, search: search || undefined })
      .then(setPolicies)
      .catch(() => {})
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
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs focus:border-[#128FAF] focus:outline-none focus:ring-1 focus:ring-[#128FAF]/20"
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

  const filtered = statusFilter
    ? policies.filter((p) => p.status === statusFilter)
    : policies

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
                  ? 'bg-[#128FAF] text-white'
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
          className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
        />
      </div>

      <DataTable data={filtered} columns={columns} pageSize={10} />
    </div>
  )
}

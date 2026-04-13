import { useState, useEffect } from 'react'
import { DollarSign, Clock, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/stat-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import {
  getCommissionSummary,
  getCommissions,
  markCommissionPaid,
  type CommissionSummary,
  type Commission,
} from '@/lib/api'

export default function Commissions() {
  const [summary, setSummary] = useState<CommissionSummary>({ totalEarned: 0, pending: 0, paidThisMonth: 0 })
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [processing, setProcessing] = useState<number | null>(null)

  useEffect(() => {
    getCommissionSummary().then(setSummary).catch(() => {})
    getCommissions({ status: statusFilter || undefined, agentId: agentFilter ? Number(agentFilter) : undefined })
      .then(setCommissions)
      .catch(() => {})
  }, [statusFilter, agentFilter])

  const handleMarkPaid = async (id: number) => {
    setProcessing(id)
    try {
      await markCommissionPaid(id)
      setCommissions((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'paid', paidAt: new Date().toISOString() } : c))
      )
    } catch {
      // handle
    } finally {
      setProcessing(null)
    }
  }

  const formatCurrency = (val: number) =>
    `R${val.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`

  const agents = [...new Map(commissions.map((c) => [c.agentId, { id: c.agentId, name: c.agentName }])).values()]

  const columns: Column<Commission>[] = [
    { key: 'agentName', header: 'Agent', render: (r) => <span className="font-medium text-gray-900">{r.agentName}</span> },
    { key: 'clientName', header: 'Client' },
    { key: 'productName', header: 'Product' },
    { key: 'amount', header: 'Amount', render: (r) => <span className="font-semibold">{formatCurrency(r.amount)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'createdAt',
      header: 'Date',
      render: (r) => new Date(r.createdAt).toLocaleDateString('en-ZA'),
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      render: (r) =>
        r.status === 'pending' ? (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              handleMarkPaid(r.id)
            }}
            disabled={processing === r.id}
          >
            {processing === r.id ? 'Processing...' : 'Mark Paid'}
          </Button>
        ) : r.paidAt ? (
          <span className="text-xs text-gray-400">
            Paid {new Date(r.paidAt).toLocaleDateString('en-ZA')}
          </span>
        ) : null,
    },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Commissions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track and manage agent commission payments.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Earned"
          value={formatCurrency(summary.totalEarned)}
          icon={<DollarSign className="h-6 w-6" />}
        />
        <StatCard
          label="Pending"
          value={formatCurrency(summary.pending)}
          icon={<Clock className="h-6 w-6" />}
        />
        <StatCard
          label="Paid This Month"
          value={formatCurrency(summary.paidThisMonth)}
          icon={<CheckCircle className="h-6 w-6" />}
        />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          {['', 'pending', 'paid'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            </button>
          ))}
        </div>
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All Agents</option>
          {agents.map((a) => (
            <option key={a.id} value={String(a.id)}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <DataTable data={commissions} columns={columns} pageSize={10} />
    </div>
  )
}

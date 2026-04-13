import { useState, useEffect } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Modal } from '@/components/ui/modal'
import {
  getPremiumChanges,
  approvePremiumChange,
  rejectPremiumChange,
  type PremiumChange,
} from '@/lib/api'

export default function PremiumChanges() {
  const [changes, setChanges] = useState<PremiumChange[]>([])
  const [filter, setFilter] = useState<string>('')
  const [rejectModal, setRejectModal] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    getPremiumChanges(filter || undefined).then(setChanges).catch(() => {})
  }, [filter])

  const handleApprove = async (id: number) => {
    setProcessing(true)
    try {
      await approvePremiumChange(id)
      setChanges((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'approved' } : c))
      )
    } catch {
      // handle
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedId) return
    setProcessing(true)
    try {
      await rejectPremiumChange(selectedId, reason)
      setChanges((prev) =>
        prev.map((c) => (c.id === selectedId ? { ...c, status: 'rejected' } : c))
      )
      setRejectModal(false)
      setReason('')
    } catch {
      // handle
    } finally {
      setProcessing(false)
    }
  }

  const columns: Column<PremiumChange>[] = [
    { key: 'productName', header: 'Product', render: (r) => <span className="font-medium text-gray-900">{r.productName}</span> },
    { key: 'tierName', header: 'Tier' },
    { key: 'currentAmount', header: 'Current', render: (r) => `R${r.currentAmount}` },
    { key: 'newAmount', header: 'New', render: (r) => <span className="font-semibold">{`R${r.newAmount}`}</span> },
    {
      key: 'changeType',
      header: 'Change',
      render: (r) => {
        const diff = r.newAmount - r.currentAmount
        const pct = ((diff / r.currentAmount) * 100).toFixed(1)
        return (
          <span className={diff > 0 ? 'text-red-600 font-medium' : 'text-emerald-600 font-medium'}>
            {diff > 0 ? '+' : ''}R{diff} ({diff > 0 ? '+' : ''}{pct}%)
          </span>
        )
      },
    },
    { key: 'effectiveDate', header: 'Effective', render: (r) => new Date(r.effectiveDate).toLocaleDateString('en-ZA') },
    { key: 'affectedPolicies', header: 'Affected', render: (r) => <span className="text-gray-600">{r.affectedPolicies || '-'} policies</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: '',
      sortable: false,
      render: (r) =>
        r.status === 'pending' ? (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleApprove(r.id)
              }}
              disabled={processing}
              className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
              title="Approve"
            >
              <CheckCircle className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSelectedId(r.id)
                setRejectModal(true)
              }}
              disabled={processing}
              className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
              title="Reject"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        ) : null,
    },
  ]

  const filters = ['', 'pending', 'approved', 'rejected']

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Premium Changes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and manage premium adjustment requests.
        </p>
      </div>

      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f || 'All'}
          </button>
        ))}
      </div>

      <DataTable data={changes} columns={columns} pageSize={10} />

      <Modal
        open={rejectModal}
        onOpenChange={setRejectModal}
        title="Reject Premium Change"
        description="Please provide a reason for rejecting this change."
      >
        <div className="space-y-4">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter rejection reason..."
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setRejectModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing || !reason.trim()}>
              {processing ? 'Rejecting...' : 'Reject'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

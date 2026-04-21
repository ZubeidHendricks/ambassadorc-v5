import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { getQAItems, submitQAVerdict, type QAItem, type PaginationInfo } from '@/lib/api'

const PAGE_SIZE = 20

export default function QualityAssurance() {
  const [items, setItems] = useState<QAItem[]>([])
  const [filter, setFilter] = useState<string>('pending')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 })
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [processing, setProcessing] = useState<number | null>(null)

  const loadItems = useCallback(async () => {
    try {
      const result = await getQAItems(filter || undefined, page, PAGE_SIZE)
      setItems(result.data)
      setPagination(result.pagination)
    } catch {
      // handle
    }
  }, [filter, page])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  useEffect(() => {
    setPage(1)
  }, [filter])

  const handleVerdict = async (id: number, verdict: string) => {
    setProcessing(id)
    try {
      const updated = await submitQAVerdict(id, { verdict, notes: notes[id] || '' })
      const updatedStatus = updated.status?.toLowerCase() || (verdict === 'repair' ? 'escalated' : verdict === 'cancel' ? 'failed' : verdict)
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, ...updated, status: updatedStatus } : item
        )
      )
    } catch {
      // handle
    } finally {
      setProcessing(null)
    }
  }

  const filters = ['pending', 'passed', 'failed', 'escalated', '']

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quality Assurance</h1>
        <p className="mt-1 text-sm text-gray-500">
          Mailbox-style queue for sales waiting on Quality Assurance before export.
        </p>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <span className="font-semibold">FoxPro QA flow:</span> Submit/Pass sends a sale to export, Repair keeps it in operations for correction, and Cancel/Fail stops the sale before collection.
      </div>

      <div className="flex flex-wrap gap-2">
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
            {f ? f.charAt(0).toUpperCase() + f.slice(1) : 'All'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {items.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">
            No QA items found.
          </div>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-gray-900">{item.clientName}</h3>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                  <div>
                    <span className="text-gray-500">Product:</span>{' '}
                    <span className="font-medium">{item.productName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Agent:</span>{' '}
                    <span className="font-medium">{item.agentName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Premium:</span>{' '}
                    <span className="font-medium">R{item.premiumAmount}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Date:</span>{' '}
                    <span className="font-medium">
                      {new Date(item.createdAt).toLocaleDateString('en-ZA')}
                    </span>
                  </div>
                </div>
                {item.notes && (
                  <p className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Notes:</span> {item.notes}
                  </p>
                )}
                {item.reviewedBy && (
                  <p className="mt-1 text-xs text-gray-400">
                    Reviewed by {item.reviewedBy} on{' '}
                    {item.reviewedAt
                      ? new Date(item.reviewedAt).toLocaleString('en-ZA')
                      : '-'}
                  </p>
                )}
              </div>

              {item.status === 'pending' && (
                <div className="flex shrink-0 flex-col gap-3 lg:w-64">
                  <textarea
                    value={notes[item.id] || ''}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                      placeholder="QA notes / repair reason..."
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleVerdict(item.id, 'passed')}
                      disabled={processing === item.id}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Submit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleVerdict(item.id, 'cancel')}
                      disabled={processing === item.id}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVerdict(item.id, 'repair')}
                      disabled={processing === item.id}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      Repair
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500">
            Showing {(pagination.page - 1) * PAGE_SIZE + 1}–{Math.min(pagination.page * PAGE_SIZE, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page === 1}
              className="rounded-lg px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page === pagination.totalPages}
              className="rounded-lg px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

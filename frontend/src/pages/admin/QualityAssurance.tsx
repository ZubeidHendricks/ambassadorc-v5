import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { getQAItems, submitQAVerdict, type QAItem, type PaginationInfo } from '@/lib/api'

const PAGE_SIZE = 20

export default function QualityAssurance() {
  const [items, setItems] = useState<QAItem[]>([])
  const [filter, setFilter] = useState<string>('pending')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 })
  const [processing, setProcessing] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

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
    setActionError(null)
    setActionMessage(null)
    try {
      const updated = await submitQAVerdict(id, { verdict, notes: '' })
      const updatedStatus = updated.status?.toLowerCase() || (verdict === 'repair' ? 'repair' : verdict === 'cancel' ? 'failed' : verdict)
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, ...updated, status: updatedStatus } : item
        )
      )
      if (updated.writeBack?.status) {
        setActionMessage(`FoxPro SalesData row ${updated.writeBack.sourceId ?? id} updated successfully.`)
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'QA update failed.')
    } finally {
      setProcessing(null)
    }
  }

  const filters = ['pending', 'passed', 'repair', 'failed', '']

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">QA MAILBOX</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Quality Assurance</h1>
          <p className="mt-1 text-sm text-gray-500">
            Mailbox-style queue for sales waiting on Quality Assurance before export.
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          <Clock className="mr-2 inline h-4 w-4" />
          If SUBMIT the sale is loaded for export @ midnight sales export to Netcash or Q-Link.
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <span className="font-semibold">FoxPro QA flow:</span> SUBMIT sends a sale to export, REPAIR keeps it in operations for correction, and CANCEL stops the sale before collection.
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {actionError}
        </div>
      )}

      {actionMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {actionMessage}
        </div>
      )}

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

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full border-collapse text-left text-sm">
            <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-600">
              <tr>
                <th className="w-12 border-b border-r border-gray-200 px-3 py-3">#</th>
                <th className="border-b border-r border-gray-200 px-3 py-3">Client ID</th>
                <th className="border-b border-r border-gray-200 px-3 py-3">Client Name</th>
                <th className="border-b border-r border-gray-200 px-3 py-3">Date Of Sale</th>
                <th className="border-b border-r border-gray-200 px-3 py-3">Sales Verification Agent</th>
                <th className="border-b border-r border-gray-200 px-3 py-3">SUBMIT</th>
                <th className="border-b border-r border-gray-200 px-3 py-3">REPAIR</th>
                <th className="border-b border-r border-gray-200 px-3 py-3">CANCEL</th>
                <th className="border-b border-gray-200 px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    No QA mailbox rows found.
                  </td>
                </tr>
              )}
              {items.map((item, index) => {
                const isPending = item.status === 'pending'
                return (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="border-r border-gray-200 px-3 py-2 text-gray-500">{(pagination.page - 1) * PAGE_SIZE + index + 1}</td>
                    <td className="border-r border-gray-200 px-3 py-2 font-medium text-gray-900">{item.clientIdNumber || item.saleId}</td>
                    <td className="border-r border-gray-200 px-3 py-2 text-gray-900">{item.clientName}</td>
                    <td className="border-r border-gray-200 px-3 py-2 text-gray-700">{new Date(item.createdAt).toLocaleDateString('en-ZA')}</td>
                    <td className="border-r border-gray-200 px-3 py-2 text-gray-700">{item.agentName}</td>
                    <td className="border-r border-gray-200 px-2 py-2">
                      <Button
                        size="sm"
                        onClick={() => handleVerdict(item.id, 'passed')}
                        disabled={!isPending || processing === item.id}
                        className="h-8 w-full bg-emerald-600 px-2 text-[11px] hover:bg-emerald-700"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        SUBMIT
                      </Button>
                    </td>
                    <td className="border-r border-gray-200 px-2 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleVerdict(item.id, 'repair')}
                        disabled={!isPending || processing === item.id}
                        className="h-8 w-full px-2 text-[11px]"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        REPAIR
                      </Button>
                    </td>
                    <td className="border-r border-gray-200 px-2 py-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleVerdict(item.id, 'cancel')}
                        disabled={!isPending || processing === item.id}
                        className="h-8 w-full px-2 text-[11px]"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        CANCEL
                      </Button>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={item.status} />
                      {item.writeBack?.status && (
                        <p className="mt-1 text-xs text-emerald-700">
                          FoxPro write-back {item.writeBack.status}
                          {item.writeBack.sourceId ? ` for SalesData #${item.writeBack.sourceId}` : ''}.
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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

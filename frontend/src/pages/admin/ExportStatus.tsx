import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, FileCheck2, FileDown, RefreshCw } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import {
  getExportStatuses,
  getFoxProStatusDictionary,
  downloadOperationsReport,
  type ExportStatusRecord,
  type ExportStatusSummary,
  type FoxProStatusDefinition,
  type PaginationInfo,
} from '@/lib/api'

const PAGE_SIZE = 20

const iconForGroup: Record<string, typeof Clock> = {
  qa_pending: Clock,
  qa_passed: CheckCircle2,
  exported_awaiting_outcome: FileCheck2,
  qlink_uploaded: CheckCircle2,
  repair: AlertTriangle,
  cancelled: AlertTriangle,
}

export default function ExportStatus() {
  const [summary, setSummary] = useState<ExportStatusSummary[]>([])
  const [records, setRecords] = useState<ExportStatusRecord[]>([])
  const [dictionary, setDictionary] = useState<FoxProStatusDefinition[]>([])
  const [group, setGroup] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [downloadingReport, setDownloadingReport] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [reportYear, setReportYear] = useState(new Date().getFullYear())
  const [reportMonth, setReportMonth] = useState(0)
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 })
  const monthOptions = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: new Date(2000, index, 1).toLocaleString('en-ZA', { month: 'long' }),
  }))

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [statusData, dictionaryData] = await Promise.all([
        getExportStatuses(group || undefined, page, PAGE_SIZE),
        getFoxProStatusDictionary(),
      ])
      setSummary(statusData.summary)
      setRecords(statusData.statuses)
      setPagination(statusData.pagination)
      setDictionary(dictionaryData)
    } catch {
      setSummary([])
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [group, page])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    setPage(1)
  }, [group])

  const selectedDefinition = dictionary.find((item) => item.group === group)

  async function handleDownloadReport() {
    setDownloadingReport(true)
    setDownloadError('')
    try {
      await downloadOperationsReport('export-status', {
        year: reportYear,
        month: reportMonth || undefined,
      })
    } catch {
      console.error('Failed to download export status report')
      setDownloadError('The Export Status report could not be generated. Please try again, or ask an admin to check the report service.')
    } finally {
      setDownloadingReport(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">FoxPro operations</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Export & Q-Link Status</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Monitor the familiar export flow: QA passed, exported awaiting outcome, Q-Link uploaded, failed returns, and cancellations.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="export-status-report-month">
              Report month
            </label>
            <select
              id="export-status-report-month"
              value={reportMonth}
              onChange={(event) => setReportMonth(Number(event.target.value))}
              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value={0}>All months in selected year</option>
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="export-status-report-year">
              Report year
            </label>
            <input
              id="export-status-report-year"
              type="number"
              min={2000}
              max={2100}
              value={reportYear}
              onChange={(event) => setReportYear(Number(event.target.value) || new Date().getFullYear())}
              className="h-10 w-24 rounded-md border border-gray-300 bg-white px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Button variant="outline" onClick={handleDownloadReport} disabled={downloadingReport}>
            <FileDown className="h-4 w-4" />
            {downloadingReport ? 'Generating...' : 'Export Status Excel'}
          </Button>
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((item) => {
          const Icon = iconForGroup[item.group] ?? Clock
          const active = group === item.group
          return (
            <button
              key={item.group}
              onClick={() => setGroup(active ? '' : item.group)}
              className={`rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md ${active ? 'border-primary ring-2 ring-primary/10' : 'border-gray-200'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-xl font-bold text-gray-900">{item.count.toLocaleString('en-ZA')}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900">{item.label}</p>
              <p className="mt-1 text-xs text-gray-500">{dictionary.find((d) => d.group === item.group)?.stage ?? 'Operations'}</p>
            </button>
          )
        })}
      </div>

      {selectedDefinition && (
        <div className="rounded-xl border border-primary/20 bg-primary-50 p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-primary">{selectedDefinition.label}</h2>
              <p className="mt-1 text-sm text-gray-700">{selectedDefinition.description}</p>
            </div>
            <div className="text-sm text-gray-600 md:text-right">
              <p><span className="font-medium">Next action:</span> {selectedDefinition.action}</p>
              <p className="mt-1 text-xs text-gray-500">Examples: {selectedDefinition.examples.join(', ')}</p>
            </div>
          </div>
        </div>
      )}

      {downloadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {downloadError}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Return outcome records</h2>
          <p className="text-sm text-gray-500">{group ? 'Filtered by selected operations status.' : 'Showing latest synced export and Q-Link status records.'}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Agent</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Raw FoxPro status</th>
                <th className="px-5 py-3">Last update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{record.clientName || 'Unknown'}</td>
                  <td className="px-5 py-3 text-gray-600">{record.productName}</td>
                  <td className="px-5 py-3 text-gray-600">{record.agentName || '-'}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={record.statusGroup} />
                      <span className="text-xs text-gray-500">{record.label}</span>
                    </div>
                  </td>
                  <td className="max-w-sm px-5 py-3 text-gray-600">{record.rawStatus}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {record.lastUpdated ? new Date(record.lastUpdated).toLocaleDateString('en-ZA') : '-'}
                  </td>
                </tr>
              ))}
              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-400">No export status records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm">
            <p className="text-gray-500">Showing {(pagination.page - 1) * PAGE_SIZE + 1}–{Math.min(pagination.page * PAGE_SIZE, pagination.total)} of {pagination.total.toLocaleString('en-ZA')}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={pagination.page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <span className="text-gray-500">Page {pagination.page} of {pagination.totalPages}</span>
              <Button variant="outline" size="sm" disabled={pagination.page === pagination.totalPages} onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

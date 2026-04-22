import { useCallback, useEffect, useState } from 'react'
import { FileDown, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getExportStatuses,
  downloadOperationsReport,
  type ExportStatusProductRow,
  type ExportStatusReturnRow,
} from '@/lib/api'

const worksheetProducts = [
  { productName: 'Lifesaver 24 Basic', premiumAmount: 259 },
  { productName: 'Lifesaver 24 Plus', premiumAmount: 349 },
  { productName: 'Lifesaver legal Basic', premiumAmount: 179 },
  { productName: 'Lifesaver legal plus', premiumAmount: 299 },
]

function normalizedName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function productRowKey(productName: string, premiumAmount: number) {
  return `${normalizedName(productName)}|${Number(premiumAmount)}`
}

function mergeWorksheetRows(rows: ExportStatusProductRow[]) {
  const byKey = new Map(rows.map((row) => [productRowKey(row.productName, row.premiumAmount), row]))
  const baseRows = worksheetProducts.map((product) => {
    const match = byKey.get(productRowKey(product.productName, product.premiumAmount))
    return {
      productName: product.productName,
      premiumAmount: product.premiumAmount,
      count: match?.count ?? 0,
    }
  })
  const baseKeys = new Set(baseRows.map((row) => productRowKey(row.productName, row.premiumAmount)))
  const extraRows = rows.filter((row) => !baseKeys.has(productRowKey(row.productName, row.premiumAmount)))
  return [...baseRows, ...extraRows]
}

function returnStatusText(row?: ExportStatusReturnRow) {
  if (!row) return 'Returned Exceeded allowable insurance'
  const reason = row.reason?.replace(/^returned\s*/i, '').trim() || 'Returned'
  return `Returned ${reason}`
}

export default function ExportStatus() {
  const [productRows, setProductRows] = useState<ExportStatusProductRow[]>([])
  const [returnRows, setReturnRows] = useState<ExportStatusReturnRow[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingReport, setDownloadingReport] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [reportYear, setReportYear] = useState(new Date().getFullYear())
  const [reportMonth, setReportMonth] = useState(0)
  const monthOptions = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: new Date(2000, index, 1).toLocaleString('en-ZA', { month: 'long' }),
  }))

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const statusData = await getExportStatuses(undefined, 1, 20)
      setProductRows(statusData.productRows)
      setReturnRows(statusData.returnRows)
    } catch {
      setProductRows([])
      setReturnRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

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

  const worksheetRows = mergeWorksheetRows(productRows)
  const primaryReturn = returnRows[0]

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Export Status Page</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Export Return Status</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">Product export counts, returned reasons, and debit-order repair actions.</p>
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

      {downloadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {downloadError}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-600">
              <tr>
                <th className="border-b border-gray-200 px-4 py-3 text-right">Exports</th>
                <th className="border-b border-gray-200 px-4 py-3 text-left">Product</th>
                <th className="border-b border-gray-200 px-4 py-3 text-right">Premium</th>
                <th className="border-b border-gray-200 px-4 py-3 text-right">Count</th>
                <th className="border-b border-gray-200 px-4 py-3 text-left">Export Return Status</th>
                <th className="border-b border-gray-200 px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {worksheetRows.map((row, index) => (
                <tr key={`${row.productName}-${row.premiumAmount}`} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-right text-gray-700">{row.count.toLocaleString('en-ZA')}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.productName}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{row.premiumAmount.toLocaleString('en-ZA')}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{row.count.toLocaleString('en-ZA')}</td>
                  <td className="px-4 py-3 text-red-600">
                    {index === 0 ? (
                      <span>
                        <span className="mr-2 font-semibold">{primaryReturn?.count.toLocaleString('en-ZA') ?? 0}</span>
                        {returnStatusText(primaryReturn)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{index === 0 ? primaryReturn?.action ?? 'Switch to Debit Order' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

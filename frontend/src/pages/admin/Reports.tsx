import { useState } from 'react'
import { downloadEarningsReport, downloadOperationsReport, type OperationsReportType } from '@/lib/api'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileDown, Users, CheckCircle2, FileSpreadsheet, BarChart3, BookOpen, Gauge } from 'lucide-react'

export default function Reports() {
  const [downloading, setDownloading] = useState(false)
  const [operationsDownload, setOperationsDownload] = useState<OperationsReportType | null>(null)
  const [reportYear, setReportYear] = useState(new Date().getFullYear())
  const [reportMonth, setReportMonth] = useState(0)
  const [downloadError, setDownloadError] = useState('')
  const monthOptions = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: new Date(2000, index, 1).toLocaleString('en-ZA', { month: 'long' }),
  }))
  const selectedPeriodLabel = reportMonth
    ? `${monthOptions.find((month) => month.value === reportMonth)?.label} ${reportYear}`
    : `Full year ${reportYear}`

  function handleDownload() {
    setDownloading(true)
    try {
      downloadEarningsReport()
      // Brief delay for UX — the download fires async
      setTimeout(() => setDownloading(false), 2000)
    } catch {
      setDownloading(false)
    }
  }

  async function handleOperationsDownload(type: OperationsReportType) {
    setOperationsDownload(type)
    setDownloadError('')
    try {
      await downloadOperationsReport(type, {
        year: reportYear,
        month: reportMonth || undefined,
      })
    } catch {
      console.error('Failed to download operations report')
      setDownloadError('The report could not be generated. Please try again, or ask an admin to check the report service.')
    } finally {
      setOperationsDownload(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Generate and download reports for FNB Cash Send payments to ambassadors
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              Ambassador Earnings Report
            </CardTitle>
            <CardDescription>
              Excel report ready for FNB Enterprise Cash Send upload. Contains all ambassador
              earnings broken down by referral batches and member sign-up conversions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-blue-50 p-4 text-center">
                <Users className="mx-auto mb-1 h-5 w-5 text-blue-600" />
                <p className="text-sm font-semibold text-blue-700">Sheet 1</p>
                <p className="text-xs text-blue-600 mt-1">FNB Cash Send Summary</p>
                <p className="text-xs text-gray-500 mt-1">All ambassadors · earnings · amount due</p>
              </div>
              <div className="rounded-lg border bg-purple-50 p-4 text-center">
                <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-purple-600" />
                <p className="text-sm font-semibold text-purple-700">Sheet 2</p>
                <p className="text-xs text-purple-600 mt-1">Member Sign-Ups Detail</p>
                <p className="text-xs text-gray-500 mt-1">Individual sign-up records with status</p>
              </div>
              <div className="rounded-lg border bg-sky-50 p-4 text-center">
                <Users className="mx-auto mb-1 h-5 w-5 text-sky-600" />
                <p className="text-sm font-semibold text-sky-700">Sheet 3</p>
                <p className="text-xs text-sky-600 mt-1">Referral Batches</p>
                <p className="text-xs text-gray-500 mt-1">Batch counts and milestone earnings</p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6">
              <p className="text-sm text-amber-800">
                <strong>FNB Cash Send process:</strong> Download this report → open Sheet 1 →
                use the "Amount Due" column to initiate Cash Send payments per ambassador
                from your FNB Enterprise account. After processing, mark payments as paid
                in the system.
              </p>
            </div>

            <Button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full sm:w-auto"
              size="lg"
            >
              <FileDown className="mr-2 h-5 w-5" />
              {downloading ? 'Generating...' : 'Download Ambassador Earnings (.xlsx)'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Operations Workbook Reports
            </CardTitle>
            <CardDescription>
              Excel downloads matching the Export Status, Monthly Premium, and Global Book workbook views using live operations data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-emerald-50 p-4 text-center">
                <Gauge className="mx-auto mb-1 h-5 w-5 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-700">Export Status</p>
                <p className="text-xs text-gray-500 mt-1">FoxPro groups, raw statuses, and status dictionary</p>
              </div>
              <div className="rounded-lg border bg-indigo-50 p-4 text-center">
                <BarChart3 className="mx-auto mb-1 h-5 w-5 text-indigo-600" />
                <p className="text-sm font-semibold text-indigo-700">Monthly Premium</p>
                <p className="text-xs text-gray-500 mt-1">Exported sales, successful collections, and lost revenue</p>
              </div>
              <div className="rounded-lg border bg-orange-50 p-4 text-center">
                <BookOpen className="mx-auto mb-1 h-5 w-5 text-orange-600" />
                <p className="text-sm font-semibold text-orange-700">Global Book</p>
                <p className="text-xs text-gray-500 mt-1">QREC/QNEW/QTOS monthly summaries by year</p>
              </div>
            </div>

            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="operations-report-month">
                    Reporting month
                  </label>
                  <select
                    id="operations-report-month"
                    value={reportMonth}
                    onChange={(event) => setReportMonth(Number(event.target.value))}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={0}>All months in selected year</option>
                    {monthOptions.map((month) => (
                      <option key={month.value} value={month.value}>{month.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="operations-report-year">
                    Reporting year
                  </label>
                  <input
                    id="operations-report-year"
                    type="number"
                    min={2000}
                    max={2100}
                    value={reportYear}
                    onChange={(event) => setReportYear(Number(event.target.value) || new Date().getFullYear())}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Downloads will use: <span className="font-medium text-gray-900">{selectedPeriodLabel}</span>
              </p>
            </div>

            {downloadError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {downloadError}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                variant="outline"
                onClick={() => handleOperationsDownload('export-status')}
                disabled={operationsDownload !== null}
              >
                <FileDown className="mr-2 h-4 w-4" />
                {operationsDownload === 'export-status' ? 'Generating...' : 'Download Export Status'}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleOperationsDownload('monthly-premium')}
                disabled={operationsDownload !== null}
              >
                <FileDown className="mr-2 h-4 w-4" />
                {operationsDownload === 'monthly-premium' ? 'Generating...' : 'Download Monthly Premium'}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleOperationsDownload('global-book')}
                disabled={operationsDownload !== null}
              >
                <FileDown className="mr-2 h-4 w-4" />
                {operationsDownload === 'global-book' ? 'Generating...' : 'Download Global Book'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

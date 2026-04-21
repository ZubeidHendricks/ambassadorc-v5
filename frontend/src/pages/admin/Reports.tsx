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

const monthlyPremiumRows = [
  {
    productName: 'Lifesaver 24 Basic',
    premiumAmount: 259,
    exportedSales: 400,
    debitOrder: 150,
    debitSuccessful: 130,
    debitRevenue: 33670,
    debitFailed: 20,
    debitLostRevenue: 5180,
    persal: 250,
    persalSuccessful: 230,
    persalRevenue: 59570,
    persalFailed: 20,
    persalLostRevenue: 5180,
  },
  {
    productName: 'Lifesaver 24 Plus',
    premiumAmount: 349,
    exportedSales: 5,
    debitOrder: 1,
    debitSuccessful: 1,
    debitRevenue: 349,
    debitFailed: 0,
    debitLostRevenue: 0,
    persal: 4,
    persalSuccessful: 4,
    persalRevenue: 1396,
    persalFailed: 0,
    persalLostRevenue: 0,
  },
  {
    productName: 'Lifesaver legal Basic',
    premiumAmount: 179,
    exportedSales: 65,
    debitOrder: 40,
    debitSuccessful: 35,
    debitRevenue: 6265,
    debitFailed: 5,
    debitLostRevenue: 895,
    persal: 25,
    persalSuccessful: 20,
    persalRevenue: 3580,
    persalFailed: 5,
    persalLostRevenue: 895,
  },
  {
    productName: 'Lifesaver legal Plus',
    premiumAmount: 299,
    exportedSales: 1,
    debitOrder: 0,
    debitSuccessful: 0,
    debitRevenue: 0,
    debitFailed: 0,
    debitLostRevenue: 0,
    persal: 1,
    persalSuccessful: 1,
    persalRevenue: 299,
    persalFailed: 0,
    persalLostRevenue: 0,
  },
]

function formatWorksheetNumber(value: number) {
  return value === 0 ? '' : value.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

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
  const monthlyPremiumTotals = monthlyPremiumRows.reduce(
    (totals, row) => ({
      exportedSales: totals.exportedSales + row.exportedSales,
      debitRevenue: totals.debitRevenue + row.debitRevenue,
      debitLostRevenue: totals.debitLostRevenue + row.debitLostRevenue,
      persalRevenue: totals.persalRevenue + row.persalRevenue,
      persalLostRevenue: totals.persalLostRevenue + row.persalLostRevenue,
    }),
    {
      exportedSales: 0,
      debitRevenue: 0,
      debitLostRevenue: 0,
      persalRevenue: 0,
      persalLostRevenue: 0,
    }
  )
  const totalBankedRevenue = monthlyPremiumTotals.debitRevenue + monthlyPremiumTotals.persalRevenue
  const totalLostRevenue = monthlyPremiumTotals.debitLostRevenue + monthlyPremiumTotals.persalLostRevenue

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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
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

            <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Monthly Premium Page</p>
                <h3 className="mt-1 text-lg font-bold text-gray-900">MONTHLY PREMIUM</h3>
                <p className="mt-1 text-sm text-gray-500">Worksheet view of exported sales, Debit Order banked revenue, Persal banked revenue, failed counts, and lost revenue.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[1180px] w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-white text-center font-semibold text-gray-800">
                      <th className="border border-gray-200 px-2 py-2 text-left">Product</th>
                      <th className="border border-gray-200 px-2 py-2">Prem</th>
                      <th className="border border-gray-200 px-2 py-2">Exported<br />Sales</th>
                      <th className="border border-gray-200 px-2 py-2">Debit<br />Order</th>
                      <th className="border border-gray-200 px-2 py-2">Successful</th>
                      <th className="border border-gray-200 px-2 py-2">Banked<br />Revenue</th>
                      <th className="border border-gray-200 px-2 py-2">Failed</th>
                      <th className="border border-gray-200 px-2 py-2">Lost<br />Revenue</th>
                      <th className="border border-gray-200 px-2 py-2">Persal</th>
                      <th className="border border-gray-200 px-2 py-2">Successful</th>
                      <th className="border border-gray-200 px-2 py-2">Banked<br />Revenue</th>
                      <th className="border border-gray-200 px-2 py-2">Failed</th>
                      <th className="border border-gray-200 px-2 py-2">Lost<br />Revenue</th>
                      <th className="border border-gray-200 px-2 py-2">Total Banked<br />Revenue</th>
                      <th className="border border-gray-200 px-2 py-2">Total Lost<br />Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyPremiumRows.map((row) => (
                      <tr key={row.productName} className="text-right text-gray-900">
                        <td className="border border-gray-200 px-2 py-2 text-left font-medium">{row.productName}</td>
                        <td className="border border-gray-200 px-2 py-2">{formatWorksheetNumber(row.premiumAmount)}</td>
                        <td className="border border-gray-200 px-2 py-2">{formatWorksheetNumber(row.exportedSales)}</td>
                        <td className="border border-gray-200 px-2 py-2">{formatWorksheetNumber(row.debitOrder)}</td>
                        <td className="border border-gray-200 px-2 py-2">{formatWorksheetNumber(row.debitSuccessful)}</td>
                        <td className="border border-gray-200 px-2 py-2">{formatWorksheetNumber(row.debitRevenue)}</td>
                        <td className="border border-gray-200 px-2 py-2 text-red-600">{formatWorksheetNumber(row.debitFailed)}</td>
                        <td className="border border-gray-200 px-2 py-2 text-red-600">{formatWorksheetNumber(row.debitLostRevenue)}</td>
                        <td className="border border-gray-200 px-2 py-2">{formatWorksheetNumber(row.persal)}</td>
                        <td className="border border-gray-200 px-2 py-2">{formatWorksheetNumber(row.persalSuccessful)}</td>
                        <td className="border border-gray-200 px-2 py-2">{formatWorksheetNumber(row.persalRevenue)}</td>
                        <td className="border border-gray-200 px-2 py-2 text-red-600">{formatWorksheetNumber(row.persalFailed)}</td>
                        <td className="border border-gray-200 px-2 py-2 text-red-600">{formatWorksheetNumber(row.persalLostRevenue)}</td>
                        <td className="border border-gray-200 px-2 py-2"></td>
                        <td className="border border-gray-200 px-2 py-2"></td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-900 text-right font-semibold text-gray-900">
                      <td className="border border-gray-200 px-2 py-3 text-left">Actual Revenue</td>
                      <td className="border border-gray-200 px-2 py-3"></td>
                      <td className="border border-gray-200 px-2 py-3">{formatWorksheetNumber(monthlyPremiumTotals.exportedSales)}</td>
                      <td className="border border-gray-200 px-2 py-3"></td>
                      <td className="border border-gray-200 px-2 py-3"></td>
                      <td className="border border-gray-200 px-2 py-3">{formatWorksheetNumber(monthlyPremiumTotals.debitRevenue)}</td>
                      <td className="border border-gray-200 px-2 py-3"></td>
                      <td className="border border-gray-200 px-2 py-3 text-red-600">{formatWorksheetNumber(monthlyPremiumTotals.debitLostRevenue)}</td>
                      <td className="border border-gray-200 px-2 py-3"></td>
                      <td className="border border-gray-200 px-2 py-3"></td>
                      <td className="border border-gray-200 px-2 py-3">{formatWorksheetNumber(monthlyPremiumTotals.persalRevenue)}</td>
                      <td className="border border-gray-200 px-2 py-3"></td>
                      <td className="border border-gray-200 px-2 py-3 text-red-600">{formatWorksheetNumber(monthlyPremiumTotals.persalLostRevenue)}</td>
                      <td className="border border-gray-200 px-2 py-3">{formatWorksheetNumber(totalBankedRevenue)}</td>
                      <td className="border border-gray-200 px-2 py-3 text-red-600">{formatWorksheetNumber(totalLostRevenue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

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

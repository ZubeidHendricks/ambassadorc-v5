import { Fragment, useState, useEffect } from 'react'
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

const globalBookMonths = ['Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26', 'Jul-26', 'Aug-26', 'Sep-26', 'Oct-26', 'Nov-26', 'Dec-26']

const persalSummaryRows = [
  { code: 'QREC', description: 'Recurring Premium', months: [6079, 6217, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0] },
  { code: 'QNEW', description: 'New Deduction', months: [68, 63, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0] },
  { code: 'QTOS', description: 'Termination of service', months: [103, 26, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0] },
  { code: 'QTOR', description: 'Reverse', months: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { code: 'QTOO', description: 'Deduction Successful', months: [42, 58, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0] },
  { code: 'QUPC', description: 'Union unable / Persal', months: [420, 364, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0] },
  { code: 'QSUP', description: 'Supplementary Premium - once off', months: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { code: 'QPDT', description: 'Deduction Stopped / Reinstated', months: [3, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { code: 'QTQV', description: 'Non Deduction / partial result', months: [5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { code: 'QPRN', description: 'Reinstatement Premium', months: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { code: 'QPRM', description: 'Reinstatement Negative', months: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { code: 'QREV', description: 'Negative', months: [15, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
]

const globalBookSections = [
  {
    title: 'Q-Link Big',
    rows: [
      { product: 'Legal - R99', values: [{ count: 12, value: 1188 }, { count: 11, value: 1089 }] },
      { product: 'Legal - R109', values: [{ count: 8, value: 872 }, { count: 9, value: 981 }] },
      { product: 'Legal - R129', values: [{ count: 110, value: 14190 }, { count: 107, value: 13803 }] },
      { product: 'Legal - R179', values: [{ count: 294, value: 52626 }, { count: 299, value: 53521 }] },
      { product: 'Legal - R199', values: [{ count: 1340, value: 266660 }, { count: 1444, value: 287356 }] },
      { product: 'Legal - R249', values: [{ count: 1673, value: 416877 }, { count: 1424, value: 354576 }] },
      { product: 'Legal - R349', values: [{ count: 913, value: 318637 }, { count: 1118, value: 390182 }] },
      { product: 'Legal - R399', values: [{ count: 117, value: 46683 }, { count: 111, value: 44289 }] },
      { product: 'Legal - R179', values: [{ count: 40, value: 7160 }, { count: 43, value: 7697 }] },
      { product: 'Legal - R0', values: [{ count: 4, value: 0 }, { count: 0, value: 0 }] },
      { product: '124 - R199', values: [{ count: 66, value: 13134 }, { count: 66, value: 13134 }] },
      { product: '124 - R219', values: [{ count: 575, value: 125925 }, { count: 592, value: 129648 }] },
      { product: '124 - R299', values: [{ count: 810, value: 242190 }, { count: 814, value: 243386 }] },
      { product: '124 - R349', values: [{ count: 2, value: 698 }, { count: 3, value: 1047 }] },
      { product: '124 - R399', values: [{ count: 5, value: 1995 }, { count: 3, value: 1197 }] },
      { product: '124 - R0', values: [{ count: 1, value: 0 }, { count: 0, value: 0 }] },
    ],
  },
  {
    title: 'Netcash',
    rows: [
      { product: 'Lifesaver Legal', values: [{ count: 266, value: 81064 }, { count: 355, value: 75000 }] },
      { product: 'Lifesaver Legal PA', values: [{ count: 1466, value: 621794 }, { count: 1329, value: 471251 }] },
      { product: 'Lifesaver 24', values: [{ count: 445, value: 118410 }, { count: 468, value: 131574 }] },
      { product: 'Legalnet Prime', values: [{ count: 566, value: 111334 }, { count: 606, value: 134156 }] },
      { product: 'Legalnet Pro', values: [{ count: 67, value: 14106 }, { count: 61, value: 13500 }] },
    ],
  },
]

function formatWorksheetNumber(value: number) {
  return value === 0 ? '' : value.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function formatWorksheetCurrency(value: number) {
  return value === 0 ? 'R0.00' : `R${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function globalBookValue(values: Array<{ count: number; value: number }>, index: number) {
  return values[index] ?? { count: 0, value: 0 }
}

export default function Reports() {
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.replace('#', '')
      const timer = setTimeout(() => {
        const el = document.getElementById(id)
        if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' })
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [])

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
  const persalMonthTotals = globalBookMonths.map((_, monthIndex) =>
    persalSummaryRows.reduce((sum, row) => sum + row.months[monthIndex], 0)
  )

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

            <div id="monthly-premium-preview" className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Monthly Premium Page</p>
                <h3 className="mt-1 text-lg font-bold text-gray-900">Monthly Premium</h3>
                <p className="mt-1 text-sm text-gray-500">Exported sales, Debit Order banked revenue, Persal banked revenue, failed counts, and lost revenue.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[1200px] w-full border-collapse text-sm">
                  <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-600">
                    <tr>
                      <th className="border-b border-gray-200 px-4 py-3 text-left">Product</th>
                      <th className="border-b border-gray-200 px-4 py-3 text-right">Prem</th>
                      <th className="border-b border-gray-200 px-4 py-3 text-right">Exported Sales</th>
                      <th className="border-b border-gray-200 px-4 py-3 text-right">Debit Order</th>
                      <th className="border-b border-gray-200 px-4 py-3 text-right">Successful</th>
                      <th className="border-b border-gray-200 px-4 py-3 text-right">Banked Revenue</th>
                      <th className="border-b border-gray-200 px-4 py-3 text-right">Failed</th>
                      <th className="border-b border-gray-200 px-4 py-3 text-right">Lost Revenue</th>
                      <th className="border-b border-gray-200 px-4 py-3 text-right">Persal</th>
                      <th className="border-b border-gray-200 px-4 py-3 text-right">Successful</th>
                      <th className="border-b border-gray-200 px-4 py-3 text-right">Banked Revenue</th>
                      <th className="border-b border-gray-200 px-4 py-3 text-right">Failed</th>
                      <th className="border-b border-gray-200 px-4 py-3 text-right">Lost Revenue</th>
                      <th className="border-b border-gray-200 px-4 py-3 text-right">Total Banked</th>
                      <th className="border-b border-gray-200 px-4 py-3 text-right">Total Lost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyPremiumRows.map((row) => (
                      <tr key={row.productName} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{row.productName}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatWorksheetNumber(row.premiumAmount)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatWorksheetNumber(row.exportedSales)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatWorksheetNumber(row.debitOrder)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatWorksheetNumber(row.debitSuccessful)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatWorksheetNumber(row.debitRevenue)}</td>
                        <td className="px-4 py-3 text-right text-red-600">{formatWorksheetNumber(row.debitFailed)}</td>
                        <td className="px-4 py-3 text-right text-red-600">{formatWorksheetNumber(row.debitLostRevenue)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatWorksheetNumber(row.persal)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatWorksheetNumber(row.persalSuccessful)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatWorksheetNumber(row.persalRevenue)}</td>
                        <td className="px-4 py-3 text-right text-red-600">{formatWorksheetNumber(row.persalFailed)}</td>
                        <td className="px-4 py-3 text-right text-red-600">{formatWorksheetNumber(row.persalLostRevenue)}</td>
                        <td className="px-4 py-3 text-right text-gray-700"></td>
                        <td className="px-4 py-3 text-right text-gray-700"></td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold text-gray-900">
                      <td className="px-4 py-3">Actual Revenue</td>
                      <td className="px-4 py-3 text-right"></td>
                      <td className="px-4 py-3 text-right">{formatWorksheetNumber(monthlyPremiumTotals.exportedSales)}</td>
                      <td className="px-4 py-3 text-right"></td>
                      <td className="px-4 py-3 text-right"></td>
                      <td className="px-4 py-3 text-right">{formatWorksheetNumber(monthlyPremiumTotals.debitRevenue)}</td>
                      <td className="px-4 py-3 text-right"></td>
                      <td className="px-4 py-3 text-right text-red-600">{formatWorksheetNumber(monthlyPremiumTotals.debitLostRevenue)}</td>
                      <td className="px-4 py-3 text-right"></td>
                      <td className="px-4 py-3 text-right"></td>
                      <td className="px-4 py-3 text-right">{formatWorksheetNumber(monthlyPremiumTotals.persalRevenue)}</td>
                      <td className="px-4 py-3 text-right"></td>
                      <td className="px-4 py-3 text-right text-red-600">{formatWorksheetNumber(monthlyPremiumTotals.persalLostRevenue)}</td>
                      <td className="px-4 py-3 text-right">{formatWorksheetNumber(totalBankedRevenue)}</td>
                      <td className="px-4 py-3 text-right text-red-600">{formatWorksheetNumber(totalLostRevenue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div id="global-book-preview" className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Global Book Page</p>
                <h3 className="mt-1 text-lg font-bold text-gray-900">Persal Monthly Summary</h3>
                <p className="mt-1 text-sm text-gray-500">Q-Link, Netcash, total book, premiums, and average premium rows across Jan-26 to Dec-26.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[1280px] w-full border-collapse text-sm">
                  <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-600">
                    <tr>
                      <th className="border-b border-gray-200 px-4 py-3 text-left">Code</th>
                      <th className="border-b border-gray-200 px-4 py-3 text-left">Description</th>
                      {globalBookMonths.map((month) => (
                        <th key={month} className="border-b border-gray-200 px-4 py-3 text-right">{month}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {persalSummaryRows.map((row) => (
                      <tr key={row.code} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-900">{row.code}</td>
                        <td className="px-4 py-3 text-gray-700">{row.description}</td>
                        {row.months.map((value, index) => (
                          <td key={`${row.code}-${globalBookMonths[index]}`} className="px-4 py-3 text-right text-gray-700">{formatWorksheetNumber(value) || '-'}</td>
                        ))}
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold text-gray-900">
                      <td className="px-4 py-3" colSpan={2}>Q-Link Total</td>
                      {persalMonthTotals.map((value, index) => (
                        <td key={`persal-total-${globalBookMonths[index]}`} className="px-4 py-3 text-right">{formatWorksheetNumber(value) || '-'}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto border-t border-gray-200">
                {globalBookSections.map((section) => {
                  const monthlyCounts = globalBookMonths.map((_, monthIndex) =>
                    section.rows.reduce((sum, row) => sum + globalBookValue(row.values, monthIndex).count, 0)
                  )
                  const monthlyValues = globalBookMonths.map((_, monthIndex) =>
                    section.rows.reduce((sum, row) => sum + globalBookValue(row.values, monthIndex).value, 0)
                  )
                  return (
                    <table key={section.title} className="min-w-[1680px] w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-100 text-xs font-bold uppercase tracking-wide text-gray-700">
                          <th className="border-b border-gray-200 px-4 py-3 text-left">{section.title}</th>
                          {globalBookMonths.map((month) => (
                            <th key={`${section.title}-${month}`} className="border-b border-gray-200 px-4 py-3 text-center" colSpan={2}>{month}</th>
                          ))}
                        </tr>
                        <tr className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
                          <th className="border-b border-gray-200 px-4 py-3 text-left">Product</th>
                          {globalBookMonths.map((month) => (
                            <Fragment key={`${section.title}-${month}-headers`}>
                              <th key={`${section.title}-${month}-count`} className="border-b border-gray-200 px-4 py-3 text-right">Count</th>
                              <th key={`${section.title}-${month}-value`} className="border-b border-gray-200 px-4 py-3 text-right">Value</th>
                            </Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((row, rowIndex) => (
                          <tr key={`${section.title}-${row.product}-${rowIndex}`} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-900">{row.product}</td>
                            {globalBookMonths.map((month, monthIndex) => {
                              const value = globalBookValue(row.values, monthIndex)
                              return (
                                <Fragment key={`${section.title}-${row.product}-${month}`}>
                                  <td key={`${section.title}-${row.product}-${month}-count`} className="px-4 py-3 text-right text-gray-700">{formatWorksheetNumber(value.count) || '-'}</td>
                                  <td key={`${section.title}-${row.product}-${month}-value`} className="px-4 py-3 text-right text-primary">{formatWorksheetCurrency(value.value)}</td>
                                </Fragment>
                              )
                            })}
                          </tr>
                        ))}
                        <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold text-gray-900">
                          <td className="px-4 py-3">Total Book & Premiums</td>
                          {globalBookMonths.map((month, monthIndex) => (
                            <Fragment key={`${section.title}-${month}-totals`}>
                              <td key={`${section.title}-${month}-total-count`} className="px-4 py-3 text-right">{formatWorksheetNumber(monthlyCounts[monthIndex]) || '-'}</td>
                              <td key={`${section.title}-${month}-total-value`} className="px-4 py-3 text-right text-primary">{formatWorksheetCurrency(monthlyValues[monthIndex])}</td>
                            </Fragment>
                          ))}
                        </tr>
                        <tr className="border-b border-gray-100 text-gray-700">
                          <td className="px-4 py-3 font-medium">Average Premiums</td>
                          {globalBookMonths.map((month, monthIndex) => (
                            <Fragment key={`${section.title}-${month}-averages`}>
                              <td key={`${section.title}-${month}-average-count`} className="px-4 py-3 text-right"></td>
                              <td key={`${section.title}-${month}-average-value`} className="px-4 py-3 text-right text-primary">
                                {monthlyCounts[monthIndex] ? formatWorksheetCurrency(monthlyValues[monthIndex] / monthlyCounts[monthIndex]) : '—'}
                              </td>
                            </Fragment>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  )
                })}
              </div>

              <div className="overflow-x-auto border-t-2 border-gray-200">
                <table className="min-w-[1680px] w-full border-collapse text-sm">
                  <tbody>
                    <tr className="bg-gray-900 font-semibold text-white">
                      <td className="px-4 py-3 text-left">Total</td>
                      {globalBookMonths.map((month, monthIndex) => {
                        const count = globalBookSections.reduce(
                          (sum, section) => sum + section.rows.reduce((rowSum, row) => rowSum + globalBookValue(row.values, monthIndex).count, 0),
                          0
                        )
                        const value = globalBookSections.reduce(
                          (sum, section) => sum + section.rows.reduce((rowSum, row) => rowSum + globalBookValue(row.values, monthIndex).value, 0),
                          0
                        )
                        return (
                          <Fragment key={`global-total-${month}`}>
                            <td key={`global-total-${month}-count`} className="px-4 py-3 text-right">{formatWorksheetNumber(count) || '-'}</td>
                            <td key={`global-total-${month}-value`} className="px-4 py-3 text-right">{formatWorksheetCurrency(value)}</td>
                          </Fragment>
                        )
                      })}
                    </tr>
                    <tr className="bg-gray-50 font-semibold text-gray-900">
                      <td className="px-4 py-3 text-left">Total Book & Premiums</td>
                      {globalBookMonths.map((month, monthIndex) => {
                        const count = globalBookSections.reduce(
                          (sum, section) => sum + section.rows.reduce((rowSum, row) => rowSum + globalBookValue(row.values, monthIndex).count, 0),
                          0
                        )
                        const value = globalBookSections.reduce(
                          (sum, section) => sum + section.rows.reduce((rowSum, row) => rowSum + globalBookValue(row.values, monthIndex).value, 0),
                          0
                        )
                        return (
                          <Fragment key={`global-book-${month}`}>
                            <td key={`global-book-${month}-count`} className="px-4 py-3 text-right">{formatWorksheetNumber(count) || '-'}</td>
                            <td key={`global-book-${month}-value`} className="px-4 py-3 text-right text-primary">{formatWorksheetCurrency(value)}</td>
                          </Fragment>
                        )
                      })}
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

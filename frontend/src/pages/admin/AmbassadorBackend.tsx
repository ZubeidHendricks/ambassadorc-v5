import { useEffect, useState, type ReactNode } from 'react'
import {
  authoriseAmbassadorPayment,
  downloadAmbassadorFnbCsv,
  generateAmbassadorPayments,
  getAmbassadorOperations,
  importAmbassadorPaidFile,
  type AmbassadorOperationsRow,
  type AmbassadorOperationsSummary,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Banknote, CheckCircle2, Download, FileSpreadsheet, MessageSquare, RefreshCw, ShieldCheck, Upload, Users } from 'lucide-react'

const currency = (value: number) => `R${Number(value || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
const wholeCurrency = (value: number) => Number(value || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0 })
const formatSheetDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-')
}

const emptySummary: AmbassadorOperationsSummary = {
  referrals: 0,
  memberSignups: 0,
  sales: 0,
  totalEarned: 0,
  pendingPayment: 0,
  amountDue: 0,
}

export default function AmbassadorBackend() {
  const [rows, setRows] = useState<AmbassadorOperationsRow[]>([])
  const [summary, setSummary] = useState<AmbassadorOperationsSummary>(emptySummary)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await getAmbassadorOperations()
      setRows(data.rows)
      setSummary(data.summary)
    } catch {
      setRows([])
      setSummary(emptySummary)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleGenerate() {
    setProcessing('generate')
    setMessage(null)
    try {
      const result = await generateAmbassadorPayments()
      setMessage(`${result.payments.length} payment(s) generated for batch ${result.batchRef}`)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not generate payments')
    } finally {
      setProcessing(null)
    }
  }

  async function handleAuthorise(id: number) {
    setProcessing(`authorise-${id}`)
    setMessage(null)
    try {
      await authoriseAmbassadorPayment(id)
      setMessage('Payment authorised for FNB processing')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not authorise payment')
    } finally {
      setProcessing(null)
    }
  }

  async function handleImportPaid(id: number) {
    setProcessing(`paid-${id}`)
    setMessage(null)
    try {
      await importAmbassadorPaidFile(id)
      setMessage('Paid file imported, table updated, and WhatsApp/SMS notice queued')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not import paid file')
    } finally {
      setProcessing(null)
    }
  }

  const pendingPayments = rows.filter((row) => row.latestPayment?.status === 'PENDING')

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Ambassador Backend</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Activity, Earnings & FNB Payment Cycle</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Recreates the workbook flow: referral leads and member signups feed the ambassador backend, CSV is exported for FNB, payments are authorised, paid files are imported, and ambassadors are notified.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} disabled={loading || !!processing}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="secondary" onClick={handleGenerate} disabled={loading || !!processing || summary.amountDue <= 0}>
            <Banknote className="mr-2 h-4 w-4" />
            Generate Due Payments
          </Button>
          <Button onClick={downloadAmbassadorFnbCsv} disabled={pendingPayments.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export FNB CSV
          </Button>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
          {message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="Referral Leads" value={summary.referrals} icon={<Users className="h-5 w-5" />} />
        <SummaryCard label="Member Signups" value={summary.memberSignups} icon={<CheckCircle2 className="h-5 w-5" />} />
        <SummaryCard label="Successful Sales" value={summary.sales} icon={<ShieldCheck className="h-5 w-5" />} />
        <SummaryCard label="Total Earned" value={currency(summary.totalEarned)} icon={<Banknote className="h-5 w-5" />} />
        <SummaryCard label="Pending FNB" value={currency(summary.pendingPayment)} icon={<FileSpreadsheet className="h-5 w-5" />} />
        <SummaryCard label="Amount Due" value={currency(summary.amountDue)} icon={<Download className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workbook Flow Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            {[
              ['1', 'Backend table updates from referrals and member signups'],
              ['2', 'CSV exported from due/pending payment rows'],
              ['3', 'CSV imported into FNB enterprise banking'],
              ['4', 'Authorised payments are imported as paid'],
              ['5', 'Dashboard and ambassador notifications update'],
            ].map(([step, label]) => (
              <div key={step} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{step}</div>
                <p className="text-sm font-medium text-gray-700">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>AMBASSADORS</CardTitle>
              <p className="mt-1 text-xs text-gray-500">Spreadsheet-style backend table for referrals, sales value, payment export, FNB import, authorisation, paid-file import, table update, and final paid status.</p>
            </div>
            <Badge variant="secondary" className="w-fit rounded-md uppercase tracking-wide">Workbook View</Badge>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 pb-0">
          <table className="min-w-[1280px] border-collapse text-center text-[12px]">
              <thead>
                <tr>
                  <th colSpan={16} className="border border-gray-300 bg-white px-3 py-2 text-sm font-bold tracking-wide text-gray-900">AMBASSADORS</th>
                </tr>
                <tr className="bg-gray-50 text-[11px] font-semibold text-gray-700">
                  <SheetHeader>Date Submitted</SheetHeader>
                  <SheetHeader>Name</SheetHeader>
                  <SheetHeader>Surname</SheetHeader>
                  <SheetHeader>Referrals</SheetHeader>
                  <SheetHeader>Confirmed Numbers</SheetHeader>
                  <SheetHeader>Member Signup</SheetHeader>
                  <SheetHeader>Sales</SheetHeader>
                  <SheetHeader>Value Rands</SheetHeader>
                  <SheetHeader>Bonus</SheetHeader>
                  <SheetHeader>Total for payment</SheetHeader>
                  <SheetHeader>CSV Export File</SheetHeader>
                  <SheetHeader>Import CSV File to FNB</SheetHeader>
                  <SheetHeader>Authorise Payment</SheetHeader>
                  <SheetHeader>Export Paid File</SheetHeader>
                  <SheetHeader>Update Table</SheetHeader>
                  <SheetHeader>Paid</SheetHeader>
                </tr>
              </thead>
              <tbody className="bg-white">
                {loading ? (
                  <tr>
                    <SheetCell colSpan={16} className="h-32 text-gray-500">
                      <div className="flex items-center justify-center gap-3">
                        <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        Loading ambassador backend table
                      </div>
                    </SheetCell>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <SheetCell colSpan={16} className="h-32 text-gray-500">No ambassador activity found.</SheetCell>
                  </tr>
                ) : rows.map((row) => {
                  const latest = row.latestPayment
                  const pending = latest?.status === 'PENDING'
                  const paid = row.paymentStatus === 'YES'
                  const due = row.amountDue > 0
                  return (
                    <tr key={row.ambassadorId} className="hover:bg-blue-50/30">
                      <SheetCell className="text-gray-700">{formatSheetDate(row.dateSubmitted)}</SheetCell>
                      <SheetCell className="text-left font-medium text-gray-900">{row.name}</SheetCell>
                      <SheetCell className="text-left font-medium text-gray-900">{row.surname}</SheetCell>
                      <SheetCell>{row.referrals || ''}</SheetCell>
                      <SheetCell className="font-semibold text-cyan-700">{row.confirmedNumbers || ''}</SheetCell>
                      <SheetCell>{row.memberSignup || ''}</SheetCell>
                      <SheetCell className="font-semibold text-cyan-700">{row.sales || ''}</SheetCell>
                      <SheetCell className="text-right font-medium">{wholeCurrency(row.valueRands)}</SheetCell>
                      <SheetCell className="text-right font-medium">{row.bonus > 0 ? wholeCurrency(row.bonus) : ''}</SheetCell>
                      <SheetCell className="text-right font-semibold text-gray-900">{wholeCurrency(row.totalForPayment)}</SheetCell>
                      <SheetCell>
                        {due ? (
                          <span className="inline-flex rounded bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase text-amber-700">Due</span>
                        ) : pending || paid ? (
                          <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" />
                        ) : ''}
                      </SheetCell>
                      <SheetCell>
                        {pending ? (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">
                            <Upload className="h-3 w-3" />
                            FNB
                          </span>
                        ) : ''}
                      </SheetCell>
                      <SheetCell>
                        {pending && latest ? (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => handleAuthorise(latest.id)} disabled={processing === `authorise-${latest.id}`}>
                            Authorise
                          </Button>
                        ) : paid ? (
                          <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" />
                        ) : ''}
                      </SheetCell>
                      <SheetCell>
                        {pending && latest ? (
                          <Button size="sm" className="h-7 px-2 text-[11px]" onClick={() => handleImportPaid(latest.id)} disabled={processing === `paid-${latest.id}`}>
                            <MessageSquare className="mr-1 h-3 w-3" />
                            Paid File
                          </Button>
                        ) : paid ? (
                          <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" />
                        ) : ''}
                      </SheetCell>
                      <SheetCell>
                        {paid ? (
                          <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" />
                        ) : pending ? (
                          <span className="text-[10px] font-semibold uppercase text-blue-600">Pending update</span>
                        ) : due ? (
                          <span className="text-[10px] font-semibold uppercase text-amber-600">Generate</span>
                        ) : ''}
                      </SheetCell>
                      <SheetCell className={paid ? 'bg-lime-200 font-black text-gray-900' : pending ? 'bg-red-600 font-black text-white' : 'font-semibold text-gray-500'}>
                        {paid ? 'YES' : pending ? 'PENDING' : row.paymentStatus === 'DUE' ? 'DUE' : ''}
                      </SheetCell>
                    </tr>
                  )
                })}
              </tbody>
            </table>
        </CardContent>
      </Card>
    </div>
  )
}

function SheetHeader({ children }: { children: ReactNode }) {
  return (
    <th className="border border-gray-300 px-2 py-2 align-middle leading-tight">
      {children}
    </th>
  )
}

function SheetCell({ children, className = '', colSpan }: { children: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={`h-8 border border-gray-200 px-2 py-1 align-middle ${className}`}>
      {children}
    </td>
  )
}

function SummaryCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
    </div>
  )
}

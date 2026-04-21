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
import { Banknote, CheckCircle2, Download, FileSpreadsheet, MessageSquare, RefreshCw, ShieldCheck, Users } from 'lucide-react'

const currency = (value: number) => `R${Number(value || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`

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

      <Card>
        <CardHeader>
          <CardTitle>Ambassador Payment Table</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No ambassador activity found.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-3 py-3">Ambassador</th>
                  <th className="px-3 py-3">Referrals</th>
                  <th className="px-3 py-3">Confirmed</th>
                  <th className="px-3 py-3">Member Signups</th>
                  <th className="px-3 py-3">Sales</th>
                  <th className="px-3 py-3">Value</th>
                  <th className="px-3 py-3">Bonus</th>
                  <th className="px-3 py-3">Total</th>
                  <th className="px-3 py-3">Pending</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.map((row) => {
                  const latest = row.latestPayment
                  const pending = latest?.status === 'PENDING'
                  return (
                    <tr key={row.ambassadorId}>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-gray-900">{row.name} {row.surname}</p>
                        <p className="text-xs text-gray-500">{row.mobileNo}</p>
                      </td>
                      <td className="px-3 py-3">{row.referrals}</td>
                      <td className="px-3 py-3">{row.confirmedNumbers}</td>
                      <td className="px-3 py-3">{row.memberSignup}</td>
                      <td className="px-3 py-3">{row.sales}</td>
                      <td className="px-3 py-3 font-medium">{currency(row.valueRands)}</td>
                      <td className="px-3 py-3">{currency(row.bonus)}</td>
                      <td className="px-3 py-3 font-semibold text-gray-900">{currency(row.totalForPayment)}</td>
                      <td className="px-3 py-3">{currency(row.pendingPayment)}</td>
                      <td className="px-3 py-3">
                        <Badge variant={row.paymentStatus === 'DUE' ? 'warning' : row.paymentStatus === 'YES' ? 'success' : 'secondary'}>
                          {row.paymentStatus}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        {pending && latest ? (
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleAuthorise(latest.id)} disabled={processing === `authorise-${latest.id}`}>
                              Authorise
                            </Button>
                            <Button size="sm" onClick={() => handleImportPaid(latest.id)} disabled={processing === `paid-${latest.id}`}>
                              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                              Import Paid
                            </Button>
                          </div>
                        ) : row.amountDue > 0 ? (
                          <span className="text-xs text-amber-600">Generate due payment</span>
                        ) : (
                          <span className="text-xs text-gray-400">No action</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
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

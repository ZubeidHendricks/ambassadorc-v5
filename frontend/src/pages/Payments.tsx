import { useEffect, useState } from 'react'
import { getAmbassadorPayments, type AmbassadorPayment } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Wallet, Clock, CheckCircle2, Inbox } from 'lucide-react'

const TYPE_LABELS: Record<AmbassadorPayment['type'], string> = {
  REFERRAL_BATCH: 'Referral Batch',
  MEMBER_SIGNUP_CONVERSION: 'Member Sign-Up',
  MANUAL: 'Manual Payment',
}

const STATUS_STYLES: Record<AmbassadorPayment['status'], string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

export default function Payments() {
  const [data, setData] = useState<{
    payments: AmbassadorPayment[]
    summary: { totalPaid: number; totalPending: number }
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAmbassadorPayments()
      .then(setData)
      .catch(() => setData({ payments: [], summary: { totalPaid: 0, totalPending: 0 } }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-light border-t-transparent" />
      </div>
    )
  }

  const { payments = [], summary = { totalPaid: 0, totalPending: 0 } } = data ?? {}

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Payments</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your FNB Cash Send payment history from AmbassadorC
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">
                R{summary.totalPaid.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-gray-500">Total Paid Out</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-full bg-yellow-100 p-3">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-700">
                R{summary.totalPending.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-gray-500">Pending Payment</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-full bg-blue-100 p-3">
              <Wallet className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700">
                R{(summary.totalPaid + summary.totalPending).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-gray-500">Total Earned</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment list */}
      {payments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Inbox className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No payment records yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Payments will appear here once processed by the admin team
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <Card key={payment.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">
                        R{Number(payment.amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[payment.status]}`}>
                        {payment.status}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                        {TYPE_LABELS[payment.type]}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 text-sm text-gray-500">
                      {payment.reference && (
                        <p>Reference: <span className="font-mono text-gray-700">{payment.reference}</span></p>
                      )}
                      {payment.periodStart && payment.periodEnd && (
                        <p>
                          Period:{' '}
                          {new Date(payment.periodStart).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' — '}
                          {new Date(payment.periodEnd).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                      {payment.notes && <p>{payment.notes}</p>}
                    </div>
                  </div>

                  <div className="text-right text-sm text-gray-400 shrink-0">
                    {payment.paidAt ? (
                      <>
                        <p className="text-green-600 font-medium">
                          {new Date(payment.paidAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-xs">Cash Send paid</p>
                      </>
                    ) : (
                      <>
                        <p>{new Date(payment.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        <p className="text-xs">Created</p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { getQAItems, submitQAVerdict, type QAItem } from '@/lib/api'

const demoItems: QAItem[] = [
  { id: 1, saleId: 1, clientName: 'John Doe', productName: 'Family Cover', agentName: 'Sarah Mbeki', premiumAmount: 350, status: 'pending', createdAt: '2025-04-10T09:00:00' },
  { id: 2, saleId: 2, clientName: 'Maria Santos', productName: 'Funeral Plan', agentName: 'James Nkosi', premiumAmount: 150, status: 'pending', createdAt: '2025-04-09T14:30:00' },
  { id: 3, saleId: 3, clientName: 'Sipho Ndlovu', productName: 'Family Cover', agentName: 'Sarah Mbeki', premiumAmount: 250, status: 'pending', createdAt: '2025-04-08T11:15:00' },
  { id: 4, saleId: 4, clientName: 'Nomsa Dlamini', productName: 'Funeral Plan', agentName: 'Thandi Zulu', premiumAmount: 80, status: 'passed', verdict: 'passed', reviewedBy: 'Admin', reviewedAt: '2025-04-07T16:00:00', createdAt: '2025-04-06T10:00:00' },
  { id: 5, saleId: 5, clientName: 'David Pillay', productName: 'Family Cover', agentName: 'James Nkosi', premiumAmount: 450, status: 'failed', verdict: 'failed', notes: 'Client did not confirm details.', reviewedBy: 'Admin', reviewedAt: '2025-04-05T12:00:00', createdAt: '2025-04-04T09:00:00' },
]

export default function QualityAssurance() {
  const [items, setItems] = useState<QAItem[]>(demoItems)
  const [filter, setFilter] = useState<string>('pending')
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [processing, setProcessing] = useState<number | null>(null)

  useEffect(() => {
    getQAItems(filter || undefined).then(setItems).catch(() => {})
  }, [filter])

  const handleVerdict = async (id: number, verdict: string) => {
    setProcessing(id)
    try {
      await submitQAVerdict(id, { verdict, notes: notes[id] || '' })
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: verdict, verdict } : item
        )
      )
    } catch {
      // handle
    } finally {
      setProcessing(null)
    }
  }

  const filters = ['pending', 'passed', 'failed', 'escalated', '']
  const filtered = filter ? items.filter((i) => i.status === filter) : items

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quality Assurance</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and verify sales before activation.
        </p>
      </div>

      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-[#128FAF] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f ? f.charAt(0).toUpperCase() + f.slice(1) : 'All'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">
            No QA items found.
          </div>
        )}
        {filtered.map((item) => (
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
                    placeholder="Add notes..."
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleVerdict(item.id, 'passed')}
                      disabled={processing === item.id}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Pass
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleVerdict(item.id, 'failed')}
                      disabled={processing === item.id}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4" />
                      Fail
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVerdict(item.id, 'escalated')}
                      disabled={processing === item.id}
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

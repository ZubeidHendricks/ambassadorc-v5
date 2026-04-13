import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getReferralBatches,
  getBatchDetail,
  type ReferralBatch,
} from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, statusToBadgeVariant } from '@/components/ui/badge'
import { ChevronDown, ChevronUp, Send, Package } from 'lucide-react'

export default function ReferralHistory() {
  const [batches, setBatches] = useState<ReferralBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    getReferralBatches()
      .then(setBatches)
      .catch(() => setBatches([]))
      .finally(() => setLoading(false))
  }, [])

  async function toggleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }

    const batch = batches.find((b) => b.id === id)
    if (batch && !batch.referrals) {
      setLoadingDetail(true)
      try {
        const detail = await getBatchDetail(id)
        setBatches((prev) =>
          prev.map((b) =>
            b.id === id ? { ...b, referrals: detail.referrals } : b
          )
        )
      } catch {
        // ignore
      } finally {
        setLoadingDetail(false)
      }
    }
    setExpandedId(id)
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Referral History</h1>
          <p className="mt-1 text-sm text-gray-500">
            View all your submitted referral batches
          </p>
        </div>
        <Button asChild>
          <Link to="/referrals">
            <Send className="mr-2 h-4 w-4" />
            New Batch
          </Link>
        </Button>
      </div>

      {batches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No referral batches yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Submit your first batch of referrals to get started
            </p>
            <Button asChild className="mt-6">
              <Link to="/referrals">Submit Referrals</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => {
            const isExpanded = expandedId === batch.id
            return (
              <Card key={batch.id}>
                <button
                  onClick={() => toggleExpand(batch.id)}
                  className="w-full text-left"
                >
                  <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                    <div>
                      <CardTitle className="text-base">
                        {batch.batchName}
                      </CardTitle>
                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(batch.createdAt).toLocaleDateString('en-ZA', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={statusToBadgeVariant(batch.status)}>
                        {batch.status}
                      </Badge>
                      <span className="text-sm font-medium text-gray-500">
                        {batch.referralCount} referral
                        {batch.referralCount !== 1 ? 's' : ''}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </CardHeader>
                </button>

                {isExpanded && (
                  <CardContent className="border-t border-gray-100 pt-4">
                    {loadingDetail ? (
                      <div className="flex justify-center py-4">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    ) : batch.referrals ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="pb-2 pr-4 text-left font-medium text-gray-500">
                                Name
                              </th>
                              <th className="pb-2 pr-4 text-left font-medium text-gray-500">
                                Contact
                              </th>
                              <th className="pb-2 text-left font-medium text-gray-500">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {batch.referrals.map((ref) => (
                              <tr
                                key={ref.id}
                                className="border-b border-gray-50 last:border-0"
                              >
                                <td className="py-2 pr-4 text-gray-900">
                                  {ref.name}
                                </td>
                                <td className="py-2 pr-4 text-gray-600">
                                  {ref.contactNo}
                                </td>
                                <td className="py-2">
                                  <Badge
                                    variant={statusToBadgeVariant(ref.status)}
                                  >
                                    {ref.status}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

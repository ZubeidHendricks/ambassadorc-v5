import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLeads, type Lead, type LeadType } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, statusToBadgeVariant } from '@/components/ui/badge'
import { UserPlus, Inbox, Users, CheckCircle2 } from 'lucide-react'

const TYPE_LABELS: Record<LeadType, { label: string; color: string }> = {
  REFERRAL_LEAD: { label: 'Referral Lead', color: 'bg-blue-100 text-blue-700' },
  MEMBER_SIGNUP: { label: 'Member Sign-Up', color: 'bg-purple-100 text-purple-700' },
}

export default function LeadHistory() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<LeadType | 'ALL'>('ALL')

  useEffect(() => {
    setLoading(true)
    const filter = typeFilter === 'ALL' ? undefined : typeFilter
    getLeads(filter)
      .then(setLeads)
      .catch(() => setLeads([]))
      .finally(() => setLoading(false))
  }, [typeFilter])

  const referralLeads = leads.filter((l) => l.type === 'REFERRAL_LEAD')
  const memberSignups = leads.filter((l) => l.type === 'MEMBER_SIGNUP')
  const paidSignups = memberSignups.filter((l) => l.status === 'PAID')

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-light border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead History</h1>
          <p className="mt-1 text-sm text-gray-500">
            All your submitted leads and their current status
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link to="/leads">
            <UserPlus className="mr-2 h-4 w-4" />
            New Lead
          </Link>
        </Button>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-blue-600">{referralLeads.length}</p>
          <p className="text-xs text-gray-500 mt-1">Referral Leads</p>
          <p className="text-xs text-green-600 font-medium mt-1">
            R{Math.floor(referralLeads.length / 10) * 100} earned
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-purple-600">{memberSignups.length}</p>
          <p className="text-xs text-gray-500 mt-1">Member Sign-Ups</p>
          <p className="text-xs text-gray-400 text-xs mt-1">{paidSignups.length} converted</p>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-green-600">R{paidSignups.length * 100}</p>
          <p className="text-xs text-gray-500 mt-1">Sign-Up Earnings</p>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-800">
            R{Math.floor(referralLeads.length / 10) * 100 + paidSignups.length * 100}
          </p>
          <p className="text-xs text-gray-500 mt-1">Total Earned</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-2">
        {(['ALL', 'REFERRAL_LEAD', 'MEMBER_SIGNUP'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setTypeFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              typeFilter === f
                ? 'bg-primary-light text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'ALL' ? 'All' : f === 'REFERRAL_LEAD' ? 'Referral Leads' : 'Member Sign-Ups'}
          </button>
        ))}
      </div>

      {leads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Inbox className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No leads submitted yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Submit your first lead to start earning
            </p>
            <Button asChild variant="secondary" className="mt-6">
              <Link to="/leads">Submit a Lead</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {leads.map((lead) => {
            const typeInfo = TYPE_LABELS[lead.type] ?? TYPE_LABELS.REFERRAL_LEAD
            const TypeIcon = lead.type === 'MEMBER_SIGNUP' ? CheckCircle2 : Users
            return (
              <Card key={lead.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      {lead.firstName} {lead.lastName}
                    </CardTitle>
                    <Badge variant={statusToBadgeVariant(lead.status)}>
                      {lead.status}
                    </Badge>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 mt-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${typeInfo.color}`}
                  >
                    <TypeIcon className="h-3 w-3" />
                    {typeInfo.label}
                  </span>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Contact</span>
                      <span className="font-medium text-gray-700">{lead.contactNo}</span>
                    </div>
                    {lead.preferredContact && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Preferred</span>
                        <span className="font-medium text-gray-700">{lead.preferredContact}</span>
                      </div>
                    )}
                    {lead.employerName && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Employer</span>
                        <span className="font-medium text-gray-700 text-right max-w-[60%] truncate">{lead.employerName}</span>
                      </div>
                    )}
                    {lead.datePaid && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Date Paid</span>
                        <span className="font-medium text-green-600">
                          {new Date(lead.datePaid).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Submitted</span>
                      <span className="text-gray-700">
                        {new Date(lead.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {lead.type === 'MEMBER_SIGNUP' && lead.status === 'PAID' && (
                      <div className="mt-2 rounded-md bg-green-50 px-2 py-1 text-center text-xs font-semibold text-green-700">
                        R100 earned — converted
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

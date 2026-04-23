import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, RefreshCw, ChevronRight, PhoneCall,
  User, Filter, ArrowUpDown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAdminLeads, type AdminLead, type CallOutcome } from '@/lib/api'

const STATUS_META: Record<string, { label: string; color: string }> = {
  NEW:       { label: 'New',       color: 'bg-orange-100 text-orange-700' },
  CONTACTED: { label: 'Contacted', color: 'bg-blue-100 text-blue-700' },
  PAID:      { label: 'Paid',      color: 'bg-emerald-100 text-emerald-700' },
  CLOSED:    { label: 'Closed',    color: 'bg-gray-100 text-gray-600' },
}

const OUTCOME_META: Record<CallOutcome, { label: string; color: string }> = {
  SALE_MADE:           { label: 'Sale Made',       color: 'bg-emerald-100 text-emerald-700' },
  COULD_NOT_REACH:     { label: 'No Answer',       color: 'bg-amber-100 text-amber-700' },
  NOT_INTERESTED:      { label: 'Not Interested',  color: 'bg-red-100 text-red-700' },
  CALLBACK_SCHEDULED:  { label: 'Callback',        color: 'bg-blue-100 text-blue-700' },
}

export default function LeadsAll() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<AdminLead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState<'' | 'assigned' | 'unassigned'>('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAdminLeads({
        page,
        limit: 50,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        assigned: assignedFilter || undefined,
      })
      setLeads(data.leads)
      setPagination({ total: data.pagination.total, totalPages: data.pagination.totalPages })
    } catch {
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [page, typeFilter, statusFilter, assignedFilter])

  useEffect(() => { setPage(1) }, [typeFilter, statusFilter, assignedFilter])
  useEffect(() => { load() }, [load])

  const filtered = search.trim()
    ? leads.filter(l =>
        `${l.firstName} ${l.lastName} ${l.contactNo} ${l.ambassador.firstName} ${l.ambassador.lastName}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : leads

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <PhoneCall className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">All Leads</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {pagination.total} leads total — click any row to view its full journey.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm focus-within:border-primary min-w-[220px]">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, ambassador…"
            className="flex-1 border-none bg-transparent text-sm text-gray-700 focus:outline-none"
          />
        </div>

        {/* Type */}
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700 shadow-sm focus:border-primary focus:outline-none"
        >
          <option value="">All types</option>
          <option value="REFERRAL_LEAD">Referrals</option>
          <option value="MEMBER_SIGNUP">Signups</option>
        </select>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700 shadow-sm focus:border-primary focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="NEW">New</option>
          <option value="CONTACTED">Contacted</option>
          <option value="PAID">Paid</option>
          <option value="CLOSED">Closed</option>
        </select>

        {/* Assignment */}
        <select
          value={assignedFilter}
          onChange={e => setAssignedFilter(e.target.value as typeof assignedFilter)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700 shadow-sm focus:border-primary focus:outline-none"
        >
          <option value="">Assigned &amp; unassigned</option>
          <option value="unassigned">Unassigned only</option>
          <option value="assigned">Assigned only</option>
        </select>

        <button
          onClick={load}
          disabled={loading}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Lead</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Phone</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Type</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Ambassador</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Assigned Agent</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Outcome</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Submitted</th>
              <th className="w-8 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-300" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-sm text-gray-400">
                  No leads found.
                </td>
              </tr>
            ) : (
              filtered.map(lead => (
                <tr
                  key={lead.id}
                  onClick={() => navigate(`/admin/leads/${lead.id}`)}
                  className="cursor-pointer transition-colors hover:bg-primary/5"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{lead.firstName} {lead.lastName}</p>
                    {lead.employerName && (
                      <p className="text-xs text-gray-400">{lead.employerName}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{lead.contactNo}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      lead.type === 'MEMBER_SIGNUP'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    )}>
                      {lead.type === 'MEMBER_SIGNUP' ? 'Signup' : 'Referral'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {lead.ambassador.firstName} {lead.ambassador.lastName}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {lead.assignedAgent
                      ? `${lead.assignedAgent.firstName} ${lead.assignedAgent.lastName}`
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      STATUS_META[lead.status]?.color ?? 'bg-gray-100 text-gray-600'
                    )}>
                      {STATUS_META[lead.status]?.label ?? lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {lead.callOutcome ? (
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        OUTCOME_META[lead.callOutcome]?.color
                      )}>
                        {OUTCOME_META[lead.callOutcome]?.label}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(lead.createdAt).toLocaleDateString('en-ZA', {
                      day: '2-digit', month: 'short', year: '2-digit'
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              Page {page} of {pagination.totalPages} ({pagination.total} leads)
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="rounded border border-gray-200 px-3 py-1 text-xs disabled:opacity-40 hover:bg-gray-50"
              >Previous</button>
              <button
                disabled={page === pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="rounded border border-gray-200 px-3 py-1 text-xs disabled:opacity-40 hover:bg-gray-50"
              >Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

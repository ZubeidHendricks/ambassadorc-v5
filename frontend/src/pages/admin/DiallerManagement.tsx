import { useEffect, useState, useCallback } from 'react'
import {
  PhoneCall, Users, Filter, RefreshCw, CheckCircle2,
  XCircle, Clock, TrendingUp, ChevronDown, UserCheck, Layers
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getAdminLeads, getDialAgents, assignLead, bulkAssignLeads, setAgentQuota,
  type AdminLead, type DialAgent, type CallOutcome
} from '@/lib/api'

const QUOTA_OPTIONS = [5, 10, 15, 20]

const OUTCOME_META: Record<CallOutcome, { label: string; color: string }> = {
  SALE_MADE:           { label: 'Sale Made',        color: 'text-emerald-600 bg-emerald-50' },
  COULD_NOT_REACH:     { label: 'No Answer',        color: 'text-amber-600 bg-amber-50' },
  NOT_INTERESTED:      { label: 'Not Interested',   color: 'text-red-600 bg-red-50' },
  CALLBACK_SCHEDULED:  { label: 'Callback',         color: 'text-blue-600 bg-blue-50' },
}

type Tab = 'unassigned' | 'assigned'

export default function DiallerManagement() {
  const [tab, setTab] = useState<Tab>('unassigned')
  const [leads, setLeads] = useState<AdminLead[]>([])
  const [agents, setAgents] = useState<DialAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkAgentId, setBulkAgentId] = useState('')
  const [assigning, setAssigning] = useState<number | null>(null)
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })

  const load = useCallback(async () => {
    setLoading(true)
    setSelectedIds(new Set())
    try {
      const [leadsData, agentsData] = await Promise.all([
        getAdminLeads({
          page: pagination.page,
          limit: 50,
          assigned: tab === 'unassigned' ? 'unassigned' : 'assigned',
          type: typeFilter || undefined,
        }),
        getDialAgents(),
      ])
      setLeads(leadsData.leads)
      setPagination(p => ({ ...p, total: leadsData.pagination.total, totalPages: leadsData.pagination.totalPages }))
      setAgents(agentsData)
    } catch {
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [tab, typeFilter, pagination.page])

  useEffect(() => {
    setPagination(p => ({ ...p, page: 1 }))
  }, [tab, typeFilter])

  useEffect(() => { load() }, [load])

  const filteredLeads = agentFilter
    ? leads.filter(l => String(l.assignedAgent?.id) === agentFilter)
    : leads

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredLeads.map(l => l.id)))
    }
  }

  async function handleAssign(leadId: number, agentId: number) {
    setAssigning(leadId)
    try {
      await assignLead(leadId, agentId)
      await load()
    } catch { /* ignore */ } finally {
      setAssigning(null)
    }
  }

  async function handleBulkAssign() {
    if (!bulkAgentId || selectedIds.size === 0) return
    setBulkAssigning(true)
    try {
      await bulkAssignLeads(Array.from(selectedIds), Number(bulkAgentId))
      setBulkAgentId('')
      await load()
    } catch { /* ignore */ } finally {
      setBulkAssigning(false)
    }
  }

  async function handleQuotaChange(agentId: number, quota: number) {
    // optimistic
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, dailyLeadQuota: quota, remainingToday: Math.max(0, quota - a.assignedToday) } : a))
    try {
      await setAgentQuota(agentId, quota)
    } catch {
      await load()
    }
  }

  const salesCount = leads.filter(l => l.callOutcome === 'SALE_MADE').length
  const noAnswerCount = leads.filter(l => l.callOutcome === 'COULD_NOT_REACH').length
  const pendingCount = leads.filter(l => tab === 'assigned' && !l.callOutcome).length

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <PhoneCall className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Lead Dialler Management</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Assign incoming referral leads and member signups to agents for calling.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Leads', value: pagination.total, icon: Layers, color: 'text-gray-700 bg-gray-100' },
          { label: 'Agents Active', value: agents.length, icon: Users, color: 'text-blue-700 bg-blue-50' },
          { label: 'Sales Made', value: salesCount, icon: TrendingUp, color: 'text-emerald-700 bg-emerald-50' },
          { label: 'Pending Calls', value: pendingCount, icon: Clock, color: 'text-amber-700 bg-amber-50' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className={cn('mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg', stat.color)}>
              <stat.icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Daily lead quotas (5/10/15/20 per agent) */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-gray-900">Daily Lead Quotas</h2>
          <span className="text-xs text-gray-400">Leads/day each agent may dial · resets at midnight (SAST)</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {agents.length === 0 && <p className="text-sm text-gray-400">No active agents.</p>}
          {agents.map(a => {
            const pct = a.dailyLeadQuota > 0 ? Math.min(100, Math.round((a.assignedToday / a.dailyLeadQuota) * 100)) : 0
            return (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{a.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                      <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-red-500' : 'bg-primary')} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="shrink-0 text-[11px] text-gray-500">{a.assignedToday}/{a.dailyLeadQuota} today</span>
                  </div>
                </div>
                <select
                  value={a.dailyLeadQuota}
                  onChange={e => handleQuotaChange(a.id, Number(e.target.value))}
                  className="h-8 shrink-0 rounded-lg border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 focus:border-primary focus:outline-none"
                  title="Leads per day"
                >
                  {[...new Set([...QUOTA_OPTIONS, a.dailyLeadQuota])].sort((x, y) => x - y).map(q => (
                    <option key={q} value={q}>{q}/day</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
        {(['unassigned', 'assigned'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-medium transition-all',
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t === 'unassigned' ? 'Unassigned Leads' : 'Assigned / Dialled'}
          </button>
        ))}
      </div>

      {/* Filters + bulk actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 shadow-sm">
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="border-none bg-transparent text-xs text-gray-700 focus:outline-none"
          >
            <option value="">All types</option>
            <option value="REFERRAL_LEAD">Referral Leads</option>
            <option value="MEMBER_SIGNUP">Member Signups</option>
          </select>
        </div>

        {tab === 'assigned' && (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 shadow-sm">
            <UserCheck className="h-3.5 w-3.5 text-gray-400" />
            <select
              value={agentFilter}
              onChange={e => setAgentFilter(e.target.value)}
              className="border-none bg-transparent text-xs text-gray-700 focus:outline-none"
            >
              <option value="">All agents</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.assignedCount})</option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 shadow-sm hover:bg-gray-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>

        {/* Bulk assign (unassigned tab only) */}
        {tab === 'unassigned' && selectedIds.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-600">{selectedIds.size} selected</span>
            <select
              value={bulkAgentId}
              onChange={e => setBulkAgentId(e.target.value)}
              className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:border-primary focus:outline-none"
            >
              <option value="">— assign to agent —</option>
              {agents.map(a => (
                <option key={a.id} value={a.id} disabled={a.remainingToday === 0}>
                  {a.name} ({a.assignedToday}/{a.dailyLeadQuota}){a.remainingToday === 0 ? ' — full' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkAssign}
              disabled={!bulkAgentId || bulkAssigning}
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {bulkAssigning ? 'Assigning…' : 'Assign All'}
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {tab === 'unassigned' && (
                <th className="w-8 py-3 pl-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary"
                  />
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Lead</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Submitted by</th>
              {tab === 'assigned' && (
                <>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Agent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Outcome</th>
                </>
              )}
              {tab === 'unassigned' && (
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Assign to Agent</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="py-12 text-center text-sm text-gray-400">Loading leads…</td></tr>
            ) : filteredLeads.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-sm text-gray-400">No leads found.</td></tr>
            ) : (
              filteredLeads.map(lead => (
                <tr key={lead.id} className={cn('hover:bg-gray-50/60 transition-colors', selectedIds.has(lead.id) && 'bg-primary/5')}>
                  {tab === 'unassigned' && (
                    <td className="pl-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{lead.firstName} {lead.lastName}</p>
                    {lead.employerName && <p className="text-xs text-gray-400">{lead.employerName}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs">{lead.contactNo}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      lead.type === 'MEMBER_SIGNUP' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    )}>
                      {lead.type === 'MEMBER_SIGNUP' ? 'Signup' : 'Referral'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {lead.ambassador.firstName} {lead.ambassador.lastName}
                  </td>
                  {tab === 'assigned' && (
                    <>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        {lead.assignedAgent ? `${lead.assignedAgent.firstName} ${lead.assignedAgent.lastName}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {lead.callOutcome ? (
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', OUTCOME_META[lead.callOutcome].color)}>
                            {OUTCOME_META[lead.callOutcome].label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Pending call</span>
                        )}
                        {lead.callNotes && <p className="mt-0.5 text-[10px] text-gray-400 max-w-[150px] truncate">{lead.callNotes}</p>}
                      </td>
                    </>
                  )}
                  {tab === 'unassigned' && (
                    <td className="px-4 py-3">
                      <AgentDropdown
                        agents={agents}
                        loading={assigning === lead.id}
                        onAssign={agentId => handleAssign(lead.id, agentId)}
                      />
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </p>
            <div className="flex gap-2">
              <button
                disabled={pagination.page === 1}
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                className="rounded border border-gray-200 px-3 py-1 text-xs disabled:opacity-40 hover:bg-gray-50"
              >Previous</button>
              <button
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                className="rounded border border-gray-200 px-3 py-1 text-xs disabled:opacity-40 hover:bg-gray-50"
              >Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AgentDropdown({ agents, loading, onAssign }: {
  agents: DialAgent[]
  loading: boolean
  onAssign: (id: number) => void
}) {
  return (
    <div className="relative flex items-center gap-2">
      <select
        defaultValue=""
        onChange={e => { if (e.target.value) { onAssign(Number(e.target.value)); e.target.value = '' } }}
        disabled={loading}
        className="h-7 w-full max-w-[160px] rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:border-primary focus:outline-none disabled:opacity-50"
      >
        <option value="" disabled>— select agent —</option>
        {agents.map(a => (
          <option key={a.id} value={a.id} disabled={a.remainingToday === 0}>
            {a.name} ({a.assignedToday}/{a.dailyLeadQuota}){a.remainingToday === 0 ? ' — full' : ''}
          </option>
        ))}
      </select>
      {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-gray-400" />}
    </div>
  )
}

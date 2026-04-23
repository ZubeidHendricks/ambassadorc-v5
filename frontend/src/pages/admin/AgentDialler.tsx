import { useEffect, useState, useCallback } from 'react'
import {
  Phone, CheckCircle2, XCircle, Clock, AlertCircle,
  ChevronDown, ChevronUp, RefreshCw, TrendingUp, Target
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getAgentDialList, recordCallOutcome,
  type AgentDialLead, type CallOutcome
} from '@/lib/api'

const OUTCOMES: { value: CallOutcome; label: string; icon: typeof CheckCircle2; color: string; bg: string }[] = [
  { value: 'SALE_MADE',          label: 'Sale Made',       icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-600 hover:bg-emerald-700' },
  { value: 'COULD_NOT_REACH',    label: 'No Answer',       icon: Phone,        color: 'text-amber-700',   bg: 'bg-amber-500  hover:bg-amber-600' },
  { value: 'NOT_INTERESTED',     label: 'Not Interested',  icon: XCircle,      color: 'text-red-700',     bg: 'bg-red-500    hover:bg-red-600' },
  { value: 'CALLBACK_SCHEDULED', label: 'Callback',        icon: Clock,        color: 'text-blue-700',    bg: 'bg-blue-500   hover:bg-blue-600' },
]

const OUTCOME_DISPLAY: Record<CallOutcome, { label: string; color: string }> = {
  SALE_MADE:           { label: 'Sale Made',       color: 'text-emerald-700 bg-emerald-100' },
  COULD_NOT_REACH:     { label: 'No Answer',       color: 'text-amber-700 bg-amber-100' },
  NOT_INTERESTED:      { label: 'Not Interested',  color: 'text-red-700 bg-red-100' },
  CALLBACK_SCHEDULED:  { label: 'Callback',        color: 'text-blue-700 bg-blue-100' },
}

export default function AgentDialler() {
  const [leads, setLeads] = useState<AgentDialLead[]>([])
  const [summary, setSummary] = useState({ total: 0, pending: 0, completed: 0, sales: 0 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [saving, setSaving] = useState<number | null>(null)
  const [notes, setNotes] = useState<Record<number, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAgentDialList(filter === 'all' ? undefined : filter)
      setLeads(data.leads)
      setSummary(data.summary)
    } catch {
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  async function handleOutcome(leadId: number, outcome: CallOutcome) {
    setSaving(leadId)
    try {
      await recordCallOutcome(leadId, outcome, notes[leadId])
      setExpandedId(null)
      await load()
    } catch { /* ignore */ } finally {
      setSaving(null)
    }
  }

  const filteredLeads = leads

  const progressPct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Phone className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">My Dial List</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Call each lead and record the outcome. Leads assigned to you by your manager.
          </p>
        </div>
        <button onClick={load} className="ml-auto rounded-lg border border-gray-200 p-2 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Progress + stats */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">Overall Progress</p>
          <p className="text-sm font-bold text-gray-900">{progressPct}%</p>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-4 gap-3 text-center">
          {[
            { label: 'Total',     value: summary.total,     color: 'text-gray-900' },
            { label: 'Pending',   value: summary.pending,   color: 'text-amber-600' },
            { label: 'Completed', value: summary.completed, color: 'text-blue-600' },
            { label: 'Sales',     value: summary.sales,     color: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label}>
              <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
              <p className="text-[10px] text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
        {(['all', 'pending', 'completed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition-all',
              filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Lead cards */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading your dial list…</div>
        ) : filteredLeads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
            <Target className="mx-auto mb-3 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">
              {filter === 'pending' ? 'All calls complete!' : 'No leads assigned to you yet.'}
            </p>
          </div>
        ) : (
          filteredLeads.map(lead => {
            const isExpanded = expandedId === lead.id
            const isSaving = saving === lead.id
            const isDone = !!lead.callOutcome

            return (
              <div
                key={lead.id}
                className={cn(
                  'overflow-hidden rounded-xl border bg-white shadow-sm transition-all',
                  isDone ? 'border-gray-200 opacity-80' : 'border-gray-200 hover:border-primary/30'
                )}
              >
                {/* Card header */}
                <div
                  className="flex cursor-pointer items-center gap-3 px-4 py-3.5"
                  onClick={() => !isDone && setExpandedId(isExpanded ? null : lead.id)}
                >
                  {/* Status indicator */}
                  <div className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    isDone ? 'bg-gray-100' : 'bg-primary/10'
                  )}>
                    {isDone
                      ? <CheckCircle2 className="h-4 w-4 text-gray-400" />
                      : <Phone className="h-4 w-4 text-primary" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{lead.firstName} {lead.lastName}</p>
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        lead.type === 'MEMBER_SIGNUP' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      )}>
                        {lead.type === 'MEMBER_SIGNUP' ? 'Signup' : 'Referral'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {lead.contactNo}
                      {lead.employerName && ` · ${lead.employerName}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {isDone && lead.callOutcome && (
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', OUTCOME_DISPLAY[lead.callOutcome].color)}>
                        {OUTCOME_DISPLAY[lead.callOutcome].label}
                      </span>
                    )}
                    {!isDone && (
                      isExpanded
                        ? <ChevronUp className="h-4 w-4 text-gray-400" />
                        : <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Outcome panel */}
                {isExpanded && !isDone && (
                  <div className="border-t border-gray-100 bg-gray-50/60 px-4 pb-4 pt-3">
                    {/* Tel link */}
                    <a
                      href={`tel:${lead.contactNo}`}
                      className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
                    >
                      <Phone className="h-4 w-4" />
                      Call {lead.contactNo}
                    </a>

                    {lead.notes && (
                      <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                        <span className="font-semibold">Notes: </span>{lead.notes}
                      </div>
                    )}

                    {/* Call notes */}
                    <textarea
                      value={notes[lead.id] ?? ''}
                      onChange={e => setNotes(p => ({ ...p, [lead.id]: e.target.value }))}
                      placeholder="Add call notes (optional)…"
                      rows={2}
                      className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />

                    {/* Outcome buttons */}
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Record outcome</p>
                    <div className="grid grid-cols-2 gap-2">
                      {OUTCOMES.map(o => (
                        <button
                          key={o.value}
                          onClick={() => handleOutcome(lead.id, o.value)}
                          disabled={isSaving}
                          className={cn(
                            'flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold text-white transition disabled:opacity-50',
                            o.bg
                          )}
                        >
                          {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <o.icon className="h-3.5 w-3.5" />}
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed detail */}
                {isDone && lead.callNotes && (
                  <div className="border-t border-gray-100 px-4 pb-3 pt-2">
                    <p className="text-[10px] text-gray-400">
                      <span className="font-medium">Notes: </span>{lead.callNotes}
                    </p>
                    {lead.dialledAt && (
                      <p className="mt-0.5 text-[10px] text-gray-400">
                        Called {new Date(lead.dialledAt).toLocaleString('en-ZA')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

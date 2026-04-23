import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, PhoneCall, User, Clock, TrendingUp, XCircle, PhoneMissed, CalendarClock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAdminLeads, type AdminLead, type CallOutcome } from '@/lib/api'

// ─── Pipeline stage definitions ─────────────────────────────────────────────

interface Stage {
  id: string
  label: string
  sublabel: string
  color: string
  headerBg: string
  cardBorder: string
  cardBg: string
  dotColor: string
  icon: typeof PhoneCall
  filter: (l: AdminLead) => boolean
}

const STAGES: Stage[] = [
  {
    id: 'new',
    label: 'Submitted',
    sublabel: 'Awaiting assignment',
    color: 'text-orange-700',
    headerBg: 'bg-orange-50 border-orange-200',
    cardBorder: 'border-orange-200',
    cardBg: 'bg-white hover:bg-orange-50/40',
    dotColor: 'bg-orange-400',
    icon: User,
    filter: (l) => l.status === 'NEW' && !l.assignedAgentId,
  },
  {
    id: 'assigned',
    label: 'Assigned',
    sublabel: 'Pending call',
    color: 'text-yellow-700',
    headerBg: 'bg-yellow-50 border-yellow-200',
    cardBorder: 'border-yellow-200',
    cardBg: 'bg-white hover:bg-yellow-50/40',
    dotColor: 'bg-yellow-400',
    icon: PhoneCall,
    filter: (l) => !!l.assignedAgentId && !l.callOutcome,
  },
  {
    id: 'no-answer',
    label: 'No Answer',
    sublabel: 'Could not reach',
    color: 'text-amber-700',
    headerBg: 'bg-amber-50 border-amber-200',
    cardBorder: 'border-amber-200',
    cardBg: 'bg-white hover:bg-amber-50/40',
    dotColor: 'bg-amber-400',
    icon: PhoneMissed,
    filter: (l) => l.callOutcome === 'COULD_NOT_REACH',
  },
  {
    id: 'callback',
    label: 'Callback',
    sublabel: 'Re-dial scheduled',
    color: 'text-blue-700',
    headerBg: 'bg-blue-50 border-blue-200',
    cardBorder: 'border-blue-200',
    cardBg: 'bg-white hover:bg-blue-50/40',
    dotColor: 'bg-blue-400',
    icon: CalendarClock,
    filter: (l) => l.callOutcome === 'CALLBACK_SCHEDULED',
  },
  {
    id: 'not-interested',
    label: 'Not Interested',
    sublabel: 'Closed',
    color: 'text-red-700',
    headerBg: 'bg-red-50 border-red-200',
    cardBorder: 'border-red-200',
    cardBg: 'bg-white hover:bg-red-50/40',
    dotColor: 'bg-red-400',
    icon: XCircle,
    filter: (l) => l.callOutcome === 'NOT_INTERESTED',
  },
  {
    id: 'sale',
    label: 'Sale Made',
    sublabel: 'Paid / converted',
    color: 'text-emerald-700',
    headerBg: 'bg-emerald-50 border-emerald-200',
    cardBorder: 'border-emerald-200',
    cardBg: 'bg-white hover:bg-emerald-50/40',
    dotColor: 'bg-emerald-500',
    icon: CheckCircle2,
    filter: (l) => l.callOutcome === 'SALE_MADE' || l.status === 'PAID',
  },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function LeadPipeline() {
  const [leads, setLeads] = useState<AdminLead[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'' | 'REFERRAL_LEAD' | 'MEMBER_SIGNUP'>('')
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAdminLeads({ limit: 200, type: typeFilter || undefined })
      setLeads(data.leads)
      setLastRefresh(new Date())
    } catch {
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [typeFilter])

  useEffect(() => { load() }, [load])

  const total = leads.length
  const sales = leads.filter(l => l.callOutcome === 'SALE_MADE' || l.status === 'PAID').length
  const convRate = total > 0 ? Math.round((sales / total) * 100) : 0

  return (
    <div className="flex h-full min-h-screen flex-col bg-gray-50">

      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <PhoneCall className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900">Lead Pipeline</h1>
            <p className="text-sm text-gray-500">
              Live view of every lead moving through the dialler flow.
            </p>
          </div>

          {/* Stats strip */}
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <p className="text-xl font-bold text-gray-900">{total}</p>
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Total</p>
            </div>
            <div className="h-8 w-px bg-gray-200" />
            <div className="text-center">
              <p className="text-xl font-bold text-emerald-600">{sales}</p>
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Sales</p>
            </div>
            <div className="h-8 w-px bg-gray-200" />
            <div className="text-center">
              <p className="text-xl font-bold text-primary">{convRate}%</p>
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Conv. rate</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-primary focus:outline-none"
            >
              <option value="">All lead types</option>
              <option value="REFERRAL_LEAD">Referrals only</option>
              <option value="MEMBER_SIGNUP">Signups only</option>
            </select>
            <button
              onClick={load}
              disabled={loading}
              className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* Flow step tracker (visual pipeline labels) */}
        <div className="mt-5 flex items-center gap-0">
          {STAGES.map((stage, i) => (
            <div key={stage.id} className="flex flex-1 items-center">
              <div className={cn(
                'flex flex-1 flex-col items-center rounded-lg border px-2 py-2 text-center',
                stage.headerBg
              )}>
                <stage.icon className={cn('mb-1 h-4 w-4', stage.color)} />
                <p className={cn('text-xs font-semibold', stage.color)}>{stage.label}</p>
                <p className="text-[10px] text-gray-400">{stage.sublabel}</p>
                <p className={cn('mt-1 text-lg font-bold', stage.color)}>
                  {leads.filter(stage.filter).length}
                </p>
              </div>
              {i < STAGES.length - 1 && (
                <div className="flex-none px-1">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 8h8M8 4l4 4-4 4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex flex-1 gap-3 overflow-x-auto p-5">
        {STAGES.map(stage => {
          const stageLeads = leads.filter(stage.filter)
          return (
            <div
              key={stage.id}
              className="flex w-64 shrink-0 flex-col rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              {/* Column header */}
              <div className={cn('flex items-center justify-between rounded-t-xl border-b px-3 py-3', stage.headerBg)}>
                <div className="flex items-center gap-2">
                  <div className={cn('h-2.5 w-2.5 rounded-full', stage.dotColor)} />
                  <p className={cn('text-sm font-semibold', stage.color)}>{stage.label}</p>
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', stage.color, 'bg-white/70')}>
                  {stageLeads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                {loading ? (
                  <div className="flex h-32 items-center justify-center">
                    <RefreshCw className="h-5 w-5 animate-spin text-gray-300" />
                  </div>
                ) : stageLeads.length === 0 ? (
                  <div className="flex h-24 items-center justify-center">
                    <p className="text-xs text-gray-300">No leads here</p>
                  </div>
                ) : (
                  stageLeads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} stage={stage} />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="px-6 pb-3 text-right text-[10px] text-gray-400">
        Last refreshed {lastRefresh.toLocaleTimeString('en-ZA')}
      </p>
    </div>
  )
}

// ─── Lead card ───────────────────────────────────────────────────────────────

function LeadCard({ lead, stage }: { lead: AdminLead; stage: Stage }) {
  const isSignup = lead.type === 'MEMBER_SIGNUP'

  return (
    <div className={cn(
      'rounded-lg border p-3 text-sm transition-colors cursor-default',
      stage.cardBorder, stage.cardBg
    )}>
      {/* Type badge + name */}
      <div className="mb-1.5 flex items-start justify-between gap-1">
        <p className="font-semibold text-gray-900 leading-tight">
          {lead.firstName} {lead.lastName}
        </p>
        <span className={cn(
          'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
          isSignup ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
        )}>
          {isSignup ? 'Signup' : 'Ref'}
        </span>
      </div>

      {/* Contact number */}
      <p className="mb-2 font-mono text-[11px] text-gray-500">{lead.contactNo}</p>

      {/* Ambassador + Agent */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <User className="h-3 w-3 shrink-0 text-gray-300" />
          <span className="truncate">
            Via {lead.ambassador.firstName} {lead.ambassador.lastName}
          </span>
        </div>
        {lead.assignedAgent && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <PhoneCall className="h-3 w-3 shrink-0 text-gray-300" />
            <span className="truncate">
              Agent: {lead.assignedAgent.firstName} {lead.assignedAgent.lastName}
            </span>
          </div>
        )}
        {lead.dialledAt && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{new Date(lead.dialledAt).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })}</span>
          </div>
        )}
      </div>

      {/* Call notes */}
      {lead.callNotes && (
        <p className="mt-2 rounded bg-gray-50 px-2 py-1 text-[10px] italic text-gray-500 line-clamp-2">
          "{lead.callNotes}"
        </p>
      )}
    </div>
  )
}

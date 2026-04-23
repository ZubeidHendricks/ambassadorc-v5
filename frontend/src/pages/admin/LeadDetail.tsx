import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, User, PhoneCall, CheckCircle2,
  Clock, XCircle, PhoneMissed, CalendarClock,
  Banknote, MessageSquare, AlertCircle, RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAdminLead, type AdminLead, type CallOutcome } from '@/lib/api'

// ─── Journey step definitions ────────────────────────────────────────────────

type StepStatus = 'done' | 'active' | 'pending' | 'skipped'

interface JourneyStep {
  id: string
  label: string
  description: (lead: AdminLead) => string
  status: (lead: AdminLead) => StepStatus
  timestamp: (lead: AdminLead) => string | null
  icon: typeof CheckCircle2
  color: string
}

const OUTCOME_LABEL: Record<CallOutcome, string> = {
  SALE_MADE:          'Sale Made',
  COULD_NOT_REACH:    'Could Not Reach',
  NOT_INTERESTED:     'Not Interested',
  CALLBACK_SCHEDULED: 'Callback Scheduled',
}

const OUTCOME_COLOR: Record<CallOutcome, string> = {
  SALE_MADE:          'text-emerald-700 bg-emerald-50 border-emerald-200',
  COULD_NOT_REACH:    'text-amber-700 bg-amber-50 border-amber-200',
  NOT_INTERESTED:     'text-red-700 bg-red-50 border-red-200',
  CALLBACK_SCHEDULED: 'text-blue-700 bg-blue-50 border-blue-200',
}

const STEPS: JourneyStep[] = [
  {
    id: 'submitted',
    label: 'Lead Submitted',
    description: (l) => `${l.type === 'MEMBER_SIGNUP' ? 'Member signup' : 'Referral lead'} submitted by ambassador ${l.ambassador.firstName} ${l.ambassador.lastName}.`,
    status: () => 'done',
    timestamp: (l) => l.createdAt,
    icon: User,
    color: 'text-orange-600 bg-orange-50 border-orange-200',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp Confirmation Sent',
    description: () => 'Automated WhatsApp "Referrals Received" message fired to ambassador.',
    status: () => 'done',
    timestamp: (l) => l.createdAt,
    icon: MessageSquare,
    color: 'text-green-600 bg-green-50 border-green-200',
  },
  {
    id: 'assigned',
    label: 'Assigned to Agent',
    description: (l) =>
      l.assignedAgent
        ? `Lead assigned to ${l.assignedAgent.firstName} ${l.assignedAgent.lastName} for dialling.`
        : 'Waiting for CC Manager to assign this lead to an agent.',
    status: (l) => (l.assignedAgent ? 'done' : 'active'),
    timestamp: (l) => l.assignedAt,
    icon: PhoneCall,
    color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  },
  {
    id: 'dialled',
    label: 'Agent Called Lead',
    description: (l) =>
      l.dialledAt
        ? `Agent dialled ${l.contactNo} and recorded a call outcome.`
        : l.assignedAgent
        ? `Lead is in ${l.assignedAgent.firstName}'s dial list, awaiting a call.`
        : 'Not yet assigned.',
    status: (l) => {
      if (l.dialledAt) return 'done'
      if (l.assignedAgent) return 'active'
      return 'pending'
    },
    timestamp: (l) => l.dialledAt,
    icon: PhoneCall,
    color: 'text-violet-600 bg-violet-50 border-violet-200',
  },
  {
    id: 'outcome',
    label: 'Call Outcome Recorded',
    description: (l) =>
      l.callOutcome
        ? `Outcome: ${OUTCOME_LABEL[l.callOutcome]}.${l.callNotes ? ` Notes: "${l.callNotes}"` : ''}`
        : 'Awaiting call outcome from agent.',
    status: (l) => {
      if (l.callOutcome) return 'done'
      if (l.dialledAt) return 'active'
      return 'pending'
    },
    timestamp: (l) => l.dialledAt,
    icon: CheckCircle2,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  {
    id: 'payment',
    label: 'Payment Cycle',
    description: (l) =>
      l.status === 'PAID' || l.callOutcome === 'SALE_MADE'
        ? `Sale confirmed. Lead feeds into the Ambassador Backend → FNB payment cycle. Ambassador earns commission.`
        : l.callOutcome === 'NOT_INTERESTED'
        ? 'Lead closed — not interested. No payment.'
        : l.callOutcome
        ? 'Call completed. Payment cycle only applies to successful sales.'
        : 'Payment cycle triggers on a confirmed sale.',
    status: (l) => {
      if (l.status === 'PAID') return 'done'
      if (l.callOutcome === 'SALE_MADE') return 'active'
      if (l.callOutcome === 'NOT_INTERESTED') return 'skipped'
      return 'pending'
    },
    timestamp: (l) => l.datePaid,
    icon: Banknote,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  },
]

// ─── Step status display ─────────────────────────────────────────────────────

const STEP_RING: Record<StepStatus, string> = {
  done:    'bg-emerald-500 border-emerald-500 text-white',
  active:  'bg-white border-primary text-primary ring-4 ring-primary/20',
  pending: 'bg-white border-gray-200 text-gray-300',
  skipped: 'bg-gray-100 border-gray-200 text-gray-400',
}

function fmt(ts: string | null) {
  if (!ts) return null
  return new Date(ts).toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [lead, setLead] = useState<AdminLead | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    getAdminLead(Number(id))
      .then(setLead)
      .catch(() => setError('Could not load lead.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    )
  }

  if (error || !lead) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-gray-300" />
        <p className="text-sm text-gray-500">{error ?? 'Lead not found.'}</p>
        <button onClick={() => navigate(-1)} className="text-sm text-primary underline">
          Go back
        </button>
      </div>
    )
  }

  const currentStep = STEPS.findIndex(s => s.status(lead) === 'active')
  const progress = currentStep === -1
    ? STEPS.every(s => s.status(lead) === 'done' || s.status(lead) === 'skipped') ? 100 : 0
    : Math.round(((currentStep) / (STEPS.length - 1)) * 100)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">

      {/* Back link */}
      <button
        onClick={() => navigate('/admin/leads')}
        className="mb-6 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to all leads
      </button>

      {/* Lead info card */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start gap-4 border-b border-gray-100 px-6 py-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">
              {lead.firstName} {lead.lastName}
            </h1>
            <p className="text-sm text-gray-500">{lead.contactNo}</p>
          </div>

          {/* Status + outcome badges */}
          <div className="flex flex-wrap gap-2">
            <span className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold',
              lead.type === 'MEMBER_SIGNUP' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            )}>
              {lead.type === 'MEMBER_SIGNUP' ? 'Member Signup' : 'Referral Lead'}
            </span>
            {lead.callOutcome && (
              <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold', OUTCOME_COLOR[lead.callOutcome])}>
                {OUTCOME_LABEL[lead.callOutcome]}
              </span>
            )}
          </div>
        </div>

        {/* Detail grid */}
        <div className="grid grid-cols-2 gap-0 sm:grid-cols-3">
          {[
            { label: 'Employer', value: lead.employerName || '—' },
            { label: 'ID Number', value: lead.idNumber || '—' },
            { label: 'Preferred Contact', value: lead.preferredContact || '—' },
            { label: 'Submitted by', value: `${lead.ambassador.firstName} ${lead.ambassador.lastName}` },
            { label: 'Assigned Agent', value: lead.assignedAgent ? `${lead.assignedAgent.firstName} ${lead.assignedAgent.lastName}` : 'Not assigned' },
            { label: 'Submitted on', value: fmt(lead.createdAt) ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="border-b border-r border-gray-100 px-4 py-3 last:border-r-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
              <p className="mt-0.5 text-sm text-gray-800">{value}</p>
            </div>
          ))}
        </div>

        {lead.notes && (
          <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Notes</p>
            <p className="mt-0.5 text-sm text-gray-700">{lead.notes}</p>
          </div>
        )}
      </div>

      {/* Journey heading + progress */}
      <div className="mb-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Lead Journey</h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 overflow-hidden rounded-full bg-gray-100 h-2">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm font-bold text-gray-700">{progress}%</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-5 h-[calc(100%-2.5rem)] w-0.5 bg-gray-100" />

        <div className="space-y-0">
          {STEPS.map((step, i) => {
            const status = step.status(lead)
            const ts = fmt(step.timestamp(lead))
            const isLast = i === STEPS.length - 1

            return (
              <div key={step.id} className="relative flex gap-4">
                {/* Circle */}
                <div className={cn(
                  'relative z-10 mt-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2',
                  STEP_RING[status]
                )}>
                  {status === 'done'
                    ? <CheckCircle2 className="h-5 w-5" />
                    : status === 'skipped'
                    ? <XCircle className="h-4 w-4" />
                    : <step.icon className="h-4 w-4" />
                  }
                </div>

                {/* Content */}
                <div className={cn('flex-1 pb-6', isLast && 'pb-0')}>
                  <div className={cn(
                    'rounded-xl border p-4',
                    status === 'done' ? step.color
                    : status === 'active' ? 'border-primary/30 bg-primary/5'
                    : status === 'skipped' ? 'border-gray-100 bg-gray-50'
                    : 'border-gray-100 bg-white'
                  )}>
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        'font-semibold text-sm',
                        status === 'pending' ? 'text-gray-400'
                        : status === 'skipped' ? 'text-gray-400 line-through'
                        : status === 'active' ? 'text-primary'
                        : 'text-gray-900'
                      )}>
                        {step.label}
                      </p>
                      {status === 'done' && (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Complete
                        </span>
                      )}
                      {status === 'active' && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          In progress
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      'mt-1 text-xs leading-relaxed',
                      status === 'pending' || status === 'skipped' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      {step.description(lead)}
                    </p>
                    {ts && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400">
                        <Clock className="h-3 w-3" />
                        {ts}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import {
  Bot,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Zap,
  ShieldCheck,
  MessageSquare,
  Calculator,
  CreditCard,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  getAiAgentStatuses,
  triggerAiAgent,
  getAiAgentHistory,
  toggleAiAgentAuto,
  type AiAgentStatus,
  type AiAgentRun,
} from '@/lib/api'
import { cn } from '@/lib/utils'

const agentMeta: Record<string, { label: string; description: string; icon: typeof Bot }> = {
  lead_scorer: {
    label: 'Lead Scorer',
    description: 'Scores and prioritizes incoming leads based on conversion likelihood.',
    icon: Zap,
  },
  auto_qa: {
    label: 'Auto QA',
    description: 'Automatically verifies sale data against quality criteria.',
    icon: ShieldCheck,
  },
  sms_dispatcher: {
    label: 'SMS Dispatcher',
    description: 'Sends scheduled SMS notifications and reminders.',
    icon: MessageSquare,
  },
  commission_calculator: {
    label: 'Commission Calculator',
    description: 'Calculates agent commissions based on tier and sales rules.',
    icon: Calculator,
  },
  payment_reconciler: {
    label: 'Payment Reconciler',
    description: 'Matches incoming payments with policy premiums.',
    icon: CreditCard,
  },
  welcome_pack_sender: {
    label: 'Welcome Pack Sender',
    description: 'Generates and sends welcome packs to new policyholders.',
    icon: FileText,
  },
}

const demoStatuses: AiAgentStatus[] = [
  { agentKey: 'lead_scorer', lastRun: '2025-04-11T08:30:00', itemsProcessed: 24, successCount: 22, errorCount: 2, status: 'idle', autoRun: true },
  { agentKey: 'auto_qa', lastRun: '2025-04-11T07:00:00', itemsProcessed: 15, successCount: 15, errorCount: 0, status: 'idle', autoRun: true },
  { agentKey: 'sms_dispatcher', lastRun: '2025-04-11T09:00:00', itemsProcessed: 156, successCount: 148, errorCount: 8, status: 'idle', autoRun: true },
  { agentKey: 'commission_calculator', lastRun: '2025-04-10T23:00:00', itemsProcessed: 42, successCount: 42, errorCount: 0, status: 'idle', autoRun: false },
  { agentKey: 'payment_reconciler', lastRun: '2025-04-11T06:00:00', itemsProcessed: 89, successCount: 85, errorCount: 4, status: 'idle', autoRun: true },
  { agentKey: 'welcome_pack_sender', lastRun: '2025-04-10T18:00:00', itemsProcessed: 8, successCount: 8, errorCount: 0, status: 'idle', autoRun: false },
]

const demoHistory: Record<string, AiAgentRun[]> = {
  lead_scorer: [
    { id: 1, agentKey: 'lead_scorer', startedAt: '2025-04-11T08:30:00', completedAt: '2025-04-11T08:31:15', itemsProcessed: 24, successCount: 22, errorCount: 2, status: 'completed' },
    { id: 2, agentKey: 'lead_scorer', startedAt: '2025-04-10T08:30:00', completedAt: '2025-04-10T08:31:02', itemsProcessed: 18, successCount: 18, errorCount: 0, status: 'completed' },
  ],
  auto_qa: [
    { id: 3, agentKey: 'auto_qa', startedAt: '2025-04-11T07:00:00', completedAt: '2025-04-11T07:02:30', itemsProcessed: 15, successCount: 15, errorCount: 0, status: 'completed' },
  ],
  sms_dispatcher: [
    { id: 4, agentKey: 'sms_dispatcher', startedAt: '2025-04-11T09:00:00', completedAt: '2025-04-11T09:05:45', itemsProcessed: 156, successCount: 148, errorCount: 8, status: 'completed' },
  ],
  commission_calculator: [
    { id: 5, agentKey: 'commission_calculator', startedAt: '2025-04-10T23:00:00', completedAt: '2025-04-10T23:01:20', itemsProcessed: 42, successCount: 42, errorCount: 0, status: 'completed' },
  ],
  payment_reconciler: [
    { id: 6, agentKey: 'payment_reconciler', startedAt: '2025-04-11T06:00:00', completedAt: '2025-04-11T06:04:12', itemsProcessed: 89, successCount: 85, errorCount: 4, status: 'completed' },
  ],
  welcome_pack_sender: [
    { id: 7, agentKey: 'welcome_pack_sender', startedAt: '2025-04-10T18:00:00', completedAt: '2025-04-10T18:02:05', itemsProcessed: 8, successCount: 8, errorCount: 0, status: 'completed' },
  ],
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function AiAgents() {
  const [statuses, setStatuses] = useState<AiAgentStatus[]>(demoStatuses)
  const [history, setHistory] = useState<Record<string, AiAgentRun[]>>(demoHistory)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)

  useEffect(() => {
    getAiAgentStatuses().then(setStatuses).catch(() => {})
  }, [])

  const handleRun = async (agentKey: string) => {
    setRunning(agentKey)
    setStatuses((prev) =>
      prev.map((s) => (s.agentKey === agentKey ? { ...s, status: 'running' } : s))
    )
    try {
      await triggerAiAgent(agentKey)
      const updated = await getAiAgentStatuses()
      setStatuses(updated)
    } catch {
      setStatuses((prev) =>
        prev.map((s) => (s.agentKey === agentKey ? { ...s, status: 'error' } : s))
      )
    } finally {
      setRunning(null)
    }
  }

  const handleToggleAuto = async (agentKey: string, currentVal: boolean) => {
    try {
      await toggleAiAgentAuto(agentKey, !currentVal)
      setStatuses((prev) =>
        prev.map((s) => (s.agentKey === agentKey ? { ...s, autoRun: !currentVal } : s))
      )
    } catch {
      // handle
    }
  }

  const handleExpand = async (agentKey: string) => {
    if (expanded === agentKey) {
      setExpanded(null)
      return
    }
    setExpanded(agentKey)
    if (!history[agentKey]) {
      try {
        const runs = await getAiAgentHistory(agentKey)
        setHistory((prev) => ({ ...prev, [agentKey]: runs }))
      } catch {
        // keep demo
      }
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Agents</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor and control automated workflows.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Bot className="h-4 w-4" />
          <span>{statuses.filter((s) => s.autoRun).length} auto-running</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statuses.map((agent) => {
          const meta = agentMeta[agent.agentKey] || {
            label: agent.agentKey,
            description: '',
            icon: Bot,
          }
          const Icon = meta.icon
          const isRunning = agent.status === 'running' || running === agent.agentKey
          const isError = agent.status === 'error'
          const runs = history[agent.agentKey] || []

          return (
            <div
              key={agent.agentKey}
              className="rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-xl',
                        isRunning
                          ? 'bg-blue-100 text-blue-600'
                          : isError
                            ? 'bg-red-100 text-red-600'
                            : 'bg-[#128FAF]/10 text-[#128FAF]'
                      )}
                    >
                      <Icon className={cn('h-5 w-5', isRunning && 'animate-pulse')} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{meta.label}</h3>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full',
                            isRunning
                              ? 'bg-blue-500 animate-pulse'
                              : isError
                                ? 'bg-red-500'
                                : 'bg-emerald-500'
                          )}
                        />
                        <span className="text-xs text-gray-500">
                          {isRunning ? 'Running...' : isError ? 'Error' : 'Idle'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-xs text-gray-500">{meta.description}</p>

                {/* Stats */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-gray-900">{agent.itemsProcessed}</p>
                    <p className="text-[10px] text-gray-500">Processed</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-emerald-700">{agent.successCount}</p>
                    <p className="text-[10px] text-emerald-600">Success</p>
                  </div>
                  <div className="rounded-lg bg-red-50 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-red-700">{agent.errorCount}</p>
                    <p className="text-[10px] text-red-600">Errors</p>
                  </div>
                </div>

                {/* Last run */}
                <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
                  <Clock className="h-3 w-3" />
                  Last run: {agent.lastRun ? timeAgo(agent.lastRun) : 'Never'}
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleRun(agent.agentKey)}
                    disabled={isRunning}
                  >
                    <Play className="h-3.5 w-3.5" />
                    {isRunning ? 'Running...' : 'Run Now'}
                  </Button>
                  <label className="flex cursor-pointer items-center gap-2">
                    <span className="text-xs text-gray-500">Auto</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={agent.autoRun}
                      onClick={() => handleToggleAuto(agent.agentKey, agent.autoRun)}
                      className={cn(
                        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                        agent.autoRun ? 'bg-[#96ca4f]' : 'bg-gray-300'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                          agent.autoRun ? 'translate-x-[18px]' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </label>
                </div>

                {/* Expand history */}
                <button
                  onClick={() => handleExpand(agent.agentKey)}
                  className="mt-3 flex w-full items-center justify-center gap-1 text-xs font-medium text-[#128FAF] hover:underline"
                >
                  {expanded === agent.agentKey ? 'Hide' : 'View'} History
                  {expanded === agent.agentKey ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              {/* History */}
              {expanded === agent.agentKey && (
                <div className="border-t border-gray-100 p-4">
                  {runs.length === 0 ? (
                    <p className="text-center text-xs text-gray-400">No history yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {runs.map((run) => (
                        <div
                          key={run.id}
                          className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            {run.status === 'completed' ? (
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-red-500" />
                            )}
                            <span className="text-gray-700">
                              {run.itemsProcessed} items ({run.successCount}/{run.errorCount})
                            </span>
                          </div>
                          <span className="text-gray-400">
                            {new Date(run.startedAt).toLocaleString('en-ZA')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

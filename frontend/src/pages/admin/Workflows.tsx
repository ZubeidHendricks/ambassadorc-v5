import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  GitBranch,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  ChevronRight,
  Zap,
  Mail,
  MessageSquare,
  Bot,
  RefreshCw,
  ShieldCheck,
  Link2,
  Pause,
  ToggleLeft,
  ToggleRight,
  Eye,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  getWorkflows,
  getWorkflowInstances,
  getWorkflowStats,
  resumeWorkflowInstance,
  type Workflow,
  type WorkflowInstance,
  type WorkflowStats,
} from '@/lib/api'
import { cn } from '@/lib/utils'

const actionTypeIcons: Record<string, { icon: typeof MessageSquare; color: string; bg: string }> = {
  SEND_SMS: { icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
  SEND_EMAIL: { icon: Mail, color: 'text-purple-600', bg: 'bg-purple-50' },
  RUN_AGENT: { icon: Bot, color: 'text-[#128FAF]', bg: 'bg-[#128FAF]/10' },
  UPDATE_STATUS: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  WAIT: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100' },
  APPROVAL: { icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
  WEBHOOK: { icon: Link2, color: 'text-orange-600', bg: 'bg-orange-50' },
}

const triggerBadgeColors: Record<string, string> = {
  MANUAL: 'bg-gray-100 text-gray-700',
  ON_CREATE: 'bg-blue-50 text-blue-700',
  ON_UPDATE: 'bg-purple-50 text-purple-700',
  SCHEDULED: 'bg-amber-50 text-amber-700',
  WEBHOOK: 'bg-orange-50 text-orange-700',
}

export default function Workflows() {
  const navigate = useNavigate()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [instances, setInstances] = useState<WorkflowInstance[]>([])
  const [stats, setStats] = useState<WorkflowStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedWorkflow, setExpandedWorkflow] = useState<number | null>(null)
  const [instanceFilter, setInstanceFilter] = useState<string>('all')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [wf, inst, st] = await Promise.all([
        getWorkflows(),
        getWorkflowInstances(),
        getWorkflowStats(),
      ])
      setWorkflows(wf)
      setInstances(inst)
      setStats(st)
    } catch {
      // fallback mock data for development
      setStats({
        activeWorkflows: 5,
        runningInstances: 12,
        completedToday: 34,
        failedCount: 2,
        pendingApproval: 3,
      })
      setWorkflows([
        {
          id: 1,
          name: 'New Client Onboarding',
          description: 'Automated onboarding flow for new clients',
          trigger: 'ON_CREATE',
          isActive: true,
          steps: [
            { id: 1, workflowId: 1, order: 1, name: 'Score Lead', actionType: 'RUN_AGENT', config: { agent: 'lead_scorer' } },
            { id: 2, workflowId: 1, order: 2, name: 'Send Welcome SMS', actionType: 'SEND_SMS', config: { template: 'welcome' } },
            { id: 3, workflowId: 1, order: 3, name: 'Wait 24h', actionType: 'WAIT', config: { hours: 24 } },
            { id: 4, workflowId: 1, order: 4, name: 'Manager Approval', actionType: 'APPROVAL', config: { role: 'ADMIN' } },
            { id: 5, workflowId: 1, order: 5, name: 'Send Welcome Pack', actionType: 'SEND_EMAIL', config: { template: 'welcome_pack' } },
          ],
          createdAt: '2025-12-01T10:00:00Z',
        },
        {
          id: 2,
          name: 'Payment Failed Recovery',
          description: 'Handle failed debit order payments',
          trigger: 'ON_UPDATE',
          isActive: true,
          steps: [
            { id: 6, workflowId: 2, order: 1, name: 'Notify Client', actionType: 'SEND_SMS', config: { template: 'payment_failed' } },
            { id: 7, workflowId: 2, order: 2, name: 'Wait 48h', actionType: 'WAIT', config: { hours: 48 } },
            { id: 8, workflowId: 2, order: 3, name: 'Update Status', actionType: 'UPDATE_STATUS', config: { status: 'AT_RISK' } },
            { id: 9, workflowId: 2, order: 4, name: 'Escalate via Webhook', actionType: 'WEBHOOK', config: { url: 'https://api.example.com/escalate' } },
          ],
          createdAt: '2025-12-05T14:00:00Z',
        },
        {
          id: 3,
          name: 'QA Auto-Review',
          description: 'Automatic quality assurance for new sales',
          trigger: 'ON_CREATE',
          isActive: false,
          steps: [
            { id: 10, workflowId: 3, order: 1, name: 'Run Auto QA', actionType: 'RUN_AGENT', config: { agent: 'auto_qa' } },
            { id: 11, workflowId: 3, order: 2, name: 'Notify Agent', actionType: 'SEND_SMS', config: { template: 'qa_result' } },
          ],
          createdAt: '2025-12-10T09:00:00Z',
        },
      ])
      setInstances([
        {
          id: 101, workflowId: 1, workflow: { name: 'New Client Onboarding' } as Workflow,
          entityType: 'CLIENT', entityId: 45, status: 'ACTIVE', currentStep: 3,
          context: {}, steps: [], startedAt: '2026-04-11T08:30:00Z', completedAt: null, error: null,
        },
        {
          id: 102, workflowId: 1, workflow: { name: 'New Client Onboarding' } as Workflow,
          entityType: 'CLIENT', entityId: 51, status: 'PAUSED', currentStep: 4,
          context: {}, steps: [], startedAt: '2026-04-11T07:15:00Z', completedAt: null, error: null,
        },
        {
          id: 103, workflowId: 2, workflow: { name: 'Payment Failed Recovery' } as Workflow,
          entityType: 'POLICY', entityId: 78, status: 'COMPLETED', currentStep: 4,
          context: {}, steps: [], startedAt: '2026-04-10T14:00:00Z', completedAt: '2026-04-11T06:00:00Z', error: null,
        },
        {
          id: 104, workflowId: 2, workflow: { name: 'Payment Failed Recovery' } as Workflow,
          entityType: 'POLICY', entityId: 82, status: 'FAILED', currentStep: 3,
          context: {}, steps: [], startedAt: '2026-04-10T16:00:00Z', completedAt: null, error: 'Webhook timeout',
        },
        {
          id: 105, workflowId: 1, workflow: { name: 'New Client Onboarding' } as Workflow,
          entityType: 'CLIENT', entityId: 53, status: 'PAUSED', currentStep: 4,
          context: {}, steps: [], startedAt: '2026-04-11T09:00:00Z', completedAt: null, error: null,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(instanceId: number) {
    try {
      await resumeWorkflowInstance(instanceId, true)
      loadData()
    } catch {
      // handle error
    }
  }

  async function handleReject(instanceId: number) {
    try {
      await resumeWorkflowInstance(instanceId, false)
      loadData()
    } catch {
      // handle error
    }
  }

  const filteredInstances = instanceFilter === 'all'
    ? instances
    : instances.filter((i) => i.status === instanceFilter)

  const instanceStatusColor: Record<string, string> = {
    ACTIVE: 'text-blue-600',
    PAUSED: 'text-amber-600',
    COMPLETED: 'text-emerald-600',
    FAILED: 'text-red-600',
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="h-8 w-8 animate-spin text-[#128FAF]" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflow Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Automate business processes with configurable workflow pipelines
          </p>
        </div>
        <Button onClick={() => navigate('/admin/workflows/new')}>
          <Plus className="h-4 w-4" />
          Create Workflow
        </Button>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active Workflows"
            value={stats.activeWorkflows}
            icon={<GitBranch className="h-6 w-6" />}
          />
          <StatCard
            label="Running Instances"
            value={stats.runningInstances}
            icon={<Play className="h-6 w-6" />}
          />
          <StatCard
            label="Completed Today"
            value={stats.completedToday}
            icon={<CheckCircle2 className="h-6 w-6" />}
          />
          <StatCard
            label="Failed / Pending"
            value={`${stats.failedCount} / ${stats.pendingApproval}`}
            icon={<AlertTriangle className="h-6 w-6" />}
          />
        </div>
      )}

      {/* Workflow Templates */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Workflow Templates</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {workflows.map((wf) => {
            const isExpanded = expandedWorkflow === wf.id
            return (
              <Card
                key={wf.id}
                className={cn(
                  'cursor-pointer transition-all duration-200',
                  isExpanded && 'lg:col-span-2 xl:col-span-3 ring-2 ring-[#128FAF]/30'
                )}
              >
                <CardHeader
                  className="pb-3"
                  onClick={() => setExpandedWorkflow(isExpanded ? null : wf.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{wf.name}</CardTitle>
                        <ChevronRight
                          className={cn(
                            'h-4 w-4 text-gray-400 transition-transform duration-200',
                            isExpanded && 'rotate-90'
                          )}
                        />
                      </div>
                      {wf.description && (
                        <p className="mt-1 text-sm text-gray-500">{wf.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {wf.isActive ? (
                        <ToggleRight className="h-5 w-5 text-[#96ca4f]" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        triggerBadgeColors[wf.trigger] || 'bg-gray-100 text-gray-700'
                      )}
                    >
                      <Zap className="mr-1 h-3 w-3" />
                      {wf.trigger.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-gray-400">
                      {wf.steps?.length || 0} steps
                    </span>
                    <span
                      className={cn(
                        'text-xs font-medium',
                        wf.isActive ? 'text-[#96ca4f]' : 'text-gray-400'
                      )}
                    >
                      {wf.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </CardHeader>

                {/* Expanded Step Pipeline */}
                {isExpanded && wf.steps && wf.steps.length > 0 && (
                  <CardContent>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">Step Pipeline</p>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/admin/workflows/${wf.id}`)
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Edit Workflow
                      </Button>
                    </div>
                    <div className="relative flex items-start gap-0 overflow-x-auto pb-2">
                      {wf.steps
                        .sort((a, b) => a.order - b.order)
                        .map((step, idx) => {
                          const actionMeta = actionTypeIcons[step.actionType] || {
                            icon: GitBranch,
                            color: 'text-gray-600',
                            bg: 'bg-gray-100',
                          }
                          const StepIcon = actionMeta.icon
                          return (
                            <div key={step.id} className="flex items-center">
                              <div className="flex flex-col items-center">
                                <div
                                  className={cn(
                                    'flex h-10 w-10 items-center justify-center rounded-full border-2 border-white shadow-sm',
                                    actionMeta.bg
                                  )}
                                >
                                  <StepIcon className={cn('h-4 w-4', actionMeta.color)} />
                                </div>
                                <div className="mt-1.5 max-w-[100px] text-center">
                                  <p className="text-[11px] font-medium text-gray-700 leading-tight">
                                    {step.name}
                                  </p>
                                  <p className="text-[10px] text-gray-400">
                                    {step.actionType.replace(/_/g, ' ')}
                                  </p>
                                </div>
                              </div>
                              {idx < (wf.steps?.length || 0) - 1 && (
                                <div className="mx-1.5 mt-[-20px] h-0.5 w-8 bg-gradient-to-r from-[#128FAF]/40 to-[#128FAF]/20" />
                              )}
                            </div>
                          )
                        })}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      </div>

      {/* Active Instances */}
      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Workflow Instances</h2>
          <div className="flex gap-1.5">
            {['all', 'ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED'].map((f) => (
              <button
                key={f}
                onClick={() => setInstanceFilter(f)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  instanceFilter === f
                    ? 'bg-[#128FAF] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Instance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Workflow
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Entity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Step
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Started
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredInstances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400">
                      No workflow instances found
                    </td>
                  </tr>
                ) : (
                  filteredInstances.map((inst) => (
                    <tr
                      key={inst.id}
                      className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/admin/workflows/instances/${inst.id}`)}
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono font-medium text-gray-700">
                          #{inst.id}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">
                          {inst.workflow?.name || `Workflow #${inst.workflowId}`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">
                          {inst.entityType} #{inst.entityId}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-[#128FAF]/10 px-2 py-0.5 text-xs font-medium text-[#128FAF]">
                          Step {inst.currentStep}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={inst.status} />
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500">
                          {new Date(inst.startedAt).toLocaleString('en-ZA', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {inst.status === 'PAUSED' && (
                            <>
                              <button
                                onClick={() => handleApprove(inst.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                                title="Approve"
                              >
                                <ThumbsUp className="h-3 w-3" />
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(inst.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
                                title="Reject"
                              >
                                <ThumbsDown className="h-3 w-3" />
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => navigate(`/admin/workflows/instances/${inst.id}`)}
                            className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}

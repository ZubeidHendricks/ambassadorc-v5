import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  GitBranch,
  CheckCircle2,
  XCircle,
  Clock,
  Pause,
  Play,
  AlertTriangle,
  MessageSquare,
  Mail,
  Bot,
  ShieldCheck,
  Link2,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Ban,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  getWorkflowInstance,
  resumeWorkflowInstance,
  cancelWorkflowInstance,
  type WorkflowInstance as WorkflowInstanceType,
  type WorkflowStepInstance,
} from '@/lib/api'
import { cn } from '@/lib/utils'

const actionIcons: Record<string, { icon: typeof MessageSquare; color: string; bg: string }> = {
  SEND_SMS: { icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
  SEND_EMAIL: { icon: Mail, color: 'text-purple-600', bg: 'bg-purple-50' },
  RUN_AGENT: { icon: Bot, color: 'text-[#128FAF]', bg: 'bg-[#128FAF]/10' },
  UPDATE_STATUS: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  WAIT: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100' },
  APPROVAL: { icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
  WEBHOOK: { icon: Link2, color: 'text-orange-600', bg: 'bg-orange-50' },
}

const stepStatusStyles: Record<string, { ring: string; bg: string; icon: typeof CheckCircle2; iconColor: string }> = {
  COMPLETED: { ring: 'ring-emerald-200', bg: 'bg-emerald-50', icon: CheckCircle2, iconColor: 'text-emerald-500' },
  ACTIVE: { ring: 'ring-blue-300', bg: 'bg-blue-50', icon: Play, iconColor: 'text-blue-500' },
  PAUSED: { ring: 'ring-amber-300', bg: 'bg-amber-50', icon: Pause, iconColor: 'text-amber-500' },
  FAILED: { ring: 'ring-red-200', bg: 'bg-red-50', icon: XCircle, iconColor: 'text-red-500' },
  PENDING: { ring: 'ring-gray-200', bg: 'bg-gray-50', icon: Clock, iconColor: 'text-gray-400' },
  SKIPPED: { ring: 'ring-gray-200', bg: 'bg-gray-50', icon: Ban, iconColor: 'text-gray-400' },
}

export default function WorkflowInstance() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [instance, setInstance] = useState<WorkflowInstanceType | null>(null)
  const [loading, setLoading] = useState(true)
  const [contextOpen, setContextOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (id) loadInstance(Number(id))
  }, [id])

  async function loadInstance(instanceId: number) {
    try {
      setLoading(true)
      const inst = await getWorkflowInstance(instanceId)
      setInstance(inst)
    } catch {
      // Mock data
      setInstance({
        id: instanceId,
        workflowId: 1,
        workflow: {
          id: 1,
          name: 'New Client Onboarding',
          description: 'Automated onboarding flow for new clients',
          trigger: 'ON_CREATE',
          isActive: true,
          steps: [],
          createdAt: '2025-12-01T10:00:00Z',
        },
        entityType: 'CLIENT',
        entityId: 45,
        status: 'PAUSED',
        currentStep: 4,
        context: {
          clientName: 'John Doe',
          phone: '0821234567',
          email: 'john@example.com',
          leadScore: 87,
          smsDelivered: true,
          waitCompleted: true,
        },
        steps: [
          {
            id: 1, instanceId, stepId: 1,
            step: { id: 1, workflowId: 1, order: 1, name: 'Score Lead', actionType: 'RUN_AGENT', config: { agent: 'lead_scorer' } },
            status: 'COMPLETED',
            result: { score: 87, tier: 'HIGH' },
            startedAt: '2026-04-11T08:30:00Z',
            completedAt: '2026-04-11T08:30:12Z',
            error: null,
          },
          {
            id: 2, instanceId, stepId: 2,
            step: { id: 2, workflowId: 1, order: 2, name: 'Send Welcome SMS', actionType: 'SEND_SMS', config: { template: 'welcome' } },
            status: 'COMPLETED',
            result: { messageId: 'sms_abc123', delivered: true },
            startedAt: '2026-04-11T08:30:12Z',
            completedAt: '2026-04-11T08:30:14Z',
            error: null,
          },
          {
            id: 3, instanceId, stepId: 3,
            step: { id: 3, workflowId: 1, order: 3, name: 'Wait 24h', actionType: 'WAIT', config: { hours: 24 } },
            status: 'COMPLETED',
            result: { waited: '24h' },
            startedAt: '2026-04-11T08:30:14Z',
            completedAt: '2026-04-12T08:30:14Z',
            error: null,
          },
          {
            id: 4, instanceId, stepId: 4,
            step: { id: 4, workflowId: 1, order: 4, name: 'Manager Approval', actionType: 'APPROVAL', config: { role: 'ADMIN' } },
            status: 'PAUSED',
            result: null,
            startedAt: '2026-04-12T08:30:14Z',
            completedAt: null,
            error: null,
          },
          {
            id: 5, instanceId, stepId: 5,
            step: { id: 5, workflowId: 1, order: 5, name: 'Send Welcome Email', actionType: 'SEND_EMAIL', config: { template: 'welcome_pack' } },
            status: 'PENDING',
            result: null,
            startedAt: null,
            completedAt: null,
            error: null,
          },
          {
            id: 6, instanceId, stepId: 6,
            step: { id: 6, workflowId: 1, order: 6, name: 'Mark Active', actionType: 'UPDATE_STATUS', config: { entity: 'client', value: 'ACTIVE' } },
            status: 'PENDING',
            result: null,
            startedAt: null,
            completedAt: null,
            error: null,
          },
        ],
        startedAt: '2026-04-11T08:30:00Z',
        completedAt: null,
        error: null,
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove() {
    if (!instance) return
    try {
      setActionLoading(true)
      await resumeWorkflowInstance(instance.id, true)
      loadInstance(instance.id)
    } catch {
      // handle error
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject() {
    if (!instance) return
    try {
      setActionLoading(true)
      await resumeWorkflowInstance(instance.id, false)
      loadInstance(instance.id)
    } catch {
      // handle error
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCancel() {
    if (!instance) return
    try {
      setActionLoading(true)
      await cancelWorkflowInstance(instance.id)
      loadInstance(instance.id)
    } catch {
      // handle error
    } finally {
      setActionLoading(false)
    }
  }

  function formatDateTime(dt: string | null) {
    if (!dt) return '--'
    return new Date(dt).toLocaleString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="h-8 w-8 animate-spin text-[#128FAF]" />
        </div>
      </div>
    )
  }

  if (!instance) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-center text-gray-500">Instance not found.</p>
      </div>
    )
  }

  const sortedSteps = [...(instance.steps || [])].sort(
    (a, b) => (a.step?.order || 0) - (b.step?.order || 0)
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back */}
      <button
        onClick={() => navigate('/admin/workflows')}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Workflows
      </button>

      {/* Instance Header */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900">
                  Instance #{instance.id}
                </h1>
                <StatusBadge status={instance.status} />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {instance.workflow?.name || `Workflow #${instance.workflowId}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium text-gray-400">Entity:</span>{' '}
                  {instance.entityType} #{instance.entityId}
                </div>
                <div>
                  <span className="font-medium text-gray-400">Started:</span>{' '}
                  {formatDateTime(instance.startedAt)}
                </div>
                {instance.completedAt && (
                  <div>
                    <span className="font-medium text-gray-400">Completed:</span>{' '}
                    {formatDateTime(instance.completedAt)}
                  </div>
                )}
                <div>
                  <span className="font-medium text-gray-400">Current Step:</span>{' '}
                  {instance.currentStep} / {sortedSteps.length}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {instance.status === 'PAUSED' && (
                <>
                  <Button
                    size="sm"
                    onClick={handleApprove}
                    disabled={actionLoading}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleReject}
                    disabled={actionLoading}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                </>
              )}
              {(instance.status === 'ACTIVE' || instance.status === 'PAUSED') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={actionLoading}
                >
                  <Ban className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {instance.error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-700">Error</p>
                <p className="text-sm text-red-600">{instance.error}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step Progress */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Step Progress</h2>

        <div className="relative">
          {/* Vertical connector */}
          <div className="absolute left-[31px] top-8 bottom-8 w-0.5 bg-gray-200" />

          <div className="space-y-0">
            {sortedSteps.map((stepInst, idx) => {
              const stepDef = stepInst.step
              const actionMeta = actionIcons[stepDef?.actionType || ''] || {
                icon: GitBranch,
                color: 'text-gray-500',
                bg: 'bg-gray-100',
              }
              const statusStyle = stepStatusStyles[stepInst.status] || stepStatusStyles.PENDING
              const StepActionIcon = actionMeta.icon
              const StatusIcon = statusStyle.icon
              const isPaused = stepInst.status === 'PAUSED'
              const isActive = stepInst.status === 'ACTIVE'
              const isCompleted = stepInst.status === 'COMPLETED'
              const isFailed = stepInst.status === 'FAILED'
              const isPending = stepInst.status === 'PENDING' || stepInst.status === 'SKIPPED'

              return (
                <div key={stepInst.id} className="relative">
                  <div
                    className={cn(
                      'relative flex items-start gap-4 rounded-xl p-4 transition-all',
                      isPaused && 'bg-amber-50/50 ring-1 ring-amber-200',
                      isActive && 'bg-blue-50/50 ring-1 ring-blue-200',
                      isFailed && 'bg-red-50/30',
                      isPending && 'opacity-50'
                    )}
                  >
                    {/* Step indicator */}
                    <div className="relative z-10 flex flex-col items-center">
                      <div
                        className={cn(
                          'flex h-[62px] w-[62px] items-center justify-center rounded-2xl ring-2 shadow-sm',
                          statusStyle.bg,
                          statusStyle.ring,
                          (isActive || isPaused) && 'animate-pulse'
                        )}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <StepActionIcon className={cn('h-5 w-5', actionMeta.color)} />
                          <StatusIcon className={cn('h-3 w-3', statusStyle.iconColor)} />
                        </div>
                      </div>
                    </div>

                    {/* Step content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400">
                              STEP {stepDef?.order || idx + 1}
                            </span>
                            <StatusBadge status={stepInst.status} />
                          </div>
                          <h4 className="mt-1 text-sm font-semibold text-gray-900">
                            {stepDef?.name || 'Unknown Step'}
                          </h4>
                          <span className="text-xs text-gray-500">
                            {stepDef?.actionType?.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Timestamps */}
                        <div className="hidden sm:block text-right shrink-0">
                          {stepInst.startedAt && (
                            <p className="text-xs text-gray-400">
                              Started: {formatDateTime(stepInst.startedAt)}
                            </p>
                          )}
                          {stepInst.completedAt && (
                            <p className="text-xs text-gray-400">
                              Completed: {formatDateTime(stepInst.completedAt)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Result */}
                      {stepInst.result && (
                        <div className="mt-2 rounded-lg bg-white/80 border border-gray-100 p-2.5">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                            Result
                          </p>
                          <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap break-all">
                            {JSON.stringify(stepInst.result, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Error */}
                      {stepInst.error && (
                        <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 p-2.5">
                          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                          <p className="text-xs text-red-700">{stepInst.error}</p>
                        </div>
                      )}

                      {/* Approval actions */}
                      {isPaused && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Awaiting Approval
                          </div>
                          <Button
                            size="sm"
                            onClick={handleApprove}
                            disabled={actionLoading}
                          >
                            <ThumbsUp className="h-3 w-3" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleReject}
                            disabled={actionLoading}
                          >
                            <ThumbsDown className="h-3 w-3" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Connector */}
                  {idx < sortedSteps.length - 1 && (
                    <div className="ml-[31px] h-1" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Instance Context */}
      <Card>
        <CardHeader className="pb-0">
          <button
            onClick={() => setContextOpen(!contextOpen)}
            className="flex w-full items-center justify-between"
          >
            <CardTitle className="text-base">Instance Context</CardTitle>
            {contextOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>
        </CardHeader>
        {contextOpen && (
          <CardContent className="pt-4">
            <div className="rounded-lg bg-gray-50 p-4">
              <pre className="text-sm text-gray-700 font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(instance.context || {}, null, 2)}
              </pre>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

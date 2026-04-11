import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  ChevronUp,
  ChevronDown,
  X,
  GitBranch,
  MessageSquare,
  Mail,
  Bot,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Link2,
  Zap,
  GripVertical,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  PlayCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  addWorkflowStep,
  updateWorkflowStep,
  deleteWorkflowStep,
  type Workflow,
  type WorkflowStep,
} from '@/lib/api'
import { cn } from '@/lib/utils'

const actionTypes = [
  { value: 'SEND_SMS', label: 'Send SMS', icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { value: 'SEND_EMAIL', label: 'Send Email', icon: Mail, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  { value: 'RUN_AGENT', label: 'Run Agent', icon: Bot, color: 'text-[#128FAF]', bg: 'bg-[#128FAF]/10', border: 'border-[#128FAF]/30' },
  { value: 'UPDATE_STATUS', label: 'Update Status', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { value: 'WAIT', label: 'Wait', icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', border: 'border-gray-200' },
  { value: 'APPROVAL', label: 'Approval', icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { value: 'WEBHOOK', label: 'Webhook', icon: Link2, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
]

const triggerTypes = [
  { value: 'MANUAL', label: 'Manual Trigger' },
  { value: 'ON_CREATE', label: 'On Create' },
  { value: 'ON_UPDATE', label: 'On Update' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'WEBHOOK', label: 'Webhook Trigger' },
]

const agentOptions = [
  { value: 'lead_scorer', label: 'Lead Scorer' },
  { value: 'auto_qa', label: 'Auto QA' },
  { value: 'sms_dispatcher', label: 'SMS Dispatcher' },
  { value: 'commission_calculator', label: 'Commission Calculator' },
  { value: 'payment_reconciler', label: 'Payment Reconciler' },
  { value: 'welcome_pack_sender', label: 'Welcome Pack Sender' },
]

const approverRoles = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'QA_OFFICER', label: 'QA Officer' },
  { value: 'AGENT', label: 'Agent Manager' },
]

interface StepFormData {
  name: string
  actionType: string
  config: Record<string, unknown>
}

export default function WorkflowDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  // Workflow form
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [trigger, setTrigger] = useState('MANUAL')
  const [isActive, setIsActive] = useState(true)
  const [steps, setSteps] = useState<WorkflowStep[]>([])

  // Step editor
  const [editingStep, setEditingStep] = useState<number | null>(null)
  const [stepForm, setStepForm] = useState<StepFormData>({ name: '', actionType: 'SEND_SMS', config: {} })

  useEffect(() => {
    if (!isNew && id) {
      loadWorkflow(Number(id))
    }
  }, [id, isNew])

  async function loadWorkflow(workflowId: number) {
    try {
      setLoading(true)
      const wf = await getWorkflow(workflowId)
      setWorkflow(wf)
      setName(wf.name)
      setDescription(wf.description || '')
      setTrigger(wf.trigger)
      setIsActive(wf.isActive)
      setSteps(wf.steps?.sort((a, b) => a.order - b.order) || [])
    } catch {
      // Mock data for development
      const mock: Workflow = {
        id: workflowId,
        name: 'New Client Onboarding',
        description: 'Automated onboarding flow for new clients',
        trigger: 'ON_CREATE',
        isActive: true,
        steps: [
          { id: 1, workflowId, order: 1, name: 'Score Lead', actionType: 'RUN_AGENT', config: { agent: 'lead_scorer' } },
          { id: 2, workflowId, order: 2, name: 'Send Welcome SMS', actionType: 'SEND_SMS', config: { template: 'welcome' } },
          { id: 3, workflowId, order: 3, name: 'Wait 24h', actionType: 'WAIT', config: { hours: 24 } },
          { id: 4, workflowId, order: 4, name: 'Manager Approval', actionType: 'APPROVAL', config: { role: 'ADMIN' } },
          { id: 5, workflowId, order: 5, name: 'Send Welcome Email', actionType: 'SEND_EMAIL', config: { template: 'welcome_pack' } },
          { id: 6, workflowId, order: 6, name: 'Mark Active', actionType: 'UPDATE_STATUS', config: { entity: 'client', value: 'ACTIVE' } },
        ],
        createdAt: '2025-12-01T10:00:00Z',
      }
      setWorkflow(mock)
      setName(mock.name)
      setDescription(mock.description || '')
      setTrigger(mock.trigger)
      setIsActive(mock.isActive)
      setSteps(mock.steps?.sort((a, b) => a.order - b.order) || [])
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveWorkflow() {
    try {
      setSaving(true)
      if (isNew) {
        const created = await createWorkflow({ name, description, trigger, isActive })
        navigate(`/admin/workflows/${created.id}`, { replace: true })
      } else if (workflow) {
        await updateWorkflow(workflow.id, { name, description, trigger, isActive })
      }
    } catch {
      // handle error
    } finally {
      setSaving(false)
    }
  }

  function openStepEditor(step?: WorkflowStep) {
    if (step) {
      setEditingStep(step.id)
      setStepForm({
        name: step.name,
        actionType: step.actionType,
        config: step.config || {},
      })
    } else {
      setEditingStep(-1) // -1 means new step
      setStepForm({ name: '', actionType: 'SEND_SMS', config: {} })
    }
  }

  function closeStepEditor() {
    setEditingStep(null)
    setStepForm({ name: '', actionType: 'SEND_SMS', config: {} })
  }

  async function handleSaveStep() {
    try {
      if (editingStep === -1 && workflow) {
        const newStep = await addWorkflowStep(workflow.id, {
          name: stepForm.name,
          actionType: stepForm.actionType,
          config: stepForm.config,
          order: steps.length + 1,
        })
        setSteps([...steps, newStep])
      } else if (editingStep && editingStep > 0) {
        const updated = await updateWorkflowStep(editingStep, {
          name: stepForm.name,
          actionType: stepForm.actionType,
          config: stepForm.config,
        })
        setSteps(steps.map((s) => (s.id === editingStep ? updated : s)))
      }
    } catch {
      // In dev, update locally
      if (editingStep === -1) {
        const newStep: WorkflowStep = {
          id: Date.now(),
          workflowId: workflow?.id || 0,
          order: steps.length + 1,
          name: stepForm.name,
          actionType: stepForm.actionType,
          config: stepForm.config,
        }
        setSteps([...steps, newStep])
      } else if (editingStep && editingStep > 0) {
        setSteps(
          steps.map((s) =>
            s.id === editingStep
              ? { ...s, name: stepForm.name, actionType: stepForm.actionType, config: stepForm.config }
              : s
          )
        )
      }
    }
    closeStepEditor()
  }

  async function handleDeleteStep(stepId: number) {
    try {
      await deleteWorkflowStep(stepId)
    } catch {
      // continue locally
    }
    const remaining = steps.filter((s) => s.id !== stepId)
    setSteps(remaining.map((s, i) => ({ ...s, order: i + 1 })))
    if (editingStep === stepId) closeStepEditor()
  }

  function moveStep(stepId: number, direction: 'up' | 'down') {
    const idx = steps.findIndex((s) => s.id === stepId)
    if (idx === -1) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === steps.length - 1) return

    const newSteps = [...steps]
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    ;[newSteps[idx], newSteps[swapIdx]] = [newSteps[swapIdx], newSteps[idx]]
    setSteps(newSteps.map((s, i) => ({ ...s, order: i + 1 })))
  }

  function insertStepAt(afterIndex: number) {
    setEditingStep(-1)
    setStepForm({ name: '', actionType: 'SEND_SMS', config: {} })
  }

  function getActionMeta(actionType: string) {
    return actionTypes.find((a) => a.value === actionType) || actionTypes[0]
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back button */}
      <button
        onClick={() => navigate('/admin/workflows')}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Workflows
      </button>

      {/* Workflow Header */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Workflow Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. New Client Onboarding"
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20 transition-all"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Trigger Type
              </label>
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20 transition-all"
              >
                {triggerTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this workflow does..."
                rows={2}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20 transition-all resize-none"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <button
              onClick={() => setIsActive(!isActive)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700"
            >
              {isActive ? (
                <ToggleRight className="h-6 w-6 text-[#96ca4f]" />
              ) : (
                <ToggleLeft className="h-6 w-6 text-gray-400" />
              )}
              {isActive ? 'Active' : 'Inactive'}
            </button>
            <Button onClick={handleSaveWorkflow} disabled={saving || !name.trim()}>
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Workflow'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step Pipeline + Editor */}
      <div className={cn('grid gap-6', editingStep !== null ? 'grid-cols-1 lg:grid-cols-5' : 'grid-cols-1')}>
        {/* Pipeline */}
        <div className={cn(editingStep !== null ? 'lg:col-span-3' : '')}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Step Pipeline</h2>
            <Button size="sm" onClick={() => openStepEditor()}>
              <Plus className="h-3.5 w-3.5" />
              Add Step
            </Button>
          </div>

          {steps.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#128FAF]/10">
                  <GitBranch className="h-8 w-8 text-[#128FAF]" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">No steps yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Add your first step to start building this workflow pipeline.
                </p>
                <Button size="sm" className="mt-4" onClick={() => openStepEditor()}>
                  <Plus className="h-3.5 w-3.5" />
                  Add First Step
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              {/* Vertical connector line */}
              <div className="absolute left-[27px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-[#128FAF]/40 via-[#128FAF]/20 to-[#128FAF]/40 rounded-full" />

              <div className="space-y-0">
                {steps.map((step, idx) => {
                  const meta = getActionMeta(step.actionType)
                  const StepIcon = meta.icon
                  const isEditing = editingStep === step.id
                  return (
                    <div key={step.id}>
                      {/* Step card */}
                      <div
                        className={cn(
                          'group relative flex items-start gap-4 rounded-xl p-3 transition-all duration-200 cursor-pointer',
                          isEditing
                            ? 'bg-[#128FAF]/5 ring-1 ring-[#128FAF]/20'
                            : 'hover:bg-gray-50'
                        )}
                        onClick={() => openStepEditor(step)}
                      >
                        {/* Step number + icon */}
                        <div className="relative z-10 flex flex-col items-center">
                          <div
                            className={cn(
                              'flex h-[54px] w-[54px] items-center justify-center rounded-xl border-2 shadow-sm transition-all',
                              meta.bg,
                              meta.border,
                              isEditing && 'ring-2 ring-[#128FAF]/30 scale-105'
                            )}
                          >
                            <StepIcon className={cn('h-5 w-5', meta.color)} />
                          </div>
                          <span className="mt-1 text-[10px] font-bold text-gray-400">
                            {step.order}
                          </span>
                        </div>

                        {/* Step info */}
                        <div className="flex-1 pt-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900">
                                {step.name}
                              </h4>
                              <span
                                className={cn(
                                  'mt-0.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                                  meta.bg,
                                  meta.color
                                )}
                              >
                                {meta.label}
                              </span>
                            </div>

                            {/* Step actions */}
                            <div
                              className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => moveStep(step.id, 'up')}
                                disabled={idx === 0}
                                className="rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move up"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => moveStep(step.id, 'down')}
                                disabled={idx === steps.length - 1}
                                className="rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move down"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteStep(step.id)}
                                className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                title="Delete step"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Config summary */}
                          {step.config && Object.keys(step.config).length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {Object.entries(step.config).map(([key, val]) => (
                                <span
                                  key={key}
                                  className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500"
                                >
                                  {key}: {String(val)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Insert point between steps */}
                      {idx < steps.length - 1 && (
                        <div className="relative ml-[27px] flex items-center py-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              insertStepAt(idx)
                            }}
                            className="absolute left-[-8px] z-10 flex h-4 w-4 items-center justify-center rounded-full bg-white border border-gray-300 text-gray-400 opacity-0 hover:opacity-100 hover:border-[#128FAF] hover:text-[#128FAF] transition-all group-hover:opacity-0"
                            title="Insert step here"
                          >
                            <Plus className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Step Editor Panel */}
        {editingStep !== null && (
          <div className="lg:col-span-2">
            <Card className="sticky top-24 border-[#128FAF]/20">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {editingStep === -1 ? 'New Step' : 'Edit Step'}
                  </CardTitle>
                  <button
                    onClick={closeStepEditor}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Step Name */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Step Name
                  </label>
                  <input
                    type="text"
                    value={stepForm.name}
                    onChange={(e) => setStepForm({ ...stepForm, name: e.target.value })}
                    placeholder="e.g. Send Welcome SMS"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20 transition-all"
                  />
                </div>

                {/* Action Type */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Action Type
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {actionTypes.map((at) => {
                      const AtIcon = at.icon
                      const isSelected = stepForm.actionType === at.value
                      return (
                        <button
                          key={at.value}
                          onClick={() =>
                            setStepForm({ ...stepForm, actionType: at.value, config: {} })
                          }
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-all',
                            isSelected
                              ? cn(at.bg, at.border, at.color, 'ring-1', at.border.replace('border-', 'ring-'))
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          )}
                        >
                          <AtIcon className="h-3.5 w-3.5" />
                          {at.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Dynamic Config Form */}
                <div className="space-y-3 rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Configuration
                  </p>

                  {stepForm.actionType === 'SEND_SMS' && (
                    <>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          SMS Template
                        </label>
                        <select
                          value={(stepForm.config.template as string) || ''}
                          onChange={(e) =>
                            setStepForm({
                              ...stepForm,
                              config: { ...stepForm.config, template: e.target.value },
                            })
                          }
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
                        >
                          <option value="">Select template...</option>
                          <option value="welcome">Welcome</option>
                          <option value="payment_reminder">Payment Reminder</option>
                          <option value="payment_failed">Payment Failed</option>
                          <option value="qa_result">QA Result</option>
                          <option value="policy_active">Policy Active</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Recipient Field
                        </label>
                        <input
                          type="text"
                          value={(stepForm.config.recipient as string) || ''}
                          onChange={(e) =>
                            setStepForm({
                              ...stepForm,
                              config: { ...stepForm.config, recipient: e.target.value },
                            })
                          }
                          placeholder="e.g. entity.phone"
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
                        />
                      </div>
                    </>
                  )}

                  {stepForm.actionType === 'SEND_EMAIL' && (
                    <>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Email Template
                        </label>
                        <select
                          value={(stepForm.config.template as string) || ''}
                          onChange={(e) =>
                            setStepForm({
                              ...stepForm,
                              config: { ...stepForm.config, template: e.target.value },
                            })
                          }
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
                        >
                          <option value="">Select template...</option>
                          <option value="welcome_pack">Welcome Pack</option>
                          <option value="policy_docs">Policy Documents</option>
                          <option value="payment_receipt">Payment Receipt</option>
                          <option value="renewal_notice">Renewal Notice</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Recipient Field
                        </label>
                        <input
                          type="text"
                          value={(stepForm.config.recipient as string) || ''}
                          onChange={(e) =>
                            setStepForm({
                              ...stepForm,
                              config: { ...stepForm.config, recipient: e.target.value },
                            })
                          }
                          placeholder="e.g. entity.email"
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
                        />
                      </div>
                    </>
                  )}

                  {stepForm.actionType === 'RUN_AGENT' && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Agent
                      </label>
                      <select
                        value={(stepForm.config.agent as string) || ''}
                        onChange={(e) =>
                          setStepForm({
                            ...stepForm,
                            config: { ...stepForm.config, agent: e.target.value },
                          })
                        }
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
                      >
                        <option value="">Select agent...</option>
                        {agentOptions.map((a) => (
                          <option key={a.value} value={a.value}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {stepForm.actionType === 'UPDATE_STATUS' && (
                    <>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Entity Field
                        </label>
                        <input
                          type="text"
                          value={(stepForm.config.entity as string) || ''}
                          onChange={(e) =>
                            setStepForm({
                              ...stepForm,
                              config: { ...stepForm.config, entity: e.target.value },
                            })
                          }
                          placeholder="e.g. client, policy"
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          New Value
                        </label>
                        <input
                          type="text"
                          value={(stepForm.config.value as string) || ''}
                          onChange={(e) =>
                            setStepForm({
                              ...stepForm,
                              config: { ...stepForm.config, value: e.target.value },
                            })
                          }
                          placeholder="e.g. ACTIVE"
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
                        />
                      </div>
                    </>
                  )}

                  {stepForm.actionType === 'WAIT' && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Wait Duration (hours)
                      </label>
                      <input
                        type="number"
                        value={(stepForm.config.hours as number) || ''}
                        onChange={(e) =>
                          setStepForm({
                            ...stepForm,
                            config: { ...stepForm.config, hours: Number(e.target.value) },
                          })
                        }
                        placeholder="e.g. 24"
                        min={1}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
                      />
                    </div>
                  )}

                  {stepForm.actionType === 'APPROVAL' && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Approver Role
                      </label>
                      <select
                        value={(stepForm.config.role as string) || ''}
                        onChange={(e) =>
                          setStepForm({
                            ...stepForm,
                            config: { ...stepForm.config, role: e.target.value },
                          })
                        }
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
                      >
                        <option value="">Select role...</option>
                        {approverRoles.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {stepForm.actionType === 'WEBHOOK' && (
                    <>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Webhook URL
                        </label>
                        <input
                          type="url"
                          value={(stepForm.config.url as string) || ''}
                          onChange={(e) =>
                            setStepForm({
                              ...stepForm,
                              config: { ...stepForm.config, url: e.target.value },
                            })
                          }
                          placeholder="https://..."
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Headers (JSON)
                        </label>
                        <textarea
                          value={(stepForm.config.headers as string) || ''}
                          onChange={(e) =>
                            setStepForm({
                              ...stepForm,
                              config: { ...stepForm.config, headers: e.target.value },
                            })
                          }
                          placeholder='{"Authorization": "Bearer ..."}'
                          rows={2}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono placeholder:text-gray-400 focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20 resize-none"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Save / Delete */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={handleSaveStep}
                    disabled={!stepForm.name.trim()}
                    className="flex-1"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {editingStep === -1 ? 'Add Step' : 'Update Step'}
                  </Button>
                  {editingStep !== -1 && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => editingStep && handleDeleteStep(editingStep)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

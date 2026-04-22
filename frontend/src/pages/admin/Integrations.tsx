import { useState, useEffect, useCallback } from 'react'
import {
  Building2,
  CreditCard,
  Landmark,
  MessageSquare,
  Phone,
  Upload,
  MessageCircle,
  Plug,
  RefreshCw,
  Settings,
  Zap,
  ChevronDown,
  ChevronUp,
  Send,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  ArrowUpDown,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Modal } from '@/components/ui/modal'
import {
  getIntegrations,
  updateIntegration,
  testIntegration,
  triggerQLinkExport,
  getQLinkBatches,
  syncSagePayTransactions,
  validateBankAccount,
  getBankList,
  sendTestSms,
  uploadViciDialerLeads,
  triggerGuardRiskExport,
  sendZapierWhatsApp,
  getZapierWhatsAppTemplates,
  type ZapierWaTemplate,
  getFileExports,
  type IntegrationConfig,
  type QLinkBatch,
  type FileExport,
} from '@/lib/api'
import { cn } from '@/lib/utils'

// ─── Integration Metadata ─────────────────────────────────────────

interface IntegrationMeta {
  key: string
  name: string
  description: string
  icon: typeof Building2
  color: string
  bgColor: string
}

const integrationMeta: IntegrationMeta[] = [
  {
    key: 'qlink',
    name: 'QLink',
    description: 'Government payroll deductions for public sector employees',
    icon: Building2,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    key: 'sagepay',
    name: 'SagePay',
    description: 'Debit order processing and transaction management',
    icon: CreditCard,
    color: 'text-primary-light',
    bgColor: 'bg-primary-light/10',
  },
  {
    key: 'netcash',
    name: 'Netcash',
    description: 'Bank account validation and verification services',
    icon: Landmark,
    color: 'text-[#0077b6]',
    bgColor: 'bg-[#0077b6]/10',
  },
  {
    key: 'sms_portal',
    name: 'SMS Portal',
    description: 'Bulk SMS messaging and notification delivery',
    icon: MessageSquare,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  {
    key: 'vicidialer',
    name: 'ViciDialer',
    description: 'Call center lead management and auto-dialing',
    icon: Phone,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
  },
  {
    key: 'guardrisk',
    name: 'Guard Risk',
    description: 'SFTP-based policy data export and file delivery',
    icon: Upload,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
  },
  {
    key: 'zapier_whatsapp',
    name: 'Zapier WhatsApp',
    description: 'WhatsApp Business messaging via Zapier webhook triggers',
    icon: MessageCircle,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
]

// ─── Status Dot Component ──────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const normalized = status?.toLowerCase()
  const dotColor =
    normalized === 'active'
      ? 'bg-emerald-500'
      : normalized === 'error'
        ? 'bg-red-500'
        : 'bg-gray-400'
  const pulseColor =
    normalized === 'active'
      ? 'bg-emerald-400'
      : normalized === 'error'
        ? 'bg-red-400'
        : ''

  return (
    <span className="relative flex h-3 w-3">
      {normalized !== 'inactive' && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
            pulseColor
          )}
        />
      )}
      <span className={cn('relative inline-flex h-3 w-3 rounded-full', dotColor)} />
    </span>
  )
}

// ─── Time Ago Helper ───────────────────────────────────────────────

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ─── Integration Card Component ─────────────────────────────────────

interface IntegrationCardProps {
  meta: IntegrationMeta
  config: IntegrationConfig | undefined
  onConfigure: () => void
  onTest: () => void
  testing: boolean
  testResult: { success: boolean; message: string } | null
  children?: React.ReactNode
}

function IntegrationCard({
  meta,
  config,
  onConfigure,
  onTest,
  testing,
  testResult,
  children,
}: IntegrationCardProps) {
  const Icon = meta.icon
  const status = config?.status || 'inactive'

  return (
    <Card className="flex flex-col overflow-hidden">
      {/* Top color accent bar */}
      <div
        className={cn(
          'h-1',
          status === 'active'
            ? 'bg-emerald-500'
            : status === 'error'
              ? 'bg-red-500'
              : 'bg-gray-300'
        )}
      />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                meta.bgColor
              )}
            >
              <Icon className={cn('h-5 w-5', meta.color)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{meta.name}</CardTitle>
                <StatusDot status={status} />
              </div>
              <p className="mt-0.5 text-xs text-gray-500">{meta.description}</p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 pt-0">
        {/* Last sync + Status */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last sync: {timeAgo(config?.lastSyncAt)}
          </span>
          <StatusBadge status={status} />
        </div>

        {/* Quick stats from config settings */}
        {config?.settings && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(config.settings as Record<string, unknown>)
              .filter(
                ([k]) =>
                  k.startsWith('stat_') || k === 'totalBatches' || k === 'totalRecords' ||
                  k === 'totalTransactions' || k === 'successRate' || k === 'leadsUploaded' ||
                  k === 'messagesSentToday'
              )
              .slice(0, 3)
              .map(([k, v]) => (
                <span
                  key={k}
                  className="rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600"
                >
                  {k
                    .replace(/^stat_/, '')
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/_/g, ' ')
                    .trim()}
                  : <span className="text-gray-900">{String(v)}</span>
                </span>
              ))}
          </div>
        )}

        {/* Integration-specific actions */}
        {children && <div className="mt-auto space-y-3 border-t border-gray-100 pt-3">{children}</div>}

        {/* Test result */}
        {testResult && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium',
              testResult.success
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            )}
          >
            {testResult.success ? (
              <CheckCircle className="h-3.5 w-3.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            {testResult.message}
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={onTest}
            disabled={testing}
            className="flex-1"
          >
            {testing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            Test
          </Button>
          <Button size="sm" variant="ghost" onClick={onConfigure} className="flex-1">
            <Settings className="h-3.5 w-3.5" />
            Configure
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Config Modal ───────────────────────────────────────────────────

interface ConfigModalProps {
  open: boolean
  onClose: () => void
  config: IntegrationConfig | null
  onSave: (data: Partial<IntegrationConfig>) => Promise<void>
}

function ConfigModal({ open, onClose, config, onSave }: ConfigModalProps) {
  const [baseUrl, setBaseUrl] = useState('')
  const [credentials, setCredentials] = useState('')
  const [settings, setSettings] = useState('')
  const [isActive, setIsActive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (config) {
      setBaseUrl(config.baseUrl || '')
      setCredentials(
        config.settings?.credentials
          ? JSON.stringify(config.settings.credentials, null, 2)
          : '{}'
      )
      setSettings(
        config.settings
          ? JSON.stringify(
              Object.fromEntries(
                Object.entries(config.settings as Record<string, unknown>).filter(
                  ([k]) => k !== 'credentials'
                )
              ),
              null,
              2
            )
          : '{}'
      )
      setIsActive(config.status === 'active')
    }
  }, [config])

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      let parsedCreds = {}
      let parsedSettings = {}
      try {
        parsedCreds = JSON.parse(credentials)
      } catch {
        throw new Error('Invalid credentials JSON')
      }
      try {
        parsedSettings = JSON.parse(settings)
      } catch {
        throw new Error('Invalid settings JSON')
      }
      await onSave({
        baseUrl,
        status: isActive ? 'active' : 'inactive',
        settings: { ...parsedSettings, credentials: parsedCreds } as Record<string, unknown>,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={`Configure ${config?.displayName || config?.name || ''}`}
      description="Update integration endpoint, credentials, and settings."
      className="max-w-xl"
    >
      <div className="space-y-4">
        {/* Endpoint URL */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Endpoint URL
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/v1"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Credentials */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Credentials (JSON)
          </label>
          <textarea
            value={credentials}
            onChange={(e) => setCredentials(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties}
            onFocus={(e) => {
              ;(e.target.style as any).WebkitTextSecurity = 'none'
            }}
            onBlur={(e) => {
              ;(e.target.style as any).WebkitTextSecurity = 'disc'
            }}
          />
        </div>

        {/* Settings */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Settings (JSON)
          </label>
          <textarea
            value={settings}
            onChange={(e) => setSettings(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Active</p>
            <p className="text-xs text-gray-500">Enable this integration</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive(!isActive)}
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors',
              isActive ? 'bg-primary-light' : 'bg-gray-300'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                isActive && 'translate-x-5'
              )}
            />
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Integrations Page ─────────────────────────────────────────

export default function Integrations() {
  const [configs, setConfigs] = useState<IntegrationConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [configModal, setConfigModal] = useState<string | null>(null)
  const [testingMap, setTestingMap] = useState<Record<string, boolean>>({})
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; message: string }>
  >({})

  // QLink state
  const [qlinkBatches, setQlinkBatches] = useState<QLinkBatch[]>([])
  const [showBatches, setShowBatches] = useState(false)
  const [exportingQlink, setExportingQlink] = useState(false)

  // SagePay state
  const [syncingSagePay, setSyncingSagePay] = useState(false)
  const [bankValidation, setBankValidation] = useState({ account: '', branch: '', type: 'savings' })
  const [bankResult, setBankResult] = useState<{ valid: boolean; message: string } | null>(null)
  const [validating, setValidating] = useState(false)

  // Netcash state
  const [netcashAccount, setNetcashAccount] = useState({ account: '', branch: '', type: 'savings' })
  const [netcashResult, setNetcashResult] = useState<{ valid: boolean; message: string } | null>(null)
  const [netcashValidating, setNetcashValidating] = useState(false)

  // SMS state
  const [smsForm, setSmsForm] = useState({ number: '', message: '' })
  const [sendingSms, setSendingSms] = useState(false)

  // ViciDialer state
  const [uploadingLeads, setUploadingLeads] = useState(false)

  // Guard Risk state
  const [exportingGuardRisk, setExportingGuardRisk] = useState(false)

  // Zapier WhatsApp state
  const [waForm, setWaForm] = useState({ phone: '', template: 'ambassador_invite' as ZapierWaTemplate, name: '' })
  const [sendingWa, setSendingWa] = useState(false)
  const [waResult, setWaResult] = useState<{ sent: boolean; message: string } | null>(null)
  const [zapierTemplateStatus, setZapierTemplateStatus] = useState<Array<{ template: string; name: string; configured: boolean }>>([])

  useEffect(() => {
    getZapierWhatsAppTemplates().then((d) => setZapierTemplateStatus(d.status)).catch(() => {})
  }, [])

  // File exports state
  const [fileExports, setFileExports] = useState<FileExport[]>([])
  const [showExports, setShowExports] = useState(false)

  // ─── Load data ────────────────────────────────────────────────────

  const loadIntegrations = useCallback(async () => {
    try {
      const data = await getIntegrations()
      setConfigs(data)
    } catch {
      // fallback to empty
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadIntegrations()
  }, [loadIntegrations])

  const getConfig = (key: string) => configs.find((c) => c.name === key)

  // ─── Test Connection ──────────────────────────────────────────────

  const handleTest = async (name: string) => {
    setTestingMap((p) => ({ ...p, [name]: true }))
    setTestResults((p) => {
      const next = { ...p }
      delete next[name]
      return next
    })
    try {
      const result = await testIntegration(name)
      setTestResults((p) => ({ ...p, [name]: result }))
    } catch (err) {
      setTestResults((p) => ({
        ...p,
        [name]: { success: false, message: err instanceof Error ? err.message : 'Test failed' },
      }))
    } finally {
      setTestingMap((p) => ({ ...p, [name]: false }))
    }
  }

  // ─── Save Config ──────────────────────────────────────────────────

  const handleSaveConfig = async (data: Partial<IntegrationConfig>) => {
    if (!configModal) return
    await updateIntegration(configModal, data)
    await loadIntegrations()
  }

  // ─── QLink Actions ────────────────────────────────────────────────

  const handleQLinkExport = async () => {
    setExportingQlink(true)
    try {
      await triggerQLinkExport()
      await loadQlinkBatches()
    } catch { /* handled */ } finally {
      setExportingQlink(false)
    }
  }

  const loadQlinkBatches = async () => {
    try {
      const data = await getQLinkBatches()
      setQlinkBatches(data)
      setShowBatches(true)
    } catch { /* handled */ }
  }

  // ─── SagePay Actions ──────────────────────────────────────────────

  const handleSagePaySync = async () => {
    setSyncingSagePay(true)
    try {
      await syncSagePayTransactions()
      await loadIntegrations()
    } catch { /* handled */ } finally {
      setSyncingSagePay(false)
    }
  }

  const handleBankValidation = async () => {
    setValidating(true)
    setBankResult(null)
    try {
      const result = await validateBankAccount(
        bankValidation.account,
        bankValidation.branch,
        bankValidation.type
      )
      setBankResult(result)
    } catch (err) {
      setBankResult({
        valid: false,
        message: err instanceof Error ? err.message : 'Validation failed',
      })
    } finally {
      setValidating(false)
    }
  }

  // ─── Netcash Actions ──────────────────────────────────────────────

  const handleNetcashValidation = async () => {
    setNetcashValidating(true)
    setNetcashResult(null)
    try {
      const result = await validateBankAccount(
        netcashAccount.account,
        netcashAccount.branch,
        netcashAccount.type
      )
      setNetcashResult(result)
    } catch (err) {
      setNetcashResult({
        valid: false,
        message: err instanceof Error ? err.message : 'Validation failed',
      })
    } finally {
      setNetcashValidating(false)
    }
  }

  const handleGetBankList = async () => {
    try {
      const banks = await getBankList()
      alert(`Available banks:\n${banks.map((b) => `${b.code} - ${b.name}`).join('\n')}`)
    } catch { /* handled */ }
  }

  // ─── SMS Actions ──────────────────────────────────────────────────

  const handleSendTestSms = async () => {
    if (!smsForm.number || !smsForm.message) return
    setSendingSms(true)
    try {
      await sendTestSms(smsForm.number, smsForm.message)
      setSmsForm({ number: '', message: '' })
    } catch { /* handled */ } finally {
      setSendingSms(false)
    }
  }

  // ─── ViciDialer Actions ───────────────────────────────────────────

  const handleUploadLeads = async () => {
    setUploadingLeads(true)
    try {
      await uploadViciDialerLeads([])
      await loadIntegrations()
    } catch { /* handled */ } finally {
      setUploadingLeads(false)
    }
  }

  // ─── Guard Risk Actions ───────────────────────────────────────────

  const handleGuardRiskExport = async () => {
    setExportingGuardRisk(true)
    try {
      await triggerGuardRiskExport()
      await loadFileExports()
    } catch { /* handled */ } finally {
      setExportingGuardRisk(false)
    }
  }

  const loadFileExports = async () => {
    try {
      const data = await getFileExports()
      setFileExports(data)
      setShowExports(true)
    } catch { /* handled */ }
  }

  // ─── Zapier WhatsApp Actions ──────────────────────────────────────

  const handleSendWhatsApp = async () => {
    if (!waForm.phone) return
    setSendingWa(true)
    setWaResult(null)
    try {
      const result = await sendZapierWhatsApp(waForm.phone, waForm.template, waForm.name || undefined)
      setWaResult({ sent: result.sent, message: result.sent ? 'Message sent via Zapier' : 'Webhook not configured' })
      if (result.sent) setWaForm((p) => ({ ...p, phone: '', name: '' }))
    } catch (err) {
      setWaResult({ sent: false, message: err instanceof Error ? err.message : 'Send failed' })
    } finally {
      setSendingWa(false)
    }
  }

  // ─── Stats summary ───────────────────────────────────────────────

  const activeCount = configs.filter((c) => c.status === 'active').length
  const errorCount = configs.filter((c) => c.status === 'error').length
  const totalCount = integrationMeta.length

  // ─── Render ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage external system connections, sync data, and monitor health.
          </p>
        </div>
        <Button variant="secondary" onClick={loadIntegrations}>
          <RefreshCw className="h-4 w-4" />
          Refresh All
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
              <p className="text-xs text-gray-500">Active</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{errorCount}</p>
              <p className="text-xs text-gray-500">Errors</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Plug className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
              <p className="text-xs text-gray-500">Total Integrations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Integration cards grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {/* ──── QLink ──── */}
        <IntegrationCard
          meta={integrationMeta[0]}
          config={getConfig('qlink')}
          onConfigure={() => setConfigModal('qlink')}
          onTest={() => handleTest('qlink')}
          testing={testingMap['qlink'] || false}
          testResult={testResults['qlink'] || null}
        >
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={handleQLinkExport}
              disabled={exportingQlink}
              className="text-xs"
            >
              {exportingQlink ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              Export Batch
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={loadQlinkBatches}
              className="text-xs"
            >
              <FileText className="h-3 w-3" />
              View Batches
            </Button>
          </div>
        </IntegrationCard>

        {/* ──── SagePay ──── */}
        <IntegrationCard
          meta={integrationMeta[1]}
          config={getConfig('sagepay')}
          onConfigure={() => setConfigModal('sagepay')}
          onTest={() => handleTest('sagepay')}
          testing={testingMap['sagepay'] || false}
          testResult={testResults['sagepay'] || null}
        >
          <Button
            size="sm"
            onClick={handleSagePaySync}
            disabled={syncingSagePay}
            className="w-full text-xs"
          >
            {syncingSagePay ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Sync Transactions
          </Button>
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600">Validate Bank Account</p>
            <div className="grid grid-cols-3 gap-1.5">
              <input
                placeholder="Account #"
                value={bankValidation.account}
                onChange={(e) => setBankValidation((p) => ({ ...p, account: e.target.value }))}
                className="col-span-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
              />
              <input
                placeholder="Branch"
                value={bankValidation.branch}
                onChange={(e) => setBankValidation((p) => ({ ...p, branch: e.target.value }))}
                className="col-span-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
              />
              <select
                value={bankValidation.type}
                onChange={(e) => setBankValidation((p) => ({ ...p, type: e.target.value }))}
                className="col-span-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
              >
                <option value="savings">Savings</option>
                <option value="current">Current</option>
                <option value="transmission">Transmission</option>
              </select>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBankValidation}
              disabled={validating || !bankValidation.account}
              className="w-full text-xs"
            >
              {validating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
              Validate
            </Button>
            {bankResult && (
              <div
                className={cn(
                  'rounded-md px-2 py-1.5 text-xs font-medium',
                  bankResult.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                )}
              >
                {bankResult.message}
              </div>
            )}
          </div>
        </IntegrationCard>

        {/* ──── Netcash ──── */}
        <IntegrationCard
          meta={integrationMeta[2]}
          config={getConfig('netcash')}
          onConfigure={() => setConfigModal('netcash')}
          onTest={() => handleTest('netcash')}
          testing={testingMap['netcash'] || false}
          testResult={testResults['netcash'] || null}
        >
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600">Validate Account</p>
            <div className="grid grid-cols-3 gap-1.5">
              <input
                placeholder="Account #"
                value={netcashAccount.account}
                onChange={(e) => setNetcashAccount((p) => ({ ...p, account: e.target.value }))}
                className="col-span-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
              />
              <input
                placeholder="Branch"
                value={netcashAccount.branch}
                onChange={(e) => setNetcashAccount((p) => ({ ...p, branch: e.target.value }))}
                className="col-span-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
              />
              <select
                value={netcashAccount.type}
                onChange={(e) => setNetcashAccount((p) => ({ ...p, type: e.target.value }))}
                className="col-span-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
              >
                <option value="savings">Savings</option>
                <option value="current">Current</option>
              </select>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleNetcashValidation}
              disabled={netcashValidating || !netcashAccount.account}
              className="w-full text-xs"
            >
              {netcashValidating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
              Validate
            </Button>
            {netcashResult && (
              <div
                className={cn(
                  'rounded-md px-2 py-1.5 text-xs font-medium',
                  netcashResult.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                )}
              >
                {netcashResult.message}
              </div>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={handleGetBankList} className="w-full text-xs">
            <Landmark className="h-3 w-3" />
            Get Bank List
          </Button>
        </IntegrationCard>

        {/* ──── SMS Portal ──── */}
        <IntegrationCard
          meta={integrationMeta[3]}
          config={getConfig('sms_portal')}
          onConfigure={() => setConfigModal('sms_portal')}
          onTest={() => handleTest('sms_portal')}
          testing={testingMap['sms_portal'] || false}
          testResult={testResults['sms_portal'] || null}
        >
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600">Quick Compose</p>
            <input
              placeholder="Phone number"
              value={smsForm.number}
              onChange={(e) => setSmsForm((p) => ({ ...p, number: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
            />
            <textarea
              placeholder="Message..."
              value={smsForm.message}
              onChange={(e) => setSmsForm((p) => ({ ...p, message: e.target.value }))}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-primary focus:outline-none resize-none"
            />
            <Button
              size="sm"
              onClick={handleSendTestSms}
              disabled={sendingSms || !smsForm.number || !smsForm.message}
              className="w-full text-xs"
            >
              {sendingSms ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Send Test SMS
            </Button>
          </div>
        </IntegrationCard>

        {/* ──── ViciDialer ──── */}
        <IntegrationCard
          meta={integrationMeta[4]}
          config={getConfig('vicidialer')}
          onConfigure={() => setConfigModal('vicidialer')}
          onTest={() => handleTest('vicidialer')}
          testing={testingMap['vicidialer'] || false}
          testResult={testResults['vicidialer'] || null}
        >
          <Button
            size="sm"
            onClick={handleUploadLeads}
            disabled={uploadingLeads}
            className="w-full text-xs"
          >
            {uploadingLeads ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Upload Leads
          </Button>
        </IntegrationCard>

        {/* ──── Guard Risk ──── */}
        <IntegrationCard
          meta={integrationMeta[5]}
          config={getConfig('guardrisk')}
          onConfigure={() => setConfigModal('guardrisk')}
          onTest={() => handleTest('guardrisk')}
          testing={testingMap['guardrisk'] || false}
          testResult={testResults['guardrisk'] || null}
        >
          <Button
            size="sm"
            onClick={handleGuardRiskExport}
            disabled={exportingGuardRisk}
            className="w-full text-xs"
          >
            {exportingGuardRisk ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Export & Upload
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={loadFileExports}
            className="w-full text-xs"
          >
            <FileText className="h-3 w-3" />
            File History
          </Button>
        </IntegrationCard>

        {/* ──── Zapier WhatsApp ──── */}
        <IntegrationCard
          meta={integrationMeta[6]}
          config={undefined}
          onConfigure={() => {}}
          onTest={() => {}}
          testing={false}
          testResult={null}
        >
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600">Webhook Status</p>
            {zapierTemplateStatus.map((t) => (
              <div key={t.template} className="flex items-center justify-between">
                <span className="text-xs text-gray-700">{t.name}</span>
                <span className={cn('text-xs font-semibold', t.configured ? 'text-emerald-600' : 'text-amber-600')}>
                  {t.configured ? 'Configured' : 'Not set'}
                </span>
              </div>
            ))}
            <div className="border-t border-gray-100 pt-2">
              <p className="mb-1.5 text-xs font-medium text-gray-600">Send Test Message</p>
              <input
                placeholder="Phone (e.g. 0821234567)"
                value={waForm.phone}
                onChange={(e) => setWaForm((p) => ({ ...p, phone: e.target.value }))}
                className="mb-1.5 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
              />
              <input
                placeholder="Name (optional)"
                value={waForm.name}
                onChange={(e) => setWaForm((p) => ({ ...p, name: e.target.value }))}
                className="mb-1.5 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
              />
              <select
                value={waForm.template}
                onChange={(e) => setWaForm((p) => ({ ...p, template: e.target.value as ZapierWaTemplate }))}
                className="mb-1.5 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
              >
                <option value="ambassador_invite">Become an Ambassador</option>
                <option value="referrals_received">Referrals Received</option>
                <option value="member_signup">Member Sign-Up Received</option>
              </select>
              <Button
                size="sm"
                onClick={handleSendWhatsApp}
                disabled={sendingWa || !waForm.phone}
                className="w-full text-xs"
              >
                {sendingWa ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Send via Zapier
              </Button>
              {waResult && (
                <div className={cn(
                  'mt-1.5 rounded-md px-2 py-1.5 text-xs font-medium',
                  waResult.sent ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                )}>
                  {waResult.message}
                </div>
              )}
            </div>
          </div>
        </IntegrationCard>
      </div>

      {/* ──── QLink Batch History ──── */}
      <div className="space-y-1">
        <button
          onClick={() => (showBatches ? setShowBatches(false) : loadQlinkBatches())}
          className="flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-primary transition-colors"
        >
          {showBatches ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          QLink Batch History
        </button>
        {showBatches && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/80">
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">
                        <div className="flex items-center gap-1">Batch ID <ArrowUpDown className="h-3 w-3" /></div>
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Product</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Records</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {qlinkBatches.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                          No QLink batches found.
                        </td>
                      </tr>
                    ) : (
                      qlinkBatches.map((batch) => (
                        <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-gray-900">
                            {batch.batchId}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{batch.product}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            {batch.recordCount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={batch.status} />
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {new Date(batch.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ──── File Export History ──── */}
      <div className="space-y-1">
        <button
          onClick={() => (showExports ? setShowExports(false) : loadFileExports())}
          className="flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-primary transition-colors"
        >
          {showExports ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          File Export History
        </button>
        {showExports && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/80">
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">File Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Direction</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Type</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Records</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fileExports.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                          No file exports found.
                        </td>
                      </tr>
                    ) : (
                      fileExports.map((file) => (
                        <tr key={file.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-gray-900">
                            {file.fileName}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                                file.direction === 'export'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-amber-50 text-amber-700'
                              )}
                            >
                              {file.direction}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{file.importType}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            {file.entryCount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={file.status} />
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {new Date(file.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Config Modal */}
      <ConfigModal
        open={!!configModal}
        onClose={() => setConfigModal(null)}
        config={configModal ? getConfig(configModal) || null : null}
        onSave={handleSaveConfig}
      />
    </div>
  )
}

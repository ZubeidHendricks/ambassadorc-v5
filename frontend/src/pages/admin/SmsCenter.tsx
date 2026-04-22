import { useState, useEffect } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { Send, MessageSquare, Users, Clock, MessageCircle, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import {
  getSmsHistory,
  sendSms,
  sendBulkSms,
  getSmsTemplates,
  getUltraMsgStatus,
  sendUltraMsgWhatsApp,
  getUltraMsgPreview,
  type UltraMsgTemplate,
  type UltraMsgTemplateInfo,
  type SmsRecord,
} from '@/lib/api'
import { cn } from '@/lib/utils'

const tabTriggerClass =
  'px-4 py-2.5 text-sm font-medium text-gray-500 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary hover:text-gray-700 transition-colors'

// ── WhatsApp preview renderer ──────────────────────────────────────────────
// Converts the *bold* and newline formatting from the backend template body
// into readable HTML-ish JSX for the preview bubble.

function MessagePreview({ body }: { body: string }) {
  if (!body) return null
  return (
    <div className="space-y-0.5">
      {body.split('\n').map((line, i) => {
        // Render **bold** segments
        const parts = line.split(/(\*[^*]+\*)/g)
        return (
          <p key={i} className={cn('text-sm leading-relaxed text-gray-800', line === '' && 'h-2')}>
            {parts.map((part, j) =>
              part.startsWith('*') && part.endsWith('*') ? (
                <strong key={j}>{part.slice(1, -1)}</strong>
              ) : (
                part
              )
            )}
          </p>
        )
      })}
    </div>
  )
}

// ── WhatsApp Tab ────────────────────────────────────────────────────────────

function WhatsAppTab() {
  const [selectedTemplate, setSelectedTemplate] = useState<UltraMsgTemplate>('ambassador_invite')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: boolean; message: string } | null>(null)

  const [configured, setConfigured] = useState<boolean | null>(null)
  const [templates, setTemplates] = useState<UltraMsgTemplateInfo[]>([])
  const [previewBody, setPreviewBody] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  // Load UltraMsg status + template list
  useEffect(() => {
    getUltraMsgStatus()
      .then((d) => {
        setConfigured(d.configured)
        setTemplates(d.templates)
      })
      .catch(() => setConfigured(false))
  }, [])

  // Refresh preview when template or name changes
  useEffect(() => {
    setPreviewLoading(true)
    getUltraMsgPreview(selectedTemplate, name || undefined)
      .then((d) => setPreviewBody(d.body))
      .catch(() => setPreviewBody(''))
      .finally(() => setPreviewLoading(false))
  }, [selectedTemplate, name])

  const currentTemplate = templates.find((t) => t.id === selectedTemplate)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone) return
    setSending(true)
    setResult(null)
    try {
      const res = await sendUltraMsgWhatsApp(phone, selectedTemplate, name || undefined)
      setResult({
        sent: res.sent,
        message: res.sent
          ? 'WhatsApp message sent successfully.'
          : 'UltraMsg is not yet configured. Add ULTRAMSG_INSTANCE_ID and ULTRAMSG_TOKEN in environment settings.',
      })
      if (res.sent) {
        setPhone('')
        setName('')
      }
    } catch (err) {
      setResult({ sent: false, message: err instanceof Error ? err.message : 'Send failed' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      {/* Left — template selector + send form */}
      <div className="space-y-4">

        {/* UltraMsg status banner */}
        {configured === false && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">UltraMsg not connected</p>
              <p className="mt-0.5 text-xs">
                Sign up at <strong>ultramsg.com</strong>, scan the QR code to link a WhatsApp number,
                then add <code className="rounded bg-amber-100 px-1">ULTRAMSG_INSTANCE_ID</code> and{' '}
                <code className="rounded bg-amber-100 px-1">ULTRAMSG_TOKEN</code> as environment secrets.
              </p>
            </div>
          </div>
        )}

        {configured === true && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span><strong>UltraMsg connected</strong> — WhatsApp messages will deliver immediately.</span>
          </div>
        )}

        {/* Template selector */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-600">Select Template</p>
          </div>
          <div className="divide-y divide-gray-100">
            {(templates.length > 0
              ? templates
              : [
                  { id: 'ambassador_invite' as UltraMsgTemplate, name: 'Become an Ambassador', description: 'Invite someone to join the Refer & Earn program', trigger: '' },
                  { id: 'referrals_received' as UltraMsgTemplate, name: 'Referrals Received', description: 'Confirmation when 10 referrals are submitted', trigger: '' },
                  { id: 'member_signup' as UltraMsgTemplate, name: 'Member Sign-Up Received', description: 'Confirmation that a signup has been received', trigger: '' },
                ]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setSelectedTemplate(t.id); setResult(null) }}
                className={cn(
                  'w-full px-4 py-3 text-left transition-colors hover:bg-gray-50',
                  selectedTemplate === t.id && 'bg-primary/5'
                )}
              >
                <p className={cn('text-sm font-semibold', selectedTemplate === t.id ? 'text-primary' : 'text-gray-900')}>
                  {t.name}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{t.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Send form */}
        <form onSubmit={handleSend} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-600">Send Message</p>
          </div>
          <div className="space-y-3 p-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Recipient WhatsApp Number
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0821234567 or 27821234567"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="mt-1 text-xs text-gray-400">SA numbers — 0xx or 27xx format accepted</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Name <span className="font-normal text-gray-400">(optional — personalises greeting)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Thabo Nkosi"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {result && (
              <div className={cn(
                'flex items-start gap-2 rounded-lg px-3 py-2 text-sm',
                result.sent ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              )}>
                {result.sent
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                {result.message}
              </div>
            )}

            <Button
              type="submit"
              disabled={sending || !phone}
              className="w-full"
            >
              <Send className="h-4 w-4" />
              {sending ? 'Sending…' : `Send — ${currentTemplate?.name ?? 'Message'}`}
            </Button>
          </div>
        </form>
      </div>

      {/* Right — live message preview */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-600">Message Preview</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Exact text that will be delivered via WhatsApp
            {name && <> — personalised for <strong>{name}</strong></>}
          </p>
        </div>
        <div className="p-4">
          <div className={cn(
            'rounded-xl bg-[#dcf8c6] px-4 py-3 shadow-sm transition-opacity',
            previewLoading && 'opacity-50'
          )}>
            {previewBody
              ? <MessagePreview body={previewBody} />
              : <p className="text-sm text-gray-400 italic">Loading preview…</p>
            }
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Preview updates live as you type a name. Sent via UltraMsg — no Meta template approval required.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main SMS / Messaging Center ─────────────────────────────────────────────

export default function SmsCenter() {
  const [history, setHistory] = useState<SmsRecord[]>([])
  const [templates, setTemplates] = useState<{ id: string; name: string; body: string }[]>([])

  const [recipient, setRecipient] = useState('')
  const [message, setMessage] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [sending, setSending] = useState(false)

  const [bulkRecipients, setBulkRecipients] = useState('')
  const [bulkMessage, setBulkMessage] = useState('')
  const [bulkTemplateId, setBulkTemplateId] = useState('')
  const [bulkSending, setBulkSending] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ sent: number; failed: number } | null>(null)

  useEffect(() => {
    getSmsHistory().then(setHistory).catch(() => {})
    getSmsTemplates().then(setTemplates).catch(() => {})
  }, [])

  const handleTemplateSelect = (id: string, setBulk = false) => {
    const tmpl = templates.find((t) => t.id === id)
    if (setBulk) {
      setBulkTemplateId(id)
      if (tmpl) setBulkMessage(tmpl.body)
    } else {
      setTemplateId(id)
      if (tmpl) setMessage(tmpl.body)
    }
  }

  const handleSendSingle = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    try {
      const record = await sendSms({ recipient, message, template: templateId || undefined })
      setHistory((prev) => [record, ...prev])
      setRecipient('')
      setMessage('')
      setTemplateId('')
    } catch {
      // silent
    } finally {
      setSending(false)
    }
  }

  const handleSendBulk = async (e: React.FormEvent) => {
    e.preventDefault()
    setBulkSending(true)
    setBulkResult(null)
    try {
      const recipients = bulkRecipients
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean)
      const result = await sendBulkSms({
        recipients,
        message: bulkMessage,
        template: bulkTemplateId || undefined,
      })
      setBulkResult(result)
      setBulkRecipients('')
      setBulkMessage('')
      setBulkTemplateId('')
      getSmsHistory().then(setHistory).catch(() => {})
    } catch {
      // silent
    } finally {
      setBulkSending(false)
    }
  }

  const recipientCount = bulkRecipients
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean).length

  const historyColumns: Column<SmsRecord>[] = [
    {
      key: 'recipient',
      header: 'Recipient',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900">{r.recipientName || r.recipient}</p>
          {r.recipientName && <p className="text-xs text-gray-500">{r.recipient}</p>}
        </div>
      ),
    },
    {
      key: 'template',
      header: 'Template',
      render: (r) => r.template || <span className="text-gray-400">Custom</span>,
    },
    {
      key: 'message',
      header: 'Message',
      render: (r) => (
        <span className="block max-w-xs truncate text-sm text-gray-600">{r.message}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'sentAt',
      header: 'Sent',
      render: (r) => new Date(r.sentAt).toLocaleString('en-ZA'),
    },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Messaging Center</h1>
        <p className="mt-1 text-sm text-gray-500">
          Send WhatsApp notifications and SMS messages to clients and ambassadors.
        </p>
      </div>

      <Tabs.Root defaultValue="whatsapp">
        <Tabs.List className="flex border-b border-gray-200">
          <Tabs.Trigger value="whatsapp" className={tabTriggerClass}>
            <span className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger value="compose" className={tabTriggerClass}>
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              SMS Compose
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger value="bulk" className={tabTriggerClass}>
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Bulk SMS
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger value="history" className={tabTriggerClass}>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              History ({history.length})
            </span>
          </Tabs.Trigger>
        </Tabs.List>

        {/* WhatsApp Tab */}
        <Tabs.Content value="whatsapp" className="mt-6">
          <WhatsAppTab />
        </Tabs.Content>

        {/* Single SMS Compose Tab */}
        <Tabs.Content value="compose" className="mt-6">
          <div className="max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <form onSubmit={handleSendSingle} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Recipient Number
                </label>
                <input
                  type="tel"
                  required
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0821234567"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Template (optional)
                </label>
                <select
                  value={templateId}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Custom message</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Message</label>
                <textarea
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={160}
                  placeholder="Type your message..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1 text-right text-xs text-gray-400">{message.length}/160</p>
              </div>
              <Button type="submit" disabled={sending || !recipient || !message}>
                <Send className="h-4 w-4" />
                {sending ? 'Sending...' : 'Send SMS'}
              </Button>
            </form>
          </div>
        </Tabs.Content>

        {/* Bulk SMS Tab */}
        <Tabs.Content value="bulk" className="mt-6">
          <div className="max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <form onSubmit={handleSendBulk} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Recipients (one number per line)
                </label>
                <textarea
                  required
                  value={bulkRecipients}
                  onChange={(e) => setBulkRecipients(e.target.value)}
                  rows={5}
                  placeholder={'0821234567\n0839876543\n0711112222'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1 text-xs text-gray-400">
                  {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Template (optional)
                </label>
                <select
                  value={bulkTemplateId}
                  onChange={(e) => handleTemplateSelect(e.target.value, true)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Custom message</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Message</label>
                <textarea
                  required
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  rows={4}
                  maxLength={160}
                  placeholder="Type your message..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1 text-right text-xs text-gray-400">{bulkMessage.length}/160</p>
              </div>

              {bulkResult && (
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="text-sm text-emerald-700">
                    Sent: <span className="font-semibold">{bulkResult.sent}</span>
                    {bulkResult.failed > 0 && (
                      <> &middot; Failed: <span className="font-semibold text-red-600">{bulkResult.failed}</span></>
                    )}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={bulkSending || recipientCount === 0 || !bulkMessage}
                >
                  <Send className="h-4 w-4" />
                  {bulkSending
                    ? 'Sending...'
                    : `Send to ${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}`}
                </Button>
                {recipientCount > 0 && (
                  <p className="text-xs text-gray-500">
                    This will send {recipientCount} SMS message{recipientCount !== 1 ? 's' : ''}.
                  </p>
                )}
              </div>
            </form>
          </div>
        </Tabs.Content>

        {/* History Tab */}
        <Tabs.Content value="history" className="mt-6">
          <DataTable
            data={history}
            columns={historyColumns}
            pageSize={10}
            searchable
            searchPlaceholder="Search messages..."
            searchKeys={['recipient', 'recipientName', 'message']}
          />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

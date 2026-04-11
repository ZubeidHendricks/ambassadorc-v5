import { useState, useEffect } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { Send, MessageSquare, Users, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import {
  getSmsHistory,
  sendSms,
  sendBulkSms,
  getSmsTemplates,
  type SmsRecord,
} from '@/lib/api'

const demoHistory: SmsRecord[] = [
  { id: 1, recipient: '0821234567', recipientName: 'John Doe', template: 'Welcome', message: 'Welcome to Lifesaver Insurance!', status: 'delivered', sentAt: '2025-04-11T09:00:00' },
  { id: 2, recipient: '0839876543', recipientName: 'Maria Santos', template: 'QA Verify', message: 'Please confirm your policy details by calling 0800 123 456.', status: 'delivered', sentAt: '2025-04-11T08:30:00' },
  { id: 3, recipient: '0711112222', recipientName: 'Sipho Ndlovu', template: 'Premium Reminder', message: 'Your premium of R350 is due on 2025-04-15.', status: 'pending', sentAt: '2025-04-11T07:00:00' },
  { id: 4, recipient: '0825555555', recipientName: 'Nomsa Dlamini', message: 'Your policy POL-1238 has been activated.', status: 'delivered', sentAt: '2025-04-10T16:00:00' },
  { id: 5, recipient: '0826666666', template: 'Payment Failed', message: 'Your debit order for R120 was unsuccessful. Please contact us.', status: 'failed', sentAt: '2025-04-10T14:00:00' },
]

const demoTemplates = [
  { id: 'welcome', name: 'Welcome', body: 'Welcome to Lifesaver Insurance, {name}! Your policy {policyNumber} is now active.' },
  { id: 'qa_verify', name: 'QA Verify', body: 'Hi {name}, please confirm your policy details by calling 0800 123 456.' },
  { id: 'premium_reminder', name: 'Premium Reminder', body: 'Hi {name}, your premium of R{amount} is due on {date}.' },
  { id: 'payment_failed', name: 'Payment Failed', body: 'Hi {name}, your debit order for R{amount} was unsuccessful. Please contact us.' },
]

const tabTriggerClass =
  'px-4 py-2.5 text-sm font-medium text-gray-500 data-[state=active]:text-[#128FAF] data-[state=active]:border-b-2 data-[state=active]:border-[#128FAF] hover:text-gray-700 transition-colors'

export default function SmsCenter() {
  const [history, setHistory] = useState<SmsRecord[]>(demoHistory)
  const [templates, setTemplates] = useState(demoTemplates)

  // Single SMS state
  const [recipient, setRecipient] = useState('')
  const [message, setMessage] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [sending, setSending] = useState(false)

  // Bulk SMS state
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
      // handle
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
      // Refresh history
      getSmsHistory().then(setHistory).catch(() => {})
    } catch {
      // handle
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
        <h1 className="text-2xl font-bold text-gray-900">SMS Center</h1>
        <p className="mt-1 text-sm text-gray-500">
          Send messages and manage SMS communications.
        </p>
      </div>

      <Tabs.Root defaultValue="compose">
        <Tabs.List className="flex border-b border-gray-200">
          <Tabs.Trigger value="compose" className={tabTriggerClass}>
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Compose
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger value="bulk" className={tabTriggerClass}>
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Bulk Send
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger value="history" className={tabTriggerClass}>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              History ({history.length})
            </span>
          </Tabs.Trigger>
        </Tabs.List>

        {/* Single Compose Tab */}
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Template (optional)
                </label>
                <select
                  value={templateId}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
                >
                  <option value="">Custom message</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
                />
                <p className="mt-1 text-right text-xs text-gray-400">
                  {message.length}/160
                </p>
              </div>
              <Button type="submit" disabled={sending || !recipient || !message}>
                <Send className="h-4 w-4" />
                {sending ? 'Sending...' : 'Send SMS'}
              </Button>
            </form>
          </div>
        </Tabs.Content>

        {/* Bulk Tab */}
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
                  placeholder="0821234567&#10;0839876543&#10;0711112222"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-mono focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
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
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
                >
                  <option value="">Custom message</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
                />
                <p className="mt-1 text-right text-xs text-gray-400">
                  {bulkMessage.length}/160
                </p>
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
                  {bulkSending ? 'Sending...' : `Send to ${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}`}
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

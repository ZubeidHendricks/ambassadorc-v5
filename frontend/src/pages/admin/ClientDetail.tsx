import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as Tabs from '@radix-ui/react-tabs'
import { ArrowLeft, Phone, Mail, MapPin, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Modal } from '@/components/ui/modal'
import {
  getClient,
  getClientPolicies,
  getClientPayments,
  getClientDocuments,
  getClientSms,
  updateClient,
  type Client,
  type Policy,
  type Payment,
  type WelcomePack,
  type SmsRecord,
  type UpdateClientPayload,
} from '@/lib/api'

const PROVINCE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Eastern Cape', value: 'EASTERN_CAPE' },
  { label: 'Free State', value: 'FREE_STATE' },
  { label: 'Gauteng', value: 'GAUTENG' },
  { label: 'KwaZulu-Natal', value: 'KWAZULU_NATAL' },
  { label: 'Limpopo', value: 'LIMPOPO' },
  { label: 'Mpumalanga', value: 'MPUMALANGA' },
  { label: 'North West', value: 'NORTH_WEST' },
  { label: 'Northern Cape', value: 'NORTHERN_CAPE' },
  { label: 'Western Cape', value: 'WESTERN_CAPE' },
]

function getProvinceLabel(value: string): string {
  const found = PROVINCE_OPTIONS.find((p) => p.value === value)
  return found ? found.label : value
}

const policyColumns: Column<Policy>[] = [
  { key: 'policyNumber', header: 'Policy #', render: (r) => <span className="font-mono text-sm font-medium">{r.policyNumber}</span> },
  { key: 'productName', header: 'Product' },
  { key: 'premiumAmount', header: 'Premium', render: (r) => `R${r.premiumAmount}` },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  { key: 'startDate', header: 'Start Date', render: (r) => new Date(r.startDate).toLocaleDateString('en-ZA') },
  { key: 'agentName', header: 'Agent' },
]

const paymentColumns: Column<Payment>[] = [
  { key: 'policyNumber', header: 'Policy #', render: (r) => <span className="font-mono text-sm">{r.policyNumber}</span> },
  { key: 'amount', header: 'Amount', render: (r) => `R${r.amount}` },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  { key: 'paymentDate', header: 'Date', render: (r) => new Date(r.paymentDate).toLocaleDateString('en-ZA') },
  { key: 'method', header: 'Method' },
  { key: 'reference', header: 'Reference', render: (r) => r.reference || '-' },
]

const docColumns: Column<WelcomePack>[] = [
  { key: 'productName', header: 'Product' },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  { key: 'sentAt', header: 'Sent', render: (r) => r.sentAt ? new Date(r.sentAt).toLocaleDateString('en-ZA') : '-' },
  { key: 'viewedAt', header: 'Viewed', render: (r) => r.viewedAt ? new Date(r.viewedAt).toLocaleDateString('en-ZA') : '-' },
  { key: 'signedAt', header: 'Signed', render: (r) => r.signedAt ? new Date(r.signedAt).toLocaleDateString('en-ZA') : '-' },
  {
    key: 'downloadUrl',
    header: '',
    sortable: false,
    render: (r) =>
      r.downloadUrl ? (
        <a href={r.downloadUrl} className="text-sm font-medium text-primary hover:underline">
          Download
        </a>
      ) : null,
  },
]

const smsColumns: Column<SmsRecord>[] = [
  { key: 'template', header: 'Template', render: (r) => r.template || 'Custom' },
  { key: 'message', header: 'Message', render: (r) => <span className="max-w-xs truncate block">{r.message}</span> },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  { key: 'sentAt', header: 'Sent', render: (r) => new Date(r.sentAt).toLocaleString('en-ZA') },
]

const tabTriggerClass =
  'px-4 py-2.5 text-sm font-medium text-gray-500 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary hover:text-gray-700 transition-colors'

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [client, setClient] = useState<Client | null>(null)
  const [policies, setPolicies] = useState<Policy[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [docs, setDocs] = useState<WelcomePack[]>([])
  const [sms, setSms] = useState<SmsRecord[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<UpdateClientPayload>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const loadClient = (cid: number) => {
    getClient(cid).then(setClient).catch(() => {})
  }

  useEffect(() => {
    if (!id) return
    const cid = parseInt(id, 10)
    loadClient(cid)
    getClientPolicies(cid).then(setPolicies).catch(() => {})
    getClientPayments(cid).then(setPayments).catch(() => {})
    getClientDocuments(cid).then(setDocs).catch(() => {})
    getClientSms(cid).then(setSms).catch(() => {})
  }, [id])

  const openEdit = () => {
    if (!client) return
    setEditForm({
      firstName: client.firstName,
      lastName: client.lastName,
      cellphone: client.cellphone ?? client.phone ?? '',
      email: client.email ?? '',
      province: client.province ?? '',
      address1: client.address1 ?? '',
    })
    setSaveError('')
    setEditOpen(true)
  }

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setSaving(true)
    setSaveError('')
    try {
      const payload: UpdateClientPayload = {
        firstName: editForm.firstName || undefined,
        lastName: editForm.lastName || undefined,
        cellphone: editForm.cellphone || undefined,
        email: editForm.email || null,
        province: editForm.province || null,
        address1: editForm.address1 || null,
      }
      const updated = await updateClient(parseInt(id, 10), payload)
      setClient(updated)
      setEditOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save changes.'
      setSaveError(message)
    } finally {
      setSaving(false)
    }
  }

  const displayPhone = client?.cellphone ?? client?.phone ?? ''
  const displayProvince = client ? getProvinceLabel(client.province ?? '') : ''

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <button
        onClick={() => navigate('/admin/clients')}
        className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Clients
      </button>

      {/* Client info card */}
      {!client ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400">
          Loading client...
        </div>
      ) : (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-white">
              {client.firstName[0]}
              {client.lastName[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {client.firstName} {client.lastName}
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">ID: {client.idNumber}</p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                {displayPhone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    {displayPhone}
                  </span>
                )}
                {client.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {client.email}
                  </span>
                )}
                {client.province && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {displayProvince}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  {client.policyCount} policies
                </span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={openEdit}>
            Edit Client
          </Button>
        </div>
      </div>
      )}

      {/* Edit Client Modal */}
      <Modal
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Client"
        description="Update the client's details below."
      >
        <form onSubmit={handleEditSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">ID Number</label>
            <input
              value={client?.idNumber ?? ''}
              readOnly
              disabled
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-400">ID number cannot be changed.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">First Name</label>
              <input
                required
                value={editForm.firstName ?? ''}
                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Last Name</label>
              <input
                required
                value={editForm.lastName ?? ''}
                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
              <input
                value={editForm.cellphone ?? ''}
                onChange={(e) => setEditForm({ ...editForm, cellphone: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={editForm.email ?? ''}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Province</label>
            <select
              value={editForm.province ?? ''}
              onChange={(e) => setEditForm({ ...editForm, province: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select province...</option>
              {PROVINCE_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
            <input
              value={editForm.address1 ?? ''}
              onChange={(e) => setEditForm({ ...editForm, address1: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {saveError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Tabs */}
      <Tabs.Root defaultValue="policies">
        <Tabs.List className="flex border-b border-gray-200">
          <Tabs.Trigger value="policies" className={tabTriggerClass}>
            Policies ({policies.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="payments" className={tabTriggerClass}>
            Payments ({payments.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="documents" className={tabTriggerClass}>
            Documents ({docs.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="communications" className={tabTriggerClass}>
            SMS ({sms.length})
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="policies" className="mt-4">
          <DataTable data={policies} columns={policyColumns} pageSize={10} />
        </Tabs.Content>
        <Tabs.Content value="payments" className="mt-4">
          <DataTable data={payments} columns={paymentColumns} pageSize={10} />
        </Tabs.Content>
        <Tabs.Content value="documents" className="mt-4">
          <DataTable data={docs} columns={docColumns} pageSize={10} />
        </Tabs.Content>
        <Tabs.Content value="communications" className="mt-4">
          <DataTable data={sms} columns={smsColumns} pageSize={10} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

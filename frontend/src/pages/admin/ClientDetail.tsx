import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as Tabs from '@radix-ui/react-tabs'
import { ArrowLeft, Phone, Mail, MapPin, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import {
  getClient,
  getClientPolicies,
  getClientPayments,
  getClientDocuments,
  getClientSms,
  type Client,
  type Policy,
  type Payment,
  type WelcomePack,
  type SmsRecord,
} from '@/lib/api'

const demoClient: Client = {
  id: 1,
  firstName: 'John',
  lastName: 'Doe',
  idNumber: '9001015000080',
  phone: '0821234567',
  email: 'john.doe@email.com',
  province: 'Gauteng',
  address: '123 Main Street, Sandton',
  policyCount: 2,
  createdAt: '2024-11-15',
}

const demoPolicies: Policy[] = [
  { id: 1, policyNumber: 'POL-1234', clientId: 1, clientName: 'John Doe', productId: 1, productName: 'Family Cover', premiumAmount: 350, status: 'active', startDate: '2024-11-15', agentName: 'Sarah Mbeki', createdAt: '2024-11-15' },
  { id: 2, policyNumber: 'POL-1235', clientId: 1, clientName: 'John Doe', productId: 2, productName: 'Funeral Plan', premiumAmount: 150, status: 'active', startDate: '2025-01-10', agentName: 'Sarah Mbeki', createdAt: '2025-01-10' },
]

const demoPayments: Payment[] = [
  { id: 1, policyId: 1, policyNumber: 'POL-1234', amount: 350, status: 'paid', paymentDate: '2025-04-01', method: 'Debit Order', reference: 'REF-001' },
  { id: 2, policyId: 1, policyNumber: 'POL-1234', amount: 350, status: 'paid', paymentDate: '2025-03-01', method: 'Debit Order', reference: 'REF-002' },
  { id: 3, policyId: 2, policyNumber: 'POL-1235', amount: 150, status: 'pending', paymentDate: '2025-04-01', method: 'Debit Order' },
]

const demoDocs: WelcomePack[] = [
  { id: 1, clientId: 1, clientName: 'John Doe', productId: 1, productName: 'Family Cover', status: 'signed', sentAt: '2024-11-15', viewedAt: '2024-11-16', signedAt: '2024-11-16', downloadUrl: '#', createdAt: '2024-11-15' },
  { id: 2, clientId: 1, clientName: 'John Doe', productId: 2, productName: 'Funeral Plan', status: 'viewed', sentAt: '2025-01-10', viewedAt: '2025-01-11', createdAt: '2025-01-10' },
]

const demoSms: SmsRecord[] = [
  { id: 1, recipient: '0821234567', recipientName: 'John Doe', template: 'Welcome', message: 'Welcome to Lifesaver!', status: 'delivered', sentAt: '2024-11-15T10:00:00' },
  { id: 2, recipient: '0821234567', recipientName: 'John Doe', template: 'QA Verify', message: 'Please confirm your policy details.', status: 'delivered', sentAt: '2024-11-16T14:30:00' },
]

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
        <a href={r.downloadUrl} className="text-sm font-medium text-[#128FAF] hover:underline">
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
  'px-4 py-2.5 text-sm font-medium text-gray-500 data-[state=active]:text-[#128FAF] data-[state=active]:border-b-2 data-[state=active]:border-[#128FAF] hover:text-gray-700 transition-colors'

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [client, setClient] = useState<Client>(demoClient)
  const [policies, setPolicies] = useState<Policy[]>(demoPolicies)
  const [payments, setPayments] = useState<Payment[]>(demoPayments)
  const [docs, setDocs] = useState<WelcomePack[]>(demoDocs)
  const [sms, setSms] = useState<SmsRecord[]>(demoSms)

  useEffect(() => {
    if (!id) return
    const cid = parseInt(id, 10)
    getClient(cid).then(setClient).catch(() => {})
    getClientPolicies(cid).then(setPolicies).catch(() => {})
    getClientPayments(cid).then(setPayments).catch(() => {})
    getClientDocuments(cid).then(setDocs).catch(() => {})
    getClientSms(cid).then(setSms).catch(() => {})
  }, [id])

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
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#128FAF] text-xl font-bold text-white">
              {client.firstName[0]}
              {client.lastName[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {client.firstName} {client.lastName}
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">ID: {client.idNumber}</p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {client.phone}
                </span>
                {client.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {client.email}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {client.province}
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  {client.policyCount} policies
                </span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm">
            Edit Client
          </Button>
        </div>
      </div>

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

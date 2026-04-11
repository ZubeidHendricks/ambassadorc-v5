import { useState, useEffect } from 'react'
import { FileText, Download, Eye, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import {
  getWelcomePacks,
  generateWelcomePack,
  getClients,
  getProducts,
  type WelcomePack,
  type Client,
  type Product,
} from '@/lib/api'

const demoPacks: WelcomePack[] = [
  { id: 1, clientId: 1, clientName: 'John Doe', productId: 1, productName: 'Family Cover', status: 'signed', sentAt: '2024-11-15', viewedAt: '2024-11-16', signedAt: '2024-11-16', downloadUrl: '#', createdAt: '2024-11-15' },
  { id: 2, clientId: 1, clientName: 'John Doe', productId: 2, productName: 'Funeral Plan', status: 'viewed', sentAt: '2025-01-10', viewedAt: '2025-01-11', createdAt: '2025-01-10' },
  { id: 3, clientId: 2, clientName: 'Maria Santos', productId: 1, productName: 'Family Cover', status: 'sent', sentAt: '2025-03-01', createdAt: '2025-03-01' },
  { id: 4, clientId: 3, clientName: 'Sipho Ndlovu', productId: 2, productName: 'Funeral Plan', status: 'signed', sentAt: '2025-02-15', viewedAt: '2025-02-16', signedAt: '2025-02-17', downloadUrl: '#', createdAt: '2025-02-15' },
]

const demoClients: Client[] = [
  { id: 1, firstName: 'John', lastName: 'Doe', idNumber: '9001015000080', phone: '0821234567', province: 'Gauteng', policyCount: 2, createdAt: '2024-11-15' },
  { id: 2, firstName: 'Maria', lastName: 'Santos', idNumber: '8505125000081', phone: '0839876543', province: 'Western Cape', policyCount: 1, createdAt: '2024-12-03' },
  { id: 3, firstName: 'Sipho', lastName: 'Ndlovu', idNumber: '7803025000082', phone: '0711112222', province: 'KwaZulu-Natal', policyCount: 3, createdAt: '2025-01-10' },
]

const demoProducts: Product[] = [
  { id: 1, name: 'Family Cover', type: 'Life', active: true, premiumTiers: [], createdAt: '2024-06-01' },
  { id: 2, name: 'Funeral Plan', type: 'Funeral', active: true, premiumTiers: [], createdAt: '2024-07-15' },
  { id: 3, name: 'Accident Cover', type: 'Accident', active: false, premiumTiers: [], createdAt: '2024-08-20' },
]

export default function Documents() {
  const [packs, setPacks] = useState<WelcomePack[]>(demoPacks)
  const [clients, setClients] = useState<Client[]>(demoClients)
  const [products, setProducts] = useState<Product[]>(demoProducts)
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    getWelcomePacks().then(setPacks).catch(() => {})
    getClients().then(setClients).catch(() => {})
    getProducts().then(setProducts).catch(() => {})
  }, [])

  const handleGenerate = async () => {
    if (!selectedClient || !selectedProduct) return
    setGenerating(true)
    try {
      const pack = await generateWelcomePack({
        clientId: Number(selectedClient),
        productId: Number(selectedProduct),
      })
      setPacks((prev) => [pack, ...prev])
      setSelectedClient('')
      setSelectedProduct('')
    } catch {
      // handle
    } finally {
      setGenerating(false)
    }
  }

  const columns: Column<WelcomePack>[] = [
    {
      key: 'clientName',
      header: 'Client',
      render: (r) => <span className="font-medium text-gray-900">{r.clientName}</span>,
    },
    { key: 'productName', header: 'Product' },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'sentAt',
      header: 'Sent',
      render: (r) => r.sentAt ? new Date(r.sentAt).toLocaleDateString('en-ZA') : '-',
    },
    {
      key: 'viewedAt',
      header: 'Viewed',
      render: (r) => r.viewedAt ? new Date(r.viewedAt).toLocaleDateString('en-ZA') : '-',
    },
    {
      key: 'signedAt',
      header: 'Signed',
      render: (r) => r.signedAt ? new Date(r.signedAt).toLocaleDateString('en-ZA') : '-',
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      render: (r) => (
        <div className="flex items-center gap-1">
          {r.downloadUrl && (
            <a
              href={r.downloadUrl}
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg p-1.5 text-[#128FAF] hover:bg-[#128FAF]/10"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </a>
          )}
          <button
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="View"
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome Packs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Generate and manage welcome pack documents for clients.
        </p>
      </div>

      {/* Generate Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-gray-900">
          <FileText className="h-5 w-5 text-[#128FAF]" />
          <h2 className="text-base font-semibold">Generate Welcome Pack</h2>
        </div>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">Client</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
            >
              <option value="">Select client...</option>
              {clients.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.firstName} {c.lastName} ({c.idNumber})
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">Product</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
            >
              <option value="">Select product...</option>
              {products
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={!selectedClient || !selectedProduct || generating}
          >
            <Send className="h-4 w-4" />
            {generating ? 'Generating...' : 'Generate'}
          </Button>
        </div>
      </div>

      {/* Packs List */}
      <DataTable
        data={packs}
        columns={columns}
        pageSize={10}
        searchable
        searchPlaceholder="Search documents..."
        searchKeys={['clientName', 'productName']}
      />
    </div>
  )
}

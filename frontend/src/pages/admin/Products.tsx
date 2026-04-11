import { useState, useEffect } from 'react'
import { Plus, ChevronDown, ChevronUp, Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Modal } from '@/components/ui/modal'
import {
  getProducts,
  createProduct,
  requestPremiumChange,
  type Product,
  type CreateProductPayload,
  type RequestPremiumChangePayload,
} from '@/lib/api'

const demoProducts: Product[] = [
  {
    id: 1,
    name: 'Family Cover',
    type: 'Life',
    description: 'Comprehensive family life cover with funeral benefits.',
    active: true,
    premiumTiers: [
      { id: 1, productId: 1, tierName: 'Basic', premiumAmount: 150, coverAmount: 15000, active: true },
      { id: 2, productId: 1, tierName: 'Standard', premiumAmount: 250, coverAmount: 30000, active: true },
      { id: 3, productId: 1, tierName: 'Premium', premiumAmount: 450, coverAmount: 60000, active: true },
    ],
    createdAt: '2024-06-01',
  },
  {
    id: 2,
    name: 'Funeral Plan',
    type: 'Funeral',
    description: 'Affordable funeral cover for individuals and families.',
    active: true,
    premiumTiers: [
      { id: 4, productId: 2, tierName: 'Individual', premiumAmount: 80, coverAmount: 10000, active: true },
      { id: 5, productId: 2, tierName: 'Family', premiumAmount: 150, coverAmount: 20000, active: true },
    ],
    createdAt: '2024-07-15',
  },
  {
    id: 3,
    name: 'Accident Cover',
    type: 'Accident',
    description: 'Personal accident cover.',
    active: false,
    premiumTiers: [
      { id: 6, productId: 3, tierName: 'Standard', premiumAmount: 120, coverAmount: 25000, active: true },
    ],
    createdAt: '2024-08-20',
  },
]

export default function Products() {
  const [products, setProducts] = useState<Product[]>(demoProducts)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [productModal, setProductModal] = useState(false)
  const [premiumModal, setPremiumModal] = useState(false)
  const [selectedTier, setSelectedTier] = useState<{
    productId: number
    tierId: number
    tierName: string
    currentAmount: number
  } | null>(null)
  const [newPremium, setNewPremium] = useState(0)
  const [effectiveDate, setEffectiveDate] = useState('')
  const [productForm, setProductForm] = useState<CreateProductPayload>({
    name: '',
    type: '',
    description: '',
    active: true,
    premiumTiers: [],
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getProducts().then(setProducts).catch(() => {})
  }, [])

  const openPremiumChange = (
    productId: number,
    tierId: number,
    tierName: string,
    currentAmount: number
  ) => {
    setSelectedTier({ productId, tierId, tierName, currentAmount })
    setNewPremium(currentAmount)
    setEffectiveDate('')
    setPremiumModal(true)
  }

  const handlePremiumSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTier) return
    setSaving(true)
    try {
      const payload: RequestPremiumChangePayload = {
        productId: selectedTier.productId,
        tierId: selectedTier.tierId,
        newAmount: newPremium,
        effectiveDate,
      }
      await requestPremiumChange(payload)
      setPremiumModal(false)
    } catch {
      // handle
    } finally {
      setSaving(false)
    }
  }

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createProduct(productForm)
      setProductModal(false)
      setProductForm({ name: '', type: '', description: '', active: true, premiumTiers: [] })
      const data = await getProducts()
      setProducts(data)
    } catch {
      // handle
    } finally {
      setSaving(false)
    }
  }

  const changePercent = selectedTier
    ? (((newPremium - selectedTier.currentAmount) / selectedTier.currentAmount) * 100).toFixed(1)
    : '0'

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage insurance products and premium tiers.
          </p>
        </div>
        <Button onClick={() => setProductModal(true)}>
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={product.type} />
                    <StatusBadge status={product.active ? 'active' : 'inactive'} />
                  </div>
                </div>
                <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>
              {product.description && (
                <p className="mt-2 text-sm text-gray-500">{product.description}</p>
              )}
              <div className="mt-3 text-sm text-gray-600">
                <span className="font-medium">{product.premiumTiers.length}</span> tier
                {product.premiumTiers.length !== 1 ? 's' : ''} | From{' '}
                <span className="font-medium">
                  R{Math.min(...product.premiumTiers.map((t) => t.premiumAmount))}
                </span>{' '}
                /mo
              </div>
              <button
                onClick={() => setExpanded(expanded === product.id ? null : product.id)}
                className="mt-3 flex items-center gap-1 text-xs font-medium text-[#128FAF] hover:underline"
              >
                {expanded === product.id ? 'Hide' : 'View'} tiers
                {expanded === product.id ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {expanded === product.id && (
              <div className="border-t border-gray-100 p-5 pt-4">
                <div className="space-y-3">
                  {product.premiumTiers.map((tier) => (
                    <div
                      key={tier.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{tier.tierName}</p>
                        <p className="text-xs text-gray-500">Cover: R{tier.coverAmount.toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-gray-900">
                          R{tier.premiumAmount}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            openPremiumChange(product.id, tier.id, tier.tierName, tier.premiumAmount)
                          }
                        >
                          Adjust
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Premium Change Modal */}
      <Modal
        open={premiumModal}
        onOpenChange={setPremiumModal}
        title="Adjust Premium"
        description={selectedTier ? `Adjusting premium for ${selectedTier.tierName} tier.` : ''}
      >
        {selectedTier && (
          <form onSubmit={handlePremiumSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                New Premium Amount (R)
              </label>
              <input
                type="range"
                min={Math.round(selectedTier.currentAmount * 0.5)}
                max={Math.round(selectedTier.currentAmount * 2)}
                step={5}
                value={newPremium}
                onChange={(e) => setNewPremium(Number(e.target.value))}
                className="w-full accent-[#128FAF]"
              />
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  value={newPremium}
                  onChange={(e) => setNewPremium(Number(e.target.value))}
                  className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
                />
                <span
                  className={`text-sm font-semibold ${Number(changePercent) > 0 ? 'text-red-600' : Number(changePercent) < 0 ? 'text-emerald-600' : 'text-gray-500'}`}
                >
                  {Number(changePercent) > 0 ? '+' : ''}
                  {changePercent}%
                </span>
                <span className="text-xs text-gray-400">
                  from R{selectedTier.currentAmount}
                </span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Effective Date
              </label>
              <input
                type="date"
                required
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
              />
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-sm text-amber-700">
                This change will be submitted for approval and may affect active policies on this tier.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setPremiumModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || newPremium === selectedTier.currentAmount}>
                {saving ? 'Submitting...' : 'Submit Change'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Product Modal */}
      <Modal
        open={productModal}
        onOpenChange={setProductModal}
        title="Add Product"
        description="Create a new insurance product."
      >
        <form onSubmit={handleProductSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Product Name</label>
            <input
              required
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
            <select
              required
              value={productForm.type}
              onChange={(e) => setProductForm({ ...productForm, type: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
            >
              <option value="">Select type...</option>
              <option value="Life">Life</option>
              <option value="Funeral">Funeral</option>
              <option value="Accident">Accident</option>
              <option value="Health">Health</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#128FAF] focus:outline-none focus:ring-2 focus:ring-[#128FAF]/20"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setProductModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create Product'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

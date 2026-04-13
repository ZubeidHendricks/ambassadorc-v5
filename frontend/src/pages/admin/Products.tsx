import { useState, useEffect, useCallback } from 'react'
import { Plus, ChevronDown, ChevronUp, Edit2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Modal } from '@/components/ui/modal'
import {
  getProducts,
  createProduct,
  updateProduct,
  requestPremiumChange,
  type Product,
  type CreateProductPayload,
  type RequestPremiumChangePayload,
  type PaginationInfo,
} from '@/lib/api'

const PAGE_SIZE = 20

const PRODUCT_TYPES = [
  { value: 'LEGAL', label: 'Legal' },
  { value: 'LIFE_COVER', label: 'Life Cover' },
  { value: 'SOS', label: 'SOS' },
  { value: 'FIVE_IN_ONE', label: 'Five-In-One' },
  { value: 'SHORT_TERM', label: 'Short Term' },
  { value: 'CONSULT', label: 'Consult' },
]

const TYPE_LABELS: Record<string, string> = {
  LEGAL: 'Legal',
  LIFE_COVER: 'Life Cover',
  SOS: 'SOS',
  FIVE_IN_ONE: 'Five-In-One',
  SHORT_TERM: 'Short Term',
  CONSULT: 'Consult',
  STANDARD: 'Standard',
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 })
  const [expanded, setExpanded] = useState<number | null>(null)

  // Add Product modal
  const [productModal, setProductModal] = useState(false)
  const [productForm, setProductForm] = useState<CreateProductPayload>({
    name: '',
    type: 'LEGAL',
    description: '',
    premiumAmount: 129,
  })

  // Edit Product modal
  const [editModal, setEditModal] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [editForm, setEditForm] = useState<CreateProductPayload & { isActive?: boolean }>({
    name: '',
    type: 'LEGAL',
    description: '',
    premiumAmount: 129,
    isActive: true,
  })

  // Premium Change modal
  const [premiumModal, setPremiumModal] = useState(false)
  const [selectedTier, setSelectedTier] = useState<{
    productId: number
    tierId: number
    tierName: string
    currentAmount: number
  } | null>(null)
  const [newPremium, setNewPremium] = useState(0)
  const [effectiveDate, setEffectiveDate] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    try {
      const result = await getProducts(page, PAGE_SIZE)
      setProducts(result.data)
      setPagination(result.pagination)
    } catch {
      // handle silently
    }
  }, [page])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const openEdit = (product: Product) => {
    setEditProduct(product)
    setEditForm({
      name: product.name,
      type: product.type,
      description: product.description ?? '',
      premiumAmount: product.premiumAmount ?? 129,
      isActive: product.active,
    })
    setError(null)
    setEditModal(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editProduct) return
    setSaving(true)
    setError(null)
    try {
      await updateProduct(editProduct.id, {
        name: editForm.name,
        type: editForm.type,
        description: editForm.description || undefined,
        premiumAmount: editForm.premiumAmount,
        isActive: editForm.isActive,
      })
      setEditModal(false)
      loadProducts()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update product.')
    } finally {
      setSaving(false)
    }
  }

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createProduct(productForm)
      setProductModal(false)
      setProductForm({ name: '', type: 'LEGAL', description: '', premiumAmount: 129 })
      loadProducts()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create product.')
    } finally {
      setSaving(false)
    }
  }

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

  const changePercent = selectedTier
    ? (((newPremium - selectedTier.currentAmount) / selectedTier.currentAmount) * 100).toFixed(1)
    : '0'

  const minPremium = (tiers: Product['premiumTiers']) =>
    tiers.length > 0 ? Math.min(...tiers.map((t) => t.premiumAmount)) : null

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage insurance products and premium tiers.
          </p>
        </div>
        <Button onClick={() => { setError(null); setProductModal(true) }}>
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const lowestPremium = minPremium(product.premiumTiers)
          return (
            <div
              key={product.id}
              className="rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge status={TYPE_LABELS[product.type] ?? product.type} />
                      <StatusBadge status={product.active ? 'active' : 'inactive'} />
                    </div>
                  </div>
                  <button
                    onClick={() => openEdit(product)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Edit product"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>

                {product.description && (
                  <p className="mt-2 text-sm text-gray-500">{product.description}</p>
                )}

                <div className="mt-3 text-sm text-gray-600">
                  {product.premiumTiers.length > 0 ? (
                    <>
                      <span className="font-medium">{product.premiumTiers.length}</span> tier
                      {product.premiumTiers.length !== 1 ? 's' : ''} | From{' '}
                      <span className="font-medium">R{lowestPremium}</span> /mo
                    </>
                  ) : (
                    <>
                      No tiers configured | Base:{' '}
                      <span className="font-medium">R{product.premiumAmount ?? 129}</span> /mo
                    </>
                  )}
                </div>

                {product.premiumTiers.length > 0 && (
                  <button
                    onClick={() => setExpanded(expanded === product.id ? null : product.id)}
                    className="mt-3 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {expanded === product.id ? 'Hide' : 'View'} tiers
                    {expanded === product.id ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>

              {expanded === product.id && product.premiumTiers.length > 0 && (
                <div className="border-t border-gray-100 p-5 pt-4">
                  <div className="space-y-3">
                    {product.premiumTiers.map((tier) => (
                      <div
                        key={tier.id}
                        className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{tier.tierName}</p>
                          {tier.coverAmount > 0 && (
                            <p className="text-xs text-gray-500">Cover: R{tier.coverAmount.toLocaleString()}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-gray-900">R{tier.premiumAmount}</span>
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
          )
        })}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500">
            Showing {(pagination.page - 1) * PAGE_SIZE + 1}–
            {Math.min(pagination.page * PAGE_SIZE, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page === 1}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-sm text-gray-600">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page === pagination.totalPages}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Edit Product Modal ─────────────────────────────────────── */}
      <Modal
        open={editModal}
        onOpenChange={(open) => { setEditModal(open); setError(null) }}
        title="Edit Product"
        description={editProduct ? `Editing "${editProduct.name}"` : ''}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Product Name</label>
            <input
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
            <select
              required
              value={editForm.type}
              onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {PRODUCT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Base Premium (R)</label>
            <input
              type="number"
              min={0}
              step={1}
              required
              value={editForm.premiumAmount}
              onChange={(e) => setEditForm({ ...editForm, premiumAmount: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="editActive"
              checked={editForm.isActive !== false}
              onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary"
            />
            <label htmlFor="editActive" className="text-sm font-medium text-gray-700">Active</label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditModal(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Add Product Modal ──────────────────────────────────────── */}
      <Modal
        open={productModal}
        onOpenChange={(open) => { setProductModal(open); setError(null) }}
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
            <select
              required
              value={productForm.type}
              onChange={(e) => setProductForm({ ...productForm, type: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {PRODUCT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Base Premium (R)</label>
            <input
              type="number"
              min={0}
              step={1}
              required
              value={productForm.premiumAmount}
              onChange={(e) => setProductForm({ ...productForm, premiumAmount: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setProductModal(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create Product'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Premium Change Modal ───────────────────────────────────── */}
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
                className="w-full accent-primary"
              />
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  value={newPremium}
                  onChange={(e) => setNewPremium(Number(e.target.value))}
                  className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <span
                  className={`text-sm font-semibold ${Number(changePercent) > 0 ? 'text-red-600' : Number(changePercent) < 0 ? 'text-emerald-600' : 'text-gray-500'}`}
                >
                  {Number(changePercent) > 0 ? '+' : ''}{changePercent}%
                </span>
                <span className="text-xs text-gray-400">from R{selectedTier.currentAmount}</span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Effective Date</label>
              <input
                type="date"
                required
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-sm text-amber-700">
                This change will be submitted for approval and may affect active policies on this tier.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setPremiumModal(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || newPremium === selectedTier.currentAmount}>
                {saving ? 'Submitting...' : 'Submit Change'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}

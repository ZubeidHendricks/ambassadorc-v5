import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, Info } from 'lucide-react'
import {
  getProducts,
  updateProduct,
  type Product,
} from '@/lib/api'

type WorksheetProduct = {
  productName: string
  currentPremium: number
}

type PremiumDraft = {
  premium: string
  effectiveDate: string
  status: string
  error: string
}

const worksheetProducts: WorksheetProduct[] = [
  { productName: 'Lifesaver 24 Basic', currentPremium: 259 },
  { productName: 'Lifesaver 24 Plus', currentPremium: 349 },
  { productName: 'Lifesaver legal Basic', currentPremium: 179 },
  { productName: 'Lifesaver legal Plus', currentPremium: 299 },
]

function normalizeProductName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function createInitialDrafts() {
  return Object.fromEntries(
    worksheetProducts.map((product) => [
      product.productName,
      { premium: '', effectiveDate: '', status: '', error: '' },
    ])
  ) as Record<string, PremiumDraft>
}

function productMatches(product: Product, worksheetProduct: WorksheetProduct) {
  return normalizeProductName(product.name) === normalizeProductName(worksheetProduct.productName)
}

export default function PremiumChanges() {
  const [products, setProducts] = useState<Product[]>([])
  const [drafts, setDrafts] = useState<Record<string, PremiumDraft>>(createInitialDrafts)
  const [loading, setLoading] = useState(true)
  const [savingProduct, setSavingProduct] = useState('')

  useEffect(() => {
    getProducts(1, 100)
      .then((result) => setProducts(result.data))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [])

  const rows = useMemo(() => {
    return worksheetProducts.map((worksheetProduct) => {
      const matchedProduct = products.find((product) => productMatches(product, worksheetProduct))
      return {
        ...worksheetProduct,
        product: matchedProduct,
        currentPremium: matchedProduct?.premiumAmount ?? worksheetProduct.currentPremium,
      }
    })
  }, [products])

  function updateDraft(productName: string, updates: Partial<PremiumDraft>) {
    setDrafts((current) => ({
      ...current,
      [productName]: {
        ...current[productName],
        ...updates,
        status: updates.status ?? current[productName].status,
        error: updates.error ?? current[productName].error,
      },
    }))
  }

  async function handleUpdate(row: WorksheetProduct & { product?: Product }) {
    const draft = drafts[row.productName]
    const nextPremium = Number(draft.premium)
    if (!draft.premium || !Number.isFinite(nextPremium) || nextPremium <= 0) {
      updateDraft(row.productName, { error: 'Enter a valid new premium amount.', status: '' })
      return
    }
    if (!draft.effectiveDate) {
      updateDraft(row.productName, { error: 'Select an effective date.', status: '' })
      return
    }
    if (!row.product) {
      updateDraft(row.productName, { error: 'Product not yet linked to the product table.', status: '' })
      return
    }

    setSavingProduct(row.productName)
    updateDraft(row.productName, { error: '', status: '' })
    try {
      const updated = await updateProduct(row.product.id, { premiumAmount: nextPremium })
      setProducts((current) => current.map((product) => (product.id === updated.id ? updated : product)))
      updateDraft(row.productName, { premium: '', status: `Updated — effective ${new Date(draft.effectiveDate).toLocaleDateString('en-ZA')}` })
    } catch {
      updateDraft(row.productName, { error: 'Could not update this premium. Please try again.', status: '' })
    } finally {
      setSavingProduct('')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">

      {/* Page header */}
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Foxbill Premium Management</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Update product premium rates. Changes take effect on the selected date.
          </p>
        </div>
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_130px_160px_200px_120px] gap-0 border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Product</span>
          <span className="text-right">Current (R)</span>
          <span className="pl-3">New Premium (R)</span>
          <span className="pl-3">Effective Date</span>
          <span className="text-center">Action</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-400">Loading products…</div>
          ) : (
            rows.map((row) => {
              const draft = drafts[row.productName]
              const saving = savingProduct === row.productName
              const hasChange = draft.premium && Number(draft.premium) !== row.currentPremium

              return (
                <div
                  key={row.productName}
                  className="grid grid-cols-[1fr_130px_160px_200px_120px] items-center gap-0 px-4 py-3 transition-colors hover:bg-gray-50/60"
                >
                  {/* Product name */}
                  <div>
                    <p className="text-sm font-medium text-gray-800">{row.productName}</p>
                    {!row.product && (
                      <span className="mt-0.5 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        Not linked
                      </span>
                    )}
                  </div>

                  {/* Current premium */}
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      R {row.currentPremium.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* New premium input */}
                  <div className="pl-3">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">R</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.premium}
                        onChange={(e) => updateDraft(row.productName, { premium: e.target.value, error: '', status: '' })}
                        placeholder="0.00"
                        className="h-9 w-full rounded-lg border border-gray-200 pl-6 pr-2 text-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        aria-label={`${row.productName} new premium`}
                      />
                    </div>
                    {hasChange && (
                      <p className="mt-0.5 text-[10px] text-gray-400">
                        was R {row.currentPremium.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>

                  {/* Effective date input */}
                  <div className="pl-3">
                    <input
                      type="date"
                      value={draft.effectiveDate}
                      onChange={(e) => updateDraft(row.productName, { effectiveDate: e.target.value, error: '', status: '' })}
                      className="h-9 w-full rounded-lg border border-gray-200 px-2.5 text-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      aria-label={`${row.productName} effective date`}
                    />
                  </div>

                  {/* Action */}
                  <div className="flex flex-col items-center gap-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleUpdate(row)}
                      disabled={loading || saving}
                      className="inline-flex h-8 items-center rounded-lg bg-primary px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? (
                        <span className="flex items-center gap-1.5">
                          <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Saving
                        </span>
                      ) : 'Update'}
                    </button>

                    {draft.error && (
                      <p className="max-w-[110px] text-center text-[10px] leading-tight text-red-600">
                        {draft.error}
                      </p>
                    )}
                    {draft.status && (
                      <p className="max-w-[110px] text-center text-[10px] leading-tight text-emerald-600">
                        {draft.status}
                      </p>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Help text */}
      <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        <p>
          Enter the new premium amount and an effective date, then click <strong>Update</strong> to apply the change to the Foxbill product record.
        </p>
      </div>

    </div>
  )
}

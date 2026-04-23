import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, Info, Link2, CheckCircle2 } from 'lucide-react'
import {
  getProducts,
  updateProduct,
  type Product,
} from '@/lib/api'

const STORAGE_KEY = 'foxbill_product_links'

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
    worksheetProducts.map((p) => [
      p.productName,
      { premium: '', effectiveDate: '', status: '', error: '' },
    ])
  ) as Record<string, PremiumDraft>
}

function loadSavedLinks(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function productAutoMatch(product: Product, worksheetProduct: WorksheetProduct) {
  return normalizeProductName(product.name) === normalizeProductName(worksheetProduct.productName)
}

export default function PremiumChanges() {
  const [products, setProducts] = useState<Product[]>([])
  const [drafts, setDrafts] = useState<Record<string, PremiumDraft>>(createInitialDrafts)
  const [loading, setLoading] = useState(true)
  const [savingProduct, setSavingProduct] = useState('')
  // Manual product links: worksheetProductName → DB product id
  const [manualLinks, setManualLinks] = useState<Record<string, number>>(loadSavedLinks)

  useEffect(() => {
    getProducts(1, 100)
      .then((result) => setProducts(result.data))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [])

  const rows = useMemo(() => {
    return worksheetProducts.map((wp) => {
      const autoMatch = products.find((p) => productAutoMatch(p, wp))
      const manualMatch = manualLinks[wp.productName]
        ? products.find((p) => p.id === manualLinks[wp.productName])
        : undefined
      const linked = autoMatch ?? manualMatch
      return {
        ...wp,
        product: linked,
        currentPremium: linked?.premiumAmount ?? wp.currentPremium,
        isManualLink: !autoMatch && !!manualMatch,
      }
    })
  }, [products, manualLinks])

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

  function linkProduct(worksheetName: string, dbProductId: number) {
    const next = { ...manualLinks, [worksheetName]: dbProductId }
    setManualLinks(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    updateDraft(worksheetName, { error: '', status: '' })
  }

  function unlinkProduct(worksheetName: string) {
    const next = { ...manualLinks }
    delete next[worksheetName]
    setManualLinks(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
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
      updateDraft(row.productName, { error: 'Link this product to a database product first.', status: '' })
      return
    }

    setSavingProduct(row.productName)
    updateDraft(row.productName, { error: '', status: '' })
    try {
      const updated = await updateProduct(row.product.id, { premiumAmount: nextPremium })
      setProducts((current) => current.map((p) => (p.id === updated.id ? updated : p)))
      updateDraft(row.productName, {
        premium: '',
        status: `Updated — effective ${new Date(draft.effectiveDate).toLocaleDateString('en-ZA')}`,
      })
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
        <div className="grid grid-cols-[1fr_150px_170px_200px_120px] gap-0 border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Product</span>
          <span className="text-right pr-2">Current (R)</span>
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
              const isLinked = !!row.product

              return (
                <div key={row.productName} className="transition-colors hover:bg-gray-50/60">

                  {/* Main row */}
                  <div className="grid grid-cols-[1fr_150px_170px_200px_120px] items-center gap-0 px-4 py-3">

                    {/* Product name + link status */}
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{row.productName}</p>
                        {isLinked ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-600 mt-0.5">
                            <CheckCircle2 className="h-3 w-3" />
                            Linked to: <span className="font-medium">{row.product!.name}</span>
                            {row.isManualLink && (
                              <button
                                onClick={() => unlinkProduct(row.productName)}
                                className="ml-1 text-gray-400 hover:text-red-500 underline"
                              >
                                unlink
                              </button>
                            )}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-amber-600 mt-0.5">
                            <Link2 className="h-3 w-3" />
                            Not linked — select below
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Current premium */}
                    <div className="text-right pr-2">
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
                          disabled={!isLinked}
                          className="h-9 w-full rounded-lg border border-gray-200 pl-6 pr-2 text-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
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
                        disabled={!isLinked}
                        className="h-9 w-full rounded-lg border border-gray-200 px-2.5 text-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                        aria-label={`${row.productName} effective date`}
                      />
                    </div>

                    {/* Action */}
                    <div className="flex flex-col items-center gap-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleUpdate(row)}
                        disabled={loading || saving || !isLinked}
                        className="inline-flex h-8 items-center rounded-lg bg-primary px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
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
                        <p className="max-w-[110px] text-center text-[10px] leading-tight text-red-600">{draft.error}</p>
                      )}
                      {draft.status && (
                        <p className="max-w-[110px] text-center text-[10px] leading-tight text-emerald-600">{draft.status}</p>
                      )}
                    </div>
                  </div>

                  {/* Link picker — shown only when not linked */}
                  {!isLinked && !loading && (
                    <div className="flex items-center gap-3 border-t border-dashed border-amber-200 bg-amber-50/60 px-4 py-2.5">
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span className="text-xs text-amber-700 whitespace-nowrap">Link to database product:</span>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const id = Number(e.target.value)
                          if (id) linkProduct(row.productName, id)
                        }}
                        className="h-7 flex-1 rounded-md border border-amber-200 bg-white px-2 text-xs text-gray-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                      >
                        <option value="" disabled>— select a product —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (R {Number(p.premiumAmount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

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
          If a product shows <strong>Not linked</strong>, select the matching database product from the dropdown — this is saved automatically. Once linked, enter a new premium and an effective date, then click <strong>Update</strong>.
        </p>
      </div>

    </div>
  )
}

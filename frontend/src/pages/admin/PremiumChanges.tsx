import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
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
      updateDraft(row.productName, { error: 'Enter a valid Change Premium amount.', status: '' })
      return
    }
    if (!draft.effectiveDate) {
      updateDraft(row.productName, { error: 'Select an Effective Date.', status: '' })
      return
    }
    if (!row.product) {
      updateDraft(row.productName, { error: 'This Foxbill product is not linked to the product table yet.', status: '' })
      return
    }

    setSavingProduct(row.productName)
    updateDraft(row.productName, { error: '', status: '' })
    try {
      const updated = await updateProduct(row.product.id, { premiumAmount: nextPremium })
      setProducts((current) => current.map((product) => (product.id === updated.id ? updated : product)))
      updateDraft(row.productName, { premium: '', status: `Updated effective ${new Date(draft.effectiveDate).toLocaleDateString('en-ZA')}` })
    } catch {
      updateDraft(row.productName, { error: 'Could not update this premium. Please try again.', status: '' })
    } finally {
      setSavingProduct('')
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3">
          <p className="text-sm font-medium uppercase tracking-wide text-gray-900">
            NICOLE CAN MANAGE "FOXBILL" PREMIUM INCREASES FROM HERE
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-r border-gray-200 px-3 py-8 text-left text-sm font-bold uppercase tracking-wide text-gray-900" colSpan={6}>
                  UPDATE PRODUCT PREMIUM
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const draft = drafts[row.productName]
                const saving = savingProduct === row.productName
                return (
                  <tr key={row.productName} className={index === 2 ? 'border-t border-gray-200' : ''}>
                    <td className="w-[34%] border-r border-gray-200 px-3 py-2 text-gray-900">{row.productName}</td>
                    <td className="w-20 border-r border-gray-200 px-3 py-2 text-right text-gray-900">{row.currentPremium.toLocaleString('en-ZA')}</td>
                    <td className="w-36 border-r border-gray-200 px-3 py-2 text-gray-900">Change Premium</td>
                    <td className="w-32 border-r border-gray-200 px-0 py-0">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.premium}
                        onChange={(event) => updateDraft(row.productName, { premium: event.target.value, error: '', status: '' })}
                        className="h-11 w-full border-2 border-gray-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        aria-label={`${row.productName} Change Premium`}
                      />
                    </td>
                    <td className="w-44 border-r border-gray-200 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="whitespace-nowrap text-gray-900">Effective Date</span>
                        <input
                          type="date"
                          value={draft.effectiveDate}
                          onChange={(event) => updateDraft(row.productName, { effectiveDate: event.target.value, error: '', status: '' })}
                          className="h-9 min-w-36 rounded border border-gray-300 px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          aria-label={`${row.productName} Effective Date`}
                        />
                      </div>
                    </td>
                    <td className="w-28 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleUpdate(row)}
                        disabled={loading || saving}
                        className="font-semibold uppercase tracking-wide text-yellow-600 hover:text-yellow-700 disabled:cursor-not-allowed disabled:text-gray-400"
                      >
                        {saving ? 'UPDATING' : 'UPDATE'}
                      </button>
                      {(draft.error || draft.status) && (
                        <p className={`mt-1 text-xs ${draft.error ? 'text-red-600' : 'text-emerald-600'}`}>
                          {draft.error || draft.status}
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <span className="font-semibold">Foxbill premium workflow:</span> enter the new premium, choose the effective date, then select UPDATE for the product row Nicole is changing.
      </div>
    </div>
  )
}
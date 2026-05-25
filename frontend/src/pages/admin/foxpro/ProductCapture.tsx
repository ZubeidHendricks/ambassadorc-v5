import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, CheckCircle2, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FoxHeader } from './FoxHeader'
import { checkSaId } from '@/lib/saId'
import {
  getFoxCaptureProducts,
  foxCapture,
  type FoxProduct,
  type FoxDependant,
  type FoxCapturePayload,
} from '@/lib/api'

const PROVINCES = [
  ['EASTERN_CAPE', 'Eastern Cape'], ['FREE_STATE', 'Free State'], ['GAUTENG', 'Gauteng'],
  ['KWAZULU_NATAL', 'KwaZulu-Natal'], ['LIMPOPO', 'Limpopo'], ['MPUMALANGA', 'Mpumalanga'],
  ['NORTH_WEST', 'North West'], ['NORTHERN_CAPE', 'Northern Cape'], ['WESTERN_CAPE', 'Western Cape'],
] as const

const blank: FoxCapturePayload = {
  productCode: '', tierName: '', collectionMethod: 'DEBIT_ORDER', source: '',
  title: '', firstName: '', lastName: '', idNumber: '', cellphone: '', email: '',
  address1: '', addressCode: '', province: '', firstDebitDate: '',
  department: '', persalNumber: '', bankName: '', accountNumber: '', branchCode: '', accountType: '',
  dependants: [],
}

const field = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F26522] focus:outline-none focus:ring-2 focus:ring-[#F26522]/20'
const lbl = 'mb-1 block text-xs font-medium text-gray-600'

export default function ProductCapture() {
  const [products, setProducts] = useState<FoxProduct[]>([])
  const [form, setForm] = useState<FoxCapturePayload>(blank)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    getFoxCaptureProducts().then(setProducts).catch(() => setProducts([]))
  }, [])

  const product = useMemo(() => products.find((p) => p.code === form.productCode), [products, form.productCode])
  const premium = useMemo(() => product?.variants.find((v) => v.tierName === form.tierName)?.premium, [product, form.tierName])
  const idCheck = useMemo(() => (form.idNumber ? checkSaId(form.idNumber) : null), [form.idNumber])
  const mobileOk = /^0\d{9}$/.test(form.cellphone)

  const set = (k: keyof FoxCapturePayload, v: any) => setForm((f) => ({ ...f, [k]: v }))

  const setProduct = (code: string) => {
    const p = products.find((x) => x.code === code)
    setForm((f) => ({
      ...f,
      productCode: code,
      tierName: p?.variants[0]?.tierName ?? '',
      collectionMethod: p?.methods[0] ?? 'DEBIT_ORDER',
    }))
  }

  const addDependant = () => set('dependants', [...(form.dependants ?? []), { name: '', relationship: '', dateOfBirth: '' }])
  const updateDependant = (i: number, patch: Partial<FoxDependant>) =>
    set('dependants', (form.dependants ?? []).map((d, j) => (j === i ? { ...d, ...patch } : d)))
  const removeDependant = (i: number) => set('dependants', (form.dependants ?? []).filter((_, j) => j !== i))

  const canSubmit =
    !!form.productCode && !!form.tierName && !!form.firstName && !!form.lastName &&
    idCheck?.valid && mobileOk &&
    (form.collectionMethod === 'PERSAL' ? !!form.department && !!form.persalNumber : !!form.bankName && !!form.accountNumber)

  const submit = async () => {
    setSubmitting(true)
    setResult(null)
    try {
      const payload: FoxCapturePayload = {
        ...form,
        email: form.email || undefined,
        province: form.province || undefined,
        firstDebitDate: form.firstDebitDate || undefined,
        dependants: (form.dependants ?? []).filter((d) => d.name.trim()),
      }
      const r = await foxCapture(payload)
      setResult({ ok: true, message: r.message })
      setForm(blank)
    } catch (e: any) {
      setResult({ ok: false, message: e?.message || 'Capture failed.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <FoxHeader
        title="Product Capture"
        subtitle="Capture a new sale for any product line. The ID number and mobile are validated, then the sale is submitted into the QA Bay with a 'T' status for the second check."
      />

      {result && (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {result.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {result.message}
        </div>
      )}

      {/* Product & plan */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">Product &amp; Plan</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={lbl}>Product</label>
            <select className={field} value={form.productCode} onChange={(e) => setProduct(e.target.value)}>
              <option value="">Select product…</option>
              {products.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Plan / Tier</label>
            <select className={field} value={form.tierName} onChange={(e) => set('tierName', e.target.value)} disabled={!product}>
              {product?.variants.map((v) => <option key={v.tierName} value={v.tierName}>{v.tierName} — R{v.premium}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Collection Method</label>
            <select className={field} value={form.collectionMethod} onChange={(e) => set('collectionMethod', e.target.value)} disabled={!product}>
              {product?.methods.map((m) => <option key={m} value={m}>{m === 'PERSAL' ? 'Persal (Q-Link)' : 'Debit Order (Netcash)'}</option>)}
            </select>
          </div>
        </div>
        {premium != null && (
          <p className="mt-3 text-sm text-gray-600">Monthly premium: <span className="font-bold text-[#F26522]">R{premium}</span></p>
        )}
      </section>

      {/* Client details */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">Client Details</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={lbl}>Title</label>
            <input className={field} value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="Mr / Mrs / Ms" />
          </div>
          <div>
            <label className={lbl}>First Name *</label>
            <input className={field} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Surname *</label>
            <input className={field} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
          </div>
          <div className="lg:col-span-2">
            <label className={lbl}>ID Number * <span className="text-gray-400">(13 digits)</span></label>
            <input
              className={`${field} ${form.idNumber && idCheck && !idCheck.valid ? 'border-red-400' : idCheck?.valid ? 'border-emerald-400' : ''}`}
              value={form.idNumber}
              maxLength={13}
              inputMode="numeric"
              onChange={(e) => set('idNumber', e.target.value.replace(/\D/g, ''))}
            />
            {idCheck && (
              <p className={`mt-1 flex items-center gap-1 text-xs ${idCheck.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                {idCheck.valid ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                {idCheck.valid ? `Valid · ${idCheck.gender} · DOB ${idCheck.dateOfBirth} · age ${idCheck.age} · ${idCheck.citizenship}` : idCheck.reason}
              </p>
            )}
          </div>
          <div>
            <label className={lbl}>Cellphone *</label>
            <input
              className={`${field} ${form.cellphone && !mobileOk ? 'border-red-400' : form.cellphone ? 'border-emerald-400' : ''}`}
              value={form.cellphone}
              maxLength={10}
              inputMode="numeric"
              onChange={(e) => set('cellphone', e.target.value.replace(/\D/g, ''))}
              placeholder="0XXXXXXXXX"
            />
            {form.cellphone && !mobileOk && <p className="mt-1 text-xs text-red-600">Must be 10 digits starting with 0</p>}
          </div>
          <div>
            <label className={lbl}>Email</label>
            <input className={field} value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Province</label>
            <select className={field} value={form.province ?? ''} onChange={(e) => set('province', e.target.value)}>
              <option value="">—</option>
              {PROVINCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className={lbl}>Address</label>
            <input className={field} value={form.address1 ?? ''} onChange={(e) => set('address1', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Postal Code</label>
            <input className={field} value={form.addressCode ?? ''} onChange={(e) => set('addressCode', e.target.value)} />
          </div>
        </div>
      </section>

      {/* Collection details */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">
          {form.collectionMethod === 'PERSAL' ? 'Persal (Q-Link) Details' : 'Debit Order (Netcash) Details'}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {form.collectionMethod === 'PERSAL' ? (
            <>
              <div>
                <label className={lbl}>Department *</label>
                <input className={field} value={form.department ?? ''} onChange={(e) => set('department', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Persal / Employee No *</label>
                <input className={field} value={form.persalNumber ?? ''} onChange={(e) => set('persalNumber', e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className={lbl}>Bank *</label>
                <input className={field} value={form.bankName ?? ''} onChange={(e) => set('bankName', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Account Number *</label>
                <input className={field} value={form.accountNumber ?? ''} onChange={(e) => set('accountNumber', e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
              </div>
              <div>
                <label className={lbl}>Branch Code</label>
                <input className={field} value={form.branchCode ?? ''} onChange={(e) => set('branchCode', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Account Type</label>
                <select className={field} value={form.accountType ?? ''} onChange={(e) => set('accountType', e.target.value)}>
                  <option value="">—</option>
                  <option>Cheque / Current</option>
                  <option>Savings</option>
                  <option>Transmission</option>
                </select>
              </div>
            </>
          )}
          <div>
            <label className={lbl}>First Debit Date</label>
            <input type="date" className={field} value={form.firstDebitDate ?? ''} onChange={(e) => set('firstDebitDate', e.target.value)} />
          </div>
        </div>
      </section>

      {/* Dependants */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Dependants</h2>
          <Button size="sm" variant="outline" onClick={addDependant}><Plus className="h-3.5 w-3.5" /> Add</Button>
        </div>
        {(form.dependants ?? []).length === 0 && <p className="text-sm text-gray-400">No dependants added.</p>}
        <div className="space-y-2">
          {(form.dependants ?? []).map((d, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <input className={field} placeholder="Full name" value={d.name} onChange={(e) => updateDependant(i, { name: e.target.value })} />
              <input className={field} placeholder="Relationship" value={d.relationship ?? ''} onChange={(e) => updateDependant(i, { relationship: e.target.value })} />
              <input type="date" className={field} value={d.dateOfBirth ?? ''} onChange={(e) => updateDependant(i, { dateOfBirth: e.target.value })} />
              <button onClick={() => removeDependant(i)} className="flex items-center justify-center rounded-lg border border-gray-200 px-3 text-gray-400 hover:bg-red-50 hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <p className="text-xs text-gray-400">On submit the sale receives a <span className="font-mono font-semibold">T</span> status and enters the QA Bay.</p>
        <Button disabled={!canSubmit || submitting} onClick={submit} className="bg-[#F26522] hover:bg-[#d4541a]">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Submit Sale
        </Button>
      </div>
    </div>
  )
}

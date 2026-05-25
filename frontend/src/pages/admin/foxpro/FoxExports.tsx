import { useState, useEffect } from 'react'
import { Upload, ArrowRightLeft, FileDown, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FoxHeader } from './FoxHeader'
import {
  getFoxExportStatus,
  getFoxExportBatches,
  type FoxExportProduct,
  type ExportReturnReason,
} from '@/lib/api'

export default function FoxExports() {
  const [products, setProducts] = useState<FoxExportProduct[]>([])
  const [returnReasons, setReturnReasons] = useState<ExportReturnReason[]>([])
  const [qlink, setQlink] = useState<any[]>([])
  const [sagepay, setSagepay] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [account, setAccount] = useState('Main Account')
  const [mode, setMode] = useState('Create Files Only')

  const load = async () => {
    setLoading(true)
    try {
      const [status, batches] = await Promise.all([getFoxExportStatus(), getFoxExportBatches()])
      setProducts(status.products)
      setReturnReasons(status.returnReasons)
      setQlink(batches.qlink)
      setSagepay(batches.sagepay)
    } catch {
      /* defensive */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totalExported = products.reduce((s, p) => s + p.exported, 0)
  const totalAwaiting = products.reduce((s, p) => s + p.awaitingOutcome, 0)

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <FoxHeader
        title="Export & Status"
        subtitle="QA-passed sales are exported at midnight to Netcash (debit order) or Q-Link (Persal). Track exported volumes, batch submissions and the return outcomes."
        actions={
          <Button variant="ghost" size="icon" onClick={load} title="Refresh">
            <RefreshCw className={`h-4 w-4 text-white ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      {/* Export status per product (EXPORT STATUS PAGE) */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Export Status by Product</h2>
          <div className="text-sm text-gray-500">
            Exported <span className="font-semibold text-blue-600">{totalExported.toLocaleString()}</span> · Awaiting outcome <span className="font-semibold text-amber-600">{totalAwaiting.toLocaleString()}</span>
          </div>
        </div>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-6 py-3">Product</th>
              <th className="px-6 py-3 text-right">Exported</th>
              <th className="px-6 py-3 text-right">Awaiting Outcome (t1)</th>
              <th className="px-6 py-3 text-right">Active</th>
              <th className="px-6 py-3 text-right">Cancelled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">{loading ? 'Loading…' : 'No export data available.'}</td></tr>
            )}
            {products.map((p) => (
              <tr key={p.productName} className="hover:bg-gray-50/60">
                <td className="px-6 py-3 font-medium text-gray-900">{p.productName}</td>
                <td className="px-6 py-3 text-right font-semibold text-blue-600">{p.exported.toLocaleString()}</td>
                <td className="px-6 py-3 text-right text-amber-600">{p.awaitingOutcome.toLocaleString()}</td>
                <td className="px-6 py-3 text-right text-emerald-600">{p.active.toLocaleString()}</td>
                <td className="px-6 py-3 text-right text-red-600">{p.cancelled.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Debit Batch Submission control (mirrors FoxPro Debit Batch Submission) */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-gray-900">
            <Upload className="h-4 w-4 text-[#F26522]" /> Debit Batch Submission
          </h2>
          <p className="mb-4 text-sm text-gray-500">Build the SagePay / Netcash debit batch for the QA-passed book.</p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Account</label>
              <select value={account} onChange={(e) => setAccount(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F26522] focus:outline-none">
                <option>Main Account</option>
                <option>Sub Account</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Action</label>
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#F26522] focus:outline-none">
                <option>Create Files Only</option>
                <option>Create File &amp; Upload to SagePay</option>
              </select>
            </div>
            <Button className="w-full bg-[#F26522] hover:bg-[#d4541a]" disabled title="Wire to /api/integrations/qlink/export or a debit-batch endpoint">
              <FileDown className="h-4 w-4" /> Process Batch
            </Button>
            <p className="text-xs text-gray-400">Recent SagePay batches: {sagepay.length} · Q-Link batches: {qlink.length}</p>
          </div>
        </div>

        {/* Export return reasons / remediation (EXPORT RETURN STATUS) */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-gray-900">
            <ArrowRightLeft className="h-4 w-4 text-[#F26522]" /> Return Status &amp; Remediation
          </h2>
          <p className="mb-4 text-sm text-gray-500">When a sale is returned, a predefined action applies.</p>
          <div className="space-y-2">
            {returnReasons.map((r) => (
              <div key={r.code} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
                <span className="text-sm text-gray-700">{r.label}</span>
                <span className="rounded-full bg-[#F26522]/10 px-2.5 py-1 text-xs font-semibold text-[#F26522]">{r.action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

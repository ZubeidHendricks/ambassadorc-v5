import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, Wrench, XCircle, Search, RefreshCw, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FoxStatusBadge } from '@/components/ui/FoxStatusBadge'
import { FoxHeader } from './FoxHeader'
import {
  getFoxQaBay,
  getFoxQaStats,
  foxQaAction,
  type FoxQaItem,
} from '@/lib/api'

type Bucket = 'new' | 'process'

export default function FoxQaBay() {
  const [bucket, setBucket] = useState<Bucket>('new')
  const [newApps, setNewApps] = useState<FoxQaItem[]>([])
  const [inProcess, setInProcess] = useState<FoxQaItem[]>([])
  const [stats, setStats] = useState<{ total: number; byStage: Record<string, number> }>({ total: 0, byStage: {} })
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [flash, setFlash] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [bay, st] = await Promise.all([getFoxQaBay(search || undefined, 1, 100), getFoxQaStats()])
      setNewApps(bay.newApplications)
      setInProcess(bay.inProcessApplications)
      setStats({ total: st.total, byStage: st.byStage })
    } catch {
      /* defensive: backend returns empty data rather than erroring */
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { load() }, [load])

  const act = async (item: FoxQaItem, action: 'submit' | 'repair' | 'cancel') => {
    setBusy(item.id)
    try {
      const r = await foxQaAction(item.id, action, notes[item.id])
      setFlash(r.message)
      // optimistic removal from the active bucket
      setNewApps((p) => p.filter((x) => x.id !== item.id))
      setInProcess((p) => p.filter((x) => x.id !== item.id))
      setTimeout(() => setFlash(null), 4000)
    } catch {
      setFlash('Could not record the QA action.')
      setTimeout(() => setFlash(null), 4000)
    } finally {
      setBusy(null)
    }
  }

  const rows = bucket === 'new' ? newApps : inProcess

  const stage = (k: string) => stats.byStage[k] ?? 0

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <FoxHeader
        title="QA Bay"
        subtitle="Quality Assurance mailbox — review captured sales, then Submit (pass), Repair (return) or Cancel. Submitted sales are loaded for the midnight export to Netcash or Q-Link."
      />

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { label: 'In Bay', value: stats.total, tone: 'text-gray-900' },
          { label: 'New (T)', value: stage('capture'), tone: 'text-amber-600' },
          { label: 'In QA', value: stage('qa'), tone: 'text-amber-700' },
          { label: 'QA Passed', value: stage('qa_passed'), tone: 'text-indigo-600' },
          { label: 'Exported', value: stage('export'), tone: 'text-blue-600' },
          { label: 'Cancelled', value: stage('cancelled'), tone: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.tone}`}>{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {flash && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800">
          {flash}
        </div>
      )}

      {/* Tabs + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          <button
            onClick={() => setBucket('new')}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${bucket === 'new' ? 'bg-[#F26522] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            New Applications ({newApps.length})
          </button>
          <button
            onClick={() => setBucket('process')}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${bucket === 'process' ? 'bg-[#F26522] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            In Process Applications ({inProcess.length})
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
              placeholder="Search ID number or name…"
              className="w-64 rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-[#F26522] focus:outline-none focus:ring-2 focus:ring-[#F26522]/20"
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => load()} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* QA queue table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Client ID</th>
              <th className="px-4 py-3">Client Name</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Verification Agent</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                  <Inbox className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {loading ? 'Loading QA queue…' : 'No applications in this bay.'}
                </td>
              </tr>
            )}
            {rows.map((item, i) => (
              <tr key={item.id} className="align-top hover:bg-gray-50/60">
                <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{item.idNumber || '—'}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{item.clientName || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{item.productName}</td>
                <td className="px-4 py-3 text-gray-600">{item.agentName || '—'}</td>
                <td className="px-4 py-3">
                  <FoxStatusBadge code={item.fox.code} label={item.fox.label} color={item.fox.color} title={item.rawStatus} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-end gap-2">
                    <input
                      value={notes[item.id] || ''}
                      onChange={(e) => setNotes((p) => ({ ...p, [item.id]: e.target.value }))}
                      placeholder="Note (optional)"
                      className="w-40 rounded-md border border-gray-200 px-2 py-1 text-xs focus:border-[#F26522] focus:outline-none"
                    />
                    <div className="flex gap-1.5">
                      <Button size="sm" disabled={busy === item.id} onClick={() => act(item, 'submit')} className="bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle className="h-3.5 w-3.5" /> Submit
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => act(item, 'repair')} className="border-amber-500 text-amber-600 hover:bg-amber-500">
                        <Wrench className="h-3.5 w-3.5" /> Repair
                      </Button>
                      <Button size="sm" variant="destructive" disabled={busy === item.id} onClick={() => act(item, 'cancel')}>
                        <XCircle className="h-3.5 w-3.5" /> Cancel
                      </Button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">
        Submit → status <span className="font-mono font-semibold">QC</span> (QA passed, queued for export) · Repair → <span className="font-mono font-semibold">R</span> (returned to agent) · Cancel → <span className="font-mono font-semibold">RC/C</span> (client cancelled). Actions are recorded to the audit log.
      </p>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, Play, CheckCircle2, XCircle, Clock, Database,
  Loader2, AlertCircle, Table2, Eye, Download,
  Activity, Server, GitMerge, RotateCcw, BookmarkCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const API_BASE = '/api'
function getToken() { return localStorage.getItem('ambassador_token') }
async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } })
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json.data as T
}
async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json.data as T
}

interface TableDef { sourceTable: string; destTable: string; label: string; category: string; pkColumn: string }
interface JobLog { job_id: string; started_at: string; finished_at: string; duration_ms: string | number; tables_total: string | number; tables_succeeded: string | number; tables_failed: string | number; rows_synced: string | number; status: string }
interface SyncResult { table: string; label: string; status: string; rowsSynced: number; rowsTotal: number; error?: string; durationMs: number; resumed?: boolean }
interface LastResult { jobId: string; startedAt: string; finishedAt: string; durationMs: number; totalRowsSynced: number; tablesSucceeded: number; tablesFailed: number; results: SyncResult[] }
interface StatusData { isRunning: boolean; lastResult: LastResult | null; tables: TableDef[]; history: JobLog[] }
interface Checkpoint { source_table: string; dest_table: string; last_id: string; rows_synced: string; updated_at: string }

const CATEGORY_COLORS: Record<string, string> = {
  ambassador: 'bg-blue-100 text-blue-700',
  sales: 'bg-green-100 text-green-700',
  payments: 'bg-purple-100 text-purple-700',
  policies: 'bg-orange-100 text-orange-700',
  operations: 'bg-gray-100 text-gray-600',
}

function duration(ms: number | string) {
  const n = Number(ms)
  if (n < 1000) return `${n}ms`
  if (n < 60000) return `${(n / 1000).toFixed(1)}s`
  return `${Math.floor(n / 60000)}m ${Math.floor((n % 60000) / 1000)}s`
}
function fmt(dt: string) {
  return new Date(dt).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'medium' })
}

interface PreviewData { rows: Record<string, unknown>[]; total: number }

export default function SyncDashboard() {
  const [status, setStatus] = useState<StatusData | null>(null)
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [selectedTables, setSelectedTables] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [preview, setPreview] = useState<{ table: string; data: PreviewData } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'tables' | 'checkpoints' | 'history' | 'lastResult'>('tables')
  const [forceReset, setForceReset] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      const [data, cpData] = await Promise.all([
        apiGet<StatusData>('/sync/status'),
        apiGet<{ checkpoints: Checkpoint[] }>('/sync/checkpoints').catch(() => ({ checkpoints: [] })),
      ])
      setStatus(data)
      setCheckpoints(cpData.checkpoints)
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  // Poll while running
  useEffect(() => {
    if (!status?.isRunning) return
    const interval = setInterval(loadStatus, 5000)
    return () => clearInterval(interval)
  }, [status?.isRunning, loadStatus])

  const runSync = async (tables?: string[], reset = false) => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      await apiPost('/sync/run', {
        ...(tables?.length ? { tables } : {}),
        ...(reset ? { forceReset: true } : {}),
      })
      setSyncMsg({
        text: reset
          ? 'Full reset started — all checkpoints cleared, reloading from scratch.'
          : tables?.length
            ? `Syncing ${tables.length} table(s) — resuming from last checkpoint if available.`
            : 'Full sync started — trickling 50 rows/batch, resuming any interrupted tables.',
        ok: true,
      })
      setSelectedTables([])
      setForceReset(false)
      setTimeout(loadStatus, 2000)
    } catch (e: any) {
      setSyncMsg({ text: `Error: ${e.message}`, ok: false })
    } finally {
      setSyncing(false)
    }
  }

  const loadPreview = async (destTable: string) => {
    if (preview?.table === destTable) { setPreview(null); return }
    setPreviewLoading(true)
    try {
      const data = await apiGet<PreviewData>(`/sync/preview/${destTable}`)
      setPreview({ table: destTable, data })
    } catch (e: any) {
      alert(`Preview error: ${e.message}`)
    } finally {
      setPreviewLoading(false)
    }
  }

  const toggleTable = (t: string) =>
    setSelectedTables(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const categories = status ? ['all', ...Array.from(new Set(status.tables.map(t => t.category)))] : []
  const filteredTables = status?.tables.filter(t => activeCategory === 'all' || t.category === activeCategory) ?? []
  const lastResult = status?.lastResult
  const cpMap = Object.fromEntries(checkpoints.map(c => [c.source_table, c]))

  return (
    <div className="flex flex-col h-full bg-gray-50" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <GitMerge className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">FoxPro → PostgreSQL Sync</h1>
              <p className="text-xs text-gray-400">50 rows/batch · checkpoint-resumable · daily at 02:00 UTC</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {status?.isRunning && (
              <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sync running…
              </div>
            )}
            <Button variant="outline" size="sm" onClick={loadStatus} className="gap-1.5 h-8 text-xs">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
              <input type="checkbox" checked={forceReset} onChange={e => setForceReset(e.target.checked)}
                className="rounded accent-red-500" />
              <RotateCcw className="h-3 w-3 text-red-400" />
              Force reset
            </label>
            <Button
              size="sm"
              className={`gap-1.5 h-8 text-xs ${forceReset ? 'bg-red-600 hover:bg-red-700' : ''}`}
              disabled={syncing || status?.isRunning}
              onClick={() => selectedTables.length ? runSync(selectedTables, forceReset) : runSync(undefined, forceReset)}
            >
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {selectedTables.length
                ? `${forceReset ? 'Reset + Sync' : 'Resume'} ${selectedTables.length} table${selectedTables.length > 1 ? 's' : ''}`
                : forceReset ? 'Reset All & Sync' : 'Sync All (resume)'}
            </Button>
          </div>
        </div>

        {syncMsg && (
          <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${!syncMsg.ok ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {!syncMsg.ok ? <AlertCircle className="h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
            {syncMsg.text}
          </div>
        )}
      </div>

      {/* Stats row */}
      {lastResult && (
        <div className="grid grid-cols-4 gap-px bg-gray-200 border-b border-gray-200">
          {[
            { label: 'Last sync', value: fmt(lastResult.startedAt), icon: Clock },
            { label: 'Rows synced', value: lastResult.totalRowsSynced.toLocaleString(), icon: Database },
            { label: 'Tables OK', value: `${lastResult.tablesSucceeded} / ${lastResult.tablesSucceeded + lastResult.tablesFailed}`, icon: CheckCircle2 },
            { label: 'Duration', value: duration(lastResult.durationMs), icon: Activity },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 bg-white px-6 py-3">
              <Icon className="h-4 w-4 text-gray-300 shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-400">{label}</p>
                <p className="text-sm font-semibold text-gray-800">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-80 shrink-0 flex flex-col border-r border-gray-200 bg-white overflow-hidden">
          <div className="flex border-b border-gray-200">
            {(['tables', 'checkpoints', 'history', 'lastResult'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-[10px] font-semibold capitalize transition-colors ${activeTab === tab ? 'border-b-2 border-primary text-primary' : 'text-gray-400 hover:text-gray-600'}`}>
                {tab === 'lastResult' ? 'Results' : tab === 'checkpoints' ? 'Progress' : tab}
              </button>
            ))}
          </div>

          {/* Tables tab */}
          {activeTab === 'tables' && (
            <div className="flex flex-col overflow-hidden flex-1">
              <div className="flex gap-1 overflow-x-auto p-2 border-b border-gray-100">
                {categories.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize transition-colors ${activeCategory === cat ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {cat}
                  </button>
                ))}
              </div>
              {selectedTables.length > 0 && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-primary/5 border-b border-primary/10 text-xs">
                  <span className="text-primary font-medium">{selectedTables.length} selected</span>
                  <button onClick={() => setSelectedTables([])} className="text-gray-400 hover:text-gray-600">Clear</button>
                </div>
              )}
              <div className="overflow-y-auto flex-1">
                {loading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
                ) : filteredTables.map(t => {
                  const cp = cpMap[t.sourceTable]
                  return (
                    <div key={t.sourceTable}
                      className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedTables.includes(t.sourceTable) ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                      onClick={() => toggleTable(t.sourceTable)}>
                      <input type="checkbox" readOnly checked={selectedTables.includes(t.sourceTable)}
                        className="h-3.5 w-3.5 rounded accent-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{t.label}</p>
                        <p className="text-[10px] text-gray-400 font-mono truncate">{t.sourceTable}</p>
                        {cp && (
                          <p className="text-[9px] text-amber-600 flex items-center gap-0.5 mt-0.5">
                            <BookmarkCheck className="h-2.5 w-2.5" />
                            checkpoint: {Number(cp.rows_synced).toLocaleString()} rows @ id={cp.last_id}
                          </p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${CATEGORY_COLORS[t.category] ?? 'bg-gray-100 text-gray-500'}`}>
                        {t.category}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Checkpoints / Progress tab */}
          {activeTab === 'checkpoints' && (
            <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
              {checkpoints.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2">
                  <BookmarkCheck className="h-8 w-8" />
                  <p className="text-xs text-center px-4">No checkpoints yet.<br />Checkpoints save progress so interrupted syncs resume automatically.</p>
                </div>
              ) : checkpoints.map((cp, i) => (
                <div key={i} className="px-3 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <BookmarkCheck className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="text-xs font-semibold text-gray-700 truncate">{cp.source_table}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                    <span>{Number(cp.rows_synced).toLocaleString()} rows synced</span>
                    <span>last id: {cp.last_id}</span>
                  </div>
                  <p className="text-[9px] text-gray-400">{fmt(cp.updated_at)}</p>
                </div>
              ))}
            </div>
          )}

          {/* History tab */}
          {activeTab === 'history' && (
            <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
              {(status?.history ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2">
                  <Clock className="h-8 w-8" /><p className="text-xs">No sync history yet</p>
                </div>
              ) : (status?.history ?? []).map((h, i) => (
                <div key={i} className="px-3 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    {h.status === 'success'
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      : h.status === 'partial'
                        ? <AlertCircle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                        : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                    <span className="text-xs font-semibold text-gray-700 capitalize">{h.status}</span>
                    <span className="ml-auto text-[10px] text-gray-400">{duration(h.duration_ms)}</span>
                  </div>
                  <p className="text-[10px] text-gray-400">{fmt(h.started_at)}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    {Number(h.rows_synced).toLocaleString()} rows · {h.tables_succeeded}/{h.tables_total} tables
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Last result tab */}
          {activeTab === 'lastResult' && lastResult && (
            <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
              {lastResult.results.map((r, i) => (
                <div key={i} className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    {r.status === 'success'
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      : r.status === 'error'
                        ? <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        : <Clock className="h-3.5 w-3.5 text-gray-300 shrink-0" />}
                    <span className="text-xs font-medium text-gray-800 truncate flex-1">{r.label}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">{duration(r.durationMs)}</span>
                  </div>
                  {r.status === 'success' && (
                    <p className="text-[10px] text-gray-400 ml-5">
                      {r.rowsSynced.toLocaleString()} rows
                      {r.resumed ? <span className="text-amber-500 ml-1">(resumed)</span> : ''}
                    </p>
                  )}
                  {r.status === 'error' && (
                    <p className="text-[10px] text-red-500 ml-5 line-clamp-2">{r.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'lastResult' && !lastResult && (
            <div className="flex flex-col items-center justify-center flex-1 text-gray-300 gap-2 py-12">
              <Activity className="h-8 w-8" /><p className="text-xs">No sync results yet</p>
            </div>
          )}
        </div>

        {/* Right: table cards + preview */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 grid grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto max-h-72 border-b border-gray-200">
            {(status?.tables ?? []).map(t => {
              const cp = cpMap[t.sourceTable]
              const result = lastResult?.results.find(r => r.table === t.sourceTable)
              return (
                <div key={t.destTable}
                  className="group rounded-xl border border-gray-200 bg-white p-3 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => loadPreview(t.destTable)}>
                  <div className="flex items-start gap-2 mb-1.5">
                    <Server className="h-4 w-4 text-primary/40 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-800 truncate">{t.label}</p>
                      <p className="text-[10px] text-gray-400 font-mono truncate">{t.sourceTable}</p>
                    </div>
                    {result?.status === 'success' && <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />}
                    {result?.status === 'error' && <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                  </div>
                  {cp && (
                    <div className="mb-1.5">
                      <div className="flex items-center justify-between text-[9px] text-amber-600 mb-0.5">
                        <span className="flex items-center gap-0.5"><BookmarkCheck className="h-2.5 w-2.5" /> checkpoint</span>
                        <span>{Number(cp.rows_synced).toLocaleString()} rows</span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${CATEGORY_COLORS[t.category] ?? 'bg-gray-100 text-gray-500'}`}>
                      {t.category}
                    </span>
                    <button className="flex items-center gap-1 text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="h-3 w-3" /> Preview
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Preview */}
          <div className="flex-1 overflow-hidden bg-white">
            {previewLoading && (
              <div className="flex items-center justify-center h-full gap-2 text-primary">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading preview…
              </div>
            )}
            {!preview && !previewLoading && (
              <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
                <Table2 className="h-10 w-10 opacity-30" />
                <p className="text-sm">Click any table to preview its synced data</p>
              </div>
            )}
            {preview && !previewLoading && (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/50">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-gray-700">{preview.table}</span>
                    <span className="text-xs text-gray-400">· {preview.data.total.toLocaleString()} rows · latest 50</span>
                  </div>
                  <button
                    onClick={() => {
                      if (!preview) return
                      const cols = preview.data.rows.length ? Object.keys(preview.data.rows[0]) : []
                      const csv = [cols.join(','), ...preview.data.rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))].join('\n')
                      const blob = new Blob([csv], { type: 'text/csv' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a'); a.href = url; a.download = `${preview.table}.csv`; a.click()
                    }}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary transition-colors">
                    <Download className="h-3.5 w-3.5" /> CSV
                  </button>
                </div>
                {preview.data.rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 text-gray-300 gap-2">
                    <Table2 className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No data synced yet for this table</p>
                    <p className="text-xs">Run a sync to start trickling data</p>
                  </div>
                ) : (
                  <div className="overflow-auto flex-1">
                    <table className="min-w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50 z-10">
                        <tr>
                          {Object.keys(preview.data.rows[0]).map(col => (
                            <th key={col} className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider text-[10px]">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {preview.data.rows.map((row, i) => (
                          <tr key={i} className="hover:bg-blue-50/40">
                            {Object.values(row).map((val, j) => (
                              <td key={j} className="whitespace-nowrap px-3 py-1.5 font-mono text-gray-700 max-w-[200px] truncate">
                                {val === null || val === undefined
                                  ? <span className="text-gray-300 italic">null</span>
                                  : String(val).match(/^\d{4}-\d{2}-\d{2}T/)
                                    ? new Date(String(val)).toLocaleDateString('en-ZA')
                                    : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

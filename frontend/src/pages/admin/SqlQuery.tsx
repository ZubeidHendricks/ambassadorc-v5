import { useState, useEffect, useRef, useCallback } from 'react'
import { Database, Play, ChevronRight, Clock, Table2, Search, X, Loader2, AlertCircle, Download, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

const API_BASE = '/api'

function getToken() {
  return localStorage.getItem('ambassador_token')
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json.data as T
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json.data as T
}

interface SchemaColumn { column: string; type: string; nullable: string }
interface SchemaTable  { table_name: string; columns: SchemaColumn[] }
interface TableCount   { table_name: string; row_count: string | number }

const PRESET_QUERIES = [
  { label: 'Recent clients',        sql: 'SELECT id, "firstName", "lastName", phone, province, "createdAt"\nFROM clients\nORDER BY "createdAt" DESC\nLIMIT 20' },
  { label: 'Active policies',       sql: 'SELECT p.id, p."policyNumber", c."firstName", c."lastName", pr.name AS product, p.status, p."premiumAmount"\nFROM policies p\nJOIN clients c ON c.id = p."clientId"\nJOIN products pr ON pr.id = p."productId"\nWHERE p.status = \'ACTIVE\'\nLIMIT 50' },
  { label: 'Sales pipeline',        sql: 'SELECT s.id, c."firstName"||\'  \'||c."lastName" AS client, pr.name AS product, a."firstName"||\'  \'||a."lastName" AS agent, s.status, s."premiumAmount", s."createdAt"\nFROM sales s\nJOIN clients c ON c.id = s."clientId"\nJOIN products pr ON pr.id = s."productId"\nJOIN ambassadors a ON a.id = s."agentId"\nORDER BY s."createdAt" DESC\nLIMIT 50' },
  { label: 'Commission summary',    sql: 'SELECT a."firstName"||\'  \'||a."lastName" AS agent, COUNT(*) AS count, SUM(amount) AS total, status\nFROM commissions cm\nJOIN ambassadors a ON a.id = cm."agentId"\nGROUP BY a.id, a."firstName", a."lastName", status\nORDER BY total DESC' },
  { label: 'Top ambassadors',       sql: 'SELECT a.id, a."firstName"||\'  \'||a."lastName" AS name, a.role, a.tier,\n       COUNT(DISTINCT rb.id) AS batches,\n       COUNT(DISTINCT l.id) AS leads\nFROM ambassadors a\nLEFT JOIN referral_batches rb ON rb."ambassadorId" = a.id\nLEFT JOIN leads l ON l."ambassadorId" = a.id\nGROUP BY a.id\nORDER BY batches DESC, leads DESC\nLIMIT 20' },
  { label: 'Pending QA checks',     sql: 'SELECT qc.id, c."firstName"||\'  \'||c."lastName" AS client, pr.name AS product,\n       a."firstName"||\'  \'||a."lastName" AS agent, qc.status, qc."createdAt"\nFROM quality_checks qc\nJOIN sales s ON s.id = qc."saleId"\nJOIN clients c ON c.id = s."clientId"\nJOIN products pr ON pr.id = s."productId"\nJOIN ambassadors a ON a.id = s."agentId"\nWHERE qc.status = \'PENDING\'\nORDER BY qc."createdAt" DESC' },
  { label: 'Province breakdown',    sql: 'SELECT province, COUNT(*) AS client_count\nFROM clients\nGROUP BY province\nORDER BY client_count DESC' },
  { label: 'SMS delivery stats',    sql: 'SELECT status, COUNT(*) AS count\nFROM sms_messages\nGROUP BY status\nORDER BY count DESC' },
  { label: 'Table row counts',      sql: 'SELECT relname AS table_name, n_live_tup AS row_count\nFROM pg_stat_user_tables\nORDER BY n_live_tup DESC' },
]

function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  const [copied, setCopied] = useState(false)
  if (!rows.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
      <Table2 className="h-10 w-10 opacity-30" />
      <p className="text-sm">Query returned 0 rows</p>
    </div>
  )

  const cols = Object.keys(rows[0])

  const copyCSV = () => {
    const header = cols.join(',')
    const body = rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(',')).join('\n')
    navigator.clipboard.writeText(`${header}\n${body}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadCSV = () => {
    const header = cols.join(',')
    const body = rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(',')).join('\n')
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query_result_${Date.now()}.csv`
    a.click()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/50">
        <span className="text-xs font-medium text-gray-500">{rows.length.toLocaleString()} row{rows.length !== 1 ? 's' : ''}</span>
        <div className="flex gap-2">
          <button onClick={copyCSV} className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 transition-colors">
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy CSV'}
          </button>
          <button onClick={downloadCSV} className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 transition-colors">
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        </div>
      </div>
      <div className="overflow-auto flex-1">
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              {cols.map(col => (
                <th key={col} className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider text-[10px]">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                {cols.map(col => {
                  const val = row[col]
                  const display = val === null || val === undefined ? (
                    <span className="text-gray-300 italic">null</span>
                  ) : typeof val === 'object' ? (
                    <span className="font-mono text-purple-600">{JSON.stringify(val)}</span>
                  ) : typeof val === 'boolean' ? (
                    <span className={val ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>{String(val)}</span>
                  ) : String(val).match(/^\d{4}-\d{2}-\d{2}T/) ? (
                    <span className="text-gray-500">{new Date(String(val)).toLocaleString('en-ZA')}</span>
                  ) : (
                    <span className="text-gray-800">{String(val)}</span>
                  )
                  return (
                    <td key={col} className="whitespace-nowrap px-3 py-1.5 font-mono max-w-[300px] truncate">
                      {display}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function SqlQuery() {
  const [sql, setSql] = useState(PRESET_QUERIES[0].sql)
  const [result, setResult] = useState<Record<string, unknown>[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState<number | null>(null)
  const [history, setHistory] = useState<{ sql: string; ts: number; rows: number }[]>([])
  const [schema, setSchema] = useState<SchemaTable[]>([])
  const [tableCounts, setTableCounts] = useState<TableCount[]>([])
  const [schemaSearch, setSchemaSearch] = useState('')
  const [expandedTable, setExpandedTable] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'schema' | 'presets' | 'history'>('presets')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    apiGet<{ tables: SchemaTable[] }>('/query/schema')
      .then(d => setSchema(d.tables))
      .catch(() => {})
    apiGet<{ counts: TableCount[] }>('/query/stats')
      .then(d => setTableCounts(d.counts))
      .catch(() => {})
  }, [])

  const run = useCallback(async (querySql = sql) => {
    if (!querySql.trim()) return
    setRunning(true)
    setError(null)
    setResult(null)
    const start = Date.now()
    try {
      const data = await apiPost<{ rows: Record<string, unknown>[]; rowCount: number }>('/query/sql', { sql: querySql })
      setResult(data.rows)
      setElapsed(Date.now() - start)
      setHistory(prev => [{ sql: querySql, ts: Date.now(), rows: data.rowCount }, ...prev].slice(0, 30))
    } catch (e: any) {
      setError(e?.message ?? 'Query failed')
      setElapsed(Date.now() - start)
    } finally {
      setRunning(false)
    }
  }, [sql])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      run()
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = textareaRef.current!
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newVal = sql.substring(0, start) + '  ' + sql.substring(end)
      setSql(newVal)
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      })
    }
  }

  const filteredSchema = schema.filter(t =>
    t.table_name.includes(schemaSearch.toLowerCase()) ||
    t.columns?.some(c => c.column.includes(schemaSearch.toLowerCase()))
  )

  const countFor = (name: string) => {
    const found = tableCounts.find(t => t.table_name === name)
    return found ? Number(found.row_count).toLocaleString() : '—'
  }

  return (
    <div className="flex h-full bg-gray-50" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Left panel: schema / presets / history */}
      <div className="w-72 shrink-0 flex flex-col border-r border-gray-200 bg-white overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['presets', 'schema', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'presets' && (
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {PRESET_QUERIES.map((q, i) => (
              <button
                key={i}
                onClick={() => { setSql(q.sql); setResult(null); setError(null) }}
                className="w-full text-left rounded-lg px-3 py-2.5 text-xs text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-primary shrink-0" />
                  <span className="font-medium">{q.label}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'schema' && (
          <div className="flex flex-col overflow-hidden flex-1">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
                <input
                  value={schemaSearch}
                  onChange={e => setSchemaSearch(e.target.value)}
                  placeholder="Search tables / columns…"
                  className="w-full rounded-md border border-gray-200 bg-gray-50 pl-7 pr-2 py-1.5 text-xs placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {schemaSearch && (
                  <button onClick={() => setSchemaSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X className="h-3 w-3 text-gray-300" />
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-1.5 space-y-0.5">
              {filteredSchema.map(t => (
                <div key={t.table_name}>
                  <button
                    onClick={() => setExpandedTable(expandedTable === t.table_name ? null : t.table_name)}
                    className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-xs hover:bg-gray-50 transition-colors group"
                  >
                    <Database className="h-3.5 w-3.5 text-primary/50 shrink-0" />
                    <span className="flex-1 text-left font-medium text-gray-700 truncate">{t.table_name}</span>
                    <span className="text-[10px] text-gray-300 shrink-0">{countFor(t.table_name)}</span>
                    <ChevronRight className={`h-3 w-3 text-gray-300 shrink-0 transition-transform ${expandedTable === t.table_name ? 'rotate-90' : ''}`} />
                  </button>
                  {expandedTable === t.table_name && (
                    <div className="ml-6 mb-1 space-y-0.5">
                      {(t.columns || []).map(col => (
                        <div key={col.column} className="flex items-center gap-2 px-2 py-1 rounded text-[11px] text-gray-500 hover:bg-gray-50">
                          <span className="font-mono text-gray-700 truncate">{col.column}</span>
                          <span className="ml-auto text-gray-300 shrink-0 text-[10px]">{col.type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="overflow-y-auto flex-1 p-2 space-y-1.5">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2">
                <Clock className="h-8 w-8" />
                <p className="text-xs">No history yet</p>
              </div>
            ) : history.map((h, i) => (
              <button
                key={i}
                onClick={() => { setSql(h.sql); setResult(null); setError(null) }}
                className="w-full text-left rounded-lg border border-gray-100 px-3 py-2.5 hover:border-primary/30 hover:bg-primary/5 transition-colors"
              >
                <p className="font-mono text-[11px] text-gray-600 line-clamp-2 leading-relaxed">{h.sql}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-gray-300">{new Date(h.ts).toLocaleTimeString()}</span>
                  <span className="text-[10px] font-medium text-primary">{h.rows} rows</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: editor + results */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Editor */}
        <div className="flex flex-col border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-gray-700">SQL Query Console</span>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">LIVE DB</span>
            </div>
            <div className="flex items-center gap-3">
              {elapsed !== null && (
                <span className="text-xs text-gray-400">
                  {elapsed}ms
                  {result && ` · ${result.length} rows`}
                </span>
              )}
              <Button
                onClick={() => run()}
                disabled={running || !sql.trim()}
                size="sm"
                className="gap-1.5 h-8 text-xs"
              >
                {running ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {running ? 'Running…' : 'Run'}
                <kbd className="ml-1 rounded bg-white/20 px-1 py-0.5 text-[9px] font-mono">⌘↵</kbd>
              </Button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            value={sql}
            onChange={e => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            rows={8}
            placeholder="SELECT * FROM clients LIMIT 10;"
            className="w-full resize-none border-0 bg-[#1e1e2e] p-4 font-mono text-sm text-[#cdd6f4] placeholder:text-gray-600 focus:outline-none leading-relaxed"
            style={{ minHeight: 160 }}
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-hidden bg-white">
          {!result && !error && !running && (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-3">
              <Play className="h-12 w-12 opacity-20" />
              <p className="text-sm">Run a query to see results</p>
              <p className="text-xs text-gray-200">Only SELECT queries are permitted</p>
            </div>
          )}
          {running && (
            <div className="flex items-center justify-center h-full gap-3 text-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Executing query…</span>
            </div>
          )}
          {error && (
            <div className="m-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Query Error</p>
                <p className="mt-1 font-mono text-xs text-red-600 leading-relaxed whitespace-pre-wrap">{error}</p>
              </div>
            </div>
          )}
          {result && !running && (
            <ResultTable rows={result} />
          )}
        </div>
      </div>
    </div>
  )
}

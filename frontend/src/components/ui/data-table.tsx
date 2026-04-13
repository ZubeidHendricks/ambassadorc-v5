import { useState, useMemo, useCallback, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  sortable?: boolean
  className?: string
}

export interface ServerPaginationProps {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  pageSize?: number
  onRowClick?: (row: T) => void
  emptyMessage?: string
  className?: string
  searchable?: boolean
  searchPlaceholder?: string
  searchKeys?: string[]
  serverPagination?: ServerPaginationProps
}

type SortDir = 'asc' | 'desc' | null

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  pageSize = 10,
  onRowClick,
  emptyMessage = 'No data found.',
  className,
  searchable = false,
  searchPlaceholder = 'Search...',
  searchKeys = [],
  serverPagination,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [page, setPage] = useState(0)

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        if (sortDir === 'asc') setSortDir('desc')
        else if (sortDir === 'desc') {
          setSortKey(null)
          setSortDir(null)
        }
      } else {
        setSortKey(key)
        setSortDir('asc')
      }
      setPage(0)
    },
    [sortKey, sortDir]
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    const keys = searchKeys.length > 0 ? searchKeys : columns.map((c) => c.key)
    return data.filter((row) =>
      keys.some((k) => {
        const val = row[k]
        return val !== undefined && val !== null && String(val).toLowerCase().includes(q)
      })
    )
  }, [data, search, searchKeys, columns])

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      const cmp = String(aVal).localeCompare(String(bVal))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = serverPagination
    ? serverPagination.totalPages
    : Math.max(1, Math.ceil(sorted.length / pageSize))
  const paged = serverPagination ? sorted : sorted.slice(page * pageSize, (page + 1) * pageSize)

  const currentPage = serverPagination ? serverPagination.page - 1 : page
  const activeTotalPages = serverPagination ? serverPagination.totalPages : totalPages
  const activeTotal = serverPagination ? serverPagination.total : sorted.length
  const activePageSize = serverPagination ? serverPagination.pageSize : pageSize

  const handlePageChange = (p: number) => {
    if (serverPagination) {
      serverPagination.onPageChange(p + 1)
    } else {
      setPage(p)
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {searchable && !serverPagination && (
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          placeholder={searchPlaceholder}
          className="w-full max-w-sm rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-left text-sm" role="table">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500',
                    col.sortable !== false && 'cursor-pointer select-none hover:text-gray-700',
                    col.className
                  )}
                  onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
                  role="columnheader"
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable !== false && (
                      <span className="inline-flex">
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 text-gray-300" />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((row, idx) => (
                <tr
                  key={idx}
                  className={cn(
                    'border-b border-gray-100 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-primary/5',
                    !onRowClick && 'hover:bg-gray-50/50'
                  )}
                  onClick={() => onRowClick?.(row)}
                  role="row"
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      onRowClick(row)
                    }
                  }}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3 text-gray-700', col.className)}>
                      {col.render ? col.render(row) : (row[col.key] as ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {activeTotalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500">
            Showing {currentPage * activePageSize + 1}–{Math.min((currentPage + 1) * activePageSize, activeTotal)} of{' '}
            {activeTotal}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(activeTotalPages, 5) }, (_, i) => {
              let pageNum: number
              if (activeTotalPages <= 5) {
                pageNum = i
              } else if (currentPage < 3) {
                pageNum = i
              } else if (currentPage > activeTotalPages - 4) {
                pageNum = activeTotalPages - 5 + i
              } else {
                pageNum = currentPage - 2 + i
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={cn(
                    'h-8 w-8 rounded-lg text-sm font-medium transition-colors',
                    currentPage === pageNum
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {pageNum + 1}
                </button>
              )
            })}
            <button
              onClick={() => handlePageChange(Math.min(activeTotalPages - 1, currentPage + 1))}
              disabled={currentPage === activeTotalPages - 1}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

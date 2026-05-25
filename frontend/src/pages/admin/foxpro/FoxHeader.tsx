import type { ReactNode } from 'react'

/**
 * FoxPro-themed page header — charcoal panel with the FoxPro orange accent,
 * echoing the look & feel of the legacy DNN FoxPro CRM (foxpro.co.za).
 */
export function FoxHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#2b2b2b] to-[#1c1c1c] px-6 py-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {/* Fox mark */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#FFB300] via-[#F26522] to-[#E53935] text-base font-black text-white shadow">
            F
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#F26522]">FoxPro CRM</p>
            <h1 className="text-xl font-bold text-white">{title}</h1>
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {subtitle && <p className="mt-3 max-w-3xl text-sm text-white/60">{subtitle}</p>}
    </div>
  )
}

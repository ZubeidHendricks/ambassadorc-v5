import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: ReactNode
  trend?: { value: number; label: string }
  iconColor?: string
  className?: string
}

export function StatCard({ label, value, icon, trend, iconColor, className }: StatCardProps) {
  const positive = trend && trend.value > 0
  const negative = trend && trend.value < 0

  return (
    <div className={cn(
      'group relative rounded-2xl border border-gray-100 bg-white p-5 transition-all duration-200 hover:border-gray-200 hover:shadow-md hover:-translate-y-px overflow-hidden',
      className
    )}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">{label}</p>
          <p className="mt-2 text-[28px] font-black tracking-tight text-gray-900 leading-none">{value}</p>
          {trend && (
            <div className={cn(
              'mt-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
              positive ? 'bg-emerald-50 text-emerald-600' : negative ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-500'
            )}>
              {positive && <TrendingUp className="h-3 w-3" />}
              {negative && <TrendingDown className="h-3 w-3" />}
              <span>{positive ? '+' : ''}{Math.abs(trend.value)}%</span>
              <span className="font-normal opacity-70">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          iconColor || 'bg-blue-50 text-blue-600'
        )}>
          {icon}
        </div>
      </div>
    </div>
  )
}

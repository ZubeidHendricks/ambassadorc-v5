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
    <div className={cn('win11-card group p-5 overflow-hidden', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500" style={{ letterSpacing: '0.02em' }}>{label}</p>
          <p className="mt-2 text-[26px] font-semibold tracking-tight text-gray-900 leading-none">{value}</p>
          {trend && (
            <div className={cn(
              'mt-2.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
              positive ? 'bg-emerald-50 text-emerald-700' : negative ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
            )}>
              {positive && <TrendingUp className="h-3 w-3" />}
              {negative && <TrendingDown className="h-3 w-3" />}
              <span>{positive ? '+' : ''}{Math.abs(trend.value)}%</span>
              <span className="font-normal text-current opacity-60">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          iconColor || 'bg-blue-50 text-blue-600'
        )}>
          {icon}
        </div>
      </div>
    </div>
  )
}

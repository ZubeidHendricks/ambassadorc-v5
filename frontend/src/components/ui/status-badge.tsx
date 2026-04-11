import { cn } from '@/lib/utils'

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  passed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  signed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  delivered: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  viewed: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  sent: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  processing: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  qa_pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  new: { bg: 'bg-[#128FAF]/10', text: 'text-[#128FAF]', dot: 'bg-[#128FAF]' },
  in_progress: { bg: 'bg-[#128FAF]/10', text: 'text-[#128FAF]', dot: 'bg-[#128FAF]' },
  contacted: { bg: 'bg-[#128FAF]/10', text: 'text-[#128FAF]', dot: 'bg-[#128FAF]' },
  rejected: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  failed: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  escalated: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  duplicate: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  lapsed: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  draft: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  increase: { bg: 'bg-[#96ca4f]/15', text: 'text-[#5a8a1f]', dot: 'bg-[#96ca4f]' },
  decrease: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
}

const fallback = { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' }

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status.toLowerCase().replace(/[\s-]/g, '_')
  const config = statusConfig[key] || fallback

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  )
}

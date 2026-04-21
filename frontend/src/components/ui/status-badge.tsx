import { cn } from '@/lib/utils'

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  // Success states
  active: { bg: 'bg-success-light', text: 'text-emerald-700', dot: 'bg-success' },
  approved: { bg: 'bg-success-light', text: 'text-emerald-700', dot: 'bg-success' },
  completed: { bg: 'bg-success-light', text: 'text-emerald-700', dot: 'bg-success' },
  passed: { bg: 'bg-success-light', text: 'text-emerald-700', dot: 'bg-success' },
  paid: { bg: 'bg-success-light', text: 'text-emerald-700', dot: 'bg-success' },
  signed: { bg: 'bg-success-light', text: 'text-emerald-700', dot: 'bg-success' },
  delivered: { bg: 'bg-success-light', text: 'text-emerald-700', dot: 'bg-success' },
  qa_passed: { bg: 'bg-success-light', text: 'text-emerald-700', dot: 'bg-success' },
  qa_validation_passed: { bg: 'bg-success-light', text: 'text-emerald-700', dot: 'bg-success' },
  qlink_uploaded: { bg: 'bg-success-light', text: 'text-emerald-700', dot: 'bg-success' },
  q_link_uploaded: { bg: 'bg-success-light', text: 'text-emerald-700', dot: 'bg-success' },

  // Info states
  viewed: { bg: 'bg-primary-50', text: 'text-primary', dot: 'bg-primary-light' },
  sent: { bg: 'bg-primary-50', text: 'text-primary', dot: 'bg-primary-light' },
  new: { bg: 'bg-primary-50', text: 'text-primary', dot: 'bg-primary-light' },
  in_progress: { bg: 'bg-primary-50', text: 'text-primary', dot: 'bg-primary-light' },
  contacted: { bg: 'bg-primary-50', text: 'text-primary', dot: 'bg-primary-light' },
  exported_awaiting_outcome: { bg: 'bg-primary-50', text: 'text-primary', dot: 'bg-primary-light' },

  // Warning states
  pending: { bg: 'bg-warning-light', text: 'text-amber-700', dot: 'bg-warning' },
  processing: { bg: 'bg-warning-light', text: 'text-amber-700', dot: 'bg-warning' },
  qa_pending: { bg: 'bg-warning-light', text: 'text-amber-700', dot: 'bg-warning' },
  in_validation_with_quality_assurance: { bg: 'bg-warning-light', text: 'text-amber-700', dot: 'bg-warning' },
  repair: { bg: 'bg-warning-light', text: 'text-amber-700', dot: 'bg-warning' },

  // Error states
  rejected: { bg: 'bg-error-light', text: 'text-red-700', dot: 'bg-error' },
  failed: { bg: 'bg-error-light', text: 'text-red-700', dot: 'bg-error' },
  cancelled: { bg: 'bg-error-light', text: 'text-red-700', dot: 'bg-error' },
  client_cancelled: { bg: 'bg-error-light', text: 'text-red-700', dot: 'bg-error' },
  escalated: { bg: 'bg-error-light', text: 'text-red-700', dot: 'bg-error' },

  // Neutral states
  duplicate: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  lapsed: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  draft: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },

  // Special
  increase: { bg: 'bg-success-light', text: 'text-emerald-700', dot: 'bg-success' },
  decrease: { bg: 'bg-warning-light', text: 'text-amber-700', dot: 'bg-warning' },

  // Tier badges
  gold: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  silver: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  bronze: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  platinum: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
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

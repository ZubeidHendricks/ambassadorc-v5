import { type HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/15 text-primary-dark',
        secondary: 'bg-gray-100 text-gray-700',
        success: 'bg-emerald-100 text-emerald-700',
        warning: 'bg-amber-100 text-amber-700',
        destructive: 'bg-red-100 text-red-700',
        info: 'bg-primary-light/15 text-primary-light',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export function statusToBadgeVariant(
  status: string
): 'success' | 'warning' | 'destructive' | 'info' | 'secondary' {
  const s = status.toLowerCase()
  if (s === 'approved' || s === 'completed' || s === 'active') return 'success'
  if (s === 'pending' || s === 'processing') return 'warning'
  if (s === 'rejected' || s === 'failed' || s === 'duplicate') return 'destructive'
  if (s === 'contacted' || s === 'in_progress') return 'info'
  return 'secondary'
}

export { Badge, badgeVariants }

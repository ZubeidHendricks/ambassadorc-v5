import { cn } from '@/lib/utils'

/** Colour tokens emitted by the backend FoxPro status taxonomy. */
const colorMap: Record<string, { bg: string; text: string; dot: string }> = {
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  red: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
}

interface FoxStatusBadgeProps {
  /** The legacy FoxPro code, e.g. "QC", "u", "t1", "RC/C". */
  code: string
  /** Human label, e.g. "Q-Link – QA Passed". */
  label?: string
  color?: string
  /** Tooltip / description text. */
  title?: string
  /** Show the raw code chip in front of the label. */
  showCode?: boolean
  className?: string
}

export function FoxStatusBadge({ code, label, color = 'gray', title, showCode = true, className }: FoxStatusBadgeProps) {
  const c = colorMap[color] ?? colorMap.gray
  return (
    <span
      title={title || label || code}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        c.bg,
        c.text,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
      {showCode && <span className="font-mono uppercase tracking-tight">{code}</span>}
      {label && <span className="font-medium">{label}</span>}
    </span>
  )
}

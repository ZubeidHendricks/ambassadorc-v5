interface LogoMarkProps {
  size?: number
  className?: string
}

export function LogoMark({ size = 36, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="AmbassadorC logo"
    >
      <defs>
        {/* Main gradient: deep navy → brand navy → teal */}
        <linearGradient id="ac-logo-bg" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0F2969" />
          <stop offset="55%" stopColor="#004D99" />
          <stop offset="100%" stopColor="#0AB3CC" />
        </linearGradient>
        {/* Top highlight for depth */}
        <linearGradient id="ac-logo-hi" x1="0" y1="0" x2="0" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity="0.16" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        {/* Drop shadow filter */}
        <filter id="ac-logo-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F2969" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Background rounded square */}
      <rect width="36" height="36" rx="9" fill="url(#ac-logo-bg)" />

      {/* Top-left inner glow for depth */}
      <rect width="36" height="20" rx="9" fill="url(#ac-logo-hi)" />

      {/* Subtle bottom rim shadow */}
      <rect x="1" y="28" width="34" height="7" rx="0" fill="black" fillOpacity="0.08" />
      <rect x="0" y="27" width="36" height="9" rx="9" fill="black" fillOpacity="0.04" />

      {/* The "A" lettermark — clean geometric shape */}
      {/* Outer path: peak → right outer leg → step in → center → step in → left outer leg → close */}
      <path
        d="M18 7 L28.5 28.5 L23.5 28.5 L18 16 L12.5 28.5 L7.5 28.5 Z"
        fill="white"
        fillOpacity="0.97"
      />
      {/* Crossbar */}
      <rect x="11.5" y="20" width="13" height="2.5" rx="1.25" fill="white" fillOpacity="0.97" />
    </svg>
  )
}

interface LogoProps {
  size?: number
  textSize?: string
  className?: string
  collapsed?: boolean
}

export function Logo({ size = 32, textSize = 'text-sm', className, collapsed }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ''}`}>
      <LogoMark size={size} />
      {!collapsed && (
        <span className={`font-semibold tracking-tight text-white ${textSize}`}>
          Ambassador<span style={{ color: '#0AB3CC' }}>C</span>
        </span>
      )}
    </div>
  )
}

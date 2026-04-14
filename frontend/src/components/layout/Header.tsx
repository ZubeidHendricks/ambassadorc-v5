import { useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Menu, Search, Bell } from 'lucide-react'

const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/referrals': 'Submit Referrals',
  '/referrals/history': 'Referral History',
  '/leads': 'Submit Lead',
  '/leads/history': 'Lead History',
  '/leaderboard': 'Leaderboard',
  '/profile': 'Profile',
  '/admin': 'Admin Dashboard',
  '/admin/clients': 'Clients',
  '/admin/products': 'Products',
  '/admin/policies': 'Policies',
  '/admin/sales': 'Sales Pipeline',
  '/admin/qa': 'Quality Assurance',
  '/admin/commissions': 'Commissions',
  '/admin/agents': 'Agent Management',
  '/admin/ai-agents': 'AI Agents',
  '/admin/workflows': 'Workflows',
  '/admin/integrations': 'Integrations',
  '/admin/documents': 'Documents',
  '/admin/sms': 'SMS Center',
  '/admin/premium-changes': 'Premium Changes',
  '/admin/sql': 'SQL Console',
  '/admin/sync': 'FoxPro Sync',
  '/admin/reports': 'Reports',
  '/payments': 'My Payments',
}

interface HeaderProps {
  onMobileMenuToggle: () => void
  onCommandPaletteOpen: () => void
}

export default function Header({ onMobileMenuToggle, onCommandPaletteOpen }: HeaderProps) {
  const { user } = useAuth()
  const location = useLocation()

  const pageTitle = routeTitles[location.pathname] || 'AmbassadorC'

  if (!user) return null

  return (
    <header className="win11-mica sticky top-0 z-20 h-[52px]">
      <div className="flex h-full items-center justify-between px-5 lg:px-7">

        {/* Left */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMobileMenuToggle}
            className="md:hidden rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-[15px] font-semibold text-gray-900 tracking-tight">{pageTitle}</h1>
        </div>

        {/* Center: Search */}
        <button
          onClick={onCommandPaletteOpen}
          className="hidden sm:flex items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-sm text-gray-400 hover:border-gray-300 hover:bg-white hover:text-gray-500 transition-all max-w-xs w-full mx-6"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left text-[13px]">Search…</span>
          <kbd className="hidden lg:inline-flex h-5 items-center gap-0.5 rounded-md border border-gray-200 bg-white px-1.5 text-[10px] font-mono text-gray-400">
            ⌘K
          </kbd>
        </button>

        {/* Right */}
        <div className="flex items-center gap-1">
          <button
            onClick={onCommandPaletteOpen}
            className="sm:hidden rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
            aria-label="Search"
          >
            <Search className="h-4.5 w-4.5" />
          </button>
          <button className="relative rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <Bell className="h-4.5 w-4.5" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
          </button>
          {/* User avatar */}
          <div className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ background: '#004D99' }}>
            {user.firstName?.[0]}{user.lastName?.[0]}
          </div>
        </div>
      </div>
    </header>
  )
}

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
    <header className="sticky top-0 z-20 h-14 border-b border-gray-200/80 bg-white/80 backdrop-blur-xl">
      <div className="flex h-full items-center justify-between px-4 lg:px-6">
        {/* Left: Mobile menu + Page title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMobileMenuToggle}
            className="md:hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{pageTitle}</h1>
          </div>
        </div>

        {/* Center: Search trigger */}
        <button
          onClick={onCommandPaletteOpen}
          className="hidden sm:flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-2 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-500 transition-colors max-w-xs w-full mx-4"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="hidden lg:inline-flex h-5 items-center rounded border border-gray-300 bg-white px-1.5 text-[10px] font-mono font-medium text-gray-400">
            Ctrl+K
          </kbd>
        </button>

        {/* Right: Notifications */}
        <div className="flex items-center gap-2">
          <button
            onClick={onCommandPaletteOpen}
            className="sm:hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
          <button className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-error" />
          </button>
        </div>
      </div>
    </header>
  )
}

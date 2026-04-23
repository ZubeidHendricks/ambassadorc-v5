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
  '/admin/export-status': 'Export & Q-Link Status',
  '/admin/leads': 'All Leads',
  '/admin/lead-pipeline': 'Lead Pipeline',
  '/admin/dialler': 'Lead Dialler',
  '/admin/agent-diallist': 'My Dial List',
  '/admin/ambassador-backend': 'Ambassador Backend',
  '/payments': 'My Payments',
}

interface HeaderProps {
  onMobileMenuToggle: () => void
  onCommandPaletteOpen: () => void
}

export default function Header({ onMobileMenuToggle, onCommandPaletteOpen }: HeaderProps) {
  const { user } = useAuth()
  const location = useLocation()

  const pageTitle = routeTitles[location.pathname]
    ?? (location.pathname.startsWith('/admin/leads/') ? 'Lead Journey' : 'AmbassadorC')

  if (!user) return null

  return (
    <header className="win11-mica sticky top-0 z-20 h-[56px]">
      <div className="flex h-full items-center justify-between px-5 lg:px-6 gap-4">

        {/* Left — hamburger + page title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMobileMenuToggle}
            className="md:hidden rounded-xl p-1.5 text-gray-400 hover:bg-black/[0.06] hover:text-gray-700 transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-[15px] font-semibold text-gray-900 tracking-tight">{pageTitle}</h1>
        </div>

        {/* Center — search pill */}
        <button
          onClick={onCommandPaletteOpen}
          className="hidden sm:flex flex-1 max-w-sm items-center gap-2.5 rounded-3xl border border-black/[0.08] bg-white/60 px-4 py-2 text-sm text-gray-400 shadow-sm hover:bg-white/90 hover:border-black/[0.12] hover:text-gray-500 transition-all"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="flex-1 text-left text-[13px]">Search…</span>
          <kbd className="hidden lg:inline-flex h-5 items-center gap-0.5 rounded-lg border border-gray-200 bg-white px-1.5 text-[10px] font-mono text-gray-400 shadow-sm">
            ⌘K
          </kbd>
        </button>

        {/* Right — icons + avatar */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onCommandPaletteOpen}
            className="sm:hidden rounded-xl p-1.5 text-gray-400 hover:bg-black/[0.06] transition-colors"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>

          <button className="relative rounded-xl p-1.5 text-gray-400 hover:bg-black/[0.06] hover:text-gray-600 transition-colors">
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shadow-sm" />
          </button>

          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm ring-2 ring-white"
            style={{ background: '#0067C0' }}
          >
            {user.firstName?.[0]}{user.lastName?.[0]}
          </div>
        </div>
      </div>
    </header>
  )
}

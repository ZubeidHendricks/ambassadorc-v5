import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import {
  Menu,
  X,
  LayoutDashboard,
  Users,
  UserPlus,
  User,
  LogOut,
  ChevronDown,
  Shield,
  Package,
  FileText,
  ShoppingCart,
  CheckSquare,
  Coins,
  UserCheck,
  Bot,
  GitBranch,
  MessageSquare,
  DollarSign,
  Plug,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/referrals', label: 'Referrals', icon: Users },
  { to: '/leads', label: 'Leads', icon: UserPlus },
]

const adminLinks = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/clients', label: 'Clients', icon: Users },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/policies', label: 'Policies', icon: Shield },
  { to: '/admin/sales', label: 'Sales', icon: ShoppingCart },
  { to: '/admin/qa', label: 'QA', icon: CheckSquare },
  { to: '/admin/commissions', label: 'Commissions', icon: Coins },
  { to: '/admin/agents', label: 'Agents', icon: UserCheck },
  { to: '/admin/ai-agents', label: 'AI Agents', icon: Bot },
  { to: '/admin/workflows', label: 'Workflows', icon: GitBranch },
  { to: '/admin/integrations', label: 'Integrations', icon: Plug },
  { to: '/admin/documents', label: 'Documents', icon: FileText },
  { to: '/admin/sms', label: 'SMS', icon: MessageSquare },
  { to: '/admin/premium-changes', label: 'Premium Changes', icon: DollarSign },
]

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'QA_OFFICER'

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-green">
            <span className="text-lg font-bold text-white">L</span>
          </div>
          <span className="text-xl font-bold text-gray-900">
            Life<span className="text-brand-green">saver</span>
          </span>
        </Link>

        {/* Desktop nav */}
        {user && (
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon
              const isActive =
                location.pathname === link.to ||
                location.pathname.startsWith(link.to + '/')
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-green/10 text-brand-green-dark'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              )
            })}

            {/* Admin dropdown */}
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    location.pathname.startsWith('/admin')
                      ? 'bg-brand-teal/10 text-brand-teal'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <Shield className="h-4 w-4" />
                  Admin
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', adminMenuOpen && 'rotate-180')} />
                </button>

                {adminMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setAdminMenuOpen(false)}
                    />
                    <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg">
                      {adminLinks.map((link) => {
                        const Icon = link.icon
                        const isActive = location.pathname === link.to
                        return (
                          <Link
                            key={link.to}
                            to={link.to}
                            onClick={() => setAdminMenuOpen(false)}
                            className={cn(
                              'flex items-center gap-2.5 px-4 py-2 text-sm transition-colors',
                              isActive
                                ? 'bg-brand-teal/10 text-brand-teal font-medium'
                                : 'text-gray-700 hover:bg-gray-50'
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            {link.label}
                          </Link>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </nav>
        )}

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="hidden md:flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-teal text-white text-xs font-bold">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
                <span className="max-w-[120px] truncate">
                  {user.firstName}
                </span>
                <ChevronDown className="h-4 w-4" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    <Link
                      to="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Button variant="ghost" asChild>
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link to="/register">Register</Link>
              </Button>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 py-3 max-h-[80vh] overflow-y-auto">
          {user ? (
            <>
              <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-teal text-white font-bold">
                  {user.firstName[0]}
                  {user.lastName[0]}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{user.mobileNo}</p>
                </div>
              </div>
              {navLinks.map((link) => {
                const Icon = link.icon
                const isActive =
                  location.pathname === link.to ||
                  location.pathname.startsWith(link.to + '/')
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-green/10 text-brand-green-dark'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                )
              })}

              {/* Admin section in mobile */}
              {isAdmin && (
                <>
                  <div className="my-3 border-t border-gray-100 pt-3">
                    <p className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Admin
                    </p>
                  </div>
                  {adminLinks.map((link) => {
                    const Icon = link.icon
                    const isActive = location.pathname === link.to
                    return (
                      <Link
                        key={link.to}
                        to={link.to}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-brand-teal/10 text-brand-teal'
                            : 'text-gray-600 hover:bg-gray-100'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {link.label}
                      </Link>
                    )
                  })}
                </>
              )}

              <div className="my-3 border-t border-gray-100 pt-3">
                <Link
                  to="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  <User className="h-4 w-4" />
                  Profile
                </Link>
                <button
                  onClick={() => {
                    setMobileOpen(false)
                    handleLogout()
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <Button variant="ghost" asChild className="justify-start">
                <Link to="/login" onClick={() => setMobileOpen(false)}>
                  Login
                </Link>
              </Button>
              <Button asChild>
                <Link to="/register" onClick={() => setMobileOpen(false)}>
                  Register
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}

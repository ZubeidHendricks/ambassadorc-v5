import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  UserPlus,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
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
  Trophy,
  Send,
  History,
  X,
  Terminal,
} from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: any
}

interface NavSection {
  title: string
  items: NavItem[]
  roles?: string[]
}

const sections: NavSection[] = [
  {
    title: 'Main',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/referrals', label: 'Submit Referrals', icon: Send },
      { to: '/referrals/history', label: 'Referral History', icon: History },
      { to: '/leads', label: 'Submit Lead', icon: UserPlus },
      { to: '/leads/history', label: 'Lead History', icon: History },
      { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    ],
  },
  {
    title: 'Sales & CRM',
    roles: ['AGENT', 'QA_OFFICER', 'ADMIN'],
    items: [
      { to: '/admin/clients', label: 'Clients', icon: Users },
      { to: '/admin/sales', label: 'Sales', icon: ShoppingCart },
      { to: '/admin/commissions', label: 'Commissions', icon: Coins },
    ],
  },
  {
    title: 'Operations',
    roles: ['QA_OFFICER', 'ADMIN'],
    items: [
      { to: '/admin', label: 'Admin Dashboard', icon: LayoutDashboard },
      { to: '/admin/qa', label: 'Quality Assurance', icon: CheckSquare },
      { to: '/admin/policies', label: 'Policies', icon: Shield },
      { to: '/admin/documents', label: 'Documents', icon: FileText },
    ],
  },
  {
    title: 'Administration',
    roles: ['ADMIN'],
    items: [
      { to: '/admin/products', label: 'Products', icon: Package },
      { to: '/admin/premium-changes', label: 'Premium Changes', icon: DollarSign },
      { to: '/admin/agents', label: 'Agents', icon: UserCheck },
      { to: '/admin/ai-agents', label: 'AI Agents', icon: Bot },
      { to: '/admin/workflows', label: 'Workflows', icon: GitBranch },
      { to: '/admin/sms', label: 'SMS Center', icon: MessageSquare },
      { to: '/admin/integrations', label: 'Integrations', icon: Plug },
      { to: '/admin/sql', label: 'SQL Console', icon: Terminal },
    ],
  },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/admin' && location.pathname.startsWith(path + '/'))

  const visibleSections = sections.filter(
    (s) => !s.roles || s.roles.includes(user.role)
  )

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-white/10">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-white text-sm">
          AC
        </div>
        {!collapsed && (
          <span className="text-lg font-bold text-white tracking-tight">
            Ambassador<span className="text-primary-light">C</span>
          </span>
        )}
        {/* Mobile close */}
        <button
          onClick={onMobileClose}
          className="ml-auto md:hidden rounded-lg p-1.5 text-white/60 hover:text-white hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll px-3 py-4 space-y-6">
        {visibleSections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-white/40">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const active = isActive(item.to)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onMobileClose}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      active
                        ? 'bg-primary text-white shadow-lg shadow-primary/25'
                        : 'text-white/70 hover:bg-white/8 hover:text-white',
                      collapsed && 'justify-center px-2'
                    )}
                  >
                    <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-white' : 'text-white/50 group-hover:text-white/80')} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-white/10 p-3">
        <Link
          to="/profile"
          onClick={onMobileClose}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/70 hover:bg-white/8 hover:text-white transition-colors',
            collapsed && 'justify-center px-2'
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ambassador text-white text-xs font-bold">
            {user.firstName[0]}{user.lastName[0]}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-white">{user.firstName} {user.lastName}</p>
              <p className="truncate text-xs text-white/40">{user.role}</p>
            </div>
          )}
        </Link>
        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          className={cn(
            'mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-colors',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse toggle - desktop only */}
      <button
        onClick={onToggle}
        className="hidden md:flex h-10 items-center justify-center border-t border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-sidebar h-screen sticky top-0 transition-all duration-300 ease-in-out z-30',
          collapsed ? 'w-[68px]' : 'w-64'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onMobileClose} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-sidebar animate-slide-in">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}

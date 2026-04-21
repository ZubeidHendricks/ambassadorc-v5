import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { Logo, LogoMark } from '@/components/ui/Logo'
import {
  LayoutDashboard,
  Users,
  UserPlus,
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
  ArrowLeftRight,
  Wallet,
  FileBarChart,
  FileCheck2,
  Landmark,
} from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: any
  roles?: string[]
}

interface NavSection {
  title: string
  items: NavItem[]
  roles?: string[]
}

const sections: NavSection[] = [
  {
    title: 'Personal',
    items: [
      { to: '/dashboard', label: 'My Dashboard', icon: LayoutDashboard },
      { to: '/referrals/history', label: 'Referral History', icon: History },
      { to: '/leads/history', label: 'Lead History', icon: History },
      { to: '/payments', label: 'My Payments', icon: Wallet },
      { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    ],
  },
  {
    title: 'Workspace Home',
    roles: ['QA_OFFICER', 'ADMIN'],
    items: [
      { to: '/admin', label: 'Operations Center', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Marketing & Agents',
    roles: ['ADMIN', 'QA_OFFICER', 'AGENT', 'AMBASSADOR'],
    items: [
      { to: '/admin/agents', label: 'Agent Management', icon: UserCheck, roles: ['ADMIN'] },
      { to: '/referrals', label: 'Submit Referrals', icon: Send },
      { to: '/leads', label: 'Submit Lead', icon: UserPlus },
      { to: '/admin/ambassador-backend', label: 'Ambassador Backend', icon: Landmark, roles: ['ADMIN'] },
    ],
  },
  {
    title: 'Engagement & Collections',
    roles: ['AGENT', 'QA_OFFICER', 'ADMIN'],
    items: [
      { to: '/admin/clients', label: 'Client Records', icon: Users },
      { to: '/admin/sales', label: 'Sales Capture', icon: ShoppingCart },
      { to: '/admin/commissions', label: 'Commissions', icon: Coins },
      { to: '/admin/qa', label: 'QA Validation', icon: CheckSquare, roles: ['QA_OFFICER', 'ADMIN'] },
      { to: '/admin/export-status', label: 'Export & Q-Link', icon: FileCheck2, roles: ['QA_OFFICER', 'ADMIN'] },
      { to: '/admin/policies', label: 'Policies', icon: Shield, roles: ['QA_OFFICER', 'ADMIN'] },
      { to: '/admin/reports', label: 'Operations Exports', icon: FileBarChart, roles: ['ADMIN'] },
    ],
  },
  {
    title: 'Client Communications',
    roles: ['QA_OFFICER', 'ADMIN'],
    items: [
      { to: '/admin/documents', label: 'Document Delivery', icon: FileText },
      { to: '/admin/sms', label: 'SMS Center', icon: MessageSquare, roles: ['ADMIN'] },
    ],
  },
  {
    title: 'System Admin',
    roles: ['ADMIN'],
    items: [
      { to: '/admin/products', label: 'Products', icon: Package },
      { to: '/admin/premium-changes', label: 'Premium Updates', icon: DollarSign },
      { to: '/admin/ai-agents', label: 'AI Agents', icon: Bot },
      { to: '/admin/workflows', label: 'Workflows', icon: GitBranch },
      { to: '/admin/integrations', label: 'Integrations', icon: Plug },
      { to: '/admin/sql', label: 'SQL Console', icon: Terminal },
      { to: '/admin/sync', label: 'FoxPro Sync', icon: ArrowLeftRight },
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
  ).map(section => {
    const allowedItems = section.items.filter(item => {
      if (item.roles && !item.roles.includes(user.role)) return false
      return true
    })
    
    return { ...section, items: allowedItems }
  }).filter(section => section.items.length > 0)

  const sidebarContent = (
    <div className="flex h-full flex-col bg-gray-900 text-gray-300">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-gray-800">
        {collapsed
          ? <LogoMark size={32} />
          : <Logo size={32} textSize="text-base" />
        }
        <button
          onClick={onMobileClose}
          className="ml-auto md:hidden rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-gray-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll px-3 py-4 space-y-6">
        {visibleSections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
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
                      'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-100',
                      active
                        ? 'bg-primary text-white font-medium shadow-sm'
                        : 'font-normal text-gray-400 hover:bg-gray-800 hover:text-gray-200',
                      collapsed && 'justify-center px-2'
                    )}
                  >
                    <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-white' : 'text-gray-500 group-hover:text-gray-300')} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-gray-800 p-3 bg-gray-900">
        <Link
          to="/profile"
          onClick={onMobileClose}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors',
            collapsed && 'justify-center px-2'
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shadow-sm">
            {user.firstName[0]}{user.lastName[0]}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-gray-200">{user.firstName} {user.lastName}</p>
              <p className="truncate text-xs text-gray-500">{user.role.replace('_', ' ')}</p>
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
        className="hidden md:flex h-10 items-center justify-center border-t border-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors bg-gray-900"
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
          'hidden md:flex flex-col h-screen sticky top-0 transition-all duration-300 ease-in-out z-30 shadow-xl border-r border-gray-800',
          collapsed ? 'w-[68px]' : 'w-64'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onMobileClose} />
          <aside className="absolute left-0 top-0 h-full w-72 animate-slide-in shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}

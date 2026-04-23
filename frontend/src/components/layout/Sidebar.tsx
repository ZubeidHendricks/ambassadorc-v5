import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { Logo, LogoMark } from '@/components/ui/Logo'
import { sections } from './navConfig'
import { LogOut, ChevronLeft, ChevronRight, X } from 'lucide-react'

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

  const visibleSections = sections
    .filter(s => !s.roles || s.roles.includes(user.role))
    .map(section => ({
      ...section,
      items: section.items.filter(item => !item.roles || item.roles.includes(user.role)),
    }))
    .filter(section => section.items.length > 0)

  const roleLabel = user.role.replace(/_/g, ' ')

  const sidebarContent = (
    <div className="flex h-full flex-col">

      {/* Logo bar */}
      <div className={cn(
        'flex h-[60px] items-center border-b border-black/[0.06] px-4',
        collapsed ? 'justify-center' : 'gap-3'
      )}>
        {collapsed ? <LogoMark size={30} /> : <Logo size={30} textSize="text-[15px]" />}
        <button
          onClick={onMobileClose}
          className="ml-auto md:hidden rounded-xl p-1.5 text-gray-400 hover:bg-black/5 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll px-2.5 py-3 space-y-5">
        {visibleSections.map(section => (
          <div key={section.title}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(item => {
                const Icon = item.icon
                const active = isActive(item.to)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onMobileClose}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'group flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-all duration-150',
                      active
                        ? 'bg-primary/10 text-primary font-semibold shadow-sm shadow-primary/10'
                        : 'font-normal text-gray-600 hover:bg-black/[0.04] hover:text-gray-900',
                      collapsed && 'justify-center px-2.5'
                    )}
                  >
                    <Icon className={cn(
                      'h-[17px] w-[17px] shrink-0 transition-colors',
                      active ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600'
                    )} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {active && !collapsed && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-black/[0.06] p-2.5 space-y-0.5">
        <Link
          to="/profile"
          onClick={onMobileClose}
          className={cn(
            'flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-black/[0.04]',
            collapsed && 'justify-center px-2.5'
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white text-[11px] font-bold shadow-sm">
            {user.firstName[0]}{user.lastName[0]}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-[13px] font-semibold text-gray-800">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-[11px] text-gray-400 capitalize">{roleLabel.toLowerCase()}</p>
            </div>
          )}
        </Link>

        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-red-500/80 transition-colors hover:bg-red-50 hover:text-red-600',
            collapsed && 'justify-center px-2.5'
          )}
        >
          <LogOut className="h-[16px] w-[16px] shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="hidden md:flex h-9 items-center justify-center border-t border-black/[0.06] text-gray-400 hover:text-gray-700 hover:bg-black/[0.04] transition-colors text-xs gap-1.5"
      >
        {collapsed
          ? <ChevronRight className="h-3.5 w-3.5" />
          : <ChevronLeft className="h-3.5 w-3.5" />
        }
        {!collapsed && <span className="text-[11px] font-medium">Collapse</span>}
      </button>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={cn(
        'win11-sidebar hidden md:flex flex-col h-screen sticky top-0 z-30 transition-all duration-300 ease-in-out',
        collapsed ? 'w-[64px]' : 'w-60'
      )}>
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onMobileClose} />
          <aside className="win11-sidebar absolute left-0 top-0 h-full w-72 animate-slide-in shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Command } from 'cmdk'
import {
  LayoutDashboard,
  Users,
  UserPlus,
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
  User,
  Search,
} from 'lucide-react'

interface CommandItem {
  id: string
  label: string
  icon: any
  path: string
  section: string
  roles?: string[]
}

const allCommands: CommandItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', section: 'Navigation' },
  { id: 'referrals', label: 'Submit Referrals', icon: Send, path: '/referrals', section: 'Actions' },
  { id: 'referral-history', label: 'Referral History', icon: History, path: '/referrals/history', section: 'Navigation' },
  { id: 'leads', label: 'Submit Lead', icon: UserPlus, path: '/leads', section: 'Actions' },
  { id: 'lead-history', label: 'Lead History', icon: History, path: '/leads/history', section: 'Navigation' },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, path: '/leaderboard', section: 'Navigation' },
  { id: 'profile', label: 'Profile', icon: User, path: '/profile', section: 'Navigation' },
  { id: 'admin', label: 'Admin Dashboard', icon: LayoutDashboard, path: '/admin', section: 'Admin', roles: ['ADMIN', 'QA_OFFICER'] },
  { id: 'clients', label: 'Clients', icon: Users, path: '/admin/clients', section: 'Admin', roles: ['AGENT', 'QA_OFFICER', 'ADMIN'] },
  { id: 'sales', label: 'Sales Pipeline', icon: ShoppingCart, path: '/admin/sales', section: 'Admin', roles: ['AGENT', 'QA_OFFICER', 'ADMIN'] },
  { id: 'commissions', label: 'Commissions', icon: Coins, path: '/admin/commissions', section: 'Admin', roles: ['AGENT', 'QA_OFFICER', 'ADMIN'] },
  { id: 'qa', label: 'Quality Assurance', icon: CheckSquare, path: '/admin/qa', section: 'Admin', roles: ['QA_OFFICER', 'ADMIN'] },
  { id: 'policies', label: 'Policies', icon: Shield, path: '/admin/policies', section: 'Admin', roles: ['QA_OFFICER', 'ADMIN'] },
  { id: 'products', label: 'Products', icon: Package, path: '/admin/products', section: 'Admin', roles: ['ADMIN'] },
  { id: 'agents', label: 'Agent Management', icon: UserCheck, path: '/admin/agents', section: 'Admin', roles: ['ADMIN'] },
  { id: 'ai-agents', label: 'AI Agents', icon: Bot, path: '/admin/ai-agents', section: 'Admin', roles: ['ADMIN'] },
  { id: 'workflows', label: 'Workflows', icon: GitBranch, path: '/admin/workflows', section: 'Admin', roles: ['ADMIN'] },
  { id: 'sms', label: 'SMS Center', icon: MessageSquare, path: '/admin/sms', section: 'Admin', roles: ['ADMIN'] },
  { id: 'integrations', label: 'Integrations', icon: Plug, path: '/admin/integrations', section: 'Admin', roles: ['ADMIN'] },
  { id: 'documents', label: 'Documents', icon: FileText, path: '/admin/documents', section: 'Admin', roles: ['QA_OFFICER', 'ADMIN'] },
  { id: 'premium-changes', label: 'Premium Changes', icon: DollarSign, path: '/admin/premium-changes', section: 'Admin', roles: ['ADMIN'] },
]

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [search, setSearch] = useState('')

  const commands = allCommands.filter(
    (cmd) => !cmd.roles || (user && cmd.roles.includes(user.role))
  )

  const sections = [...new Set(commands.map((c) => c.section))]

  const handleSelect = useCallback((path: string) => {
    navigate(path)
    onClose()
    setSearch('')
  }, [navigate, onClose])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) onClose()
        else onClose() // parent handles open toggle
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="flex items-start justify-center pt-[15vh] px-4">
        <div className="w-full max-w-lg animate-scale-in">
          <Command
            className="rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
            shouldFilter={true}
          >
            <div className="flex items-center gap-3 border-b border-gray-100 px-4">
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Search pages, actions..."
                className="flex-1 h-12 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
              />
              <kbd className="hidden sm:inline-flex h-6 items-center rounded border border-gray-200 bg-gray-50 px-1.5 text-[10px] font-mono text-gray-400">
                ESC
              </kbd>
            </div>
            <Command.List className="max-h-72 overflow-y-auto p-2">
              <Command.Empty className="py-8 text-center text-sm text-gray-400">
                No results found.
              </Command.Empty>
              {sections.map((section) => (
                <Command.Group key={section} heading={section} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-gray-400">
                  {commands
                    .filter((c) => c.section === section)
                    .map((cmd) => {
                      const Icon = cmd.icon
                      return (
                        <Command.Item
                          key={cmd.id}
                          value={cmd.label}
                          onSelect={() => handleSelect(cmd.path)}
                          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 cursor-pointer aria-selected:bg-primary-50 aria-selected:text-primary transition-colors"
                        >
                          <Icon className="h-4 w-4 text-gray-400" />
                          <span>{cmd.label}</span>
                        </Command.Item>
                      )
                    })}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </div>
      </div>
    </div>
  )
}

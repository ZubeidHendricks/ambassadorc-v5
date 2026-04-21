import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  Users,
  Shield,
  DollarSign,
  AlertCircle,
  UserCheck,
  Coins,
  ArrowRight,
  MessageSquare,
  Building,
  Briefcase,
  Send,
  Landmark,
  type LucideIcon,
} from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import {
  getAdminDashboardStats,
  type AdminDashboardStats,
} from '@/lib/api'

const emptyStats: AdminDashboardStats = {
  totalClients: 0,
  activePolicies: 0,
  monthlyRevenue: 0,
  pendingQA: 0,
  activeAgents: 0,
  commissionsPaid: 0,
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<AdminDashboardStats>(emptyStats)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAdminDashboardStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const formatCurrency = (val: number) =>
    `R${val.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`
  const statValue = (value: string | number) => loading ? '—' : value
  const bookCoverage = stats.totalClients > 0
    ? Math.min(100, Math.round((stats.activePolicies / stats.totalClients) * 100))
    : 0
  const commissionShare = stats.monthlyRevenue > 0
    ? Math.min(100, Math.round((stats.commissionsPaid / stats.monthlyRevenue) * 100))
    : 0
  const qaLoad = Math.min(100, stats.pendingQA * 10)

  const processColumns: ProcessColumn[] = [
    {
      title: 'Marketing & Ambassador App',
      icon: Building,
      cards: [
        {
          id: 'first-app-marketing',
          to: '/admin/ambassador-backend',
          title: 'First App: Ambassador Marketing',
          description: 'WhatsApp invite, ambassador registration, referrals, member sign-up, and earnings rules for R100 / R100 / R1000 incentives.',
          tags: ['WhatsApp Invite', 'Referrals', 'Member Sign-Up'],
          icon: Send,
          roles: ['ADMIN'],
        },
        {
          id: 'lead-intake',
          to: '/admin/sales',
          title: 'Lead Intake',
          description: 'Capture member leads from the ambassador journey and marketing campaigns into the operational queue.',
          tags: ['Lead Capture', 'Campaigns'],
        },
        {
          id: 'agent-management',
          to: '/admin/agents',
          title: 'Agent Management',
          description: 'Master access, loading sales agents, assigning campaigns, and operational user setup.',
          tags: ['Master Access', 'Sales Agents', 'Campaigns'],
          roles: ['ADMIN'],
        },
        {
          id: 'ambassador-backend',
          to: '/admin/ambassador-backend',
          title: 'Ambassador Backend & FNB Cycle',
          description: 'Backend earnings table, payment status tracking, FNB exports, paid rows, and dashboard activity updates.',
          tags: ['Backend Table', 'FNB Payment Cycle'],
          icon: Landmark,
          roles: ['ADMIN'],
        },
      ],
    },
    {
      title: 'Engagement, Onboarding & Collections',
      icon: Briefcase,
      cards: [
        {
          id: 'sales-capture',
          to: '/admin/sales',
          title: 'Sales Capture',
          description: 'New policy capture, sales pipeline movement, and FoxPro sales status visibility.',
          tags: ['Sales Capture', 'Pipeline'],
        },
        {
          id: 'qa-validation',
          to: '/admin/qa',
          title: 'QA Validation',
          description: 'QA mailbox for QC, repair, client cancelled, and QA validation passed outcomes.',
          tags: ['QA', 'QC', 'Client Cancelled'],
        },
        {
          id: 'export-q-link',
          to: '/admin/export-status',
          title: 'Export & Q-Link Outcomes',
          description: 'Exported awaiting outcome, Q-Link uploaded, RC/C, t1, and u status monitoring.',
          tags: ['Q-Link Uploaded', 'RC/C', 't1', 'u'],
        },
        {
          id: 'operations-exports',
          to: '/admin/reports',
          title: 'Operations Exports',
          description: 'Workbook-style reporting for export status, monthly premium collections, and the global book.',
          tags: ['Reports', 'Premium Collections'],
          roles: ['ADMIN'],
        },
        {
          id: 'premium-updates',
          to: '/admin/premium-changes',
          title: 'Premium Updates',
          description: 'Bulk premium updates, policy changes, and collections adjustment workflow.',
          tags: ['Premium Updates', 'Collections'],
          roles: ['ADMIN'],
        },
      ],
    },
    {
      title: 'Client Communications',
      icon: MessageSquare,
      cards: [
        {
          id: 'document-delivery',
          to: '/admin/documents',
          title: 'Document Delivery',
          description: 'Welcome packs, policy documents, and client onboarding delivery tracking.',
          tags: ['Welcome Packs', 'Documents'],
        },
        {
          id: 'sms-client-communication',
          to: '/admin/sms',
          title: 'SMS & Client Communication',
          description: 'Client communication messaging, payment notifications, and bulk SMS operations.',
          tags: ['SMS', 'Client Communication'],
          roles: ['ADMIN'],
        },
      ],
    },
  ]

  const canSeeCard = (card: ProcessCardConfig) =>
    !card.roles || (!!user && card.roles.includes(user.role))

  return (
    <div className="space-y-6 p-6 lg:p-8 animate-fade-in bg-gray-50/50 min-h-full">
      <div className="flex items-end justify-between border-b border-gray-200 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-1">Operations Workspace</p>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">FoxPro Operations Center</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Centralized routing for South African insurance operations, starting with the ambassador marketing app and flowing through onboarding, collections, and client communications.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Total Clients"
          value={statValue(stats.totalClients.toLocaleString())}
          icon={<Users className="h-5 w-5" />}
          iconColor="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Active Policies"
          value={statValue(stats.activePolicies.toLocaleString())}
          icon={<Shield className="h-5 w-5" />}
          iconColor="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Monthly Revenue"
          value={statValue(formatCurrency(stats.monthlyRevenue))}
          icon={<DollarSign className="h-5 w-5" />}
          iconColor="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          label="Pending QA"
          value={statValue(stats.pendingQA)}
          icon={<AlertCircle className="h-5 w-5" />}
          iconColor="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Active Agents"
          value={statValue(stats.activeAgents)}
          icon={<UserCheck className="h-5 w-5" />}
          iconColor="bg-violet-50 text-violet-600"
        />
        <StatCard
          label="Commissions"
          value={statValue(formatCurrency(stats.commissionsPaid))}
          icon={<Coins className="h-5 w-5" />}
          iconColor="bg-orange-50 text-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {processColumns.map((column) => {
          const Icon = column.icon
          const cards = column.cards.filter(canSeeCard)
          return (
            <div key={column.title} className="flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                <Icon className="h-5 w-5 text-gray-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">{column.title}</h2>
              </div>
              <div className="grid gap-3">
                {cards.map((card) => (
                  <ProcessCard key={card.id} {...card} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Analytics Snapshot</p>
          <h2 className="mt-1 text-sm font-bold text-gray-900">Book & Revenue Position</h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-lg font-black text-gray-900">{statValue(stats.totalClients.toLocaleString())}</p>
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Clients</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-lg font-black text-gray-900">{statValue(stats.activePolicies.toLocaleString())}</p>
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Policies</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-lg font-black text-gray-900">{statValue(formatCurrency(stats.monthlyRevenue))}</p>
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Revenue</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <AnalyticsMeter
              label="Policy Attachment"
              value={loading ? '—' : `${bookCoverage}%`}
              width={loading ? 0 : bookCoverage}
              tone="bg-emerald-500"
              detail="Active policies measured against client records"
            />
            <AnalyticsMeter
              label="Commission Ratio"
              value={loading ? '—' : `${commissionShare}%`}
              width={loading ? 0 : commissionShare}
              tone="bg-orange-500"
              detail="Paid commissions compared with monthly revenue"
            />
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Team Activity</p>
          <h2 className="mt-1 text-sm font-bold text-gray-900">QA, Agents & Commissions</h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-lg font-black text-amber-700">{statValue(stats.pendingQA)}</p>
              <p className="text-[10px] uppercase tracking-wide text-amber-700/70">Pending QA</p>
            </div>
            <div className="rounded-lg bg-violet-50 p-3">
              <p className="text-lg font-black text-violet-700">{statValue(stats.activeAgents)}</p>
              <p className="text-[10px] uppercase tracking-wide text-violet-700/70">Agents</p>
            </div>
            <div className="rounded-lg bg-orange-50 p-3">
              <p className="text-lg font-black text-orange-700">{statValue(formatCurrency(stats.commissionsPaid))}</p>
              <p className="text-[10px] uppercase tracking-wide text-orange-700/70">Commissions</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <AnalyticsMeter
              label="QA Queue Pressure"
              value={statValue(stats.pendingQA)}
              width={loading ? 0 : qaLoad}
              tone="bg-amber-500"
              detail="Pending QA items needing validation or repair"
            />
            <AnalyticsMeter
              label="Agent Coverage"
              value={statValue(stats.activeAgents)}
              width={loading ? 0 : Math.min(100, stats.activeAgents * 8)}
              tone="bg-violet-500"
              detail="Active agents available for marketing and onboarding work"
            />
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Operations Activity</p>
            <h2 className="mt-1 text-sm font-bold text-gray-900">Current workflow focus</h2>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
            FoxPro-aligned dashboard
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <ActivityTile
            label="Marketing"
            value="Ambassador app launch lane"
            detail="WhatsApp invite, registration, referral capture, and backend earnings table"
          />
          <ActivityTile
            label="Collections"
            value="Q-Link outcome monitoring"
            detail="RC/C, t1, u, uploaded, and exported awaiting outcome queues"
          />
          <ActivityTile
            label="Client Care"
            value="Document and SMS follow-through"
            detail="Welcome packs, policy documents, and payment communication"
          />
        </div>
      </div>
    </div>
  )
}

interface ProcessCardConfig {
  id: string
  to: string
  title: string
  description: string
  tags: string[]
  icon?: LucideIcon
  roles?: string[]
}

interface ProcessColumn {
  title: string
  icon: LucideIcon
  cards: ProcessCardConfig[]
}

function ProcessCard({ to, title, description, tags, icon: CardIcon }: ProcessCardConfig) {
  return (
    <Link 
      to={to} 
      className="group block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {CardIcon && (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CardIcon className="h-4 w-4" />
              </span>
            )}
            <h3 className="text-sm font-bold text-gray-900 transition-colors group-hover:text-primary">{title}</h3>
          </div>
          <p className="mt-1 text-xs text-gray-500 leading-relaxed">{description}</p>
        </div>
        <div className="bg-gray-50 rounded-full p-1.5 group-hover:bg-primary/10 transition-colors">
          <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
            {tag}
          </span>
        ))}
      </div>
    </Link>
  )
}

function AnalyticsMeter({
  label,
  value,
  width,
  tone,
  detail,
}: {
  label: string
  value: string | number
  width: number
  tone: string
  detail: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-gray-800">{label}</p>
          <p className="text-[11px] text-gray-500">{detail}</p>
        </div>
        <span className="text-xs font-black text-gray-900">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function ActivityTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-black text-gray-900">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-gray-500">{detail}</p>
    </div>
  )
}

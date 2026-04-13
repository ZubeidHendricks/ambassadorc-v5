import { useState, useEffect } from 'react'
import {
  Users,
  Shield,
  DollarSign,
  AlertCircle,
  UserCheck,
  Coins,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { StatCard } from '@/components/ui/stat-card'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  getAdminDashboardStats,
  getRevenueChart,
  getPipelineChart,
  getTopAgents,
  getRecentActivity,
  type AdminDashboardStats,
  type RevenueData,
  type PipelineData,
  type TopAgent,
  type ActivityItem,
} from '@/lib/api'

const emptyStats: AdminDashboardStats = {
  totalClients: 0,
  activePolicies: 0,
  monthlyRevenue: 0,
  pendingQA: 0,
  activeAgents: 0,
  commissionsPaid: 0,
}

const activityColors: Record<string, string> = {
  sale: 'bg-success-light text-success',
  qa: 'bg-primary-50 text-primary',
  commission: 'bg-warning-light text-warning',
  client: 'bg-primary-100 text-primary-dark',
  premium: 'bg-violet-50 text-violet-600',
}

const pipelineColors = ['#004D99', '#0AB3CC', '#0FCC85', '#9933FF', '#F0527A']

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminDashboardStats>(emptyStats)
  const [revenue, setRevenue] = useState<RevenueData[]>([])
  const [pipeline, setPipeline] = useState<PipelineData[]>([])
  const [topAgents, setTopAgents] = useState<TopAgent[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getAdminDashboardStats().then(setStats).catch(() => {}),
      getRevenueChart().then((d) => d.length && setRevenue(d)).catch(() => {}),
      getPipelineChart().then((d) => d.length && setPipeline(d)).catch(() => {}),
      getTopAgents().then((d) => d.length && setTopAgents(d)).catch(() => {}),
      getRecentActivity().then((d) => d.length && setActivity(d)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const formatCurrency = (val: number) =>
    `R${val.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`

  return (
    <div className="space-y-6 p-6 lg:p-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your business performance and key metrics.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Total Clients"
          value={stats.totalClients.toLocaleString()}
          icon={<Users className="h-6 w-6" />}
          iconColor="bg-primary-50 text-primary"
          trend={{ value: 12, label: 'vs last month' }}
        />
        <StatCard
          label="Active Policies"
          value={stats.activePolicies.toLocaleString()}
          icon={<Shield className="h-6 w-6" />}
          iconColor="bg-success-light text-success"
          trend={{ value: 8, label: 'vs last month' }}
        />
        <StatCard
          label="Monthly Revenue"
          value={formatCurrency(stats.monthlyRevenue)}
          icon={<DollarSign className="h-6 w-6" />}
          iconColor="bg-emerald-50 text-emerald-600"
          trend={{ value: 15, label: 'vs last month' }}
        />
        <StatCard
          label="Pending QA"
          value={stats.pendingQA}
          icon={<AlertCircle className="h-6 w-6" />}
          iconColor="bg-warning-light text-warning"
          trend={{ value: -5, label: 'vs yesterday' }}
        />
        <StatCard
          label="Active Agents"
          value={stats.activeAgents}
          icon={<UserCheck className="h-6 w-6" />}
          iconColor="bg-violet-50 text-violet-600"
          trend={{ value: 3, label: 'this week' }}
        />
        <StatCard
          label="Commissions Paid"
          value={formatCurrency(stats.commissionsPaid)}
          icon={<Coins className="h-6 w-6" />}
          iconColor="bg-amber-50 text-amber-600"
          trend={{ value: 22, label: 'vs last month' }}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue chart */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Revenue (Last 12 Months)</h2>
            <span className="flex items-center gap-1 text-xs font-medium text-success">
              <ArrowUpRight className="h-3.5 w-3.5" />
              15%
            </span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenue}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#004D99" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#004D99" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94A3B8' }} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)', fontSize: '13px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#004D99" strokeWidth={2.5} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pipeline chart */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Sales Pipeline</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)', fontSize: '13px' }} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {pipeline.map((_, index) => (
                    <Cell key={index} fill={pipelineColors[index % pipelineColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top agents */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Top Agents</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">#</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Agent</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Sales</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Revenue</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Tier</th>
                </tr>
              </thead>
              <tbody>
                {topAgents.map((agent, idx) => (
                  <tr key={agent.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3.5">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-gray-100 text-gray-600' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-400'}`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary-50 flex items-center justify-center text-xs font-bold text-primary">
                          {agent.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="font-medium text-gray-900">{agent.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 text-gray-700 font-medium">{agent.sales}</td>
                    <td className="py-3.5 font-mono text-sm text-gray-700">{formatCurrency(agent.revenue)}</td>
                    <td className="py-3.5"><StatusBadge status={agent.tier} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {activity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-gray-50/80 transition-colors">
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${activityColors[item.type] || 'bg-gray-100 text-gray-500'}`}>
                  <Clock className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{item.description}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                    <span>{item.timestamp}</span>
                    {item.user && (
                      <>
                        <span className="h-1 w-1 rounded-full bg-gray-300" />
                        <span>{item.user}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

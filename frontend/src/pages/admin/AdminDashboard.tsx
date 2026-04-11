import { useState, useEffect } from 'react'
import {
  Users,
  Shield,
  DollarSign,
  AlertCircle,
  UserCheck,
  Coins,
  Clock,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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

// Fallback demo data
const demoStats: AdminDashboardStats = {
  totalClients: 1247,
  activePolicies: 892,
  monthlyRevenue: 156400,
  pendingQA: 23,
  activeAgents: 48,
  commissionsPaid: 34200,
}

const demoRevenue: RevenueData[] = [
  { month: 'May', revenue: 98000 },
  { month: 'Jun', revenue: 105000 },
  { month: 'Jul', revenue: 112000 },
  { month: 'Aug', revenue: 108000 },
  { month: 'Sep', revenue: 120000 },
  { month: 'Oct', revenue: 128000 },
  { month: 'Nov', revenue: 135000 },
  { month: 'Dec', revenue: 140000 },
  { month: 'Jan', revenue: 132000 },
  { month: 'Feb', revenue: 145000 },
  { month: 'Mar', revenue: 151000 },
  { month: 'Apr', revenue: 156400 },
]

const demoPipeline: PipelineData[] = [
  { status: 'New', count: 45 },
  { status: 'QA Pending', count: 23 },
  { status: 'QA Approved', count: 18 },
  { status: 'Active', count: 892 },
  { status: 'Cancelled', count: 32 },
]

const demoTopAgents: TopAgent[] = [
  { id: 1, name: 'Sarah Mbeki', sales: 45, revenue: 28500, tier: 'Gold' },
  { id: 2, name: 'James Nkosi', sales: 38, revenue: 24200, tier: 'Gold' },
  { id: 3, name: 'Thandi Zulu', sales: 32, revenue: 19800, tier: 'Silver' },
  { id: 4, name: 'David Moyo', sales: 28, revenue: 17600, tier: 'Silver' },
  { id: 5, name: 'Nomsa Dlamini', sales: 25, revenue: 15200, tier: 'Bronze' },
]

const demoActivity: ActivityItem[] = [
  { id: 1, type: 'sale', description: 'New policy sold to John Doe', timestamp: '2 min ago', user: 'Sarah Mbeki' },
  { id: 2, type: 'qa', description: 'QA approved for policy #POL-1234', timestamp: '15 min ago', user: 'Admin' },
  { id: 3, type: 'commission', description: 'Commission R450 paid to James Nkosi', timestamp: '1 hour ago' },
  { id: 4, type: 'client', description: 'New client registered: Maria Santos', timestamp: '2 hours ago', user: 'Thandi Zulu' },
  { id: 5, type: 'premium', description: 'Premium increase approved for Family Plan', timestamp: '3 hours ago', user: 'Admin' },
]

const activityIcons: Record<string, string> = {
  sale: 'bg-[#96ca4f]/15 text-[#5a8a1f]',
  qa: 'bg-[#128FAF]/10 text-[#128FAF]',
  commission: 'bg-amber-50 text-amber-600',
  client: 'bg-blue-50 text-[#0077b6]',
  premium: 'bg-purple-50 text-purple-600',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminDashboardStats>(demoStats)
  const [revenue, setRevenue] = useState<RevenueData[]>(demoRevenue)
  const [pipeline, setPipeline] = useState<PipelineData[]>(demoPipeline)
  const [topAgents, setTopAgents] = useState<TopAgent[]>(demoTopAgents)
  const [activity, setActivity] = useState<ActivityItem[]>(demoActivity)

  useEffect(() => {
    getAdminDashboardStats().then(setStats).catch(() => {})
    getRevenueChart().then(setRevenue).catch(() => {})
    getPipelineChart().then(setPipeline).catch(() => {})
    getTopAgents().then(setTopAgents).catch(() => {})
    getRecentActivity().then(setActivity).catch(() => {})
  }, [])

  const formatCurrency = (val: number) =>
    `R${val.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
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
          trend={{ value: 12, label: 'vs last month' }}
        />
        <StatCard
          label="Active Policies"
          value={stats.activePolicies.toLocaleString()}
          icon={<Shield className="h-6 w-6" />}
          trend={{ value: 8, label: 'vs last month' }}
        />
        <StatCard
          label="Monthly Revenue"
          value={formatCurrency(stats.monthlyRevenue)}
          icon={<DollarSign className="h-6 w-6" />}
          trend={{ value: 15, label: 'vs last month' }}
        />
        <StatCard
          label="Pending QA"
          value={stats.pendingQA}
          icon={<AlertCircle className="h-6 w-6" />}
          trend={{ value: -5, label: 'vs yesterday' }}
        />
        <StatCard
          label="Active Agents"
          value={stats.activeAgents}
          icon={<UserCheck className="h-6 w-6" />}
          trend={{ value: 3, label: 'this week' }}
        />
        <StatCard
          label="Commissions Paid"
          value={formatCurrency(stats.commissionsPaid)}
          icon={<Coins className="h-6 w-6" />}
          trend={{ value: 22, label: 'vs last month' }}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Revenue (Last 12 Months)</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenue}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#96ca4f" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#96ca4f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#96ca4f"
                  strokeWidth={2.5}
                  fill="url(#revenueGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pipeline chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Sales Pipeline</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar dataKey="count" fill="#128FAF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top agents */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Top Agents</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    #
                  </th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Agent
                  </th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Sales
                  </th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Revenue
                  </th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Tier
                  </th>
                </tr>
              </thead>
              <tbody>
                {topAgents.map((agent, idx) => (
                  <tr key={agent.id} className="border-b border-gray-50">
                    <td className="py-3 font-medium text-gray-400">{idx + 1}</td>
                    <td className="py-3 font-medium text-gray-900">{agent.name}</td>
                    <td className="py-3 text-gray-700">{agent.sales}</td>
                    <td className="py-3 text-gray-700">{formatCurrency(agent.revenue)}</td>
                    <td className="py-3">
                      <StatusBadge status={agent.tier} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
          <div className="mt-4 space-y-4">
            {activity.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${activityIcons[item.type] || 'bg-gray-100 text-gray-500'}`}
                >
                  <Clock className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{item.description}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                    <span>{item.timestamp}</span>
                    {item.user && (
                      <>
                        <span>-</span>
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

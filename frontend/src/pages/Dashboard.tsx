import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  getDashboardStats,
  getMonthlyStats,
  type DashboardStats,
  type MonthlyStats,
} from '@/lib/api'
import { StatCard } from '@/components/ui/stat-card'
import { Button } from '@/components/ui/button'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  Users,
  UserPlus,
  Banknote,
  TrendingUp,
  Send,
  PlusCircle,
  Trophy,
  Star,
  Target,
  ArrowRight,
} from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [monthly, setMonthly] = useState<MonthlyStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [s, m] = await Promise.all([
          getDashboardStats(),
          getMonthlyStats(),
        ])
        setStats(s)
        setMonthly(m)
      } catch {
        setStats({
          totalReferrals: 0,
          totalLeads: 0,
          totalEarnings: 0,
          thisMonthReferrals: 0,
          thisMonthLeads: 0,
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const tierInfo = getTierInfo(stats?.totalReferrals ?? 0)

  return (
    <div className="space-y-6 p-6 lg:p-8 animate-fade-in">
      {/* Welcome header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-400 mb-1">Ambassador Portal</p>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">
            Welcome back, {user?.firstName}!
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link to="/referrals">
              <Send className="mr-1.5 h-4 w-4" />
              Submit Referrals
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/leads">
              <PlusCircle className="mr-1.5 h-4 w-4" />
              Submit Lead
            </Link>
          </Button>
        </div>
      </div>

      {/* Tier progress card */}
      <div className="rounded-xl bg-gradient-to-r from-primary-dark via-primary to-primary-light p-6 text-white" style={{ boxShadow: '0 4px 12px rgba(0,77,153,0.25), 0 16px 40px rgba(0,77,153,0.15)' }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <Trophy className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm text-blue-100">Current Tier</p>
              <p className="text-2xl font-bold">{tierInfo.name}</p>
            </div>
          </div>
          <div className="flex-1 max-w-md">
            <div className="flex items-center justify-between text-sm text-blue-100 mb-1.5">
              <span>{stats?.totalReferrals ?? 0} referrals</span>
              <span>{tierInfo.nextThreshold} to reach {tierInfo.nextTier}</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-white/20">
              <div
                className="h-2.5 rounded-full bg-white transition-all duration-500"
                style={{ width: `${tierInfo.progress}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-300" />
            <span className="text-sm font-medium">
              {tierInfo.remaining} more to level up
            </span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Referrals"
          value={stats?.totalReferrals ?? 0}
          icon={<Users className="h-6 w-6" />}
          iconColor="bg-primary-50 text-primary"
          trend={stats?.thisMonthReferrals ? { value: stats.thisMonthReferrals, label: 'this month' } : undefined}
        />
        <StatCard
          label="Total Leads"
          value={stats?.totalLeads ?? 0}
          icon={<UserPlus className="h-6 w-6" />}
          iconColor="bg-secondary/10 text-secondary"
          trend={stats?.thisMonthLeads ? { value: stats.thisMonthLeads, label: 'this month' } : undefined}
        />
        <StatCard
          label="Earnings"
          value={`R${(stats?.totalEarnings ?? 0).toLocaleString()}`}
          icon={<Banknote className="h-6 w-6" />}
          iconColor="bg-success-light text-success"
        />
        <StatCard
          label="This Month"
          value={(stats?.thisMonthReferrals ?? 0) + (stats?.thisMonthLeads ?? 0)}
          icon={<Target className="h-6 w-6" />}
          iconColor="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Chart & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart */}
        <div className="lg:col-span-2 win11-card p-6">
          <h2 className="text-[15px] font-semibold text-gray-900 mb-4">Monthly Activity</h2>
          {monthly.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)',
                      fontSize: '13px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="referrals" fill="#004D99" name="Referrals" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="leads" fill="#0AB3CC" name="Leads" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-72 items-center justify-center text-gray-400">
              No activity data yet. Start referring to see your chart!
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="win11-card p-6">
          <h2 className="text-[15px] font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Button asChild className="w-full justify-between" size="lg">
              <Link to="/referrals">
                <span className="flex items-center gap-3">
                  <Send className="h-5 w-5" />
                  Submit Referrals
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" className="w-full justify-between" size="lg">
              <Link to="/leads">
                <span className="flex items-center gap-3">
                  <PlusCircle className="h-5 w-5" />
                  Submit a Lead
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between" size="lg">
              <Link to="/referrals/history">
                <span className="flex items-center gap-3">
                  <Users className="h-5 w-5" />
                  Referral History
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between" size="lg">
              <Link to="/leads/history">
                <span className="flex items-center gap-3">
                  <UserPlus className="h-5 w-5" />
                  Lead History
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between" size="lg">
              <Link to="/leaderboard">
                <span className="flex items-center gap-3">
                  <Trophy className="h-5 w-5" />
                  Leaderboard
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function getTierInfo(referrals: number) {
  const tiers = [
    { name: 'Bronze', min: 0, next: 25 },
    { name: 'Silver', min: 25, next: 50 },
    { name: 'Gold', min: 50, next: 100 },
    { name: 'Platinum', min: 100, next: 250 },
    { name: 'Diamond', min: 250, next: 500 },
  ]

  let current = tiers[0]
  for (const tier of tiers) {
    if (referrals >= tier.min) current = tier
  }

  const nextTier = tiers[tiers.indexOf(current) + 1]
  const nextThreshold = nextTier?.min ?? current.next
  const progress = nextTier
    ? Math.min(100, ((referrals - current.min) / (nextThreshold - current.min)) * 100)
    : 100

  return {
    name: current.name,
    nextTier: nextTier?.name ?? 'Max',
    nextThreshold,
    progress,
    remaining: Math.max(0, nextThreshold - referrals),
  }
}

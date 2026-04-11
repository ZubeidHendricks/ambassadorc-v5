import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  getDashboardStats,
  getMonthlyStats,
  type DashboardStats,
  type MonthlyStats,
} from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Users, UserPlus, Banknote, TrendingUp, Send, PlusCircle } from 'lucide-react'

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
        // Stats might fail on first load, show zeroes
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

  const statCards = stats
    ? [
        {
          title: 'Total Referrals',
          value: stats.totalReferrals,
          icon: Users,
          color: 'text-brand-green',
          bg: 'bg-brand-green/10',
        },
        {
          title: 'Total Leads',
          value: stats.totalLeads,
          icon: UserPlus,
          color: 'text-brand-teal',
          bg: 'bg-brand-teal/10',
        },
        {
          title: 'Earnings',
          value: `R${stats.totalEarnings.toLocaleString()}`,
          icon: Banknote,
          color: 'text-emerald-600',
          bg: 'bg-emerald-100',
        },
        {
          title: 'This Month',
          value: stats.thisMonthReferrals + stats.thisMonthLeads,
          subtitle: `${stats.thisMonthReferrals} referrals, ${stats.thisMonthLeads} leads`,
          icon: TrendingUp,
          color: 'text-brand-blue',
          bg: 'bg-brand-blue/10',
        },
      ]
    : []

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="mt-1 text-gray-500">
          Here's an overview of your ambassador activity.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      {card.title}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">
                      {card.value}
                    </p>
                    {card.subtitle && (
                      <p className="mt-0.5 text-xs text-gray-400">
                        {card.subtitle}
                      </p>
                    )}
                  </div>
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.bg}`}
                  >
                    <Icon className={`h-6 w-6 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Chart & Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {monthly.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="referrals"
                    fill="#96ca4f"
                    name="Referrals"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="leads"
                    fill="#128FAF"
                    name="Leads"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-gray-400">
                No activity data yet. Start referring to see your chart!
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full justify-start gap-3" size="lg">
              <Link to="/referrals">
                <Send className="h-5 w-5" />
                Submit Referrals
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              className="w-full justify-start gap-3"
              size="lg"
            >
              <Link to="/leads">
                <PlusCircle className="h-5 w-5" />
                Submit a Lead
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full justify-start gap-3"
              size="lg"
            >
              <Link to="/referrals/history">
                <Users className="h-5 w-5" />
                Referral History
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full justify-start gap-3"
              size="lg"
            >
              <Link to="/leads/history">
                <UserPlus className="h-5 w-5" />
                Lead History
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Trophy, Star, TrendingUp, Award } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import {
  getAgents,
  getCampaigns,
  assignAgentCampaign,
  updateAgentRole,
  updateAgentTier,
  type Agent,
  type Campaign,
} from '@/lib/api'
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts'


const sparkData = [
  [{ v: 3 }, { v: 5 }, { v: 4 }, { v: 8 }, { v: 7 }, { v: 10 }, { v: 12 }],
  [{ v: 2 }, { v: 4 }, { v: 6 }, { v: 5 }, { v: 8 }, { v: 9 }, { v: 8 }],
  [{ v: 1 }, { v: 3 }, { v: 2 }, { v: 5 }, { v: 7 }, { v: 6 }, { v: 9 }],
  [{ v: 4 }, { v: 3 }, { v: 5 }, { v: 4 }, { v: 6 }, { v: 5 }, { v: 7 }],
  [{ v: 2 }, { v: 3 }, { v: 4 }, { v: 3 }, { v: 5 }, { v: 6 }, { v: 5 }],
  [{ v: 5 }, { v: 4 }, { v: 3 }, { v: 2 }, { v: 3 }, { v: 2 }, { v: 1 }],
]

const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum']
const roles = ['AMBASSADOR', 'AGENT', 'QA_OFFICER', 'ADMIN']

const formatCurrency = (val: number) =>
  `R${val.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [processing, setProcessing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getAgents(), getCampaigns()])
      .then(([agentData, campaignData]) => {
        setAgents(agentData)
        setCampaigns(campaignData)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleTierChange = async (id: number, tier: string) => {
    setProcessing(`tier-${id}`)
    try {
      await updateAgentTier(id, tier)
      setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, tier } : a)))
    } catch {
      // handle
    } finally {
      setProcessing(null)
    }
  }

  const handleRoleChange = async (id: number, role: string) => {
    setProcessing(`role-${id}`)
    try {
      await updateAgentRole(id, role)
      setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, role } : a)))
    } catch {
      // handle
    } finally {
      setProcessing(null)
    }
  }

  const handleCampaignChange = async (id: number, campaignId: string) => {
    setProcessing(`campaign-${id}`)
    const nextCampaignId = campaignId ? Number(campaignId) : null
    try {
      await assignAgentCampaign(id, nextCampaignId)
      const campaign = campaigns.find((c) => c.id === nextCampaignId)
      setAgents((prev) => prev.map((a) => (
        a.id === id
          ? { ...a, assignedCampaignId: nextCampaignId, assignedCampaignName: campaign?.name ?? null }
          : a
      )))
    } catch {
      // handle
    } finally {
      setProcessing(null)
    }
  }

  const topPerformer = [...agents].sort((a, b) => b.saleCount - a.saleCount)[0]
  const leaderboard = [...agents]
    .filter((a) => a.status === 'active')
    .sort((a, b) => b.saleCount - a.saleCount)
    .slice(0, 5)

  const columns: Column<Agent>[] = [
    {
      key: 'firstName',
      header: 'Agent',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
            {r.firstName[0]}{r.lastName[0]}
          </div>
          <div>
            <p className="font-medium text-gray-900">{r.firstName} {r.lastName}</p>
            <p className="text-xs text-gray-500">{r.mobileNo}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (r) => (
        <select
          value={r.role}
          onChange={(e) => handleRoleChange(r.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          disabled={processing === `role-${r.id}`}
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {role.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'tier',
      header: 'Tier',
      render: (r) => (
        <select
          value={r.tier}
          onChange={(e) => handleTierChange(r.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          disabled={processing === `tier-${r.id}`}
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
        >
          {tiers.map((tier) => (
            <option key={tier} value={tier}>{tier}</option>
          ))}
        </select>
      ),
    },
    { key: 'referralCount', header: 'Referrals' },
    { key: 'leadCount', header: 'Leads' },
    { key: 'saleCount', header: 'Sales' },
    {
      key: 'assignedCampaignName',
      header: 'Campaign',
      render: (r) => (
        <select
          value={r.assignedCampaignId ?? ''}
          onChange={(e) => handleCampaignChange(r.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          disabled={processing === `campaign-${r.id}`}
          className="max-w-44 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
        >
          <option value="">Unassigned</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
          ))}
        </select>
      ),
    },
    {
      key: 'totalEarnings',
      header: 'Earnings',
      render: (r) => <span className="font-semibold">{formatCurrency(r.totalEarnings)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'sparkline',
      header: 'Trend',
      sortable: false,
      render: (r) => {
        const idx = agents.indexOf(r) % sparkData.length
        return (
          <div className="h-8 w-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData[idx]}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke="#004D99"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      },
    },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agents & Ambassadors</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage master access, call-centre users, sales agents, role assignments, and campaign allocation.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Master/Admin Access</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{agents.filter((a) => a.role === 'ADMIN').length}</p>
          <p className="mt-1 text-sm text-gray-500">Users with full operational control</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Call Centre / QA</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{agents.filter((a) => a.role === 'QA_OFFICER' || a.role === 'AGENT').length}</p>
          <p className="mt-1 text-sm text-gray-500">Users who can process sales and QA work</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Active Campaigns</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{campaigns.filter((c) => c.isActive !== false).length}</p>
          <p className="mt-1 text-sm text-gray-500">Assignable sales campaigns</p>
        </div>
      </div>

      {/* Wins Section */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Top Performer */}
        {topPerformer && (
          <div className="relative overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-6 shadow-sm">
            <div className="absolute right-3 top-3 text-amber-300">
              <Trophy className="h-16 w-16 opacity-20" />
            </div>
            <div className="flex items-center gap-2 text-amber-700">
              <Trophy className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">Top Performer</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-lg font-bold text-white">
                {topPerformer.firstName[0]}{topPerformer.lastName[0]}
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">
                  {topPerformer.firstName} {topPerformer.lastName}
                </p>
                <p className="text-sm text-gray-600">
                  {topPerformer.saleCount} sales &middot; {formatCurrency(topPerformer.totalEarnings)}
                </p>
              </div>
            </div>
            <StatusBadge status={topPerformer.tier} className="mt-3" />
          </div>
        )}

        {/* Monthly Leaderboard */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2 text-gray-900">
            <Award className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold">Monthly Leaderboard</h3>
          </div>
          <div className="mt-4 space-y-3">
            {leaderboard.map((agent, idx) => (
              <div
                key={agent.id}
                className="flex items-center gap-4 rounded-lg px-3 py-2 transition-colors hover:bg-gray-50"
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    idx === 0
                      ? 'bg-amber-100 text-amber-700'
                      : idx === 1
                        ? 'bg-gray-200 text-gray-600'
                        : idx === 2
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {agent.firstName} {agent.lastName}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-600">{agent.saleCount} sales</span>
                  <span className="font-medium text-primary">{formatCurrency(agent.totalEarnings)}</span>
                  <StatusBadge status={agent.tier} />
                </div>
                {idx < 3 && (
                  <div className="flex items-center gap-1 text-xs text-primary-light">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {idx < 3 ? 'Streak' : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Agents Table */}
      <DataTable
        data={loading ? [] : agents}
        columns={columns}
        pageSize={10}
        searchable
        searchPlaceholder="Search agents..."
        searchKeys={['firstName', 'lastName', 'mobileNo']}
      />
    </div>
  )
}

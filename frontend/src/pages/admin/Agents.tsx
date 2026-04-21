import { useEffect, useMemo, useState } from 'react'
import { Award, CalendarDays, ClipboardList, KeyRound, Star, Trophy, UserPlus } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  assignAgentCampaign,
  createAgent,
  getAgents,
  getCampaigns,
  getProducts,
  updateAgentRole,
  updateAgentTier,
  type Agent,
  type Campaign,
  type Product,
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
const callCentreRoles = ['AGENT', 'QA_OFFICER', 'ADMIN']
const leadTargets = [5, 10, 15, 20]

const emptyForm = {
  firstName: '',
  lastName: '',
  mobileNo: '',
  password: '',
  role: 'AGENT',
}

const formatCurrency = (val: number) =>
  `R${val.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`

const formatDate = (value?: string) => {
  if (!value) return new Date().toLocaleDateString('en-ZA')
  return new Date(value).toLocaleDateString('en-ZA')
}

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [processing, setProcessing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('')
  const [selectedLeadTarget, setSelectedLeadTarget] = useState('10')

  useEffect(() => {
    Promise.all([getAgents(), getCampaigns(), getProducts(1, 100)])
      .then(([agentData, campaignData, productData]) => {
        setAgents(agentData)
        setCampaigns(campaignData)
        setProducts(productData.data.filter((product) => product.active !== false))
        const firstAgent = agentData.find((agent) => agent.status === 'active')
        if (firstAgent) {
          setSelectedAgentId(String(firstAgent.id))
          setSelectedCampaignId(firstAgent.assignedCampaignId ? String(firstAgent.assignedCampaignId) : '')
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not load call centre control data')
      })
      .finally(() => setLoading(false))
  }, [])

  const activeAgents = useMemo(
    () => agents.filter((agent) => agent.status === 'active' && ['AGENT', 'QA_OFFICER', 'ADMIN'].includes(agent.role)),
    [agents]
  )

  const selectedAgent = useMemo(
    () => agents.find((agent) => String(agent.id) === selectedAgentId),
    [agents, selectedAgentId]
  )

  const selectedProduct = useMemo(
    () => products.find((product) => String(product.id) === selectedProductId),
    [products, selectedProductId]
  )

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => String(campaign.id) === selectedCampaignId),
    [campaigns, selectedCampaignId]
  )

  const handleTierChange = async (id: number, tier: string) => {
    setProcessing(`tier-${id}`)
    setError(null)
    try {
      await updateAgentTier(id, tier)
      setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, tier } : a)))
      setSuccess('Agent tier updated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update agent tier')
    } finally {
      setProcessing(null)
    }
  }

  const handleRoleChange = async (id: number, role: string) => {
    setProcessing(`role-${id}`)
    setError(null)
    try {
      await updateAgentRole(id, role)
      setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, role } : a)))
      setSuccess('Agent role updated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update agent role')
    } finally {
      setProcessing(null)
    }
  }

  const handleCampaignChange = async (id: number, campaignId: string) => {
    setProcessing(`campaign-${id}`)
    setError(null)
    const nextCampaignId = campaignId ? Number(campaignId) : null
    try {
      await assignAgentCampaign(id, nextCampaignId)
      const campaign = campaigns.find((c) => c.id === nextCampaignId)
      setAgents((prev) => prev.map((a) => (
        a.id === id
          ? { ...a, assignedCampaignId: nextCampaignId, assignedCampaignName: campaign?.name ?? null }
          : a
      )))
      setSuccess('Agent campaign updated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update agent campaign')
    } finally {
      setProcessing(null)
    }
  }

  const handleCreateAgent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProcessing('create-agent')
    setError(null)
    setSuccess(null)
    try {
      const agent = await createAgent({
        ...form,
        role: form.role as 'AGENT' | 'QA_OFFICER' | 'ADMIN',
        department: 'Call Centre',
        province: 'GAUTENG',
        campaignId: selectedCampaignId ? Number(selectedCampaignId) : null,
      })
      setAgents((prev) => [agent, ...prev])
      setSelectedAgentId(String(agent.id))
      setForm(emptyForm)
      setSuccess(`${agent.firstName} ${agent.lastName} was added to the call centre control list`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add agent')
    } finally {
      setProcessing(null)
    }
  }

  const handleAssignmentSave = async () => {
    if (!selectedAgentId) {
      setError('Select an active agent before saving an assignment')
      return
    }
    await handleCampaignChange(Number(selectedAgentId), selectedCampaignId)
    if (selectedAgent) {
      const productText = selectedProduct ? ` for ${selectedProduct.name}` : ''
      const campaignText = selectedCampaign ? ` on ${selectedCampaign.name}` : ''
      setSuccess(`${selectedAgent.firstName} ${selectedAgent.lastName} assigned${productText}${campaignText} at ${selectedLeadTarget} leads/day`)
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
          {campaigns.filter((campaign) => campaign.isActive !== false).map((campaign) => (
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
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Call centre control page</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Agents & Campaign Assignment</h1>
        <p className="mt-1 text-sm text-gray-500">
          Add call-centre agents, stamp their login details, and assign active agents to products, campaigns, and daily lead targets.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm">
        <div className="grid border-b border-gray-200 bg-gray-50 px-5 py-3 sm:grid-cols-[220px_1fr]">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">Add New Agents</h2>
          <p className="text-sm text-gray-600">Once agents are loaded, the call centre manager can assign agents product and campaigns.</p>
        </div>
        <form onSubmit={handleCreateAgent} className="grid gap-0 sm:grid-cols-[220px_1fr]">
          <label className="border-b border-gray-200 px-5 py-3 text-sm font-medium text-gray-700">First Name</label>
          <div className="border-b border-gray-200 px-5 py-2">
            <Input value={form.firstName} onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))} required />
          </div>
          <label className="border-b border-gray-200 px-5 py-3 text-sm font-medium text-gray-700">Last Name</label>
          <div className="border-b border-gray-200 px-5 py-2">
            <Input value={form.lastName} onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))} required />
          </div>
          <label className="border-b border-gray-200 px-5 py-3 text-sm font-medium text-gray-700">Login</label>
          <div className="border-b border-gray-200 px-5 py-2">
            <Input value={form.mobileNo} onChange={(e) => setForm((prev) => ({ ...prev, mobileNo: e.target.value }))} placeholder="Mobile number" required />
          </div>
          <label className="border-b border-gray-200 px-5 py-3 text-sm font-medium text-gray-700">Password</label>
          <div className="border-b border-gray-200 px-5 py-2">
            <Input type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} required minLength={6} />
          </div>
          <label className="border-b border-gray-200 px-5 py-3 text-sm font-medium text-gray-700">Mobile Number</label>
          <div className="border-b border-gray-200 px-5 py-2">
            <select
              value={form.role}
              onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {callCentreRoles.map((role) => <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="px-5 py-3 text-sm font-semibold italic text-gray-700">Date Stamped</div>
          <div className="flex items-center justify-between gap-3 px-5 py-2">
            <span className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700">
              <CalendarDays className="h-4 w-4" /> {formatDate()}
            </span>
            <Button type="submit" disabled={processing === 'create-agent'}>
              <UserPlus className="h-4 w-4" /> {processing === 'create-agent' ? 'Adding...' : 'Add Agent'}
            </Button>
          </div>
        </form>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-xl border border-gray-300 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">Assign Agents</h2>
          </div>
          <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-gray-500">Active agents drop down list</label>
          <select
            value={selectedAgentId}
            onChange={(e) => {
              const agent = agents.find((candidate) => String(candidate.id) === e.target.value)
              setSelectedAgentId(e.target.value)
              setSelectedCampaignId(agent?.assignedCampaignId ? String(agent.assignedCampaignId) : '')
            }}
            className="mt-2 h-11 w-full rounded-none border-2 border-gray-900 bg-white px-3 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">Select active agent</option>
            {activeAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.firstName} {agent.lastName} — {agent.mobileNo}</option>
            ))}
          </select>

          <div className="mt-6 border-l-2 border-gray-900 pl-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-900">Assign Agents</p>
            <div className="mt-3 space-y-2">
              {products.length === 0 ? (
                <p className="text-sm text-gray-500">No active products are available for assignment.</p>
              ) : products.map((product) => (
                <label key={product.id} className="flex cursor-pointer items-center gap-3 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="product"
                    value={product.id}
                    checked={selectedProductId === String(product.id)}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="h-4 w-4 text-primary focus:ring-primary"
                  />
                  {product.name}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-300 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">Select Campaigns</h2>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_120px_160px] px-4 text-xs font-bold uppercase tracking-wide text-gray-500">
            <span>Campaign</span>
            <span>Leads/Day</span>
            <span className="text-right">5 / 10 / 15 / 20</span>
          </div>
          <div className="mt-5 overflow-hidden border-l-2 border-gray-900">
            {campaigns.filter((campaign) => campaign.isActive !== false).map((campaign) => (
              <label key={campaign.id} className="grid cursor-pointer grid-cols-[1fr_120px_160px] items-center border-b border-gray-200 px-4 py-2 text-sm hover:bg-gray-50">
                <span className="font-medium text-gray-800">{campaign.name}</span>
                <span className="text-gray-600">Leads/Day</span>
                <span className="flex justify-end gap-2 text-gray-700">
                  {leadTargets.map((target) => (
                    <button
                      key={target}
                      type="button"
                      onClick={() => {
                        setSelectedCampaignId(String(campaign.id))
                        setSelectedLeadTarget(String(target))
                      }}
                      className={`rounded px-2 py-1 text-xs ${selectedCampaignId === String(campaign.id) && selectedLeadTarget === String(target) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {target}
                    </button>
                  ))}
                </span>
              </label>
            ))}
            {campaigns.filter((campaign) => campaign.isActive !== false).length === 0 && (
              <p className="px-4 py-3 text-sm text-gray-500">No active campaigns are available.</p>
            )}
          </div>
          <div className="mt-5 flex flex-col gap-3 rounded-lg bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-600">
              <p className="font-semibold text-gray-900">Current assignment</p>
              <p>{selectedAgent ? `${selectedAgent.firstName} ${selectedAgent.lastName}` : 'No agent selected'} · {selectedProduct?.name ?? 'No product selected'} · {selectedCampaign?.name ?? 'No campaign selected'} · {selectedLeadTarget} leads/day</p>
            </div>
            <Button type="button" onClick={handleAssignmentSave} disabled={!selectedAgentId || processing === `campaign-${selectedAgentId}`}>
              Save Assignment
            </Button>
          </div>
        </div>
      </section>

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
                    Streak
                  </div>
                )}
              </div>
            ))}
            {leaderboard.length === 0 && <p className="text-sm text-gray-500">No active agents loaded yet.</p>}
          </div>
        </div>
      </div>

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

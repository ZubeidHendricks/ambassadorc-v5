const API_BASE = '/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

function getToken(): string | null {
  return localStorage.getItem('ambassador_token')
}

export function setToken(token: string): void {
  localStorage.setItem('ambassador_token', token)
}

export function clearToken(): void {
  localStorage.removeItem('ambassador_token')
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  const json: ApiResponse<T> = await res.json()

  if (!res.ok || !json.success) {
    throw new Error(json.error || `Request failed with status ${res.status}`)
  }

  return json
}

// Auth
export interface LoginPayload {
  mobileNo: string
  password: string
}

export interface RegisterPayload {
  firstName: string
  lastName: string
  mobileNo: string
  password: string
  province: string
  department: string
}

export type UserRole = 'AMBASSADOR' | 'AGENT' | 'ADMIN' | 'QA_OFFICER'

export interface Ambassador {
  id: number
  firstName: string
  lastName: string
  mobileNo: string
  province: string
  department: string
  role: UserRole
  tier?: string
  status: string
  createdAt: string
}

export async function login(payload: LoginPayload) {
  const res = await request<{ token: string; ambassador: Ambassador }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify(payload) }
  )
  return res.data!
}

export async function register(payload: RegisterPayload) {
  const res = await request<{ token: string; ambassador: Ambassador }>(
    '/auth/register',
    { method: 'POST', body: JSON.stringify(payload) }
  )
  return res.data!
}

export async function getMe() {
  const res = await request<Ambassador>('/auth/me')
  return res.data!
}

// Referrals
export interface ReferralEntry {
  name: string
  contactNo: string
}

export interface ReferralBatchPayload {
  batchName: string
  referrals: ReferralEntry[]
}

export interface ReferralBatch {
  id: number
  batchName: string
  referralCount: number
  status: string
  createdAt: string
  referrals?: Referral[]
}

export interface Referral {
  id: number
  name: string
  contactNo: string
  status: string
  createdAt: string
}

export async function submitReferralBatch(payload: ReferralBatchPayload) {
  const res = await request<ReferralBatch>('/referrals/batch', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data!
}

export async function getReferralBatches() {
  const res = await request<{ batches: ReferralBatch[]; pagination: any }>('/referrals/batches')
  return res.data!.batches
}

export async function getBatchDetail(id: number) {
  const res = await request<ReferralBatch>(`/referrals/batch/${id}`)
  return res.data!
}

// Leads
export type LeadType = 'REFERRAL_LEAD' | 'MEMBER_SIGNUP'

export interface LeadPayload {
  firstName: string
  lastName: string
  contactNo: string
  preferredContact: string
  type?: LeadType
  employerName?: string
  idNumber?: string
  notes?: string
}

export interface Lead {
  id: number
  firstName: string
  lastName: string
  contactNo: string
  preferredContact: string
  status: string
  type: LeadType
  employerName?: string
  idNumber?: string
  notes?: string
  datePaid?: string
  createdAt: string
}

export async function submitLead(payload: LeadPayload) {
  const res = await request<Lead>('/leads', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data!
}

export async function getLeads(typeFilter?: LeadType) {
  const params = typeFilter ? `?type=${typeFilter}` : ''
  const res = await request<{ leads: Lead[]; pagination: any }>(`/leads${params}`)
  return res.data!.leads
}

// Ambassador Payments
export interface AmbassadorPayment {
  id: number
  amount: number
  type: 'REFERRAL_BATCH' | 'MEMBER_SIGNUP_CONVERSION' | 'MANUAL'
  status: 'PENDING' | 'PAID' | 'CANCELLED'
  reference?: string
  batchRef?: string
  periodStart?: string
  periodEnd?: string
  paidAt?: string
  notes?: string
  createdAt: string
}

export async function getAmbassadorPayments(): Promise<{
  payments: AmbassadorPayment[]
  summary: { totalPaid: number; totalPending: number }
}> {
  const res = await request<any>('/ambassador-payments')
  return res.data!
}

export function downloadEarningsReport() {
  const token = getToken()
  const url = `/api/reports/ambassador-earnings`
  const a = document.createElement('a')
  a.href = url
  a.setAttribute('download', '')
  // Use fetch with auth header to trigger download
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.blob())
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob)
      const date = new Date().toISOString().split('T')[0]
      a.href = blobUrl
      a.download = `Ambassador_Earnings_${date}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    })
}

// Dashboard
export interface DashboardStats {
  totalReferrals: number
  totalLeads: number
  totalEarnings: number
  thisMonthReferrals: number
  thisMonthLeads: number
}

export interface MonthlyStats {
  month: string
  referrals: number
  leads: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await request<any>('/dashboard/stats')
  const d = res.data!
  return {
    totalReferrals: d.totalReferrals ?? 0,
    totalLeads: d.totalLeads ?? 0,
    totalEarnings: d.earnings?.totalEarnings ?? 0,
    thisMonthReferrals: d.monthlyStats?.[0]?.referralCount ?? 0,
    thisMonthLeads: d.monthlyStats?.[0]?.leadCount ?? 0,
  }
}

export async function getMonthlyStats(): Promise<MonthlyStats[]> {
  const res = await request<any>('/dashboard/stats')
  const months = res.data?.monthlyStats ?? []
  return months.map((m: any) => ({
    month: m.month ?? '',
    referrals: m.referralCount ?? 0,
    leads: m.leadCount ?? 0,
  }))
}

// Profile
export interface UpdateProfilePayload {
  firstName?: string
  lastName?: string
  province?: string
  department?: string
}

export async function updateProfile(id: number, payload: UpdateProfilePayload) {
  const res = await request<Ambassador>(`/ambassadors/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return res.data!
}

export async function requestMobileChange(newMobileNo: string) {
  const res = await request<{ message: string }>('/ambassadors/change-mobile', {
    method: 'POST',
    body: JSON.stringify({ newMobileNo }),
  })
  return res.data!
}

// ─── Admin Types ───────────────────────────────────────────────────

export interface Client {
  id: number
  firstName: string
  lastName: string
  idNumber: string
  phone: string
  cellphone?: string
  email?: string
  province: string
  address?: string
  address1?: string
  policyCount: number
  createdAt: string
}

export interface Product {
  id: number
  name: string
  code?: string
  type: string
  description?: string
  active: boolean
  premiumAmount?: number
  premiumTiers: PremiumTier[]
  createdAt: string
}

export interface PremiumTier {
  id: number
  productId: number
  tierName: string
  premiumAmount: number
  coverAmount: number
  active: boolean
}

export interface Policy {
  id: number
  policyNumber: string
  clientId: number
  clientName: string
  productId: number
  productName: string
  premiumAmount: number
  status: string
  startDate: string
  endDate?: string
  agentId?: number
  agentName?: string
  createdAt: string
}

export interface Payment {
  id: number
  policyId: number
  policyNumber: string
  amount: number
  status: string
  paymentDate: string
  method: string
  reference?: string
}

export interface Sale {
  id: number
  clientId: number
  clientName: string
  productId: number
  productName: string
  agentId: number
  agentName: string
  premiumAmount: number
  status: string
  campaignId?: number
  campaignName?: string
  rawStatus?: string
  createdAt: string
}

export interface QAItem {
  id: number
  saleId: number
  clientName: string
  productName: string
  agentName: string
  premiumAmount: number
  status: string
  notes?: string
  verdict?: string
  reviewedBy?: string
  reviewedAt?: string
  createdAt: string
}

export interface FoxProStatusDefinition {
  group: string
  label: string
  examples: string[]
  stage: string
  action: string
  description: string
}

export interface ExportStatusSummary {
  group: string
  label: string
  count: number
}

export interface ExportStatusRecord {
  id: number
  clientName: string
  productName: string
  agentName: string
  rawStatus: string
  subStatus?: string
  statusGroup: string
  label: string
  lastOutcome?: string
  lastUpdated?: string
  dateLoaded?: string
  syncedAt: string
}

export interface Commission {
  id: number
  agentId: number
  agentName: string
  saleId: number
  clientName: string
  productName: string
  amount: number
  status: string
  paidAt?: string
  createdAt: string
}

export interface Agent {
  id: number
  firstName: string
  lastName: string
  mobileNo: string
  role: string
  tier: string
  referralCount: number
  leadCount: number
  saleCount: number
  totalEarnings: number
  status: string
  assignedCampaignId?: number | null
  assignedCampaignName?: string | null
  createdAt: string
}

export interface WelcomePack {
  id: number
  clientId: number
  clientName: string
  productId: number
  productName: string
  status: string
  sentAt?: string
  viewedAt?: string
  signedAt?: string
  downloadUrl?: string
  createdAt: string
}

export interface SmsRecord {
  id: number
  recipient: string
  recipientName?: string
  template?: string
  message: string
  status: string
  sentAt: string
}

export interface PremiumChange {
  id: number
  policyId?: number
  policyNumber?: string
  productId?: number
  productName?: string
  tierId?: number
  tierName?: string
  currentAmount: number
  newAmount: number
  changeType: string
  effectiveDate: string
  reason?: string
  status: string
  affectedPolicies?: number
  requestedBy?: string
  approvedBy?: string
  createdAt: string
}

export interface AdminDashboardStats {
  totalClients: number
  activePolicies: number
  monthlyRevenue: number
  pendingQA: number
  activeAgents: number
  commissionsPaid: number
}

export interface RevenueData {
  month: string
  revenue: number
}

export interface PipelineData {
  status: string
  count: number
}

export interface TopAgent {
  id: number
  name: string
  sales: number
  revenue: number
  tier: string
}

export interface ActivityItem {
  id: number
  type: string
  description: string
  timestamp: string
  user?: string
}

// ─── Admin Dashboard ───────────────────────────────────────────────

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const res = await request<any>('/admin/stats')
  const d = res.data!
  return {
    totalClients: d.clients?.total ?? 0,
    activePolicies: d.policies?.active ?? 0,
    monthlyRevenue: d.revenue?.total ?? 0,
    pendingQA: d.commissions?.pending ?? 0,
    activeAgents: d.ambassadors?.active ?? 0,
    commissionsPaid: d.commissions?.total ?? 0,
  }
}

export async function getRevenueChart(): Promise<RevenueData[]> {
  // No dedicated endpoint - return empty to let component use real stats
  return []
}

export async function getPipelineChart(): Promise<PipelineData[]> {
  // Build from real stats
  try {
    const res = await request<any>('/admin/stats')
    const d = res.data!
    return [
      { status: 'Active', count: d.policies?.active ?? 0 },
      { status: 'Pending QA', count: d.commissions?.pending ?? 0 },
      { status: 'Sales', count: d.sales?.active ?? 0 },
      { status: 'Ambassadors', count: d.ambassadors?.active ?? 0 },
    ]
  } catch {
    return []
  }
}

export async function getTopAgents(): Promise<TopAgent[]> {
  try {
    const agents = await getAgents()
    return agents
      .sort((a, b) => b.saleCount - a.saleCount || b.totalEarnings - a.totalEarnings)
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        name: `${a.firstName} ${a.lastName}`,
        sales: a.saleCount,
        revenue: a.totalEarnings,
        tier: a.tier || 'Bronze',
      }))
  } catch {
    return []
  }
}

export async function getRecentActivity(): Promise<ActivityItem[]> {
  try {
    const res = await request<any>('/admin/audit-log')
    const d = res.data!
    const entries = d.entries ?? d.auditLogs ?? (Array.isArray(d) ? d : [])
    return entries.slice(0, 5).map((e: any, i: number) => ({
      id: e.id ?? i,
      type: e.action?.includes('sale') ? 'sale' : e.action?.includes('qa') ? 'qa' : e.action?.includes('commission') ? 'commission' : 'client',
      description: e.description ?? e.action ?? 'Activity',
      timestamp: e.createdAt ? new Date(e.createdAt).toLocaleString() : 'Recently',
      user: e.ambassadorName ?? undefined,
    }))
  } catch {
    return []
  }
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: PaginationInfo
}

// ─── Clients ───────────────────────────────────────────────────────

export async function getClients(search?: string, page = 1, limit = 20): Promise<PaginatedResult<Client>> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  params.set('page', String(page))
  params.set('limit', String(limit))
  const res = await request<{ clients: Client[]; pagination: PaginationInfo }>(`/clients?${params.toString()}`)
  return { data: res.data!.clients, pagination: res.data!.pagination }
}

export async function getClient(id: number) {
  const res = await request<Client>(`/clients/${id}`)
  return res.data!
}

export interface CreateClientPayload {
  firstName: string
  lastName: string
  idNumber: string
  phone: string
  email?: string
  province: string
  address?: string
}

export async function createClient(payload: CreateClientPayload) {
  const res = await request<Client>('/clients', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data!
}

export interface UpdateClientPayload {
  firstName?: string
  lastName?: string
  cellphone?: string
  email?: string | null
  province?: string | null
  address1?: string | null
}

export async function updateClient(id: number, payload: UpdateClientPayload) {
  const res = await request<Client>(`/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return res.data!
}

// ─── Client sub-resources ──────────────────────────────────────────

export async function getClientPolicies(clientId: number) {
  const res = await request<Policy[]>(`/clients/${clientId}/policies`)
  return res.data!
}

export async function getClientPayments(clientId: number) {
  const res = await request<Payment[]>(`/clients/${clientId}/payments`)
  return res.data!
}

export async function getClientDocuments(clientId: number) {
  const res = await request<WelcomePack[]>(`/clients/${clientId}/documents`)
  return res.data!
}

export async function getClientSms(clientId: number) {
  const res = await request<SmsRecord[]>(`/clients/${clientId}/sms`)
  return res.data!
}

// ─── Products ──────────────────────────────────────────────────────

export async function getProducts(page = 1, limit = 20): Promise<PaginatedResult<Product>> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  const res = await request<{ products: Product[]; pagination: PaginationInfo }>(`/products?${params.toString()}`)
  const d = res.data!
  const products = Array.isArray(d) ? d : (d.products ?? [])
  const pagination: PaginationInfo = d.pagination ?? { page, limit, total: products.length, totalPages: 1 }
  return { data: products, pagination }
}

export async function getProduct(id: number) {
  const res = await request<Product>(`/products/${id}`)
  return res.data!
}

export interface CreateProductPayload {
  name: string
  type: string
  description?: string
  premiumAmount?: number
  active?: boolean
}

export async function createProduct(payload: CreateProductPayload) {
  const res = await request<Product>('/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data!
}

export async function updateProduct(id: number, payload: Partial<CreateProductPayload> & { isActive?: boolean }) {
  const res = await request<Product>(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return res.data!
}

// ─── Premium Changes ───────────────────────────────────────────────

export interface RequestPremiumChangePayload {
  productId?: number
  tierId?: number
  policyId?: number
  newAmount: number
  effectiveDate: string
  reason?: string
}

export async function requestPremiumChange(payload: RequestPremiumChangePayload) {
  const res = await request<PremiumChange>('/policies/premium-changes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data!
}

export async function getPremiumChanges(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  const res = await request<{ premiumChanges: PremiumChange[]; pagination: any }>(`/policies/premium-changes${q}`)
  return res.data!.premiumChanges
}

export async function approvePremiumChange(id: number) {
  const res = await request<PremiumChange>(`/policies/premium-changes/${id}/approve`, {
    method: 'POST',
  })
  return res.data!
}

export async function rejectPremiumChange(id: number, reason: string) {
  const res = await request<PremiumChange>(`/policies/premium-changes/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
  return res.data!
}

// ─── Policies ──────────────────────────────────────────────────────

export async function getPolicies(filters?: { status?: string; search?: string }, page = 1, limit = 20): Promise<PaginatedResult<Policy>> {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.search) params.set('search', filters.search)
  params.set('page', String(page))
  params.set('limit', String(limit))
  const res = await request<any>(`/policies?${params.toString()}`)
  const d = res.data!
  const policies = (Array.isArray(d) ? d : d.policies ?? []) as Policy[]
  const pagination: PaginationInfo = d.pagination ?? { page, limit, total: policies.length, totalPages: 1 }
  return { data: policies, pagination }
}

export async function getPolicy(id: number) {
  const res = await request<Policy>(`/policies/${id}`)
  return res.data!
}

export async function updatePolicyStatus(id: number, status: string) {
  const res = await request<Policy>(`/policies/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
  return res.data!
}

// ─── Sales ─────────────────────────────────────────────────────────

export async function getSales(filters?: {
  status?: string
  agentId?: number
  productId?: number
  campaignId?: number
}, page = 1, limit = 20): Promise<PaginatedResult<Sale>> {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.agentId) params.set('agentId', String(filters.agentId))
  if (filters?.productId) params.set('productId', String(filters.productId))
  if (filters?.campaignId) params.set('campaignId', String(filters.campaignId))
  params.set('page', String(page))
  params.set('limit', String(limit))
  const res = await request<any>(`/sales?${params.toString()}`)
  const d = res.data!
  const sales = (Array.isArray(d) ? d : d.sales ?? []) as Sale[]
  const pagination: PaginationInfo = d.pagination ?? { page, limit, total: sales.length, totalPages: 1 }
  return { data: sales, pagination }
}

export async function updateSaleStatus(id: number, status: string) {
  const res = await request<Sale>(`/sales/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
  return res.data!
}

export async function getFoxProStatusDictionary(): Promise<FoxProStatusDefinition[]> {
  const res = await request<{ statuses: FoxProStatusDefinition[] }>('/sales/status-dictionary')
  return res.data!.statuses
}

export async function getExportStatuses(group?: string, page = 1, limit = 20): Promise<{
  summary: ExportStatusSummary[]
  statuses: ExportStatusRecord[]
  pagination: PaginationInfo
}> {
  const params = new URLSearchParams()
  if (group) params.set('group', group)
  params.set('page', String(page))
  params.set('limit', String(limit))
  const res = await request<any>(`/sales/export-status?${params.toString()}`)
  return {
    summary: res.data!.summary ?? [],
    statuses: res.data!.statuses ?? [],
    pagination: res.data!.pagination ?? { page, limit, total: 0, totalPages: 1 },
  }
}

// ─── Quality Assurance ─────────────────────────────────────────────

export async function getQAItems(status?: string, page = 1, limit = 20): Promise<PaginatedResult<QAItem>> {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  params.set('page', String(page))
  params.set('limit', String(limit))
  const res = await request<any>(`/qa?${params.toString()}`)
  const d = res.data!
  const items = (Array.isArray(d) ? d : d.qualityChecks ?? []) as QAItem[]
  const pagination: PaginationInfo = d.pagination ?? { page, limit, total: items.length, totalPages: 1 }
  return { data: items, pagination }
}

export async function submitQAVerdict(id: number, payload: { verdict: string; notes?: string }) {
  const res = await request<QAItem>(`/qa/${id}/verdict`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data!
}

// ─── Commissions ───────────────────────────────────────────────────

export interface CommissionSummary {
  totalEarned: number
  pending: number
  paidThisMonth: number
}

export async function getCommissionSummary() {
  const res = await request<any>('/commissions/summary')
  const d = res.data!
  return {
    totalEarned: d.total?.amount ?? 0,
    pending: d.pending?.amount ?? 0,
    paidThisMonth: d.paid?.amount ?? 0,
  } as CommissionSummary
}

export async function getCommissions(filters?: {
  agentId?: number
  status?: string
  dateFrom?: string
  dateTo?: string
}, page = 1, limit = 20): Promise<PaginatedResult<Commission>> {
  const params = new URLSearchParams()
  if (filters?.agentId) params.set('agentId', String(filters.agentId))
  if (filters?.status) params.set('status', filters.status)
  if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters?.dateTo) params.set('dateTo', filters.dateTo)
  params.set('page', String(page))
  params.set('limit', String(limit))
  const res = await request<any>(`/commissions?${params.toString()}`)
  const d = res.data!
  const commissions = (Array.isArray(d) ? d : d.commissions ?? []) as Commission[]
  const pagination: PaginationInfo = d.pagination ?? { page, limit, total: commissions.length, totalPages: 1 }
  return { data: commissions, pagination }
}

export async function markCommissionPaid(id: number) {
  const res = await request<Commission>(`/commissions/${id}/pay`, {
    method: 'POST',
  })
  return res.data!
}

// ─── Agents ────────────────────────────────────────────────────────

export async function getAgents() {
  const res = await request<{ agents: any[]; pagination: any }>('/admin/agents')
  const agents = res.data!.agents ?? []
  return agents.map((a: any) => ({
    id: a.id,
    firstName: a.firstName,
    lastName: a.lastName,
    mobileNo: a.mobileNo,
    role: a.role ?? 'AMBASSADOR',
    tier: a.tier ?? 'Bronze',
    referralCount: a._count?.referralBatches ?? 0,
    leadCount: a._count?.leads ?? 0,
    saleCount: a._count?.sales ?? a.metrics?.approvedSales ?? 0,
    totalEarnings: a.metrics?.totalCommission ?? 0,
    status: a.status ?? (a.isActive ? 'active' : 'inactive'),
    assignedCampaignId: a.assignedCampaignId ?? null,
    assignedCampaignName: a.assignedCampaignName ?? a.assignedCampaign?.name ?? null,
    createdAt: a.createdAt,
  })) as Agent[]
}

export async function getAgent(id: number) {
  const res = await request<Agent>(`/admin/agents/${id}`)
  return res.data!
}

export async function updateAgentRole(id: number, role: string) {
  const res = await request<Agent>(`/admin/agents/${id}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  })
  return res.data!
}

export async function updateAgentTier(id: number, tier: string) {
  const res = await request<Agent>(`/admin/agents/${id}/tier`, {
    method: 'PUT',
    body: JSON.stringify({ tier }),
  })
  return res.data!
}

export async function assignAgentCampaign(id: number, campaignId: number | null) {
  const res = await request<Agent>(`/admin/agents/${id}/campaign`, {
    method: 'PUT',
    body: JSON.stringify({ campaignId }),
  })
  return res.data!
}

// ─── Leaderboard ──────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number
  name: string
  referrals: number
  leads: number
  earnings: number
  tier: string
  trend: 'up' | 'down' | 'same'
}

export async function getLeaderboard(period?: string): Promise<LeaderboardEntry[]> {
  try {
    const params = period ? `?period=${period}` : ''
    const res = await request<LeaderboardEntry[]>(`/leaderboard${params}`)
    return res.data ?? []
  } catch {
    return []
  }
}

// ─── Documents / Welcome Packs ─────────────────────────────────────

export async function getWelcomePacks() {
  try {
    const res = await request<any>('/documents/welcome-pack')
    const d = res.data!
    return (Array.isArray(d) ? d : d.documents ?? []) as WelcomePack[]
  } catch {
    return [] as WelcomePack[]
  }
}

export async function generateWelcomePack(payload: { clientId: number; productId: number }) {
  const res = await request<WelcomePack>('/documents/welcome-pack/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data!
}

// ─── SMS ───────────────────────────────────────────────────────────

export async function getSmsHistory() {
  const res = await request<any>('/sms')
  const d = res.data!
  return (Array.isArray(d) ? d : d.messages ?? d.sms ?? []) as SmsRecord[]
}

export async function sendSms(payload: { recipient: string; message: string; template?: string }) {
  const res = await request<SmsRecord>('/sms/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data!
}

export async function sendBulkSms(payload: {
  recipients: string[]
  message: string
  template?: string
}) {
  const res = await request<{ sent: number; failed: number }>('/sms/bulk', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data!
}

export async function getSmsTemplates() {
  try {
    const res = await request<any>('/sms/templates')
    const d = res.data!
    return (Array.isArray(d) ? d : d.templates ?? []) as { id: string; name: string; body: string }[]
  } catch {
    return [] as { id: string; name: string; body: string }[]
  }
}

// ─── AI Agents ────────────────────────────────────────────────────

export interface AiAgentStatus {
  agentKey: string
  lastRun: string | null
  itemsProcessed: number
  successCount: number
  errorCount: number
  status: string
  autoRun: boolean
}

export interface AiAgentRun {
  id: number
  agentKey: string
  startedAt: string
  completedAt?: string
  itemsProcessed: number
  successCount: number
  errorCount: number
  status: string
}

export async function getAiAgentStatuses() {
  const res = await request<any>('/agents')
  const d = res.data!
  const arr = Array.isArray(d) ? d : d.agents ?? []
  return arr.map((a: any) => ({
    agentKey: a.name ?? a.agentKey ?? '',
    lastRun: a.lastRun ?? null,
    itemsProcessed: a.lastResult?.itemsProcessed ?? a.itemsProcessed ?? 0,
    successCount: a.lastResult?.successCount ?? a.successCount ?? 0,
    errorCount: a.lastResult?.errorCount ?? a.errorCount ?? 0,
    status: a.isRunning ? 'running' : a.status ?? 'idle',
    autoRun: a.isScheduled ?? a.autoRun ?? false,
  })) as AiAgentStatus[]
}

export async function triggerAiAgent(agentKey: string) {
  const res = await request<AiAgentRun>(`/agents/${agentKey}/run`, {
    method: 'POST',
  })
  return res.data!
}

export async function getAiAgentHistory(agentKey: string) {
  const res = await request<{ runs: AiAgentRun[]; pagination: any }>(`/agents/${agentKey}/history`)
  return res.data!.runs
}

export async function toggleAiAgentAuto(agentKey: string, autoRun: boolean) {
  const res = await request<AiAgentStatus>(`/agents/${agentKey}/auto`, {
    method: 'PUT',
    body: JSON.stringify({ autoRun }),
  })
  return res.data!
}

// ─── Workflows ────────────────────────────────────────────────────

export interface WorkflowStep {
  id: number
  workflowId: number
  order: number
  name: string
  actionType: string
  config: Record<string, unknown>
}

export interface Workflow {
  id: number
  name: string
  description?: string
  trigger: string
  isActive: boolean
  steps?: WorkflowStep[]
  createdAt: string
}

export interface WorkflowStepInstance {
  id: number
  instanceId: number
  stepId: number
  step?: WorkflowStep
  status: string
  result: Record<string, unknown> | null
  startedAt: string | null
  completedAt: string | null
  error: string | null
}

export interface WorkflowInstance {
  id: number
  workflowId: number
  workflow?: Workflow
  entityType: string
  entityId: number
  status: string
  currentStep: number
  context: Record<string, unknown>
  steps: WorkflowStepInstance[]
  startedAt: string
  completedAt: string | null
  error: string | null
}

export interface WorkflowStats {
  activeWorkflows: number
  runningInstances: number
  completedToday: number
  failedCount: number
  pendingApproval: number
}

export async function getWorkflows() {
  const res = await request<any>('/workflows')
  const d = res.data!
  return (Array.isArray(d) ? d : d.workflows ?? []) as Workflow[]
}

export async function getWorkflow(id: number) {
  const res = await request<Workflow>(`/workflows/${id}`)
  return res.data!
}

export async function createWorkflow(data: {
  name: string
  description?: string
  trigger: string
  isActive: boolean
}) {
  const res = await request<Workflow>('/workflows', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data!
}

export async function updateWorkflow(
  id: number,
  data: Partial<{ name: string; description: string; trigger: string; isActive: boolean }>
) {
  const res = await request<Workflow>(`/workflows/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return res.data!
}

export async function addWorkflowStep(
  workflowId: number,
  data: { name: string; actionType: string; config: Record<string, unknown>; order: number }
) {
  const res = await request<WorkflowStep>(`/workflows/${workflowId}/steps`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data!
}

export async function updateWorkflowStep(
  stepId: number,
  data: Partial<{ name: string; actionType: string; config: Record<string, unknown>; order: number }>
) {
  const res = await request<WorkflowStep>(`/workflows/steps/${stepId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return res.data!
}

export async function deleteWorkflowStep(stepId: number) {
  await request(`/workflows/steps/${stepId}`, { method: 'DELETE' })
}

export async function triggerWorkflow(
  workflowId: number,
  entityType: string,
  entityId: number
) {
  const res = await request<WorkflowInstance>(`/workflows/${workflowId}/trigger`, {
    method: 'POST',
    body: JSON.stringify({ entityType, entityId }),
  })
  return res.data!
}

export async function getWorkflowInstances(filters?: {
  workflowId?: number
  status?: string
  entityType?: string
}) {
  const params = new URLSearchParams()
  if (filters?.workflowId) params.set('workflowId', String(filters.workflowId))
  if (filters?.status) params.set('status', filters.status)
  if (filters?.entityType) params.set('entityType', filters.entityType)
  const q = params.toString() ? `?${params.toString()}` : ''
  const res = await request<any>(`/workflows/instances${q}`)
  const d = res.data!
  return (Array.isArray(d) ? d : d.instances ?? []) as WorkflowInstance[]
}

export async function getWorkflowInstance(id: number) {
  const res = await request<WorkflowInstance>(`/workflows/instances/${id}`)
  return res.data!
}

export async function resumeWorkflowInstance(id: number, approved: boolean) {
  await request(`/workflows/instances/${id}/resume`, {
    method: 'POST',
    body: JSON.stringify({ approved }),
  })
}

export async function cancelWorkflowInstance(id: number) {
  await request(`/workflows/instances/${id}/cancel`, {
    method: 'POST',
  })
}

export async function processWorkflows() {
  const res = await request<{ processed: number; completed: number; failed: number }>(
    '/workflows/process',
    { method: 'POST' }
  )
  return res.data!
}

export async function getWorkflowStats() {
  const res = await request<any>('/workflows/stats')
  const d = res.data!
  // Backend returns nested shape; map to flat WorkflowStats
  if (d && (d.workflows || d.instances)) {
    return {
      activeWorkflows:   d.workflows?.active  ?? 0,
      runningInstances:  d.instances?.active  ?? 0,
      completedToday:    d.instances?.completed ?? 0,
      failedCount:       d.instances?.failed   ?? 0,
      pendingApproval:   d.instances?.paused   ?? 0,
    } as WorkflowStats
  }
  return d as WorkflowStats
}

// ─── Admin Stats & Audit ──────────────────────────────────────────

export interface AuditLogEntry {
  id: number
  action: string
  entity: string
  entityId?: number
  userId: number
  userName: string
  details?: string
  timestamp: string
}

export async function getAuditLog(filters?: { entity?: string; userId?: number; limit?: number }) {
  const params = new URLSearchParams()
  if (filters?.entity) params.set('entity', filters.entity)
  if (filters?.userId) params.set('userId', String(filters.userId))
  if (filters?.limit) params.set('limit', String(filters.limit))
  const q = params.toString() ? `?${params.toString()}` : ''
  const res = await request<AuditLogEntry[]>(`/admin/audit-log${q}`)
  return res.data!
}

// ─── Campaigns ────────────────────────────────────────────────────

export interface Campaign {
  id: number
  name: string
  status?: string
  isActive?: boolean
  startDate: string
  endDate?: string
  saleCount?: number
  _count?: { assignedAmbassadors?: number }
  createdAt: string
}

export async function getCampaigns() {
  const campaigns: Campaign[] = []
  let page = 1
  let totalPages = 1

  do {
    const res = await request<any>(`/sales/campaigns?page=${page}&limit=100`)
    const d = res.data!
    campaigns.push(...((Array.isArray(d) ? d : d.campaigns ?? []) as Campaign[]))
    totalPages = Array.isArray(d) ? 1 : d.pagination?.totalPages ?? 1
    page += 1
  } while (page <= totalPages)

  return campaigns
}

// ─── Debit Orders ─────────────────────────────────────────────────

export interface DebitOrder {
  id: number
  policyId: number
  policyNumber: string
  clientName: string
  amount: number
  bankName: string
  accountNumber: string
  status: string
  nextDebitDate: string
}

export async function getDebitOrders() {
  const res = await request<DebitOrder[]>('/payments/debit-orders')
  return res.data!
}

export async function updateDebitOrderStatus(id: number, status: string) {
  const res = await request<DebitOrder>(`/payments/debit-orders/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
  return res.data!
}

// ─── Integrations ─────────────────────────────────────────────────

export interface IntegrationConfig {
  id: number
  name: string
  displayName: string
  baseUrl: string
  status: string
  lastSyncAt: string | null
  settings: Record<string, unknown>
}

export interface QLinkBatch {
  id: number
  batchId: string
  product: string
  description: string
  recordCount: number
  status: string
  createdAt: string
}

export interface FileExport {
  id: number
  fileName: string
  direction: string
  entryCount: number
  importType: string
  status: string
  createdAt: string
}

export interface BankValidationResult {
  valid: boolean
  message: string
}

export interface Bank {
  code: string
  name: string
}

export async function getIntegrations() {
  const res = await request<IntegrationConfig[]>('/integrations')
  return res.data!
}

export async function getIntegration(name: string) {
  const res = await request<IntegrationConfig>(`/integrations/${name}`)
  return res.data!
}

export async function updateIntegration(name: string, data: Partial<IntegrationConfig>) {
  const res = await request<IntegrationConfig>(`/integrations/${name}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return res.data!
}

export async function testIntegration(name: string) {
  const res = await request<{ success: boolean; message: string }>(
    `/integrations/${name}/test`,
    { method: 'POST' }
  )
  return res.data!
}

// QLink
export async function triggerQLinkExport(policyIds?: number[]) {
  const res = await request<{ batchId: string; recordCount: number }>(
    '/integrations/qlink/export',
    {
      method: 'POST',
      body: JSON.stringify({ policyIds }),
    }
  )
  return res.data!
}

export async function getQLinkBatches() {
  const res = await request<QLinkBatch[]>('/integrations/qlink/batches')
  return res.data!
}

// SagePay
export async function syncSagePayTransactions() {
  const res = await request<{ imported: number }>(
    '/integrations/sagepay/sync',
    { method: 'POST' }
  )
  return res.data!
}

// Bank validation (SagePay / Netcash)
export async function validateBankAccount(account: string, branch: string, type: string) {
  const res = await request<BankValidationResult>(
    '/integrations/bank/validate',
    {
      method: 'POST',
      body: JSON.stringify({ accountNumber: account, branchCode: branch, accountType: type }),
    }
  )
  return res.data!
}

export async function getBankList() {
  const res = await request<Bank[]>('/integrations/bank/list')
  return res.data!
}

// SMS Portal
export async function sendTestSms(number: string, message: string) {
  const res = await request<{ sent: boolean }>(
    '/integrations/sms/send',
    {
      method: 'POST',
      body: JSON.stringify({ number, message }),
    }
  )
  return res.data!
}

export async function sendBulkIntegrationSms(numbers: string[], message: string) {
  const res = await request<{ sent: number; failed: number }>(
    '/integrations/sms/bulk',
    {
      method: 'POST',
      body: JSON.stringify({ numbers, message }),
    }
  )
  return res.data!
}

// ViciDialer
export async function uploadViciDialerLeads(leadIds: number[]) {
  const res = await request<{ uploaded: number }>(
    '/integrations/vicidialer/upload',
    {
      method: 'POST',
      body: JSON.stringify({ leadIds }),
    }
  )
  return res.data!
}

// Guard Risk
export async function triggerGuardRiskExport() {
  const res = await request<{ success: boolean }>(
    '/integrations/guardrisk/export',
    { method: 'POST' }
  )
  return res.data!
}

// WhatsApp / WATI
export async function sendWhatsApp(number: string, template: string, params: unknown[]) {
  const res = await request<{ sent: boolean }>(
    '/integrations/whatsapp/send',
    {
      method: 'POST',
      body: JSON.stringify({ number, template, params }),
    }
  )
  return res.data!
}

// File Exports
export async function getFileExports() {
  const res = await request<FileExport[]>('/integrations/files')
  return res.data!
}

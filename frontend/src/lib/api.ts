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
  const res = await request<ReferralBatch[]>('/referrals/batches')
  return res.data!
}

export async function getBatchDetail(id: number) {
  const res = await request<ReferralBatch>(`/referrals/batch/${id}`)
  return res.data!
}

// Leads
export interface LeadPayload {
  firstName: string
  lastName: string
  contactNo: string
  preferredContact: string
}

export interface Lead {
  id: number
  firstName: string
  lastName: string
  contactNo: string
  preferredContact: string
  status: string
  createdAt: string
}

export async function submitLead(payload: LeadPayload) {
  const res = await request<Lead>('/leads', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data!
}

export async function getLeads() {
  const res = await request<Lead[]>('/leads')
  return res.data!
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

export async function getDashboardStats() {
  const res = await request<DashboardStats>('/dashboard/stats')
  return res.data!
}

export async function getMonthlyStats() {
  const res = await request<MonthlyStats[]>('/dashboard/stats/monthly')
  return res.data!
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
  email?: string
  province: string
  address?: string
  policyCount: number
  createdAt: string
}

export interface Product {
  id: number
  name: string
  type: string
  description?: string
  active: boolean
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

export async function getAdminDashboardStats() {
  const res = await request<AdminDashboardStats>('/admin/dashboard/stats')
  return res.data!
}

export async function getRevenueChart() {
  const res = await request<RevenueData[]>('/admin/dashboard/revenue')
  return res.data!
}

export async function getPipelineChart() {
  const res = await request<PipelineData[]>('/admin/dashboard/pipeline')
  return res.data!
}

export async function getTopAgents() {
  const res = await request<TopAgent[]>('/admin/dashboard/top-agents')
  return res.data!
}

export async function getRecentActivity() {
  const res = await request<ActivityItem[]>('/admin/dashboard/activity')
  return res.data!
}

// ─── Clients ───────────────────────────────────────────────────────

export async function getClients(search?: string) {
  const q = search ? `?search=${encodeURIComponent(search)}` : ''
  const res = await request<Client[]>(`/admin/clients${q}`)
  return res.data!
}

export async function getClient(id: number) {
  const res = await request<Client>(`/admin/clients/${id}`)
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
  const res = await request<Client>('/admin/clients', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data!
}

export async function updateClient(id: number, payload: Partial<CreateClientPayload>) {
  const res = await request<Client>(`/admin/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return res.data!
}

// ─── Client sub-resources ──────────────────────────────────────────

export async function getClientPolicies(clientId: number) {
  const res = await request<Policy[]>(`/admin/clients/${clientId}/policies`)
  return res.data!
}

export async function getClientPayments(clientId: number) {
  const res = await request<Payment[]>(`/admin/clients/${clientId}/payments`)
  return res.data!
}

export async function getClientDocuments(clientId: number) {
  const res = await request<WelcomePack[]>(`/admin/clients/${clientId}/documents`)
  return res.data!
}

export async function getClientSms(clientId: number) {
  const res = await request<SmsRecord[]>(`/admin/clients/${clientId}/sms`)
  return res.data!
}

// ─── Products ──────────────────────────────────────────────────────

export async function getProducts() {
  const res = await request<Product[]>('/admin/products')
  return res.data!
}

export async function getProduct(id: number) {
  const res = await request<Product>(`/admin/products/${id}`)
  return res.data!
}

export interface CreateProductPayload {
  name: string
  type: string
  description?: string
  active: boolean
  premiumTiers: Omit<PremiumTier, 'id' | 'productId'>[]
}

export async function createProduct(payload: CreateProductPayload) {
  const res = await request<Product>('/admin/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data!
}

export async function updateProduct(id: number, payload: Partial<CreateProductPayload>) {
  const res = await request<Product>(`/admin/products/${id}`, {
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
  const res = await request<PremiumChange>('/admin/premium-changes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data!
}

export async function getPremiumChanges(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  const res = await request<PremiumChange[]>(`/admin/premium-changes${q}`)
  return res.data!
}

export async function approvePremiumChange(id: number) {
  const res = await request<PremiumChange>(`/admin/premium-changes/${id}/approve`, {
    method: 'POST',
  })
  return res.data!
}

export async function rejectPremiumChange(id: number, reason: string) {
  const res = await request<PremiumChange>(`/admin/premium-changes/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
  return res.data!
}

// ─── Policies ──────────────────────────────────────────────────────

export async function getPolicies(filters?: { status?: string; search?: string }) {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.search) params.set('search', filters.search)
  const q = params.toString() ? `?${params.toString()}` : ''
  const res = await request<Policy[]>(`/admin/policies${q}`)
  return res.data!
}

export async function getPolicy(id: number) {
  const res = await request<Policy>(`/admin/policies/${id}`)
  return res.data!
}

export async function updatePolicyStatus(id: number, status: string) {
  const res = await request<Policy>(`/admin/policies/${id}/status`, {
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
}) {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.agentId) params.set('agentId', String(filters.agentId))
  if (filters?.productId) params.set('productId', String(filters.productId))
  if (filters?.campaignId) params.set('campaignId', String(filters.campaignId))
  const q = params.toString() ? `?${params.toString()}` : ''
  const res = await request<Sale[]>(`/admin/sales${q}`)
  return res.data!
}

export async function updateSaleStatus(id: number, status: string) {
  const res = await request<Sale>(`/admin/sales/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
  return res.data!
}

// ─── Quality Assurance ─────────────────────────────────────────────

export async function getQAItems(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  const res = await request<QAItem[]>(`/admin/qa${q}`)
  return res.data!
}

export async function submitQAVerdict(id: number, payload: { verdict: string; notes?: string }) {
  const res = await request<QAItem>(`/admin/qa/${id}/verdict`, {
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
  const res = await request<CommissionSummary>('/admin/commissions/summary')
  return res.data!
}

export async function getCommissions(filters?: {
  agentId?: number
  status?: string
  dateFrom?: string
  dateTo?: string
}) {
  const params = new URLSearchParams()
  if (filters?.agentId) params.set('agentId', String(filters.agentId))
  if (filters?.status) params.set('status', filters.status)
  if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters?.dateTo) params.set('dateTo', filters.dateTo)
  const q = params.toString() ? `?${params.toString()}` : ''
  const res = await request<Commission[]>(`/admin/commissions${q}`)
  return res.data!
}

export async function markCommissionPaid(id: number) {
  const res = await request<Commission>(`/admin/commissions/${id}/pay`, {
    method: 'POST',
  })
  return res.data!
}

// ─── Agents ────────────────────────────────────────────────────────

export async function getAgents() {
  const res = await request<Agent[]>('/admin/agents')
  return res.data!
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

// ─── Documents / Welcome Packs ─────────────────────────────────────

export async function getWelcomePacks() {
  const res = await request<WelcomePack[]>('/admin/documents')
  return res.data!
}

export async function generateWelcomePack(payload: { clientId: number; productId: number }) {
  const res = await request<WelcomePack>('/admin/documents/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data!
}

// ─── SMS ───────────────────────────────────────────────────────────

export async function getSmsHistory() {
  const res = await request<SmsRecord[]>('/admin/sms')
  return res.data!
}

export async function sendSms(payload: { recipient: string; message: string; template?: string }) {
  const res = await request<SmsRecord>('/admin/sms/send', {
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
  const res = await request<{ sent: number; failed: number }>('/admin/sms/bulk', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data!
}

export async function getSmsTemplates() {
  const res = await request<{ id: string; name: string; body: string }[]>('/admin/sms/templates')
  return res.data!
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
  const res = await request<AiAgentStatus[]>('/admin/ai-agents')
  return res.data!
}

export async function triggerAiAgent(agentKey: string) {
  const res = await request<AiAgentRun>(`/admin/ai-agents/${agentKey}/run`, {
    method: 'POST',
  })
  return res.data!
}

export async function getAiAgentHistory(agentKey: string) {
  const res = await request<AiAgentRun[]>(`/admin/ai-agents/${agentKey}/history`)
  return res.data!
}

export async function toggleAiAgentAuto(agentKey: string, autoRun: boolean) {
  const res = await request<AiAgentStatus>(`/admin/ai-agents/${agentKey}/auto`, {
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
  const res = await request<Workflow[]>('/admin/workflows')
  return res.data!
}

export async function getWorkflow(id: number) {
  const res = await request<Workflow>(`/admin/workflows/${id}`)
  return res.data!
}

export async function createWorkflow(data: {
  name: string
  description?: string
  trigger: string
  isActive: boolean
}) {
  const res = await request<Workflow>('/admin/workflows', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data!
}

export async function updateWorkflow(
  id: number,
  data: Partial<{ name: string; description: string; trigger: string; isActive: boolean }>
) {
  const res = await request<Workflow>(`/admin/workflows/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return res.data!
}

export async function addWorkflowStep(
  workflowId: number,
  data: { name: string; actionType: string; config: Record<string, unknown>; order: number }
) {
  const res = await request<WorkflowStep>(`/admin/workflows/${workflowId}/steps`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data!
}

export async function updateWorkflowStep(
  stepId: number,
  data: Partial<{ name: string; actionType: string; config: Record<string, unknown>; order: number }>
) {
  const res = await request<WorkflowStep>(`/admin/workflow-steps/${stepId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return res.data!
}

export async function deleteWorkflowStep(stepId: number) {
  await request(`/admin/workflow-steps/${stepId}`, { method: 'DELETE' })
}

export async function triggerWorkflow(
  workflowId: number,
  entityType: string,
  entityId: number
) {
  const res = await request<WorkflowInstance>(`/admin/workflows/${workflowId}/trigger`, {
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
  const res = await request<WorkflowInstance[]>(`/admin/workflow-instances${q}`)
  return res.data!
}

export async function getWorkflowInstance(id: number) {
  const res = await request<WorkflowInstance>(`/admin/workflow-instances/${id}`)
  return res.data!
}

export async function resumeWorkflowInstance(id: number, approved: boolean) {
  await request(`/admin/workflow-instances/${id}/resume`, {
    method: 'POST',
    body: JSON.stringify({ approved }),
  })
}

export async function cancelWorkflowInstance(id: number) {
  await request(`/admin/workflow-instances/${id}/cancel`, {
    method: 'POST',
  })
}

export async function processWorkflows() {
  const res = await request<{ processed: number; completed: number; failed: number }>(
    '/admin/workflows/process',
    { method: 'POST' }
  )
  return res.data!
}

export async function getWorkflowStats() {
  const res = await request<WorkflowStats>('/admin/workflows/stats')
  return res.data!
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
  status: string
  startDate: string
  endDate?: string
  saleCount: number
  createdAt: string
}

export async function getCampaigns() {
  const res = await request<Campaign[]>('/admin/campaigns')
  return res.data!
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
  const res = await request<DebitOrder[]>('/admin/debit-orders')
  return res.data!
}

export async function updateDebitOrderStatus(id: number, status: string) {
  const res = await request<DebitOrder>(`/admin/debit-orders/${id}/status`, {
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
  const res = await request<IntegrationConfig[]>('/admin/integrations')
  return res.data!
}

export async function getIntegration(name: string) {
  const res = await request<IntegrationConfig>(`/admin/integrations/${name}`)
  return res.data!
}

export async function updateIntegration(name: string, data: Partial<IntegrationConfig>) {
  const res = await request<IntegrationConfig>(`/admin/integrations/${name}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return res.data!
}

export async function testIntegration(name: string) {
  const res = await request<{ success: boolean; message: string }>(
    `/admin/integrations/${name}/test`,
    { method: 'POST' }
  )
  return res.data!
}

// QLink
export async function triggerQLinkExport(policyIds?: number[]) {
  const res = await request<{ batchId: string; recordCount: number }>(
    '/admin/integrations/qlink/export',
    {
      method: 'POST',
      body: JSON.stringify({ policyIds }),
    }
  )
  return res.data!
}

export async function getQLinkBatches() {
  const res = await request<QLinkBatch[]>('/admin/integrations/qlink/batches')
  return res.data!
}

// SagePay
export async function syncSagePayTransactions() {
  const res = await request<{ imported: number }>(
    '/admin/integrations/sagepay/sync',
    { method: 'POST' }
  )
  return res.data!
}

// Bank validation (SagePay / Netcash)
export async function validateBankAccount(account: string, branch: string, type: string) {
  const res = await request<BankValidationResult>(
    '/admin/integrations/bank/validate',
    {
      method: 'POST',
      body: JSON.stringify({ accountNumber: account, branchCode: branch, accountType: type }),
    }
  )
  return res.data!
}

export async function getBankList() {
  const res = await request<Bank[]>('/admin/integrations/bank/list')
  return res.data!
}

// SMS Portal
export async function sendTestSms(number: string, message: string) {
  const res = await request<{ sent: boolean }>(
    '/admin/integrations/sms/send',
    {
      method: 'POST',
      body: JSON.stringify({ number, message }),
    }
  )
  return res.data!
}

export async function sendBulkIntegrationSms(numbers: string[], message: string) {
  const res = await request<{ sent: number; failed: number }>(
    '/admin/integrations/sms/bulk',
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
    '/admin/integrations/vicidialer/upload',
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
    '/admin/integrations/guardrisk/export',
    { method: 'POST' }
  )
  return res.data!
}

// WhatsApp / WATI
export async function sendWhatsApp(number: string, template: string, params: unknown[]) {
  const res = await request<{ sent: boolean }>(
    '/admin/integrations/whatsapp/send',
    {
      method: 'POST',
      body: JSON.stringify({ number, template, params }),
    }
  )
  return res.data!
}

// File Exports
export async function getFileExports() {
  const res = await request<FileExport[]>('/admin/integrations/files')
  return res.data!
}

export const sections = [
  {
    title: 'Personal',
    items: [
      { to: '/dashboard', label: 'My Dashboard', icon: 'LayoutDashboard' },
      { to: '/referrals/history', label: 'Referral History', icon: 'History' },
      { to: '/leads/history', label: 'Lead History', icon: 'History' },
      { to: '/payments', label: 'My Payments', icon: 'Wallet' },
      { to: '/leaderboard', label: 'Leaderboard', icon: 'Trophy' },
    ],
  },
  {
    title: 'Workspace Home',
    roles: ['QA_OFFICER', 'ADMIN'],
    items: [
      { to: '/admin', label: 'Operations Center', icon: 'LayoutDashboard' },
    ],
  },
  {
    title: 'Marketing & Agents',
    roles: ['ADMIN', 'QA_OFFICER', 'AGENT', 'AMBASSADOR'],
    items: [
      { to: '/admin/agents', label: 'Agent Management', icon: 'UserCheck', roles: ['ADMIN'] },
      { to: '/referrals', label: 'Submit Referrals', icon: 'Send' },
      { to: '/leads', label: 'Submit Lead', icon: 'UserPlus' },
      { to: '/admin/ambassador-backend', label: 'Ambassador Backend', icon: 'Landmark', roles: ['ADMIN'] },
    ],
  },
  {
    title: 'Engagement & Collections',
    roles: ['AGENT', 'QA_OFFICER', 'ADMIN'],
    items: [
      { to: '/admin/clients', label: 'Client Records', icon: 'Users' },
      { to: '/admin/sales', label: 'Sales Capture', icon: 'ShoppingCart' },
      { to: '/admin/commissions', label: 'Commissions', icon: 'Coins' },
      { to: '/admin/qa', label: 'QA Validation', icon: 'CheckSquare', roles: ['QA_OFFICER', 'ADMIN'] },
      { to: '/admin/export-status', label: 'Export & Q-Link', icon: 'FileCheck2', roles: ['QA_OFFICER', 'ADMIN'] },
      { to: '/admin/policies', label: 'Policies', icon: 'Shield', roles: ['QA_OFFICER', 'ADMIN'] },
      { to: '/admin/reports', label: 'Operations Exports', icon: 'FileBarChart', roles: ['ADMIN'] },
    ],
  },
  {
    title: 'Client Communications',
    roles: ['QA_OFFICER', 'ADMIN'],
    items: [
      { to: '/admin/documents', label: 'Document Delivery', icon: 'FileText' },
      { to: '/admin/sms', label: 'SMS Center', icon: 'MessageSquare', roles: ['ADMIN'] },
    ],
  },
  {
    title: 'System Admin',
    roles: ['ADMIN'],
    items: [
      { to: '/admin/products', label: 'Products', icon: 'Package' },
      { to: '/admin/premium-changes', label: 'Premium Updates', icon: 'DollarSign' },
      { to: '/admin/ai-agents', label: 'AI Agents', icon: 'Bot' },
      { to: '/admin/workflows', label: 'Workflows', icon: 'GitBranch' },
      { to: '/admin/integrations', label: 'Integrations', icon: 'Plug' },
      { to: '/admin/sql', label: 'SQL Console', icon: 'Terminal' },
      { to: '/admin/sync', label: 'FoxPro Sync', icon: 'ArrowLeftRight' },
    ],
  },
]
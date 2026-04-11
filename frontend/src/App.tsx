import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import Landing from '@/pages/Landing'
import Register from '@/pages/Register'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import SubmitReferrals from '@/pages/SubmitReferrals'
import ReferralHistory from '@/pages/ReferralHistory'
import SubmitLead from '@/pages/SubmitLead'
import LeadHistory from '@/pages/LeadHistory'
import Profile from '@/pages/Profile'

// Admin pages
import AdminDashboard from '@/pages/admin/AdminDashboard'
import Clients from '@/pages/admin/Clients'
import ClientDetail from '@/pages/admin/ClientDetail'
import Products from '@/pages/admin/Products'
import PremiumChanges from '@/pages/admin/PremiumChanges'
import Policies from '@/pages/admin/Policies'
import Sales from '@/pages/admin/Sales'
import QualityAssurance from '@/pages/admin/QualityAssurance'
import Commissions from '@/pages/admin/Commissions'
import Agents from '@/pages/admin/Agents'
import AiAgents from '@/pages/admin/AiAgents'
import Workflows from '@/pages/admin/Workflows'
import WorkflowDetail from '@/pages/admin/WorkflowDetail'
import WorkflowInstance from '@/pages/admin/WorkflowInstance'
import Documents from '@/pages/admin/Documents'
import SmsCenter from '@/pages/admin/SmsCenter'
import Integrations from '@/pages/admin/Integrations'

export default function App() {
  return (
    <Layout>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/referrals"
          element={
            <ProtectedRoute>
              <SubmitReferrals />
            </ProtectedRoute>
          }
        />
        <Route
          path="/referrals/history"
          element={
            <ProtectedRoute>
              <ReferralHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leads"
          element={
            <ProtectedRoute>
              <SubmitLead />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leads/history"
          element={
            <ProtectedRoute>
              <LeadHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Agent routes (AGENT + QA_OFFICER + ADMIN) */}
        <Route
          path="/admin/clients"
          element={
            <ProtectedRoute allowedRoles={['AGENT', 'QA_OFFICER', 'ADMIN']}>
              <Clients />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/clients/:id"
          element={
            <ProtectedRoute allowedRoles={['AGENT', 'QA_OFFICER', 'ADMIN']}>
              <ClientDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/sales"
          element={
            <ProtectedRoute allowedRoles={['AGENT', 'QA_OFFICER', 'ADMIN']}>
              <Sales />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/commissions"
          element={
            <ProtectedRoute allowedRoles={['AGENT', 'QA_OFFICER', 'ADMIN']}>
              <Commissions />
            </ProtectedRoute>
          }
        />

        {/* QA routes (QA_OFFICER + ADMIN) */}
        <Route
          path="/admin/qa"
          element={
            <ProtectedRoute allowedRoles={['QA_OFFICER', 'ADMIN']}>
              <QualityAssurance />
            </ProtectedRoute>
          }
        />

        {/* Admin-only routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'QA_OFFICER']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/products"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Products />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/premium-changes"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <PremiumChanges />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/policies"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'QA_OFFICER']}>
              <Policies />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/agents"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Agents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/ai-agents"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AiAgents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/workflows"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Workflows />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/workflows/instances/:id"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <WorkflowInstance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/workflows/:id"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <WorkflowDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/documents"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'QA_OFFICER']}>
              <Documents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/sms"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <SmsCenter />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/integrations"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Integrations />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

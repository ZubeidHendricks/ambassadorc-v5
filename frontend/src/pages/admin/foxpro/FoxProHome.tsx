import { Link } from 'react-router-dom'
import {
  ClipboardCheck, Upload, ListChecks, Users, ShoppingCart, PhoneCall,
  BarChart3, DollarSign, Package, ArrowLeftRight, UserCheck, FileText, FilePlus,
} from 'lucide-react'
import { FoxHeader } from './FoxHeader'

interface Mod { to: string; label: string; desc: string; icon: any; external?: boolean }
interface Group { title: string; mods: Mod[] }

// Mirrors the FoxPro CRM top-nav / Business-Sector partitioning, wiring each
// legacy module to its AmbassadorC v5 equivalent.
const groups: Group[] = [
  {
    title: 'Quality Assurance & Export',
    mods: [
      { to: '/admin/foxpro/qa-bay', label: 'QA Bay', desc: 'QA mailbox — Submit / Repair / Cancel captured sales', icon: ClipboardCheck },
      { to: '/admin/foxpro/exports', label: 'Export & Status', desc: 'Midnight exports, debit batches & return outcomes', icon: Upload },
      { to: '/admin/foxpro/statuses', label: 'Status Codes', desc: 'The full FoxPro status taxonomy reference', icon: ListChecks },
      { to: '/admin/qa', label: 'QA Reviews (v5)', desc: 'Modern QA verdict workflow', icon: ClipboardCheck },
    ],
  },
  {
    title: 'Business Sector — Sales',
    mods: [
      { to: '/admin/foxpro/capture', label: 'Product Capture', desc: 'Capture a new sale (LifeSaver 24, Legal, LegalNet, 5-in-1)', icon: FilePlus },
      { to: '/admin/sales', label: 'Sales Pipeline', desc: 'Captured sales across all products', icon: ShoppingCart },
      { to: '/admin/clients', label: 'Client Detail', desc: 'Search & manage 85k+ clients', icon: Users },
      { to: '/admin/products', label: 'Products', desc: 'Product & premium tier definitions', icon: Package },
      { to: '/admin/premium-changes', label: 'Premium Increase', desc: 'Manage product premium increases', icon: DollarSign },
    ],
  },
  {
    title: 'Leads & Ambassador Program',
    mods: [
      { to: '/leads/history', label: 'FoxPro Leads', desc: 'Lead dispositions & call outcomes', icon: PhoneCall },
      { to: '/admin/agents', label: 'Manage Agents / Ambassadors', desc: 'Agents, tiers & Tier-2 linking', icon: UserCheck },
      { to: '/leaderboard', label: 'Agent Earnings', desc: 'Production & earnings leaderboard', icon: BarChart3 },
    ],
  },
  {
    title: 'Reporting & Data',
    mods: [
      { to: '/admin', label: 'Reports / Dashboard', desc: 'Production & revenue dashboards', icon: BarChart3 },
      { to: '/admin/sync', label: 'FoxPro Sync', desc: 'ETL from the live FoxPro SQL Server', icon: ArrowLeftRight },
      { to: '/admin/documents', label: 'Welcome Packs', desc: 'Statutory document delivery', icon: FileText },
    ],
  },
]

export default function FoxProHome() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <FoxHeader
        title="CRM Modules"
        subtitle="The FoxPro sales lifecycle, re-partitioned in AmbassadorC v5: capture → quality assurance → export to Netcash / Q-Link → collection outcome. Each tile maps a legacy FoxPro module to its v5 equivalent."
      />

      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">{g.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {g.mods.map((m) => {
              const Icon = m.icon
              return (
                <Link
                  key={m.to + m.label}
                  to={m.to}
                  className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-[#F26522]/40 hover:shadow-md"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F26522]/10 text-[#F26522] transition-colors group-hover:bg-[#F26522] group-hover:text-white">
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{m.label}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{m.desc}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

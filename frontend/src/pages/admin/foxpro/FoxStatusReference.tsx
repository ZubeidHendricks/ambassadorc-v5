import { useState, useEffect } from 'react'
import { FoxStatusBadge } from '@/components/ui/FoxStatusBadge'
import { FoxHeader } from './FoxHeader'
import { getFoxStatuses, type FoxStatusReference as Ref } from '@/lib/api'

export default function FoxStatusReference() {
  const [ref, setRef] = useState<Ref | null>(null)

  useEffect(() => {
    getFoxStatuses().then(setRef).catch(() => setRef(null))
  }, [])

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <FoxHeader
        title="Status Codes"
        subtitle="The FoxPro status taxonomy that drives the sales → QA → export → collection lifecycle, mapped to the AmbassadorC v5 sale statuses."
      />

      {!ref && <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-400">Loading status reference…</div>}

      {ref && (
        <>
          {/* Pipeline status codes */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Sales Pipeline Status Codes</h2>
              <p className="text-sm text-gray-500">Captured → QA → QA passed → exported → outcome.</p>
            </div>
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-6 py-3">Code</th>
                  <th className="px-6 py-3">Meaning</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3">v5 Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ref.pipeline.map((s) => (
                  <tr key={s.code} className="hover:bg-gray-50/60">
                    <td className="px-6 py-3"><FoxStatusBadge code={s.code} color={s.color} /></td>
                    <td className="px-6 py-3 font-medium text-gray-900">{s.label}</td>
                    <td className="px-6 py-3 text-gray-600">{s.description}</td>
                    <td className="px-6 py-3"><span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">{s.mapsTo}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Lead dispositions */}
            <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-4">
                <h2 className="text-base font-semibold text-gray-900">FoxPro Leads — Call Dispositions</h2>
              </div>
              <ul className="divide-y divide-gray-100">
                {ref.leadDispositions.map((d) => (
                  <li key={d.code} className="flex items-center justify-between px-6 py-2.5 text-sm">
                    <span className="text-gray-700">{d.label}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{d.outcome}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Q-Link / Persal codes */}
            <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-4">
                <h2 className="text-base font-semibold text-gray-900">Q-Link / Persal Result Codes</h2>
              </div>
              <ul className="divide-y divide-gray-100">
                {ref.qlinkCodes.map((c) => (
                  <li key={c.code} className="flex items-center justify-between px-6 py-2.5 text-sm">
                    <span className="text-gray-700"><span className="font-mono font-semibold text-gray-900">{c.code}</span> · {c.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.effect === 'collecting' ? 'bg-emerald-50 text-emerald-600' : c.effect === 'stopped' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{c.effect}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Export return reasons */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Export Return Reasons</h2>
            </div>
            <ul className="divide-y divide-gray-100">
              {ref.exportReturnReasons.map((r) => (
                <li key={r.code} className="flex items-center justify-between px-6 py-2.5 text-sm">
                  <span className="text-gray-700">{r.label}</span>
                  <span className="rounded-full bg-[#F26522]/10 px-2.5 py-1 text-xs font-semibold text-[#F26522]">{r.action}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

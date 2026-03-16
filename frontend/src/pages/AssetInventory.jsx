import { useState, useEffect, useMemo } from 'react'
import { Search, ExternalLink, ChevronDown } from 'lucide-react'
import KpiCard from '../components/KpiCard.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { fetchInventory } from '../api/client.js'

const HEALTH_OPTIONS = ['All', 'healthy', 'warning', 'stale']
const SHARED_OPTIONS = ['All', 'Shared only', 'Non-shared only']

function HealthBadge({ health }) {
  if (health === 'healthy') return <span className="badge-healthy"><span>●</span> Healthy</span>
  if (health === 'warning') return <span className="badge-warning"><span>●</span> Warning</span>
  return <span className="badge-stale"><span>●</span> Stale</span>
}

function fmtBytes(bytes) {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2)} TB`
  if (bytes >= 1e9)  return `${(bytes / 1e9).toFixed(2)} GB`
  if (bytes >= 1e6)  return `${(bytes / 1e6).toFixed(1)} MB`
  return `${(bytes / 1e3).toFixed(0)} KB`
}

export default function AssetInventory({ selectedOrg, selectedStack }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [healthFilter, setHealthFilter] = useState('All')
  const [sharedFilter, setSharedFilter] = useState('All')

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchInventory(selectedOrg)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [selectedOrg])

  const tables = data?.tables ?? []

  const filtered = useMemo(() => {
    return tables.filter(t => {
      if (search && !t.table_name.toLowerCase().includes(search.toLowerCase())) return false
      if (healthFilter !== 'All' && t.health !== healthFilter) return false
      if (sharedFilter === 'Shared only' && !t.is_shared) return false
      if (sharedFilter === 'Non-shared only' && t.is_shared) return false
      return true
    })
  }, [tables, search, healthFilter, sharedFilter])

  const healthy   = tables.filter(t => t.health === 'healthy').length
  const stale     = tables.filter(t => t.health === 'stale').length
  const shared    = tables.filter(t => t.is_shared).length
  const slaRate   = tables.length > 0 ? Math.round((healthy / tables.length) * 100) : 0

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title">Asset Inventory &amp; Cleanup</h1>
        <p className="caption mt-1">
          Centralized registry of data assets
          {selectedOrg !== 'All Organizations' && (
            <span className="ml-1 font-medium text-slate-700">· {selectedOrg}</span>
          )}
        </p>
      </div>

      {loading && <LoadingSpinner message="Loading asset inventory…" />}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-6">
          Failed to load: {error}
        </div>
      )}

      {!loading && !error && data && tables.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-base font-semibold text-slate-700 mb-2">No table telemetry data available</p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Storage telemetry (row counts, bytes, freshness) is not collected for{' '}
            {selectedOrg !== 'All Organizations' ? <strong>{selectedOrg}</strong> : 'the selected filters'}.
            {' '}ROI Analysis data is still available for this organization.
          </p>
        </div>
      )}

      {!loading && !error && data && tables.length > 0 && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KpiCard label="Total Assets"   value={tables.length.toLocaleString()} color="blue" />
            <KpiCard label="SLA Compliance" value={`${slaRate}%`}                  color="green" />
            <KpiCard label="Stale Assets"   value={stale.toLocaleString()}          color="red" />
            <KpiCard label="Shared Tables"  value={shared.toLocaleString()}         color="amber" />
          </div>

          <div className="divider" />

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search tables…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-9"
              />
            </div>
            <div className="relative w-44">
              <select
                value={healthFilter}
                onChange={e => setHealthFilter(e.target.value)}
                className="select pr-8"
              >
                {HEALTH_OPTIONS.map(o => (
                  <option key={o} value={o}>{o === 'All' ? 'All health' : o.charAt(0).toUpperCase() + o.slice(1)}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative w-44">
              <select
                value={sharedFilter}
                onChange={e => setSharedFilter(e.target.value)}
                className="select pr-8"
              >
                {SHARED_OPTIONS.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Results summary */}
          <p className="text-sm text-slate-500 mb-4">
            Showing <span className="font-semibold text-slate-800">{Math.min(filtered.length, 100)}</span>
            {filtered.length > 100 ? ` of ${filtered.length.toLocaleString()}` : ` asset${filtered.length !== 1 ? 's' : ''}`}
            {(search || healthFilter !== 'All' || sharedFilter !== 'All') && ' (filtered)'}
          </p>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="card p-12 text-center text-slate-400">
              <p className="text-base font-medium">No assets match your filters</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                      {['Table', 'Project', 'Health', 'Staleness', 'Rows', 'Size'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 100).map((t, i) => (
                      <tr key={i} className="border-t border-slate-100 hover:bg-blue-50/30 transition-colors">
                        <td className="px-5 py-3.5 max-w-[220px]">
                          <div className="flex items-center gap-2">
                            {t.table_url ? (
                              <a
                                href={t.table_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-blue-600 hover:text-blue-800 hover:underline truncate flex items-center gap-1.5"
                              >
                                {t.table_name}
                                <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60" />
                              </a>
                            ) : (
                              <span className="font-medium text-slate-800 truncate">{t.table_name}</span>
                            )}
                            {t.is_shared && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded text-xs font-medium">
                                shared
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 max-w-[160px] truncate">{t.project_name}</td>
                        <td className="px-5 py-3.5"><HealthBadge health={t.health} /></td>
                        <td className="px-5 py-3.5 text-slate-600">
                          {t.hours_stale >= 99999 ? '—' : `${t.hours_stale.toLocaleString()} h`}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{t.rows.toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-slate-600">{fmtBytes(t.bytes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length > 100 && (
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                  <p className="text-xs text-slate-400">
                    Showing first 100 of {filtered.length.toLocaleString()} results. Refine your search to see more.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

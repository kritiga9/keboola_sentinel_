import { ShieldCheck, DollarSign, BarChart3, FlaskConical, ChevronDown, Layers } from 'lucide-react'

const NAV = [
  { id: 'roi',       icon: DollarSign,  label: 'ROI Analysis' },
  { id: 'inventory', icon: BarChart3,   label: 'Asset Inventory' },
  { id: 'impact',    icon: FlaskConical, label: 'Impact Analysis' },
]

export default function Sidebar({
  page, setPage,
  stacks, selectedStack, setSelectedStack,
  orgs, selectedOrg, setSelectedOrg,
}) {
  const orgOptions = ['All Organizations', ...orgs]

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-slate-800 flex flex-col z-20 shadow-xl">

      {/* Logo */}
      <div className="px-6 pt-7 pb-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-blue-400 flex-shrink-0" />
          <div>
            <h1 className="text-white font-bold text-lg leading-none tracking-wide">SENTINEL</h1>
            <p className="text-slate-400 text-xs mt-0.5">Data Governance Suite</p>
          </div>
        </div>
      </div>

      <div className="px-4 mb-1"><div className="h-px bg-slate-700" /></div>

      {/* ── Stack filter ── */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Layers className="w-3 h-3 text-slate-400" />
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Stack</p>
        </div>
        <div className="relative">
          <select
            value={selectedStack}
            onChange={e => setSelectedStack(e.target.value)}
            className="w-full appearance-none bg-slate-700 text-sm rounded-lg px-3 py-2.5
                       border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500
                       cursor-pointer pr-8
                       text-white"
          >
            <option value="">— Select a stack —</option>
            {stacks.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* ── Organisation filter (shown only after stack is selected) ── */}
      {selectedStack && (
        <div className="px-4 pb-4">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-2">
            Organization
          </p>

          {orgs.length === 0 ? (
            <p className="text-slate-500 text-xs italic px-1">Loading organizations…</p>
          ) : (
            <div className="relative">
              <select
                value={selectedOrg}
                onChange={e => setSelectedOrg(e.target.value)}
                className="w-full appearance-none bg-slate-700 text-white text-sm rounded-lg px-3 py-2.5
                           border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500
                           cursor-pointer pr-8"
              >
                {orgOptions.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          )}

          {selectedOrg !== 'All Organizations' && (
            <div className="mt-2 px-3 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg">
              <p className="text-blue-300 text-xs font-semibold leading-none mb-1">Active filter</p>
              <p className="text-white text-xs truncate">{selectedOrg}</p>
            </div>
          )}
        </div>
      )}

      <div className="px-4 mb-2"><div className="h-px bg-slate-700" /></div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {NAV.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                        transition-all duration-150 text-left
                        ${page === id
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 mt-auto">
        <div className="h-px bg-slate-700 mb-4" />
        <p className="text-slate-500 text-xs text-center">Powered by Keboola Telemetry</p>
        <p className="text-slate-600 text-xs text-center mt-0.5">Refreshes every 5 min</p>
      </div>
    </aside>
  )
}

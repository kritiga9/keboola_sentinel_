import { useState, useEffect } from 'react'
import { ChevronDown, AlertTriangle } from 'lucide-react'
import KpiCard from '../components/KpiCard.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { fetchImpactTables, fetchImpactAnalysis } from '../api/client.js'

// ── Dependency graph rendered as SVG ─────────────────────────────────────────

const NODE_W   = 192
const NODE_H   = 62
const COL_GAP  = 110
const ROW_GAP  = 14
const PAD_X    = 28
const PAD_TOP  = 28
const PAD_BOT  = 44   // extra bottom space for legend

function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + '…' : str
}

function nodeColor(type, side) {
  if (side === 'center') return { fill: '#2563eb', text: '#fff', border: '#1d4ed8', shadow: '#bfdbfe' }
  if (side === 'writer') return { fill: '#16a34a', text: '#fff', border: '#15803d', shadow: '#bbf7d0' }
  const t = (type || '').toLowerCase()
  if (t.includes('transformation')) return { fill: '#d97706', text: '#fff', border: '#b45309', shadow: '#fde68a' }
  if (t.includes('writer'))         return { fill: '#dc2626', text: '#fff', border: '#b91c1c', shadow: '#fecaca' }
  return { fill: '#475569', text: '#fff', border: '#334155', shadow: '#cbd5e1' }
}

function Node({ x, y, label, sub, color, isCenter }) {
  return (
    <g>
      {/* Shadow */}
      <rect x={x + 2} y={y + 3} width={NODE_W} height={NODE_H} rx="10"
        fill={color.shadow} opacity="0.5" />
      {/* Body */}
      <rect x={x} y={y} width={NODE_W} height={NODE_H} rx="10"
        fill={color.fill} stroke={color.border} strokeWidth={isCenter ? 2 : 1.5} />
      {/* Label */}
      <text
        x={x + NODE_W / 2} y={y + 24}
        fill={color.text} fontSize="11.5" fontWeight="600"
        textAnchor="middle" dominantBaseline="middle"
      >
        {truncate(label, 24)}
      </text>
      {/* Sub-label */}
      <text
        x={x + NODE_W / 2} y={y + 42}
        fill={color.text} fontSize="9.5" opacity="0.75"
        textAnchor="middle" dominantBaseline="middle"
      >
        {truncate(sub, 26)}
      </text>
    </g>
  )
}

function DependencyGraph({ writers, readers, tableName }) {
  const leftCount  = writers.length
  const rightCount = readers.length
  const maxRows    = Math.max(leftCount, rightCount, 1)

  const innerH = maxRows * NODE_H + (maxRows - 1) * ROW_GAP
  const totalH = PAD_TOP + innerH + PAD_BOT
  const totalW = PAD_X * 2 + NODE_W * 3 + COL_GAP * 2

  const centerX = PAD_X + NODE_W + COL_GAP
  const centerY = PAD_TOP + (innerH - NODE_H) / 2

  function rowY(count, i) {
    const blockH = count * NODE_H + (count - 1) * ROW_GAP
    const startY = PAD_TOP + (innerH - blockH) / 2
    return startY + i * (NODE_H + ROW_GAP)
  }

  const writerNodes = writers.map((w, i) => ({
    x:     PAD_X,
    y:     rowY(Math.max(leftCount, 1), i),
    label: w.config_name,
    sub:   w.component_name,
    color: nodeColor(w.component_type, 'writer'),
  }))

  const readerNodes = readers.map((r, i) => ({
    x:     PAD_X + NODE_W * 2 + COL_GAP * 2,
    y:     rowY(Math.max(rightCount, 1), i),
    label: r.config_name,
    sub:   r.component_name,
    color: nodeColor(r.component_type, 'reader'),
  }))

  const centerColor = nodeColor(null, 'center')

  const isEmpty = writers.length === 0 && readers.length === 0
  const svgH    = isEmpty ? 140 : Math.max(totalH, 140)

  return (
    <div className="overflow-x-auto rounded-xl bg-slate-50 border border-slate-200 p-2">
      <svg width={totalW} height={svgH} className="font-sans block">
        <defs>
          <marker id="arrowGreen" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
            <path d="M0,0.5 L0,6.5 L8,3.5 z" fill="#16a34a" />
          </marker>
          <marker id="arrowSlate" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
            <path d="M0,0.5 L0,6.5 L8,3.5 z" fill="#64748b" />
          </marker>
          <marker id="arrowRed" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
            <path d="M0,0.5 L0,6.5 L8,3.5 z" fill="#dc2626" />
          </marker>
          <marker id="arrowAmber" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
            <path d="M0,0.5 L0,6.5 L8,3.5 z" fill="#d97706" />
          </marker>
        </defs>

        {/* Writer → Center edges */}
        {writerNodes.map((w, i) => {
          const x1 = w.x + NODE_W, y1 = w.y + NODE_H / 2
          const x2 = centerX,      y2 = centerY + NODE_H / 2
          const mx = (x1 + x2) / 2
          return (
            <path key={`we-${i}`}
              d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill="none" stroke="#16a34a" strokeWidth="2" strokeOpacity="0.55"
              markerEnd="url(#arrowGreen)"
            />
          )
        })}

        {/* Center → Reader edges */}
        {readerNodes.map((r, i) => {
          const x1 = centerX + NODE_W, y1 = centerY + NODE_H / 2
          const x2 = r.x,              y2 = r.y + NODE_H / 2
          const mx = (x1 + x2) / 2
          const t  = (r.color.fill === '#dc2626' || r.color.fill === '#d97706')
          const strokeColor = r.color.border
          const markerId    = r.color.fill === '#d97706' ? 'arrowAmber'
                            : r.color.fill === '#dc2626' ? 'arrowRed' : 'arrowSlate'
          return (
            <path key={`re-${i}`}
              d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill="none" stroke={strokeColor} strokeWidth="2" strokeOpacity="0.55"
              markerEnd={`url(#${markerId})`}
            />
          )
        })}

        {/* Writer nodes */}
        {writerNodes.map((n, i) => (
          <Node key={`wn-${i}`} {...n} />
        ))}

        {/* Center node */}
        <Node
          x={centerX} y={centerY}
          label={tableName} sub="selected table"
          color={centerColor} isCenter
        />

        {/* Reader nodes */}
        {readerNodes.map((n, i) => (
          <Node key={`rn-${i}`} {...n} />
        ))}

        {/* Empty state */}
        {isEmpty && (
          <text x={totalW / 2} y={svgH / 2} fill="#94a3b8" fontSize="13"
            textAnchor="middle" dominantBaseline="middle">
            No dependencies found for this table
          </text>
        )}

        {/* Legend */}
        {!isEmpty && (
          <g transform={`translate(${PAD_X}, ${svgH - 22})`}>
            <rect width="11" height="11" rx="3" fill="#16a34a" y="-0.5" />
            <text x="16" y="9" fontSize="10" fill="#64748b">Writes to table</text>
            <rect x="118" width="11" height="11" rx="3" fill="#dc2626" y="-0.5" />
            <text x="134" y="9" fontSize="10" fill="#64748b">Reads from table</text>
            <rect x="254" width="11" height="11" rx="3" fill="#d97706" y="-0.5" />
            <text x="270" y="9" fontSize="10" fill="#64748b">Transformation</text>
            <rect x="364" width="11" height="11" rx="3" fill="#475569" y="-0.5" />
            <text x="380" y="9" fontSize="10" fill="#64748b">Other</text>
          </g>
        )}
      </svg>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ImpactAnalysis({ selectedOrg, selectedStack }) {
  const [tables, setTables] = useState([])
  const [tablesLoading, setTablesLoading] = useState(false)
  const [selectedTable, setSelectedTable] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [error, setError] = useState(null)

  const orgSelected = selectedOrg && selectedOrg !== 'All Organizations'

  // Load table list
  useEffect(() => {
    if (!orgSelected) { setTables([]); setSelectedTable(''); setAnalysis(null); return }
    setTablesLoading(true)
    setSelectedTable('')
    setAnalysis(null)
    fetchImpactTables(selectedOrg)
      .then(t => { setTables(t); if (t.length > 0) setSelectedTable(t[0]) })
      .catch(e => setError(e.message))
      .finally(() => setTablesLoading(false))
  }, [selectedOrg, orgSelected])

  // Load analysis when table changes
  useEffect(() => {
    if (!selectedTable) return
    setAnalysisLoading(true)
    setError(null)
    fetchImpactAnalysis(selectedTable, selectedOrg)
      .then(setAnalysis)
      .catch(e => setError(e.message))
      .finally(() => setAnalysisLoading(false))
  }, [selectedTable, selectedOrg])

  const readers       = analysis?.readers ?? []
  const writers       = analysis?.writers ?? []
  const affected      = analysis?.affected_tables ?? []
  const totalDeps     = analysis?.total_dependencies ?? 0

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title">Schema Impact Analysis</h1>
        <p className="caption mt-1">
          Analyze dependencies before schema changes
          {selectedOrg !== 'All Organizations' && (
            <span className="ml-1 font-medium text-slate-700">· {selectedOrg}</span>
          )}
        </p>
      </div>

      {!orgSelected && (
        <div className="card p-12 text-center text-slate-400">
          <p className="text-lg font-medium text-slate-600">Select an organisation to load data</p>
          <p className="text-sm mt-1">Choose a stack and organisation from the left sidebar.</p>
        </div>
      )}

      {orgSelected && tablesLoading && <LoadingSpinner message="Building lineage index…" />}

      {orgSelected && !tablesLoading && tables.length === 0 && (
        <div className="card p-12 text-center text-slate-400">
          <p className="text-base font-medium">No tables found</p>
          {selectedStack && selectedStack.includes('.keboola.cloud') ? (
            <p className="text-sm mt-1 text-amber-600">
              Table telemetry is not collected for the private stack &quot;{selectedStack}&quot;. ROI data is still available.
            </p>
          ) : (
            <p className="text-sm mt-1">Try selecting a different organization.</p>
          )}
        </div>
      )}

      {orgSelected && !tablesLoading && tables.length > 0 && (
        <>
          {/* Table selector */}
          <div className="card p-5 mb-6">
            <label className="block text-xs font-medium text-slate-500 mb-2">Select a table to analyze impact</label>
            <div className="relative max-w-lg">
              <select
                value={selectedTable}
                onChange={e => setSelectedTable(e.target.value)}
                className="select pr-8"
              >
                {tables.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-6">
              Error: {error}
            </div>
          )}

          {analysisLoading && <LoadingSpinner message="Analyzing dependencies…" />}

          {!analysisLoading && analysis && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <KpiCard label="Downstream Configs" value={readers.length}      color="red"    sub="Read from table" />
                <KpiCard label="Upstream Configs"   value={writers.length}      color="green"  sub="Write to table" />
                <KpiCard label="Affected Tables"    value={affected.length}      color="purple" sub="Downstream outputs" />
                <KpiCard label="Total Dependencies" value={totalDeps}           color="blue" />
              </div>

              <div className="divider" />

              {/* Graph */}
              <div className="card p-6 mb-6">
                <h2 className="section-title mb-1">Dependency Graph</h2>
                <p className="caption mb-6">
                  Green nodes write to the selected table · Red/amber nodes read from it
                </p>
                <DependencyGraph
                  writers={writers}
                  readers={readers}
                  tableName={selectedTable}
                />
              </div>

              {/* Warning banner */}
              {(readers.length > 0 || affected.length > 0) && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-800">
                      Modifying <code className="font-mono bg-amber-100 px-1 rounded">{selectedTable}</code> will
                      affect <strong>{readers.length} config{readers.length !== 1 ? 's' : ''}</strong> and{' '}
                      <strong>{affected.length} downstream table{affected.length !== 1 ? 's' : ''}</strong>.
                    </p>
                    {affected.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-amber-700">
                        {affected.slice(0, 6).map((t, i) => (
                          <li key={i} className="font-mono text-xs">· {t}</li>
                        ))}
                        {affected.length > 6 && (
                          <li className="text-xs">and {affected.length - 6} more…</li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {readers.length === 0 && writers.length === 0 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                  No dependencies found — this table can be safely modified.
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

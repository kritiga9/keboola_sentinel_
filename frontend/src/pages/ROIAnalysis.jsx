import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { RefreshCw, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import KpiCard from '../components/KpiCard.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { fetchRoi } from '../api/client.js'

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function fmtMb(mb) {
  if (mb >= 1024 * 1024) return `${(mb / (1024 * 1024)).toFixed(2)} TB`
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  return `${mb.toFixed(0)} MB`
}

const CustomTooltip = ({ active, payload, label, costPerPPU }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-sm max-w-xs">
      <p className="font-semibold text-slate-900 mb-2 truncate">{d.flow_name}</p>
      <div className="space-y-1 text-slate-600">
        <p><span className="font-medium text-slate-800">Total cost:</span> ${(d.total_credits * costPerPPU).toFixed(2)}</p>
        <p><span className="font-medium text-slate-800">Avg cost/run:</span> ${(d.avg_credits_per_run * costPerPPU).toFixed(4)}</p>
        <p><span className="font-medium text-slate-800">Runs:</span> {d.run_count.toLocaleString()}</p>
        <p><span className="font-medium text-slate-800">Use case:</span> {d.use_case}</p>
        <p><span className="font-medium text-slate-800">Data change rate:</span> {d.data_change_rate.toFixed(1)}%</p>
      </div>
    </div>
  )
}

export default function ROIAnalysis({ selectedOrg }) {
  const [startDate, setStartDate] = useState(daysAgo(90))
  const [endDate, setEndDate] = useState(today)
  const [costPerPPU, setCostPerPPU] = useState(0.50)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchRoi(selectedOrg, startDate, endDate)
      setData(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [selectedOrg, startDate, endDate])

  useEffect(() => { load() }, [load])

  const flows = data?.flows ?? []
  const hasData = flows.length > 0 && flows.reduce((s, f) => s + f.total_credits, 0) > 0

  // Derived metrics
  const totalCredits   = flows.reduce((s, f) => s + f.total_credits, 0)
  const totalCost      = totalCredits * costPerPPU
  const totalRuns      = flows.reduce((s, f) => s + f.run_count, 0)
  const avgCostPerRun  = totalRuns > 0 ? totalCost / totalRuns : 0
  const totalDataMb    = flows.reduce((s, f) => s + f.total_data_mb, 0)
  const totalTasks     = flows.reduce((s, f) => s + f.total_tasks, 0)
  const successTasks   = flows.reduce((s, f) => s + f.successful_tasks, 0)
  const successRate    = totalTasks > 0 ? (successTasks / totalTasks) * 100 : 0

  const days           = Math.max((new Date(endDate) - new Date(startDate)) / 86400000, 1)
  const weeks          = days / 7
  const months         = days / 30.44

  // Chart data: top 10 by cost, ascending for horizontal chart (bottom = most expensive)
  const chartFlows = [...flows]
    .sort((a, b) => b.total_credits - a.total_credits)
    .slice(0, 10)
    .sort((a, b) => a.total_credits - b.total_credits)

  const noDataFlows  = flows.filter(f => f.data_change_rate === 0)
  const lowDataFlows = flows.filter(f => f.data_change_rate > 0 && f.data_change_rate < 50)

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title">ROI Analysis</h1>
        <p className="caption mt-1">
          Cost attribution and return on investment analysis by flow
          {selectedOrg !== 'All Organizations' && (
            <span className="ml-1 font-medium text-slate-700">· {selectedOrg}</span>
          )}
        </p>
      </div>

      {/* Settings */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Settings</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">End date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="input"
            />
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Cost per PPU ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={costPerPPU}
              onChange={e => setCostPerPPU(parseFloat(e.target.value) || 0)}
              className="input"
            />
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="btn-primary h-10"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Failed to load data</p>
            <p className="text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {loading && <LoadingSpinner message="Querying flow cost data…" />}

      {!loading && !error && !hasData && data && (
        <div className="card p-12 text-center text-slate-400">
          <p className="text-lg font-medium">No flow cost data found</p>
          <p className="text-sm mt-1">Try adjusting the date range or organization filter.</p>
        </div>
      )}

      {!loading && hasData && (
        <>
          {/* KPI row 1 */}
          <div className="mb-3">
            <h2 className="section-title mb-1">Key Metrics</h2>
            <p className="caption mb-4">{startDate} → {endDate}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Avg $ per Flow Run" value={`$${avgCostPerRun.toFixed(2)}`}   color="red" />
              <KpiCard label="Total Cost"          value={`$${totalCost.toLocaleString('en', { maximumFractionDigits: 2 })}`} color="blue" />
              <KpiCard label="Total Runs"          value={totalRuns.toLocaleString()}        color="green" />
              <KpiCard label="Total PPU"           value={totalCredits.toLocaleString('en', { maximumFractionDigits: 1 })} color="purple" />
            </div>
          </div>

          {/* KPI row 2 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KpiCard label="Unique Flows" value={flows.length}                                           color="blue" />
            <KpiCard label="Total Tasks"  value={totalTasks.toLocaleString()}                            color="green" />
            <KpiCard label="Success Rate" value={`${successRate.toFixed(1)}%`} color={successRate > 90 ? 'green' : 'amber'} />
            <KpiCard label="Data Moved"   value={fmtMb(totalDataMb)}                                    color="purple" />
          </div>

          <div className="divider" />

          {/* Chart */}
          <div className="card p-6 mb-8">
            <h2 className="section-title mb-1">Top 10 Flows by Cost</h2>
            <p className="caption mb-6">Flows ranked by total dollar cost</p>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart
                data={chartFlows}
                layout="vertical"
                margin={{ top: 4, right: 80, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  tickFormatter={v => `$${(v * costPerPPU).toFixed(2)}`}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="flow_name"
                  width={180}
                  tick={{ fontSize: 11, fill: '#334155' }}
                  tickFormatter={v => v.length > 26 ? v.slice(0, 26) + '…' : v}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip costPerPPU={costPerPPU} />} />
                <Bar dataKey="total_credits" radius={[0, 4, 4, 0]} maxBarSize={32}>
                  {chartFlows.map((_, i) => (
                    <Cell
                      key={i}
                      fill={`hsl(${10 + i * 8}, 80%, ${55 + i * 2}%)`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="card mb-8">
            <div className="px-6 pt-5 pb-3">
              <h2 className="section-title mb-0.5">Flow Cost Details</h2>
              <p className="caption">Detailed breakdown of cost per flow with use case summary</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-slate-100 bg-slate-50/70">
                    {['Flow Name', 'Use Case', 'Total Cost', 'Cost / Run', 'Runs', 'Runs/Wk', 'Runs/Mo', 'Avg Data/Run', 'PPU Credits'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flows.map((f, i) => (
                    <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900 max-w-[200px] truncate">{f.flow_name}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-[180px] truncate">{f.use_case}</td>
                      <td className="px-4 py-3 font-medium text-red-600">${(f.total_credits * costPerPPU).toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-700">${(f.avg_credits_per_run * costPerPPU).toFixed(4)}</td>
                      <td className="px-4 py-3 text-slate-700">{f.run_count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-700">{(f.run_count / weeks).toFixed(1)}</td>
                      <td className="px-4 py-3 text-slate-700">{(f.run_count / months).toFixed(1)}</td>
                      <td className="px-4 py-3 text-slate-700">{f.avg_data_per_run_mb.toFixed(2)} MB</td>
                      <td className="px-4 py-3 text-slate-700">{f.total_credits.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Data change insights */}
          <div>
            <h2 className="section-title mb-4">Data Change Insights</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="card p-5">
                {noDataFlows.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <p className="font-semibold text-slate-800">{noDataFlows.length} flow(s) without data transfer</p>
                    </div>
                    <ul className="space-y-2">
                      {noDataFlows.slice(0, 5).map((f, i) => (
                        <li key={i} className="text-sm text-slate-600">
                          <span className="font-medium text-slate-800">{f.flow_name}</span>
                          {' — '}{f.run_count} runs, ${(f.total_credits * costPerPPU).toFixed(2)} spent
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <p className="font-medium">All flows transferred data during their runs</p>
                  </div>
                )}
              </div>

              <div className="card p-5">
                {lowDataFlows.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <Info className="w-5 h-5 text-blue-500" />
                      <p className="font-semibold text-slate-800">{lowDataFlows.length} flow(s) with &lt;50% data change rate</p>
                    </div>
                    <ul className="space-y-2">
                      {lowDataFlows.slice(0, 5).map((f, i) => (
                        <li key={i} className="text-sm text-slate-600">
                          <span className="font-medium text-slate-800">{f.flow_name}</span>
                          {' — '}{f.data_change_rate.toFixed(1)}% of runs had changes
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <p className="font-medium">All flows have healthy data change rates</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

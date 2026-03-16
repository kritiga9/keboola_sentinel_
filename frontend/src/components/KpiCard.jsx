export default function KpiCard({ label, value, color = 'blue', sub }) {
  const colorMap = {
    blue:   'text-blue-600',
    green:  'text-green-600',
    red:    'text-red-600',
    purple: 'text-violet-600',
    amber:  'text-amber-600',
  }
  const textColor = colorMap[color] ?? colorMap.blue

  return (
    <div className="card p-5 flex flex-col gap-1 hover:shadow-md transition-shadow">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-2xl font-bold ${textColor} leading-none`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

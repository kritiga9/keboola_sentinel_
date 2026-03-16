export default function LoadingSpinner({ message = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
      <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
      <span className="text-sm">{message}</span>
    </div>
  )
}

export function InlineSpinner() {
  return (
    <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin inline-block" />
  )
}

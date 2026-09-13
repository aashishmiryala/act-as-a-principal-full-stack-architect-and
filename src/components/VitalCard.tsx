import type { Vital } from '../lib/data'
import { Sparkline } from './Sparkline'
import { iconMap, ArrowUp, ArrowDown, Minus } from './icons'

const statusStyles: Record<Vital['status'], { ring: string; text: string; dot: string; label: string }> = {
  normal: { ring: 'ring-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Normal' },
  watch: { ring: 'ring-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400', label: 'Watch' },
  critical: { ring: 'ring-rose-500/20', text: 'text-rose-400', dot: 'bg-rose-400', label: 'Critical' },
}

const sparkColor: Record<Vital['status'], string> = {
  normal: '#34d399',
  watch: '#fbbf24',
  critical: '#fb7185',
}

export function VitalCard({ vital, index }: { vital: Vital; index: number }) {
  const Icon = iconMap[vital.icon as keyof typeof iconMap]
  const s = statusStyles[vital.status]
  const TrendIcon = vital.trend === 'up' ? ArrowUp : vital.trend === 'down' ? ArrowDown : Minus

  return (
    <div
      className={`animate-floatUp rounded-2xl bg-slate-900/60 p-5 ring-1 backdrop-blur ${s.ring} border border-white/5 transition-all hover:-translate-y-0.5 hover:bg-slate-900/80`}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-xl bg-slate-800/80 ${s.text}`}>
            <Icon width={20} height={20} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">{vital.label}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white tabular-nums">{vital.value}</span>
              <span className="text-xs text-slate-500">{vital.unit}</span>
            </div>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full bg-slate-800/70 px-2 py-1 text-[10px] font-semibold ${s.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${vital.status === 'critical' ? 'animate-pulse' : ''}`} />
          {s.label}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <Sparkline data={vital.history} color={sparkColor[vital.status]} />
        <div className="flex flex-col items-end">
          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${s.text}`}>
            <TrendIcon width={13} height={13} />
            {vital.trend}
          </span>
          <span className="mt-1 text-[10px] text-slate-500">
            range {vital.min}–{vital.max}
          </span>
        </div>
      </div>
    </div>
  )
}

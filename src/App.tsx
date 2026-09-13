import { useEffect, useMemo, useState } from 'react'
import {
  alerts as seedAlerts,
  devices as seedDevices,
  patients,
  vitals as seedVitals,
  type Vital,
} from './lib/data'
import { VitalCard } from './components/VitalCard'
import { Waveform } from './components/Waveform'
import { Sparkline } from './components/Sparkline'
import {
  Activity,
  Battery,
  Bell,
  Cpu,
  Grid,
  Search,
  Settings,
  Shield,
  Signal,
  Sparkles,
  Users,
} from './components/icons'

const nav = [
  { id: 'overview', label: 'Overview', icon: Grid },
  { id: 'vitals', label: 'Live Vitals', icon: Activity },
  { id: 'devices', label: 'Devices', icon: Cpu },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
]

function useLiveVitals() {
  const [vitals, setVitals] = useState<Vital[]>(seedVitals)
  useEffect(() => {
    const t = setInterval(() => {
      setVitals((prev) =>
        prev.map((v) => {
          const delta = (Math.random() - 0.5) * (v.max - v.min) * 0.06
          let next = Math.round((v.value + delta) * 10) / 10
          const floor = v.min - (v.max - v.min) * 0.3
          const ceil = v.max + (v.max - v.min) * 0.5
          next = Math.max(floor, Math.min(ceil, next))
          const history = [...v.history.slice(1), next]
          const prevVal = v.history[v.history.length - 1]
          const trend = next > prevVal + 0.15 ? 'up' : next < prevVal - 0.15 ? 'down' : 'stable'
          let status: Vital['status'] = 'normal'
          if (next > v.max || next < v.min) status = next > v.max + (v.max - v.min) * 0.15 ? 'critical' : 'watch'
          return { ...v, value: next, history, trend, status }
        }),
      )
    }, 2000)
    return () => clearInterval(t)
  }, [])
  return vitals
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="text-sm text-slate-400">{subtitle}</p>
    </div>
  )
}

const severityStyles = {
  critical: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
} as const

const patientStatus = {
  urgent: 'text-rose-400 bg-rose-500/10',
  monitor: 'text-amber-400 bg-amber-500/10',
  stable: 'text-emerald-400 bg-emerald-500/10',
} as const

export default function App() {
  const [active, setActive] = useState('overview')
  const vitals = useLiveVitals()
  const hr = vitals.find((v) => v.id === 'hr')?.value ?? 78

  const aiScore = useMemo(() => {
    const critical = vitals.filter((v) => v.status === 'critical').length
    const watch = vitals.filter((v) => v.status === 'watch').length
    return Math.min(98, 40 + critical * 22 + watch * 11 + Math.round(Math.random() * 4))
  }, [vitals])

  const onlineDevices = seedDevices.filter((d) => d.online).length

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(60rem_40rem_at_80%_-10%,rgba(6,182,212,0.12),transparent),radial-gradient(50rem_30rem_at_-10%_10%,rgba(56,189,248,0.10),transparent)] text-slate-200">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-white/5 bg-slate-950/60 p-5 backdrop-blur lg:flex">
          <div className="flex items-center gap-3 px-1">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-slate-950 shadow-lg shadow-brand-500/30">
              <Shield width={22} height={22} />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-white">HealthGuard</p>
              <p className="text-[11px] text-brand-300">AIoT Platform</p>
            </div>
          </div>

          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {nav.map((item) => {
              const Icon = item.icon
              const isActive = active === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-brand-500/15 text-brand-200 ring-1 ring-brand-500/30'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <Icon width={18} height={18} />
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-white/5 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-brand-300">
              <Sparkles width={16} height={16} />
              <span className="text-xs font-semibold">Edge AI Online</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              Anomaly detector v12 running on-device with 8&nbsp;ms inference latency.
            </p>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          {/* Topbar */}
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="lg:hidden">
                  <Shield width={20} height={20} />
                </span>
                <h1 className="text-xl font-bold text-white sm:text-2xl">AIoT HealthGuard</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-pulseRing rounded-full bg-emerald-400" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  Live
                </span>
              </div>
              <p className="text-sm text-slate-400">
                Real-time patient monitoring &amp; predictive health intelligence
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="hidden items-center gap-2 rounded-xl border border-white/5 bg-slate-900/60 px-3 py-2 text-sm text-slate-400 md:flex">
                <Search width={16} height={16} />
                <input
                  className="w-40 bg-transparent text-slate-200 placeholder:text-slate-500 focus:outline-none"
                  placeholder="Search patients…"
                />
              </label>
              <button className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/5 bg-slate-900/60 text-slate-300 transition hover:text-white">
                <Bell width={18} height={18} />
                <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                  {seedAlerts.filter((a) => a.severity !== 'info').length}
                </span>
              </button>
              <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-slate-900/60 px-2 py-1.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-slate-950">
                  DR
                </div>
                <div className="hidden pr-1 sm:block">
                  <p className="text-xs font-semibold leading-tight text-white">Dr. Rao</p>
                  <p className="text-[10px] text-slate-400">Attending</p>
                </div>
              </div>
            </div>
          </header>

          {/* Stat row */}
          <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Monitored patients" value={String(patients.length)} sub="+2 today" icon={<Users width={18} height={18} />} tone="brand" />
            <StatCard label="Devices online" value={`${onlineDevices}/${seedDevices.length}`} sub="1 needs battery" icon={<Cpu width={18} height={18} />} tone="emerald" />
            <StatCard label="Active alerts" value={String(seedAlerts.length)} sub="1 critical" icon={<Bell width={18} height={18} />} tone="rose" />
            <StatCard label="AI risk index" value={`${aiScore}`} sub="composite score" icon={<Sparkles width={18} height={18} />} tone="amber" />
          </section>

          {/* Vitals */}
          <SectionHeading title="Live Vitals" subtitle="Streaming from connected wearables — updates every 2 seconds" />
          <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {vitals.map((v, i) => (
              <VitalCard key={v.id} vital={v} index={i} />
            ))}
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {/* Waveform + AI panel */}
            <section className="xl:col-span-2">
              <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">ECG Waveform</h3>
                    <p className="text-xs text-slate-400">Lead II · {Math.round(hr)} bpm</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-1 text-[11px] font-semibold text-brand-300">
                    <Activity width={13} height={13} /> Sinus rhythm
                  </span>
                </div>
                <div className="h-56 overflow-hidden rounded-xl bg-slate-950/70 ring-1 ring-white/5">
                  <Waveform bpm={Math.round(hr)} />
                </div>
              </div>

              {/* Devices */}
              <div className="mt-6 rounded-2xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur">
                <SectionHeading title="Connected Devices" subtitle="Edge-linked sensors & gateways" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {seedDevices.map((d) => (
                    <div key={d.id} className="rounded-xl border border-white/5 bg-slate-950/50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">{d.name}</p>
                          <p className="text-[11px] text-slate-400">{d.type}</p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            d.online ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-700/40 text-slate-400'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${d.online ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                          {d.online ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2">
                        <Meter icon={<Battery width={13} height={13} />} label="Battery" value={d.battery} />
                        <Meter icon={<Signal width={13} height={13} />} label="Signal" value={d.signal} />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
                        <span>fw {d.firmware}</span>
                        <span>sync {d.lastSync}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Right column: AI + alerts */}
            <section className="space-y-6">
              <div className="rounded-2xl border border-white/5 bg-gradient-to-b from-brand-500/10 to-slate-900/60 p-5 backdrop-blur">
                <div className="flex items-center gap-2 text-brand-300">
                  <Sparkles width={18} height={18} />
                  <h3 className="font-semibold text-white">AI Risk Assessment</h3>
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <RiskGauge score={aiScore} />
                  <div className="text-sm">
                    <p className="font-semibold text-white">
                      {aiScore >= 70 ? 'Elevated risk' : aiScore >= 45 ? 'Moderate risk' : 'Low risk'}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      Predictive model flags rising blood pressure &amp; temperature. Suggest clinician review.
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
                  {[
                    ['Cardiac stability', 76],
                    ['Respiratory index', 91],
                    ['Thermal trend', 58],
                  ].map(([label, val]) => (
                    <div key={label as string}>
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>{label}</span>
                        <span className="tabular-nums">{val}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                          style={{ width: `${val}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur">
                <SectionHeading title="Alerts" subtitle="Prioritized by severity" />
                <div className="space-y-3">
                  {seedAlerts.map((a) => (
                    <div key={a.id} className={`rounded-xl border p-3 ${severityStyles[a.severity]}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{a.title}</p>
                        <span className="text-[10px] opacity-70">{a.time}</span>
                      </div>
                      <p className="mt-1 text-xs opacity-80">{a.detail}</p>
                      <p className="mt-1 text-[10px] font-medium opacity-70">Patient: {a.patient}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Patients table */}
          <SectionHeading title="Patient Roster" subtitle="Sorted by AI-predicted risk" />
          <section className="mb-8 overflow-hidden rounded-2xl border border-white/5 bg-slate-900/60 backdrop-blur">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-medium">Patient</th>
                    <th className="px-5 py-3 font-medium">Room</th>
                    <th className="px-5 py-3 font-medium">HR</th>
                    <th className="px-5 py-3 font-medium">SpO₂</th>
                    <th className="px-5 py-3 font-medium">Risk</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...patients]
                    .sort((a, b) => b.risk - a.risk)
                    .map((p) => (
                      <tr key={p.id} className="border-b border-white/5 last:border-0 transition hover:bg-white/[0.03]">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-800 text-[11px] font-bold text-brand-300">
                              {p.name.split(' ').map((n) => n[0]).join('')}
                            </div>
                            <div>
                              <p className="font-medium text-white">{p.name}</p>
                              <p className="text-[11px] text-slate-500">{p.age} yrs</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-400">{p.room}</td>
                        <td className="px-5 py-3 tabular-nums text-slate-300">{p.hr}</td>
                        <td className="px-5 py-3 tabular-nums text-slate-300">{p.spo2}%</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className={`h-full rounded-full ${
                                  p.risk >= 70 ? 'bg-rose-500' : p.risk >= 45 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${p.risk}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums text-slate-400">{p.risk}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${patientStatus[p.status]}`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="pb-6 text-center text-[11px] text-slate-600">
            AIoT HealthGuard · demo dashboard with simulated telemetry · not for clinical use
          </footer>
        </main>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string
  value: string
  sub: string
  icon: React.ReactNode
  tone: 'brand' | 'emerald' | 'rose' | 'amber'
}) {
  const tones = {
    brand: 'from-brand-500/20 text-brand-300',
    emerald: 'from-emerald-500/20 text-emerald-300',
    rose: 'from-rose-500/20 text-rose-300',
    amber: 'from-amber-500/20 text-amber-300',
  }
  const spark = {
    brand: '#22d3ee',
    emerald: '#34d399',
    rose: '#fb7185',
    amber: '#fbbf24',
  }
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-slate-900/60 p-5 backdrop-blur">
      <div className={`absolute inset-0 bg-gradient-to-br ${tones[tone]} to-transparent opacity-40`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className={`grid h-9 w-9 place-items-center rounded-lg bg-slate-950/50 ${tones[tone].split(' ')[1]}`}>
            {icon}
          </span>
          <Sparkline
            data={Array.from({ length: 12 }, (_, i) => 40 + Math.sin(i / 1.5) * 10 + Math.random() * 8)}
            color={spark[tone]}
            width={70}
            height={28}
            fill={false}
          />
        </div>
        <p className="mt-3 text-2xl font-bold text-white tabular-nums">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="mt-0.5 text-[10px] text-slate-500">{sub}</p>
      </div>
    </div>
  )
}

function Meter({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  const color = value > 60 ? 'bg-emerald-500' : value > 30 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500">{icon}</span>
      <span className="w-12 text-[10px] text-slate-500">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right text-[10px] tabular-nums text-slate-400">{value}%</span>
    </div>
  )
}

function RiskGauge({ score }: { score: number }) {
  const r = 34
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 70 ? '#fb7185' : score >= 45 ? '#fbbf24' : '#34d399'
  return (
    <div className="relative grid h-24 w-24 place-items-center">
      <svg width={96} height={96} className="-rotate-90">
        <circle cx={48} cy={48} r={r} fill="none" stroke="#1e293b" strokeWidth={8} />
        <circle
          cx={48}
          cy={48}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-xl font-bold text-white tabular-nums">{score}</p>
        <p className="text-[9px] uppercase tracking-wide text-slate-500">index</p>
      </div>
    </div>
  )
}

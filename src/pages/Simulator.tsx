import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Cpu,
  Gauge,
  Pause,
  Play,
  Power,
  Radio,
  SlidersHorizontal,
  Terminal,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/Badge";
import { broker, Topics } from "@/lib/mqtt/broker";
import type { BrokerMessage } from "@/lib/mqtt/broker";
import { fleet } from "@/lib/iot/fleet";
import { SCENARIOS, type ScenarioKind } from "@/lib/iot/sensors";
import { repository } from "@/lib/db/repository";
import { useFleetStore } from "@/store/useFleetStore";
import { useTelemetry } from "@/hooks/useTelemetry";
import { cn, formatClock, formatNumber } from "@/lib/utils";

const TOPIC_FILTERS = [
  { label: "Everything", value: Topics.everything() },
  { label: "Telemetry", value: Topics.telemetryAll() },
  { label: "Status", value: Topics.statusAll() },
  { label: "Alerts", value: Topics.alertsAll() },
];

interface LogEntry {
  id: number;
  topic: string;
  ts: number;
  payload: unknown;
}

export default function Simulator() {
  useTelemetry();
  const devices = repository.listDevices();
  const running = useFleetStore((s) => s.running);
  const timeScale = useFleetStore((s) => s.timeScale);
  const brokerStats = useFleetStore((s) => s.brokerStats);
  const toggleRunning = useFleetStore((s) => s.toggleRunning);
  const setTimeScale = useFleetStore((s) => s.setTimeScale);
  const injectScenario = useFleetStore((s) => s.injectScenario);
  const setDeviceOnline = useFleetStore((s) => s.setDeviceOnline);

  const [filter, setFilter] = useState(Topics.telemetryAll());
  const [paused, setPaused] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const counter = useRef(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    setLog([]);
    const unsub = broker.subscribe(filter, (msg: BrokerMessage) => {
      if (pausedRef.current) return;
      setLog((prev) => {
        const entry: LogEntry = {
          id: counter.current++,
          topic: msg.topic,
          ts: msg.ts,
          payload: msg.payload,
        };
        const next = [entry, ...prev];
        return next.slice(0, 40);
      });
    });
    return unsub;
  }, [filter]);

  const online = devices.filter((d) => d.status === "online").length;

  const scenarioCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of devices) {
      const s = fleet.scenarioOf(d.id) ?? "healthy";
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, brokerStats.publishedMessages]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="IoT Simulator & Broker Inspector"
        description="Drive the ESP32 fleet emulator and watch the live MQTT message bus."
        icon={<SlidersHorizontal className="h-6 w-6" />}
        actions={
          <button className={cn("btn", running ? "btn-ghost" : "btn-primary")} onClick={toggleRunning}>
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Pause fleet" : "Resume fleet"}
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Broker throughput"
          value={`${formatNumber(brokerStats.throughputMsgSec)}/s`}
          icon={<Radio className="h-4 w-4" />}
          hint={`${brokerStats.transport} transport`}
          accent="emerald"
        />
        <StatCard
          label="Messages published"
          value={formatNumber(brokerStats.publishedMessages)}
          icon={<Activity className="h-4 w-4" />}
          hint={`${formatNumber(brokerStats.deliveredMessages)} delivered`}
          accent="brand"
        />
        <StatCard
          label="Subscriptions"
          value={brokerStats.activeSubscriptions}
          icon={<Gauge className="h-4 w-4" />}
          hint="Active topic filters"
          accent="violet"
        />
        <StatCard
          label="Nodes online"
          value={`${online}/${devices.length}`}
          icon={<Cpu className="h-4 w-4" />}
          hint={`${timeScale}× simulation speed`}
          accent={online === devices.length ? "emerald" : "amber"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        {/* Controls */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Simulation controls"
            subtitle="Clock speed and scenario mix"
            icon={<Zap className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />}
          />
          <div className="space-y-4 px-4 pb-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs text-ink-300">
                <span>Simulation speed</span>
                <span className="font-semibold tabular-nums text-brand-300">{timeScale}×</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={timeScale}
                onChange={(e) => setTimeScale(Number(e.target.value))}
                className="w-full accent-brand-400"
              />
              <div className="mt-1 flex justify-between text-[10px] text-ink-600">
                <span>1× realtime</span>
                <span>20× fast-forward</span>
              </div>
            </div>

            <div className="border-t border-white/5 pt-3">
              <div className="mb-2 text-xs font-medium text-ink-300">Active scenario mix</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(scenarioCounts).map(([kind, count]) => (
                  <span
                    key={kind}
                    className={cn(
                      "chip",
                      kind === "healthy"
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                        : "border-amber-400/30 bg-amber-400/10 text-amber-200",
                    )}
                  >
                    {SCENARIOS.find((s) => s.kind === kind)?.label ?? kind}: {count}
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-white/5 pt-3">
              <div className="mb-2 text-xs font-medium text-ink-300">Bulk scenario</div>
              <div className="flex flex-wrap gap-1.5">
                {SCENARIOS.filter((s) => s.kind !== "fall").map((s) => (
                  <button
                    key={s.kind}
                    onClick={() => applyRandom(s.kind, injectScenario)}
                    className="chip cursor-pointer border-white/10 bg-white/5 text-ink-300 hover:bg-white/10"
                    title={`Apply "${s.label}" to a random online device`}
                  >
                    + {s.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink-500">
                Applies to a random online device. Use the table below for precise targeting.
              </p>
            </div>
          </div>
        </Card>

        {/* Live broker feed */}
        <Card className="xl:col-span-3">
          <CardHeader
            title="Live MQTT message bus"
            subtitle={filter}
            icon={<Terminal className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />}
            action={
              <div className="flex items-center gap-2">
                <select
                  className="input h-8 w-auto py-1 text-xs"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {TOPIC_FILTERS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setPaused((p) => !p)}
                  className="btn-ghost h-8 !px-2.5 text-xs"
                >
                  {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  {paused ? "Resume" : "Pause"}
                </button>
              </div>
            }
          />
          <div className="max-h-[420px] overflow-y-auto px-3 pb-3 font-mono text-[11px]">
            {log.length === 0 ? (
              <div className="py-10 text-center text-ink-500">Waiting for messages…</div>
            ) : (
              <div className="space-y-1">
                {log.map((e) => (
                  <div
                    key={e.id}
                    className="animate-fade-in rounded-lg border border-white/5 bg-ink-950/60 px-2.5 py-1.5"
                  >
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-emerald-400">{formatClock(e.ts)}</span>
                      <span className="truncate text-brand-300">{e.topic}</span>
                    </div>
                    <div className="mt-0.5 truncate text-ink-400">{summarise(e.payload)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Per-device control table */}
      <Card>
        <CardHeader
          title="Per-device control"
          subtitle="Target individual ESP32 nodes"
          icon={<Cpu className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />}
        />
        <div className="overflow-x-auto px-2 pb-3">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-[11px] uppercase tracking-wide text-ink-500">
                <th className="px-3 py-2 font-medium">Device</th>
                <th className="px-3 py-2 font-medium">Patient</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Scenario</th>
                <th className="px-3 py-2 font-medium">Power</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => {
                const patient = repository.getPatient(d.patientId);
                const scenario = fleet.scenarioOf(d.id) ?? "healthy";
                return (
                  <tr key={d.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-3 py-2 font-mono text-xs text-ink-300">{d.id}</td>
                    <td className="px-3 py-2 text-ink-100">{patient?.fullName}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="input h-8 w-auto py-1 text-xs"
                        value={scenario}
                        onChange={(e) => injectScenario(d.id, e.target.value as ScenarioKind)}
                      >
                        {SCENARIOS.map((s) => (
                          <option key={s.kind} value={s.kind}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setDeviceOnline(d.id, d.status === "offline")}
                        className={cn(
                          "btn h-7 border text-xs",
                          d.status === "offline"
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                            : "border-white/10 bg-white/5 text-ink-300 hover:bg-white/10",
                        )}
                      >
                        <Power className="h-3 w-3" />
                        {d.status === "offline" ? "On" : "Off"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function applyRandom(kind: ScenarioKind, inject: (id: string, k: ScenarioKind) => void) {
  const online = repository.listDevices().filter((d) => d.status !== "offline");
  if (!online.length) return;
  const target = online[Math.floor(Math.random() * online.length)];
  inject(target.id, kind);
}

function summarise(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    if (p.metrics && typeof p.metrics === "object") {
      const m = p.metrics as Record<string, number>;
      return `HR ${m.heartRate?.toFixed?.(0)} · SpO₂ ${m.spo2?.toFixed?.(0)} · T ${m.temperature?.toFixed?.(1)} · RR ${m.respiration?.toFixed?.(0)} · BP ${m.systolic?.toFixed?.(0)}/${m.diastolic?.toFixed?.(0)} · mot ${m.motion?.toFixed?.(2)}`;
    }
    if (p.title) return `${p.severity ?? ""} · ${p.title}`;
    if (p.status) return `status=${p.status} · batt ${p.battery}% · rssi ${p.rssi}dBm`;
  }
  return JSON.stringify(payload).slice(0, 120);
}

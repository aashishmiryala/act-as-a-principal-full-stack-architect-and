import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  BatteryCharging,
  Cpu,
  Gauge,
  MapPin,
  Power,
  Radio,
  Wifi,
  Zap,
} from "lucide-react";
import type { VitalMetric } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { Avatar } from "@/components/ui/Avatar";
import { VitalChart } from "@/components/charts/VitalChart";
import { AlertRow } from "@/components/widgets/AlertRow";
import { useTelemetry } from "@/hooks/useTelemetry";
import { repository } from "@/lib/db/repository";
import { telemetryHub } from "@/lib/telemetryHub";
import { useFleetStore } from "@/store/useFleetStore";
import { useAlertStore } from "@/store/useAlertStore";
import { useAuthStore } from "@/store/useAuthStore";
import { fleet } from "@/lib/iot/fleet";
import { SCENARIOS } from "@/lib/iot/sensors";
import { METRIC_LABELS, METRIC_UNITS, CLINICAL_RULES } from "@/lib/ml/clinical";
import { ageFromDob, cn, formatClock, formatUptime } from "@/lib/utils";

const CHART_METRICS: VitalMetric[] = [
  "heartRate",
  "spo2",
  "temperature",
  "respiration",
  "systolic",
  "diastolic",
];

export default function DeviceDetail() {
  useTelemetry();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const device = repository.getDevice(id);
  const patient = device ? repository.getPatient(device.patientId) : undefined;
  const injectScenario = useFleetStore((s) => s.injectScenario);
  const setDeviceOnline = useFleetStore((s) => s.setDeviceOnline);
  const acknowledge = useAlertStore((s) => s.acknowledge);
  const alerts = useAlertStore((s) => s.alerts);
  const user = useAuthStore((s) => s.user);
  const [selectedMetric, setSelectedMetric] = useState<VitalMetric>("heartRate");

  const currentScenario = fleet.scenarioOf(id) ?? "healthy";

  const deviceAlerts = useMemo(
    () => alerts.filter((a) => a.deviceId === id).slice(0, 8),
    [alerts, id],
  );

  if (!device || !patient) {
    return (
      <div className="card grid place-items-center py-20 text-center">
        <p className="text-sm text-ink-300">Device not found.</p>
        <button className="btn-ghost mt-4" onClick={() => navigate("/devices")}>
          <ArrowLeft className="h-4 w-4" /> Back to fleet
        </button>
      </div>
    );
  }

  const snapshot = telemetryHub.getSnapshot(id);
  const frame = snapshot?.frame ?? telemetryHub.getLatest(id);
  const scores = snapshot?.scores ?? [];
  const anomalySet = new Set(snapshot?.anomalyMetrics ?? []);

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-200"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <PageHeader
        title={patient.fullName}
        description={`${ageFromDob(patient.dateOfBirth)}y · ${patient.sex} · ${patient.condition} · MRN ${patient.mrn}`}
        icon={<Avatar name={patient.fullName} color={anomalySet.size ? "#fb7185" : "#22d3ee"} size={44} />}
        actions={<StatusBadge status={device.status} />}
      />

      {/* Top row: identity + risk + device meta */}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="p-4 lg:col-span-1">
          <div className="flex items-center gap-4">
            <ScoreRing value={snapshot?.compositeScore ?? 0} size={84} strokeWidth={8} label="risk" />
            <div>
              <div className="text-xs uppercase tracking-wide text-ink-400">Composite risk</div>
              <div className="mt-1 text-sm text-ink-200">
                {anomalySet.size === 0 ? (
                  <span className="text-emerald-400">Stable</span>
                ) : (
                  <span className="text-rose-300">{anomalySet.size} metric(s) anomalous</span>
                )}
              </div>
              <div className="mt-1 text-[11px] text-ink-500">Ensemble · updated {frame ? formatClock(frame.ts) : "—"}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 lg:col-span-3">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Meta icon={<Cpu className="h-4 w-4" />} label="Device" value={device.id} sub={device.hardware} />
            <Meta icon={<Radio className="h-4 w-4" />} label="Firmware" value={device.firmware} sub={`${device.sampleRateHz} Hz`} />
            <Meta
              icon={<BatteryCharging className="h-4 w-4" />}
              label="Battery"
              value={`${device.batteryPct.toFixed(0)}%`}
              sub={`${formatUptime(device.uptimeSec)} uptime`}
              tone={device.batteryPct < 15 ? "amber" : undefined}
            />
            <Meta icon={<Wifi className="h-4 w-4" />} label="Signal" value={`${device.rssi} dBm`} sub={device.ipAddress} />
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-white/5 pt-3 text-xs text-ink-400">
            <MapPin className="h-3.5 w-3.5 text-brand-300" />
            {device.location.label}
          </div>
        </Card>
      </div>

      {/* Scenario injector */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/20">
              <Zap className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div className="text-sm font-semibold text-ink-50">Scenario injection</div>
              <div className="text-xs text-ink-400">
                Drive the ESP32 emulator to validate the detection pipeline live.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.kind}
                onClick={() => injectScenario(id, s.kind)}
                title={s.description}
                className={cn(
                  "chip cursor-pointer transition-colors",
                  currentScenario === s.kind
                    ? "border-violet-400/40 bg-violet-400/15 text-violet-100"
                    : "border-white/10 bg-white/5 text-ink-300 hover:bg-white/10",
                )}
              >
                {s.label}
              </button>
            ))}
            <button
              onClick={() => setDeviceOnline(id, device.status === "offline")}
              className={cn(
                "btn h-8 border text-xs",
                device.status === "offline"
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                  : "border-white/10 bg-white/5 text-ink-300 hover:bg-white/10",
              )}
            >
              <Power className="h-3.5 w-3.5" />
              {device.status === "offline" ? "Bring online" : "Take offline"}
            </button>
          </div>
        </div>
      </Card>

      {/* Live vitals numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {CHART_METRICS.map((m) => {
          const val = frame?.metrics[m];
          const rule = CLINICAL_RULES[m];
          const inRange = val !== undefined && val >= rule.normal[0] && val <= rule.normal[1];
          const anomaly = anomalySet.has(m);
          const decimals = m === "temperature" ? 1 : m === "systolic" || m === "diastolic" ? 0 : 1;
          return (
            <button
              key={m}
              onClick={() => setSelectedMetric(m)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all",
                selectedMetric === m
                  ? "border-brand-400/40 bg-brand-500/10 ring-1 ring-brand-400/20"
                  : anomaly
                    ? "border-rose-500/30 bg-rose-500/[0.06]"
                    : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wide text-ink-400">
                  {METRIC_LABELS[m]}
                </span>
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    anomaly ? "bg-rose-400 animate-pulse" : inRange ? "bg-emerald-400" : "bg-amber-400",
                  )}
                />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={cn("text-xl font-bold tabular-nums", anomaly ? "text-rose-200" : "text-ink-50")}>
                  {val !== undefined ? val.toFixed(decimals) : "—"}
                </span>
                <span className="text-[10px] text-ink-500">{METRIC_UNITS[m]}</span>
              </div>
              <div className="mt-0.5 text-[10px] text-ink-500">
                normal {rule.normal[0]}–{rule.normal[1]}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected metric chart + anomaly scores */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={`${METRIC_LABELS[selectedMetric]} trend`}
            subtitle="Green band = personalised normal range · live 3-minute window"
            icon={<Activity className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />}
          />
          <div className="px-2 pb-4">
            <VitalChart data={telemetryHub.getSeries(id, selectedMetric)} metric={selectedMetric} height={280} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="ML anomaly scores"
            subtitle="Per-metric ensemble output (0–100%)"
            icon={<Gauge className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />}
          />
          <div className="space-y-2.5 px-4 pb-4">
            {scores.length === 0 && <p className="py-6 text-center text-xs text-ink-500">Warming up…</p>}
            {scores.map((s) => (
              <div key={s.metric}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-ink-300">{METRIC_LABELS[s.metric]}</span>
                  <span className={cn("font-semibold tabular-nums", s.isAnomaly ? "text-rose-300" : "text-ink-400")}>
                    {Math.round(s.score * 100)}% · z={s.zScore}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      s.score >= 0.66 ? "bg-rose-400" : s.score >= 0.4 ? "bg-amber-400" : "bg-emerald-400",
                    )}
                    style={{ width: `${Math.max(2, s.score * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Device alerts */}
      <Card>
        <CardHeader
          title="Alert history"
          subtitle={`${deviceAlerts.length} recent alerts for this device`}
          icon={<Radio className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />}
        />
        <div className="space-y-2 px-3 pb-4">
          {deviceAlerts.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">No alerts for this device yet.</p>
          ) : (
            deviceAlerts.map((a) => (
              <AlertRow
                key={a.id}
                alert={a}
                onAck={(alertId) => acknowledge(alertId, user?.fullName ?? "you")}
              />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function Meta({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "amber";
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-400">
        <span className="text-ink-500">{icon}</span>
        {label}
      </div>
      <div className={cn("mt-1 truncate text-sm font-semibold", tone === "amber" ? "text-amber-300" : "text-ink-50")}>
        {value}
      </div>
      {sub && <div className="truncate text-[11px] text-ink-500">{sub}</div>}
    </div>
  );
}

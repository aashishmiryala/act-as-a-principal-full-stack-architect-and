import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Cpu,
  Gauge,
  HeartPulse,
  Radio,
  ShieldAlert,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { DeviceCard } from "@/components/widgets/DeviceCard";
import { AlertRow } from "@/components/widgets/AlertRow";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { Avatar } from "@/components/ui/Avatar";
import { Sparkline } from "@/components/ui/Sparkline";
import { useTelemetry } from "@/hooks/useTelemetry";
import { telemetryHub } from "@/lib/telemetryHub";
import { repository } from "@/lib/db/repository";
import { useAlertStore } from "@/store/useAlertStore";
import { useFleetStore } from "@/store/useFleetStore";
import { useAuthStore } from "@/store/useAuthStore";
import { formatNumber } from "@/lib/utils";

export default function Dashboard() {
  useTelemetry();
  const navigate = useNavigate();
  const devices = repository.listDevices();
  const alerts = useAlertStore((s) => s.alerts);
  const acknowledge = useAlertStore((s) => s.acknowledge);
  const brokerStats = useFleetStore((s) => s.brokerStats);
  const user = useAuthStore((s) => s.user);

  const online = devices.filter((d) => d.status === "online").length;
  const fleetRisk = telemetryHub.fleetRiskScore();
  const unack = alerts.filter((a) => !a.acknowledged);
  const critical = unack.filter((a) => a.severity === "critical").length;

  const ranked = useMemo(() => {
    return devices
      .map((d) => ({
        device: d,
        patient: repository.getPatient(d.patientId)!,
        snapshot: telemetryHub.getSnapshot(d.id),
      }))
      .sort((a, b) => (b.snapshot?.compositeScore ?? 0) - (a.snapshot?.compositeScore ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, telemetryHub.getVersion()]);

  const watchlist = ranked.slice(0, 5);
  const topCards = ranked.slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good to see you, ${user?.fullName?.split(" ")[0] ?? "there"}`}
        description="Live overview of the monitored fleet, patient risk and system health."
        icon={<Activity className="h-6 w-6" />}
        actions={
          <button className="btn-primary" onClick={() => navigate("/assistant")}>
            <BrainCircuit className="h-4 w-4" />
            Ask the assistant
          </button>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Devices online"
          value={`${online}/${devices.length}`}
          icon={<Cpu className="h-4 w-4" />}
          hint="ESP32 nodes streaming telemetry"
          accent="emerald"
        />
        <StatCard
          label="Patients monitored"
          value={devices.length}
          icon={<Users className="h-4 w-4" />}
          hint="Across all wards"
          accent="brand"
        />
        <StatCard
          label="Active alerts"
          value={unack.length}
          icon={<ShieldAlert className="h-4 w-4" />}
          hint={`${critical} high · ${unack.length - critical} moderate`}
          accent={critical > 0 ? "rose" : "amber"}
        />
        <StatCard
          label="Ingest throughput"
          value={`${formatNumber(brokerStats.throughputMsgSec)}/s`}
          icon={<Radio className="h-4 w-4" />}
          hint={`${formatNumber(telemetryHub.totalFrames)} frames processed`}
          accent="violet"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Watchlist */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Patient risk watchlist"
            subtitle="Ranked by live ML composite anomaly score"
            icon={<Gauge className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />}
            action={
              <button
                onClick={() => navigate("/devices")}
                className="btn-ghost h-8 text-xs"
              >
                View fleet <ArrowRight className="h-3.5 w-3.5" />
              </button>
            }
          />
          <div className="space-y-1 px-3 pb-3">
            {watchlist.map(({ device, patient, snapshot }) => {
              const frame = snapshot?.frame ?? telemetryHub.getLatest(device.id);
              const hr = telemetryHub.getSeries(device.id, "heartRate");
              return (
                <button
                  key={device.id}
                  onClick={() => navigate(`/devices/${device.id}`)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <Avatar
                    name={patient.fullName}
                    color={(snapshot?.anomalyMetrics.length ?? 0) > 0 ? "#fb7185" : "#22d3ee"}
                    size={38}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink-50">
                        {patient.fullName}
                      </span>
                      <span className="text-[11px] text-ink-500">{patient.ward}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-ink-400">
                      <span className="flex items-center gap-1">
                        <HeartPulse className="h-3 w-3 text-rose-400" />
                        {frame?.metrics.heartRate?.toFixed(0) ?? "—"} bpm
                      </span>
                      <span>{frame?.metrics.spo2?.toFixed(0) ?? "—"}% SpO₂</span>
                      <span>{frame?.metrics.temperature?.toFixed(1) ?? "—"}°C</span>
                    </div>
                  </div>
                  <Sparkline
                    data={hr}
                    color={(snapshot?.anomalyMetrics.length ?? 0) > 0 ? "#fb7185" : "#22d3ee"}
                    width={80}
                    height={28}
                  />
                  <ScoreRing value={snapshot?.compositeScore ?? 0} size={44} strokeWidth={4} />
                </button>
              );
            })}
          </div>
        </Card>

        {/* Recent alerts */}
        <Card>
          <CardHeader
            title="Recent alerts"
            subtitle={`${unack.length} awaiting acknowledgement`}
            icon={<ShieldAlert className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />}
            action={
              <button onClick={() => navigate("/alerts")} className="btn-ghost h-8 text-xs">
                All
              </button>
            }
          />
          <div className="max-h-[420px] space-y-2 overflow-y-auto px-3 pb-3">
            {alerts.slice(0, 6).map((a) => (
              <AlertRow
                key={a.id}
                alert={a}
                patient={repository.getPatient(a.patientId)}
                onAck={(id) => acknowledge(id, user?.fullName ?? "you")}
                compact
              />
            ))}
            {alerts.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-400">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <p className="text-sm text-ink-300">All clear — no alerts yet.</p>
                <p className="text-xs text-ink-500">
                  Inject a scenario in the IoT Simulator to see detection live.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Fleet grid */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-100">Live device fleet</h2>
          <span className="text-xs text-ink-500">
            Fleet risk index{" "}
            <span className="font-semibold text-ink-200">{Math.round(fleetRisk * 100)}%</span>
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topCards.map(({ device, patient }) => (
            <DeviceCard key={device.id} device={device} patient={patient} />
          ))}
        </div>
      </div>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { BatteryLow, ChevronRight, Cpu, HeartPulse, Wifi } from "lucide-react";
import type { Device, Patient } from "@/types";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { Avatar } from "@/components/ui/Avatar";
import { Sparkline } from "@/components/ui/Sparkline";
import { telemetryHub } from "@/lib/telemetryHub";
import { ageFromDob, cn, formatRelativeTime } from "@/lib/utils";
import { METRIC_LABELS } from "@/lib/ml/clinical";

interface DeviceCardProps {
  device: Device;
  patient: Patient;
}

export function DeviceCard({ device, patient }: DeviceCardProps) {
  const navigate = useNavigate();
  const snapshot = telemetryHub.getSnapshot(device.id);
  const frame = snapshot?.frame ?? telemetryHub.getLatest(device.id);
  const composite = snapshot?.compositeScore ?? 0;
  const anomalies = snapshot?.anomalyMetrics ?? [];
  const hrSeries = telemetryHub.getSeries(device.id, "heartRate");

  return (
    <Card
      hover
      className={cn(
        "group cursor-pointer overflow-hidden",
        anomalies.length > 0 && "ring-1 ring-rose-500/30",
      )}
      onClick={() => navigate(`/devices/${device.id}`)}
    >
      <div className="flex items-start gap-3 p-4">
        <Avatar name={patient.fullName} color={anomalies.length ? "#fb7185" : "#22d3ee"} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-ink-50">{patient.fullName}</h3>
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-500 transition-transform group-hover:translate-x-0.5" />
          </div>
          <p className="truncate text-xs text-ink-400">
            {ageFromDob(patient.dateOfBirth)}y · {patient.sex} · {patient.condition}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <StatusBadge status={device.status} />
            <span className="text-[10px] text-ink-500">{patient.ward}</span>
          </div>
        </div>
        <ScoreRing value={composite} size={52} strokeWidth={5} label="risk" />
      </div>

      <div className="flex items-center justify-between border-t border-white/5 px-4 py-2.5">
        <div className="flex items-center gap-3 text-[11px] text-ink-400">
          <span className="flex items-center gap-1">
            <HeartPulse className="h-3.5 w-3.5 text-rose-400" />
            <span className="font-semibold tabular-nums text-ink-200">
              {frame?.metrics.heartRate?.toFixed(0) ?? "—"}
            </span>
            bpm
          </span>
          <span className="flex items-center gap-1">
            <span className="font-semibold tabular-nums text-ink-200">
              {frame?.metrics.spo2?.toFixed(0) ?? "—"}
            </span>
            % SpO₂
          </span>
        </div>
        <Sparkline data={hrSeries} color={anomalies.length ? "#fb7185" : "#22d3ee"} width={64} height={22} />
      </div>

      <div className="flex items-center justify-between border-t border-white/5 px-4 py-2 text-[10px] text-ink-500">
        <span className="flex items-center gap-1">
          <Cpu className="h-3 w-3" /> {device.id}
        </span>
        <div className="flex items-center gap-2.5">
          <span className={cn("flex items-center gap-1", device.batteryPct < 15 && "text-amber-400")}>
            {device.batteryPct < 15 ? <BatteryLow className="h-3 w-3" /> : null}
            {device.batteryPct.toFixed(0)}%
          </span>
          <span className="flex items-center gap-1">
            <Wifi className="h-3 w-3" /> {device.rssi}dBm
          </span>
          <span>{frame ? formatRelativeTime(frame.ts) : "—"}</span>
        </div>
      </div>

      {anomalies.length > 0 && (
        <div className="border-t border-rose-500/20 bg-rose-500/10 px-4 py-1.5 text-[10px] font-medium text-rose-200">
          Anomaly: {anomalies.map((m) => METRIC_LABELS[m]).join(", ")}
        </div>
      )}
    </Card>
  );
}

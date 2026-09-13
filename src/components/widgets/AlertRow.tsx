import { Check, ChevronRight, Stethoscope } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Alert, Patient } from "@/types";
import { SeverityBadge } from "@/components/ui/Badge";
import { cn, formatRelativeTime } from "@/lib/utils";
import { METRIC_LABELS } from "@/lib/ml/clinical";

interface AlertRowProps {
  alert: Alert;
  patient?: Patient;
  onAck?: (id: string) => void;
  compact?: boolean;
}

export function AlertRow({ alert, patient, onAck, compact }: AlertRowProps) {
  const navigate = useNavigate();
  const metricLabel = alert.metric === "composite" ? "Composite" : METRIC_LABELS[alert.metric];

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 rounded-xl border p-3 transition-colors",
        alert.acknowledged
          ? "border-white/5 bg-white/[0.02] opacity-70"
          : alert.severity === "critical"
            ? "border-rose-500/30 bg-rose-500/[0.06]"
            : alert.severity === "warning"
              ? "border-amber-500/25 bg-amber-500/[0.05]"
              : "border-white/5 bg-white/[0.02]",
      )}
    >
      <div
        className={cn(
          "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
          alert.severity === "critical"
            ? "bg-rose-500/15 text-rose-300"
            : alert.severity === "warning"
              ? "bg-amber-500/15 text-amber-300"
              : "bg-sky-500/15 text-sky-300",
        )}
      >
        <Stethoscope className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink-50">{alert.title}</span>
          <SeverityBadge severity={alert.severity} />
          <span className="chip border-white/10 bg-white/5 text-ink-300">{metricLabel}</span>
        </div>
        {!compact && <p className="mt-1 text-xs text-ink-400">{alert.description}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500">
          {patient && (
            <button
              onClick={() => navigate(`/devices/${alert.deviceId}`)}
              className="flex items-center gap-1 font-medium text-ink-300 hover:text-brand-300"
            >
              {patient.fullName}
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
          <span>{alert.deviceId}</span>
          <span className="capitalize">detector: {alert.detector}</span>
          <span>{formatRelativeTime(alert.ts)}</span>
          {alert.acknowledged && alert.acknowledgedBy && (
            <span className="text-emerald-400">✓ acked by {alert.acknowledgedBy}</span>
          )}
        </div>
        {!compact && !alert.acknowledged && (
          <div className="mt-2 rounded-lg border border-white/5 bg-ink-950/50 px-3 py-2 text-[11px] text-ink-300">
            <span className="font-semibold text-brand-300">Recommended: </span>
            {alert.recommendation}
          </div>
        )}
      </div>

      {onAck && !alert.acknowledged && (
        <button
          onClick={() => onAck(alert.id)}
          className="btn-ghost h-8 shrink-0 !px-2.5 text-xs"
          title="Acknowledge"
        >
          <Check className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Ack</span>
        </button>
      )}
    </div>
  );
}

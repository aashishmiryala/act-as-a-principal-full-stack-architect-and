import type { VitalMetric } from "@/types";
import { CLINICAL_RULES, METRIC_LABELS, METRIC_UNITS } from "@/lib/ml/clinical";
import { Sparkline } from "@/components/ui/Sparkline";
import { telemetryHub } from "@/lib/telemetryHub";
import { cn } from "@/lib/utils";

const COLORS: Record<VitalMetric, string> = {
  heartRate: "#fb7185",
  spo2: "#38bdf8",
  temperature: "#fbbf24",
  respiration: "#34d399",
  systolic: "#a78bfa",
  diastolic: "#c084fc",
  motion: "#22d3ee",
};

interface VitalTileProps {
  deviceId: string;
  metric: VitalMetric;
  value: number | undefined;
  isAnomaly?: boolean;
  compact?: boolean;
}

export function VitalTile({ deviceId, metric, value, isAnomaly, compact }: VitalTileProps) {
  const rule = CLINICAL_RULES[metric];
  const series = telemetryHub.getSeries(deviceId, metric);
  const decimals = metric === "temperature" || metric === "motion" ? 2 : metric === "systolic" || metric === "diastolic" ? 0 : 1;
  const inRange = value !== undefined && value >= rule.normal[0] && value <= rule.normal[1];

  return (
    <div
      className={cn(
        "rounded-xl border bg-white/[0.02] p-3 transition-colors",
        isAnomaly ? "border-rose-500/40 bg-rose-500/[0.06]" : "border-white/5",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
          {METRIC_LABELS[metric]}
        </span>
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            isAnomaly ? "bg-rose-400 animate-pulse" : inRange ? "bg-emerald-400" : "bg-amber-400",
          )}
        />
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              "font-bold tabular-nums",
              compact ? "text-lg" : "text-2xl",
              isAnomaly ? "text-rose-200" : "text-ink-50",
            )}
          >
            {value !== undefined ? value.toFixed(decimals) : "—"}
          </span>
          <span className="text-[11px] text-ink-500">{METRIC_UNITS[metric]}</span>
        </div>
        <Sparkline
          data={series}
          color={isAnomaly ? "#fb7185" : COLORS[metric]}
          width={compact ? 56 : 76}
          height={compact ? 22 : 30}
        />
      </div>
    </div>
  );
}

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricPoint, VitalMetric } from "@/types";
import { CLINICAL_RULES, METRIC_LABELS, METRIC_UNITS } from "@/lib/ml/clinical";
import { formatClock } from "@/lib/utils";

interface VitalChartProps {
  data: MetricPoint[];
  metric: VitalMetric;
  color?: string;
  height?: number;
  showBand?: boolean;
  showAxis?: boolean;
}

const DEFAULT_COLORS: Partial<Record<VitalMetric, string>> = {
  heartRate: "#fb7185",
  spo2: "#38bdf8",
  temperature: "#fbbf24",
  respiration: "#34d399",
  systolic: "#a78bfa",
  diastolic: "#c084fc",
  motion: "#22d3ee",
};

export function VitalChart({
  data,
  metric,
  color,
  height = 200,
  showBand = true,
  showAxis = true,
}: VitalChartProps) {
  const stroke = color ?? DEFAULT_COLORS[metric] ?? "#22d3ee";
  const rule = CLINICAL_RULES[metric];
  const gradientId = `grad_${metric}`;

  const { chartData, domain } = useMemo(() => {
    const cd = data.map((d) => ({ ts: d.ts, value: d.value }));
    const values = data.map((d) => d.value);
    const lo = Math.min(...values, rule.normal[0]);
    const hi = Math.max(...values, rule.normal[1]);
    const pad = (hi - lo) * 0.15 || 1;
    return {
      chartData: cd,
      domain: [Math.floor(lo - pad), Math.ceil(hi + pad)] as [number, number],
    };
  }, [data, rule.normal]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: showAxis ? -12 : 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        {showBand && (
          <ReferenceArea
            y1={rule.normal[0]}
            y2={rule.normal[1]}
            fill="#34d399"
            fillOpacity={0.06}
            stroke="#34d399"
            strokeOpacity={0.15}
            strokeDasharray="4 4"
          />
        )}
        <XAxis
          dataKey="ts"
          hide={!showAxis}
          tickFormatter={(ts) => formatClock(ts).slice(0, 5)}
          tick={{ fill: "#6a86b2", fontSize: 10 }}
          axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          domain={domain}
          hide={!showAxis}
          tick={{ fill: "#6a86b2", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip
          contentStyle={{
            background: "rgba(11,18,32,0.95)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            fontSize: 12,
            color: "#e6ecf4",
          }}
          labelFormatter={(ts) => formatClock(Number(ts))}
          formatter={(value: number) => [
            `${value.toFixed(metric === "temperature" || metric === "motion" ? 2 : 1)} ${METRIC_UNITS[metric]}`,
            METRIC_LABELS[metric],
          ]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={stroke}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

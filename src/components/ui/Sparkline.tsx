import { useMemo } from "react";
import type { MetricPoint } from "@/types";

interface SparklineProps {
  data: MetricPoint[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  strokeWidth?: number;
  min?: number;
  max?: number;
  className?: string;
}

/** Lightweight inline-SVG sparkline — no chart library needed for tiny trends. */
export function Sparkline({
  data,
  width = 120,
  height = 36,
  color = "#22d3ee",
  fill = true,
  strokeWidth = 1.75,
  min,
  max,
  className,
}: SparklineProps) {
  const { path, area, gradientId } = useMemo(() => {
    const gid = `spark_${Math.random().toString(36).slice(2, 9)}`;
    if (data.length < 2) return { path: "", area: "", gradientId: gid };
    const values = data.map((d) => d.value);
    const lo = min ?? Math.min(...values);
    const hi = max ?? Math.max(...values);
    const range = hi - lo || 1;
    const stepX = width / (data.length - 1);
    const pts = values.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - lo) / range) * (height - 4) - 2;
      return [x, y] as const;
    });
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    const a = `${d} L${width},${height} L0,${height} Z`;
    return { path: d, area: a, gradientId: gid };
  }, [data, width, height, min, max]);

  if (!path) {
    return (
      <div
        className={className}
        style={{ width, height }}
        aria-hidden
      />
    );
  }

  return (
    <svg width={width} height={height} className={className} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gradientId})`} stroke="none" />}
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

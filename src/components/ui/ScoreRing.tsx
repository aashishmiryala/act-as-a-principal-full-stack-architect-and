import { cn } from "@/lib/utils";

interface ScoreRingProps {
  /** 0..1 risk score. */
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

function riskColor(v: number): string {
  if (v >= 0.66) return "#fb7185"; // rose
  if (v >= 0.4) return "#fbbf24"; // amber
  if (v >= 0.2) return "#38bdf8"; // sky
  return "#34d399"; // emerald
}

export function ScoreRing({
  value,
  size = 72,
  strokeWidth = 7,
  label,
  className,
}: ScoreRingProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);
  const color = riskColor(clamped);

  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.4s ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-sm font-bold tabular-nums" style={{ color }}>
            {Math.round(clamped * 100)}
          </div>
          {label && <div className="text-[9px] uppercase tracking-wide text-ink-500">{label}</div>}
        </div>
      </div>
    </div>
  );
}

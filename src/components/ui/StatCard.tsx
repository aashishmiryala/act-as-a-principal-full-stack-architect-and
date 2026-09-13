import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  trend?: { value: number; label?: string };
  accent?: "brand" | "emerald" | "amber" | "rose" | "violet";
  className?: string;
}

const ACCENTS: Record<string, string> = {
  brand: "text-brand-300 bg-brand-500/10 ring-brand-500/20",
  emerald: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/20",
  amber: "text-amber-300 bg-amber-500/10 ring-amber-500/20",
  rose: "text-rose-300 bg-rose-500/10 ring-rose-500/20",
  violet: "text-violet-300 bg-violet-500/10 ring-violet-500/20",
};

export function StatCard({
  label,
  value,
  icon,
  hint,
  trend,
  accent = "brand",
  className,
}: StatCardProps) {
  return (
    <div className={cn("card card-hover p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</span>
        {icon && (
          <div className={cn("grid h-8 w-8 place-items-center rounded-lg ring-1", ACCENTS[accent])}>
            {icon}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-2xl font-bold tracking-tight text-ink-50 tabular-nums">{value}</span>
        {trend && (
          <span
            className={cn(
              "mb-1 text-xs font-semibold tabular-nums",
              trend.value >= 0 ? "text-emerald-400" : "text-rose-400",
            )}
          >
            {trend.value >= 0 ? "▲" : "▼"} {Math.abs(trend.value)}
            {trend.label}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

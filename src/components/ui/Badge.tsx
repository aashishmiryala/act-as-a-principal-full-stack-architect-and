import type { ReactNode } from "react";
import type { DeviceStatus, Severity } from "@/types";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<Severity, string> = {
  info: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  warning: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  critical: "border-rose-500/40 bg-rose-500/15 text-rose-200",
};

export function SeverityBadge({ severity, children }: { severity: Severity; children?: ReactNode }) {
  return (
    <span className={cn("chip capitalize", SEVERITY_STYLES[severity])}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          severity === "critical" && "bg-rose-400",
          severity === "warning" && "bg-amber-400",
          severity === "info" && "bg-sky-400",
        )}
      />
      {children ?? severity}
    </span>
  );
}

const STATUS_STYLES: Record<DeviceStatus, string> = {
  online: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  offline: "border-white/10 bg-white/5 text-ink-400",
  degraded: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  provisioning: "border-sky-400/30 bg-sky-400/10 text-sky-200",
};

export function StatusBadge({ status }: { status: DeviceStatus }) {
  return (
    <span className={cn("chip capitalize", STATUS_STYLES[status])}>
      <span
        className={cn(
          "relative flex h-1.5 w-1.5",
          status === "online" && "text-emerald-400",
        )}
      >
        {status === "online" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
        )}
        <span
          className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            status === "online" && "bg-emerald-400",
            status === "offline" && "bg-ink-500",
            status === "degraded" && "bg-amber-400",
            status === "provisioning" && "bg-sky-400",
          )}
        />
      </span>
      {status}
    </span>
  );
}

export function Chip({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "brand" | "emerald" | "amber" | "rose" | "violet";
}) {
  const tones: Record<string, string> = {
    neutral: "border-white/10 bg-white/5 text-ink-200",
    brand: "border-brand-400/30 bg-brand-400/10 text-brand-200",
    emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-200",
    violet: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  };
  return <span className={cn("chip", tones[tone], className)}>{children}</span>;
}

import { useMemo, useState } from "react";
import { CheckCheck, ShieldAlert, Trash2 } from "lucide-react";
import type { Severity } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { AlertRow } from "@/components/widgets/AlertRow";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useAlertStore } from "@/store/useAlertStore";
import { useAuthStore } from "@/store/useAuthStore";
import { repository } from "@/lib/db/repository";
import { cn } from "@/lib/utils";

type Filter = "all" | "unacked" | Severity;

export default function Alerts() {
  useTelemetry();
  const alerts = useAlertStore((s) => s.alerts);
  const acknowledge = useAlertStore((s) => s.acknowledge);
  const acknowledgeAll = useAlertStore((s) => s.acknowledgeAll);
  const clear = useAlertStore((s) => s.clear);
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<Filter>("unacked");

  const counts = useMemo(() => {
    const unacked = alerts.filter((a) => !a.acknowledged);
    return {
      total: alerts.length,
      unacked: unacked.length,
      critical: unacked.filter((a) => a.severity === "critical").length,
      warning: unacked.filter((a) => a.severity === "warning").length,
    };
  }, [alerts]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "all":
        return alerts;
      case "unacked":
        return alerts.filter((a) => !a.acknowledged);
      default:
        return alerts.filter((a) => a.severity === filter);
    }
  }, [alerts, filter]);

  const filters: { key: Filter; label: string }[] = [
    { key: "unacked", label: "Unacknowledged" },
    { key: "critical", label: "Critical" },
    { key: "warning", label: "Warning" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alert Center"
        description="ML-detected anomalies and clinical rule breaches across the fleet."
        icon={<ShieldAlert className="h-6 w-6" />}
        actions={
          <div className="flex gap-2">
            <button
              className="btn-ghost"
              onClick={() => acknowledgeAll(user?.fullName ?? "you")}
              disabled={counts.unacked === 0}
            >
              <CheckCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Ack all</span>
            </button>
            <button className="btn-danger" onClick={clear} disabled={counts.total === 0}>
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total alerts" value={counts.total} accent="brand" />
        <StatCard label="Unacknowledged" value={counts.unacked} accent="violet" />
        <StatCard label="Critical" value={counts.critical} accent="rose" />
        <StatCard label="Warning" value={counts.warning} accent="amber" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "chip cursor-pointer transition-colors",
              filter === f.key
                ? "border-brand-400/40 bg-brand-400/15 text-brand-100"
                : "border-white/10 bg-white/5 text-ink-300 hover:bg-white/10",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="p-3">
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-400">
                <CheckCheck className="h-7 w-7" />
              </div>
              <p className="text-sm text-ink-200">Nothing here — you're all caught up.</p>
              <p className="text-xs text-ink-500">
                Inject a scenario in the IoT Simulator to generate detections.
              </p>
            </div>
          ) : (
            filtered.map((a) => (
              <AlertRow
                key={a.id}
                alert={a}
                patient={repository.getPatient(a.patientId)}
                onAck={(id) => acknowledge(id, user?.fullName ?? "you")}
              />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

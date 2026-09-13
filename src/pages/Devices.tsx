import { useMemo, useState } from "react";
import { Cpu, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeviceCard } from "@/components/widgets/DeviceCard";
import { useTelemetry } from "@/hooks/useTelemetry";
import { repository } from "@/lib/db/repository";
import { telemetryHub } from "@/lib/telemetryHub";
import { cn } from "@/lib/utils";

type SortKey = "risk" | "name" | "ward";

export default function Devices() {
  useTelemetry();
  const devices = repository.listDevices();
  const [query, setQuery] = useState("");
  const [ward, setWard] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("risk");
  const [onlyAnomalies, setOnlyAnomalies] = useState(false);

  const wards = useMemo(
    () => ["all", ...Array.from(new Set(devices.map((d) => repository.getPatient(d.patientId)?.ward ?? "—")))],
    [devices],
  );

  const rows = useMemo(() => {
    let list = devices.map((d) => ({
      device: d,
      patient: repository.getPatient(d.patientId)!,
      snapshot: telemetryHub.getSnapshot(d.id),
    }));

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (r) =>
          r.patient.fullName.toLowerCase().includes(q) ||
          r.device.id.toLowerCase().includes(q) ||
          r.patient.condition.toLowerCase().includes(q) ||
          r.patient.mrn.toLowerCase().includes(q),
      );
    }
    if (ward !== "all") list = list.filter((r) => r.patient.ward === ward);
    if (onlyAnomalies) list = list.filter((r) => (r.snapshot?.anomalyMetrics.length ?? 0) > 0);

    list.sort((a, b) => {
      if (sort === "risk") return (b.snapshot?.compositeScore ?? 0) - (a.snapshot?.compositeScore ?? 0);
      if (sort === "name") return a.patient.fullName.localeCompare(b.patient.fullName);
      return a.patient.ward.localeCompare(b.patient.ward);
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, query, ward, sort, onlyAnomalies, telemetryHub.getVersion()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Device Fleet"
        description={`${devices.length} ESP32 nodes · ${rows.length} shown`}
        icon={<Cpu className="h-6 w-6" />}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            className="input pl-9"
            placeholder="Search patient, device ID, MRN or condition…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className="input sm:w-44" value={ward} onChange={(e) => setWard(e.target.value)}>
          {wards.map((w) => (
            <option key={w} value={w}>
              {w === "all" ? "All wards" : w}
            </option>
          ))}
        </select>
        <select
          className="input sm:w-40"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          <option value="risk">Sort: Risk</option>
          <option value="name">Sort: Name</option>
          <option value="ward">Sort: Ward</option>
        </select>
        <button
          onClick={() => setOnlyAnomalies((v) => !v)}
          className={cn(
            "btn h-[42px] shrink-0 border",
            onlyAnomalies
              ? "border-rose-500/40 bg-rose-500/15 text-rose-200"
              : "border-white/5 bg-white/[0.03] text-ink-300 hover:bg-white/10",
          )}
        >
          Anomalies only
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="card grid place-items-center py-16 text-center">
          <p className="text-sm text-ink-300">No devices match your filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {rows.map(({ device, patient }) => (
            <DeviceCard key={device.id} device={device} patient={patient} />
          ))}
        </div>
      )}
    </div>
  );
}

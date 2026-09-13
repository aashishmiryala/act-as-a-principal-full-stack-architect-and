import { create } from "zustand";
import type { Alert, DetectorKind, Severity, VitalMetric } from "@/types";
import { repository } from "@/lib/db/repository";
import { supabase } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/** A row of public.alerts as returned by PostgREST. */
interface AlertRow {
  id: string;
  device_id: string;
  patient_id: string | null;
  ts: string;
  severity: Severity;
  metric: string;
  title: string;
  description: string | null;
  value: number | null;
  detector: string;
  score: number | null;
  recommendation: string | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
}

function rowToAlert(r: AlertRow): Alert {
  return {
    id: r.id,
    deviceId: r.device_id,
    patientId: r.patient_id ?? "",
    ts: new Date(r.ts).getTime(),
    severity: r.severity,
    metric: r.metric as VitalMetric | "composite",
    title: r.title,
    description: r.description ?? "",
    value: Number(r.value ?? 0),
    detector: r.detector as DetectorKind,
    score: Number(r.score ?? 0),
    acknowledged: r.acknowledged,
    acknowledgedBy: r.acknowledged_by ?? undefined,
    acknowledgedAt: r.acknowledged_at ? new Date(r.acknowledged_at).getTime() : undefined,
    recommendation: r.recommendation ?? "",
  };
}

function alertToRow(a: Alert) {
  return {
    id: a.id,
    device_id: a.deviceId,
    patient_id: a.patientId || null,
    ts: new Date(a.ts).toISOString(),
    severity: a.severity,
    metric: a.metric,
    title: a.title,
    description: a.description,
    value: a.value,
    detector: a.detector,
    score: Math.min(9.9999, a.score),
    recommendation: a.recommendation,
    acknowledged: a.acknowledged,
    acknowledged_by: a.acknowledgedBy ?? null,
    acknowledged_at: a.acknowledgedAt ? new Date(a.acknowledgedAt).toISOString() : null,
  };
}

interface AlertState {
  alerts: Alert[];
  mode: "supabase" | "local";
  channel: RealtimeChannel | null;
  init: () => Promise<void>;
  ingest: (alert: Alert) => void;
  acknowledge: (id: string, by: string) => void;
  acknowledgeAll: (by: string) => void;
  clear: () => void;
  unacknowledgedCount: () => number;
  criticalCount: () => number;
}

const MAX = 500;

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],
  mode: "local",
  channel: null,

  init: async () => {
    repository.init();

    let authed = false;
    try {
      const { data } = await supabase.auth.getSession();
      authed = Boolean(data.session);
    } catch {
      authed = false;
    }

    if (authed) {
      try {
        const { data, error } = await supabase
          .from("alerts")
          .select("*")
          .order("ts", { ascending: false })
          .limit(MAX);
        if (error) throw error;

        set({ mode: "supabase", alerts: (data as AlertRow[]).map(rowToAlert) });

        if (!get().channel) {
          const channel = supabase
            .channel("alerts-feed")
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "alerts" },
              (payload) => {
                const state = get();
                if (payload.eventType === "DELETE") {
                  const id = (payload.old as { id?: string }).id;
                  set({ alerts: state.alerts.filter((a) => a.id !== id) });
                  return;
                }
                const incoming = rowToAlert(payload.new as AlertRow);
                const rest = state.alerts.filter((a) => a.id !== incoming.id);
                const next = [incoming, ...rest]
                  .sort((a, b) => b.ts - a.ts)
                  .slice(0, MAX);
                set({ alerts: next });
              },
            )
            .subscribe();
          set({ channel });
        }
        return;
      } catch {
        /* fall through to local mode */
      }
    }

    set({ mode: "local", alerts: repository.listAlerts() });
  },

  ingest: (alert) => {
    const state = get();
    if (state.alerts.some((a) => a.id === alert.id)) return;
    set({ alerts: [alert, ...state.alerts].slice(0, MAX) });

    if (state.mode === "supabase") {
      // Fire-and-forget; the realtime echo de-duplicates by id.
      void supabase.from("alerts").insert(alertToRow(alert)).then(({ error }) => {
        if (error) console.warn("[alerts] persist failed:", error.message);
      });
    } else {
      repository.addAlert(alert);
    }
  },

  acknowledge: (id, by) => {
    const state = get();
    const at = Date.now();
    set({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true, acknowledgedBy: by, acknowledgedAt: at } : a,
      ),
    });
    if (state.mode === "supabase") {
      void supabase
        .from("alerts")
        .update({ acknowledged: true, acknowledged_by: by, acknowledged_at: new Date(at).toISOString() })
        .eq("id", id);
    } else {
      repository.acknowledgeAlert(id, by);
    }
  },

  acknowledgeAll: (by) => {
    const state = get();
    const at = Date.now();
    set({
      alerts: state.alerts.map((a) =>
        a.acknowledged ? a : { ...a, acknowledged: true, acknowledgedBy: by, acknowledgedAt: at },
      ),
    });
    if (state.mode === "supabase") {
      void supabase
        .from("alerts")
        .update({ acknowledged: true, acknowledged_by: by, acknowledged_at: new Date(at).toISOString() })
        .eq("acknowledged", false);
    } else {
      repository.acknowledgeAll(by);
    }
  },

  clear: () => {
    const state = get();
    set({ alerts: [] });
    if (state.mode === "supabase") {
      void supabase.from("alerts").delete().neq("id", "");
    } else {
      repository.clearAlerts();
    }
  },

  unacknowledgedCount: () => get().alerts.filter((a) => !a.acknowledged).length,
  criticalCount: () =>
    get().alerts.filter((a) => !a.acknowledged && a.severity === "critical").length,
}));

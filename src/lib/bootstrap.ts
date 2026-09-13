/**
 * System bootstrap.
 * ------------------------------------------------------------------
 * Idempotently starts the runtime: repository → ESP32 fleet → telemetry hub,
 * and wires the anomaly engine's alert output into the alert store. Safe to call
 * from React effects and StrictMode double-invocation.
 */

import { repository } from "@/lib/db/repository";
import { fleet } from "@/lib/iot/fleet";
import { telemetryHub } from "@/lib/telemetryHub";
import { useAlertStore } from "@/store/useAlertStore";

let booted = false;

export async function bootstrapSystem(): Promise<void> {
  if (booted) return;
  booted = true;

  repository.init();
  // Load persisted alerts (Supabase when signed in, else local) BEFORE the
  // telemetry hub can start emitting new detections into the store.
  await useAlertStore.getState().init();

  // Route anomaly-engine alerts into the alert store (and thus the UI + storage).
  telemetryHub.setAlertSink((alert) => {
    useAlertStore.getState().ingest(alert);
  });

  telemetryHub.start();
  fleet.start();
}

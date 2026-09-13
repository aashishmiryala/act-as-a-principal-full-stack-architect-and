/**
 * Telemetry persistence bridge.
 * ------------------------------------------------------------------
 * The browser doubles as the ESP32 "gateway": it subscribes to the featured
 * device's MQTT telemetry topic and writes throttled frames to `public.telemetry`
 * in Postgres (behind RLS). This demonstrates durable time-series persistence
 * without flooding the DB at the full 1 Hz sample rate.
 *
 * Best-effort and guarded: if the backend is unreachable or the user is not
 * authenticated, it is a no-op and the local simulation keeps running.
 */

import type { TelemetryFrame } from "@/types";
import { supabase, supabaseConfigured } from "@/lib/supabase/client";
import { broker, Topics } from "@/lib/mqtt/broker";
import type { BrokerMessage } from "@/lib/mqtt/broker";

/** Device whose telemetry stream is persisted to Postgres. */
export const PERSISTED_DEVICE_ID = "esp32-simulated-01";
const INTERVAL_MS = 4000; // persist ~one frame every 4s

let unsubscribe: (() => void) | null = null;
let lastInsert = 0;
let started = false;

async function persist(frame: TelemetryFrame): Promise<void> {
  const { error } = await supabase.from("telemetry").insert({
    device_id: frame.deviceId,
    patient_id: frame.patientId || null,
    ts: new Date(frame.ts).toISOString(),
    seq: frame.seq,
    metrics: frame.metrics,
    battery: frame.battery,
    rssi: frame.rssi,
  });
  if (error) console.warn("[telemetry] persist failed:", error.message);
}

/** Start persisting the featured device's telemetry (idempotent). */
export async function startTelemetryPersistence(): Promise<void> {
  if (started || !supabaseConfigured) return;
  // RLS requires an authenticated session to insert.
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
  } catch {
    return;
  }
  started = true;
  unsubscribe = broker.subscribe<TelemetryFrame>(
    Topics.telemetry(PERSISTED_DEVICE_ID),
    (msg: BrokerMessage<TelemetryFrame>) => {
      const now = Date.now();
      if (now - lastInsert < INTERVAL_MS) return;
      lastInsert = now;
      void persist(msg.payload);
    },
  );
}

export function stopTelemetryPersistence(): void {
  unsubscribe?.();
  unsubscribe = null;
  started = false;
}

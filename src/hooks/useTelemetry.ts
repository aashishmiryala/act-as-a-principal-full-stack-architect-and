import { useSyncExternalStore } from "react";
import { telemetryHub } from "@/lib/telemetryHub";

/**
 * Subscribe a component to the live telemetry stream. Returns a monotonically
 * increasing version number that changes on each throttled flush (~5 Hz), which
 * triggers a re-render. Components then read fresh data via `telemetryHub`
 * getters. This keeps high-frequency telemetry out of React state while still
 * driving smooth updates.
 */
export function useTelemetry(): number {
  return useSyncExternalStore(
    telemetryHub.subscribe,
    telemetryHub.getVersion,
    telemetryHub.getVersion,
  );
}

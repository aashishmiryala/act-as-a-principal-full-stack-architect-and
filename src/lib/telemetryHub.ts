/**
 * Telemetry hub — the real-time nerve centre.
 * ------------------------------------------------------------------
 * Subscribes to the MQTT telemetry stream, maintains rolling per-device /
 * per-metric ring buffers, runs every frame through the anomaly engine, pushes
 * raised alerts to the alert store + broker `alerts` topic, and exposes a
 * `useSyncExternalStore`-compatible surface so React components read live data
 * without re-render storms (UI notifications are throttled to ~5 Hz while the
 * underlying data stays instantaneous).
 */

import type {
  Alert,
  AnomalyScore,
  MetricPoint,
  TelemetryFrame,
  VitalMetric,
} from "@/types";
import { broker, Topics } from "@/lib/mqtt/broker";
import type { BrokerMessage } from "@/lib/mqtt/broker";
import { anomalyEngine } from "@/lib/ml/anomaly";
import { repository } from "@/lib/db/repository";

const BUFFER_CAP = 180; // ~3 minutes at 1 Hz
const NOTIFY_INTERVAL = 200; // ms → 5 Hz UI refresh

export interface DeviceSnapshot {
  deviceId: string;
  frame: TelemetryFrame | null;
  compositeScore: number;
  scores: AnomalyScore[];
  anomalyMetrics: VitalMetric[];
}

type AlertSink = (alert: Alert) => void;

class TelemetryHub {
  private buffers = new Map<string, Map<VitalMetric, MetricPoint[]>>();
  private latest = new Map<string, TelemetryFrame>();
  private snapshots = new Map<string, DeviceSnapshot>();
  private compositeHistory = new Map<string, MetricPoint[]>();

  private listeners = new Set<() => void>();
  private version = 0;
  private dirty = false;
  private notifyTimer: ReturnType<typeof setInterval> | null = null;
  private unsub: (() => void) | null = null;
  private alertSink: AlertSink | null = null;
  private started = false;

  // Aggregate counters for the dashboard header.
  totalFrames = 0;
  totalAnomalies = 0;

  start(): void {
    if (this.started) return;
    repository.init();

    // Warm-start the detectors from each patient's baseline.
    for (const device of repository.listDevices()) {
      if (device.baseline) anomalyEngine.seedBaseline(device.id, device.baseline);
    }

    this.unsub = broker.subscribe<TelemetryFrame>(Topics.telemetryAll(), (msg) =>
      this.onFrame(msg),
    );
    this.notifyTimer = setInterval(() => this.flush(), NOTIFY_INTERVAL);
    this.started = true;
  }

  setAlertSink(sink: AlertSink): void {
    this.alertSink = sink;
  }

  private onFrame(msg: BrokerMessage<TelemetryFrame>): void {
    const frame = msg.payload;
    this.latest.set(frame.deviceId, frame);
    this.totalFrames++;

    // Append to ring buffers.
    let byMetric = this.buffers.get(frame.deviceId);
    if (!byMetric) {
      byMetric = new Map();
      this.buffers.set(frame.deviceId, byMetric);
    }
    for (const key of Object.keys(frame.metrics) as VitalMetric[]) {
      let buf = byMetric.get(key);
      if (!buf) {
        buf = [];
        byMetric.set(key, buf);
      }
      buf.push({ ts: frame.ts, value: frame.metrics[key] });
      if (buf.length > BUFFER_CAP) buf.shift();
    }

    // Run detection.
    const result = anomalyEngine.process(frame);
    const anomalyMetrics = result.scores.filter((s) => s.isAnomaly).map((s) => s.metric);
    this.snapshots.set(frame.deviceId, {
      deviceId: frame.deviceId,
      frame,
      compositeScore: result.compositeScore,
      scores: result.scores,
      anomalyMetrics,
    });

    // Composite score history for the risk sparkline.
    let hist = this.compositeHistory.get(frame.deviceId);
    if (!hist) {
      hist = [];
      this.compositeHistory.set(frame.deviceId, hist);
    }
    hist.push({ ts: frame.ts, value: result.compositeScore });
    if (hist.length > BUFFER_CAP) hist.shift();

    // Emit alerts.
    for (const alert of result.alerts) {
      this.totalAnomalies++;
      broker.publish(Topics.alerts(frame.deviceId), alert, { qos: 1 });
      this.alertSink?.(alert);
    }

    this.dirty = true;
  }

  private flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.version++;
    for (const l of this.listeners) l();
  }

  // ── External store surface (useSyncExternalStore) ──────────────────────────
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getVersion = (): number => this.version;

  // ── Readers ────────────────────────────────────────────────────────────────
  getLatest(deviceId: string): TelemetryFrame | null {
    return this.latest.get(deviceId) ?? null;
  }
  getSnapshot(deviceId: string): DeviceSnapshot | null {
    return this.snapshots.get(deviceId) ?? null;
  }
  getSeries(deviceId: string, metric: VitalMetric): MetricPoint[] {
    return this.buffers.get(deviceId)?.get(metric) ?? EMPTY;
  }
  getCompositeHistory(deviceId: string): MetricPoint[] {
    return this.compositeHistory.get(deviceId) ?? EMPTY;
  }
  allSnapshots(): DeviceSnapshot[] {
    return [...this.snapshots.values()];
  }
  fleetRiskScore(): number {
    const snaps = this.allSnapshots();
    if (!snaps.length) return 0;
    return snaps.reduce((a, s) => a + s.compositeScore, 0) / snaps.length;
  }

  dispose(): void {
    this.unsub?.();
    if (this.notifyTimer) clearInterval(this.notifyTimer);
    this.listeners.clear();
    this.buffers.clear();
    this.latest.clear();
    this.snapshots.clear();
    this.started = false;
  }
}

const EMPTY: MetricPoint[] = [];
export const telemetryHub = new TelemetryHub();

/**
 * ESP32 device emulator.
 * ------------------------------------------------------------------
 * Each instance models one ESP32-WROOM-32 node running the HealthGuard firmware:
 * it samples its attached sensors at the configured rate, encodes a compact
 * telemetry frame and publishes it to the MQTT topic
 * `healthguard/{deviceId}/telemetry`, plus periodic retained status frames on
 * `healthguard/{deviceId}/status`. It also drains battery, jitters RSSI and can
 * be driven into fault states — exactly like real hardware in the field.
 */

import type { Device, TelemetryFrame } from "@/types";
import { broker, Topics } from "@/lib/mqtt/broker";
import { clamp, gaussian, mulberry32 } from "@/lib/utils";
import { SignalSource, type ScenarioKind } from "./sensors";

export interface DeviceStatusFrame {
  deviceId: string;
  status: Device["status"];
  battery: number;
  rssi: number;
  uptimeSec: number;
  firmware: string;
  ts: number;
}

export class Esp32Device {
  private signal: SignalSource;
  private seq = 0;
  private rand: () => number;
  private accumulator = 0;
  private statusAccumulator = 0;
  private battery: number;
  private rssi: number;
  private uptime: number;
  private online = true;

  constructor(public readonly device: Device) {
    const seed = hashSeed(device.id);
    this.rand = mulberry32(seed);
    this.signal = new SignalSource(
      // The patient baseline is injected by the fleet manager via device meta.
      device.baseline ?? DEFAULT_BASELINE,
      seed,
    );
    this.battery = device.batteryPct;
    this.rssi = device.rssi;
    this.uptime = device.uptimeSec;
    // Retain an initial status so late-joining dashboards render immediately.
    this.publishStatus(Date.now());
  }

  get id(): string {
    return this.device.id;
  }

  setScenario(kind: ScenarioKind): void {
    this.signal.setScenario(kind);
  }

  get scenario(): ScenarioKind {
    return this.signal.currentScenario;
  }

  setOnline(online: boolean): void {
    this.online = online;
    this.device.status = online ? "online" : "offline";
    this.publishStatus(Date.now());
  }

  /**
   * Advance the device clock by `dtSec`. Emits telemetry at `sampleRateHz` and a
   * status heartbeat every 5s.
   */
  update(dtSec: number, now: number): void {
    if (!this.online) return;

    this.uptime += dtSec;
    this.accumulator += dtSec;
    this.statusAccumulator += dtSec;

    const period = 1 / this.device.sampleRateHz;
    // Emit at most a few frames per animation tick to stay real-time.
    let guard = 0;
    while (this.accumulator >= period && guard < 8) {
      this.accumulator -= period;
      guard++;
      this.emitTelemetry(now);
    }

    // Battery + link dynamics.
    this.battery = clamp(this.battery - dtSec * 0.0009, 0, 100);
    this.rssi = clamp(this.rssi + gaussian(this.rand, 0, 0.6), -95, -35);
    this.device.batteryPct = Number(this.battery.toFixed(1));
    this.device.rssi = Math.round(this.rssi);
    this.device.uptimeSec = Math.round(this.uptime);
    this.device.lastSeen = now;

    if (this.battery < 8 && this.device.status === "online") {
      this.device.status = "degraded";
    }

    if (this.statusAccumulator >= 5) {
      this.statusAccumulator = 0;
      this.publishStatus(now);
    }
  }

  private emitTelemetry(now: number): void {
    const sample = this.signal.tick(1 / this.device.sampleRateHz);
    const frame: TelemetryFrame = {
      deviceId: this.device.id,
      patientId: this.device.patientId,
      ts: now,
      seq: this.seq++,
      metrics: {
        heartRate: round1(sample.metrics.heartRate),
        spo2: round1(sample.metrics.spo2),
        temperature: round2(sample.metrics.temperature),
        respiration: round1(sample.metrics.respiration),
        systolic: Math.round(sample.metrics.systolic),
        diastolic: Math.round(sample.metrics.diastolic),
        motion: round2(sample.metrics.motion),
      },
      battery: Number(this.battery.toFixed(1)),
      rssi: Math.round(this.rssi),
    };
    broker.publish(Topics.telemetry(this.device.id), frame, { qos: 0 });
  }

  private publishStatus(now: number): void {
    const status: DeviceStatusFrame = {
      deviceId: this.device.id,
      status: this.device.status,
      battery: Number(this.battery.toFixed(1)),
      rssi: Math.round(this.rssi),
      uptimeSec: Math.round(this.uptime),
      firmware: this.device.firmware,
      ts: now,
    };
    broker.publish(Topics.status(this.device.id), status, { retained: true, qos: 1 });
  }
}

const DEFAULT_BASELINE = {
  heartRate: 74,
  spo2: 98,
  temperature: 36.8,
  respiration: 16,
  systolic: 118,
  diastolic: 76,
};

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

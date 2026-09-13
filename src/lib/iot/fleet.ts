/**
 * Fleet manager — orchestrates the whole ESP32 estate.
 * ------------------------------------------------------------------
 * Owns the simulation clock (a requestAnimationFrame loop with a fixed logical
 * timestep), instantiates one `Esp32Device` per seeded device, exposes controls
 * for injecting scenarios / toggling connectivity, and lets callers accelerate
 * simulated time. Everything downstream (telemetry store, anomaly engine, UI)
 * consumes the MQTT stream this produces — nothing talks to the fleet directly.
 */

import type { Device } from "@/types";
import { repository } from "@/lib/db/repository";
import { Esp32Device } from "./device";
import type { ScenarioKind } from "./sensors";

class FleetManager {
  private devices = new Map<string, Esp32Device>();
  private running = false;
  private rafId: number | null = null;
  private lastTs = 0;
  private timeScale = 1;
  private started = false;

  start(): void {
    if (this.started) return;
    repository.init();
    for (const dev of repository.listDevices()) {
      this.devices.set(dev.id, new Esp32Device(dev));
    }
    this.started = true;
    this.resume();
  }

  resume(): void {
    if (this.running) return;
    this.running = true;
    this.lastTs = performance.now();
    const loop = (ts: number) => {
      if (!this.running) return;
      const rawDt = (ts - this.lastTs) / 1000;
      this.lastTs = ts;
      // Clamp to avoid huge jumps when the tab was backgrounded.
      const dt = Math.min(rawDt, 0.25) * this.timeScale;
      const now = Date.now();
      for (const dev of this.devices.values()) dev.update(dt, now);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  pause(): void {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  get isRunning(): boolean {
    return this.running;
  }

  setTimeScale(scale: number): void {
    this.timeScale = Math.max(0.25, Math.min(20, scale));
  }
  get scale(): number {
    return this.timeScale;
  }

  injectScenario(deviceId: string, kind: ScenarioKind): void {
    this.devices.get(deviceId)?.setScenario(kind);
  }

  scenarioOf(deviceId: string): ScenarioKind | undefined {
    return this.devices.get(deviceId)?.scenario;
  }

  setDeviceOnline(deviceId: string, online: boolean): void {
    this.devices.get(deviceId)?.setOnline(online);
  }

  listDevices(): Device[] {
    return [...this.devices.values()].map((d) => d.device);
  }

  dispose(): void {
    this.pause();
    this.devices.clear();
    this.started = false;
  }
}

export const fleet = new FleetManager();

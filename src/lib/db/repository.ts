/**
 * Client-side repository (data-access layer).
 * ------------------------------------------------------------------
 * Presents the same shape as the eventual PostgREST API + Supabase Realtime, but
 * backed by an in-memory store hydrated from `buildSeed()` and persisted to
 * localStorage. When `VITE_SUPABASE_URL`/`ANON_KEY` are present this is where you
 * would swap `createClient(...)` calls in; the rest of the app is transport
 * agnostic.
 */

import type { Alert, Device, Patient } from "@/types";
import { buildSeed } from "./seed";

const LS_KEY = "healthguard.alerts.v1";

class Repository {
  private patients = new Map<string, Patient>();
  private devices = new Map<string, Device>();
  private alerts: Alert[] = [];
  private ready = false;

  init(): void {
    if (this.ready) return;
    for (const { patient, device } of buildSeed()) {
      this.patients.set(patient.id, patient);
      this.devices.set(device.id, device);
    }
    this.loadAlerts();
    this.ready = true;
  }

  // ── Patients ──────────────────────────────────────────────────────────────
  listPatients(): Patient[] {
    return [...this.patients.values()];
  }
  getPatient(id: string): Patient | undefined {
    return this.patients.get(id);
  }

  // ── Devices ───────────────────────────────────────────────────────────────
  listDevices(): Device[] {
    return [...this.devices.values()];
  }
  getDevice(id: string): Device | undefined {
    return this.devices.get(id);
  }
  getDeviceByPatient(patientId: string): Device | undefined {
    return [...this.devices.values()].find((d) => d.patientId === patientId);
  }

  // ── Alerts ────────────────────────────────────────────────────────────────
  listAlerts(): Alert[] {
    return [...this.alerts].sort((a, b) => b.ts - a.ts);
  }
  addAlert(alert: Alert): void {
    this.alerts.unshift(alert);
    if (this.alerts.length > 500) this.alerts.length = 500;
    this.persistAlerts();
  }
  acknowledgeAlert(id: string, by: string): Alert | undefined {
    const alert = this.alerts.find((a) => a.id === id);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = by;
      alert.acknowledgedAt = Date.now();
      this.persistAlerts();
    }
    return alert;
  }
  acknowledgeAll(by: string): void {
    for (const a of this.alerts) {
      if (!a.acknowledged) {
        a.acknowledged = true;
        a.acknowledgedBy = by;
        a.acknowledgedAt = Date.now();
      }
    }
    this.persistAlerts();
  }
  clearAlerts(): void {
    this.alerts = [];
    this.persistAlerts();
  }

  private loadAlerts(): void {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) this.alerts = JSON.parse(raw) as Alert[];
    } catch {
      this.alerts = [];
    }
  }
  private persistAlerts(): void {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.alerts.slice(0, 200)));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }
}

export const repository = new Repository();

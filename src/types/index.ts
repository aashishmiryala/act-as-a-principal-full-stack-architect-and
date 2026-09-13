/**
 * AIoT HealthGuard — Domain Types
 * ------------------------------------------------------------------
 * These interfaces mirror the relational schema defined in
 * `supabase/migrations/0001_init.sql`. Keeping the TypeScript model and the
 * SQL schema in lock-step lets the client-side repository behave exactly like
 * the eventual REST/Realtime API served by Postgres + PostgREST.
 */

// ─── Auth & tenancy ─────────────────────────────────────────────────────────

export type UserRole = "admin" | "clinician" | "caregiver" | "patient";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarColor: string;
  createdAt: number;
}

export interface Session {
  token: string;
  user: User;
  issuedAt: number;
  expiresAt: number;
}

// ─── Patients ───────────────────────────────────────────────────────────────

export type Sex = "male" | "female" | "other";

export interface Patient {
  id: string;
  mrn: string; // medical record number
  fullName: string;
  sex: Sex;
  dateOfBirth: string; // ISO date
  room: string;
  ward: string;
  condition: string;
  admittedAt: number;
  baseline: VitalBaseline;
}

/** Personalised normal ranges used to tune the ML detectors per-patient. */
export interface VitalBaseline {
  heartRate: number;
  spo2: number;
  temperature: number;
  respiration: number;
  systolic: number;
  diastolic: number;
}

// ─── Devices (ESP32 fleet) ──────────────────────────────────────────────────

export type DeviceStatus = "online" | "offline" | "degraded" | "provisioning";

export type SensorKind =
  | "heartRate"
  | "spo2"
  | "temperature"
  | "respiration"
  | "systolic"
  | "diastolic"
  | "motion";

export interface DeviceSensor {
  kind: SensorKind;
  model: string;
  unit: string;
}

export interface Device {
  id: string; // e.g. esp32-a1b2
  name: string;
  patientId: string;
  firmware: string;
  hardware: string; // e.g. ESP32-WROOM-32
  status: DeviceStatus;
  batteryPct: number;
  rssi: number; // Wi-Fi signal, dBm
  ipAddress: string;
  sampleRateHz: number;
  sensors: DeviceSensor[];
  lastSeen: number;
  uptimeSec: number;
  location: { lat: number; lng: number; label: string };
  /** Patient baseline copied onto the device to warm-start the ML detectors. */
  baseline?: VitalBaseline;
}

// ─── Telemetry ──────────────────────────────────────────────────────────────

/** A single decoded MQTT telemetry frame published by an ESP32 device. */
export interface TelemetryFrame {
  deviceId: string;
  patientId: string;
  ts: number;
  seq: number;
  metrics: Record<VitalMetric, number>;
  battery: number;
  rssi: number;
}

export type VitalMetric =
  | "heartRate"
  | "spo2"
  | "temperature"
  | "respiration"
  | "systolic"
  | "diastolic"
  | "motion";

export interface MetricPoint {
  ts: number;
  value: number;
}

// ─── ML anomaly detection ───────────────────────────────────────────────────

export type Severity = "info" | "warning" | "critical";

/** User-facing severity tier labels shown in the anomaly feed. */
export type SeverityTier = "LOW" | "MODERATE" | "HIGH";

export type DetectorKind = "zscore" | "ewma" | "clinical" | "fall" | "iforest" | "ensemble";

export interface AnomalyScore {
  metric: VitalMetric;
  value: number;
  score: number; // 0..1 normalised anomaly score
  zScore: number;
  detector: DetectorKind;
  isAnomaly: boolean;
}

export interface Alert {
  id: string;
  deviceId: string;
  patientId: string;
  ts: number;
  severity: Severity;
  metric: VitalMetric | "composite";
  title: string;
  description: string;
  value: number;
  detector: DetectorKind;
  score: number;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  recommendation: string;
}

// ─── RAG documentation retrieval ────────────────────────────────────────────

export type DocCategory =
  | "clinical-protocol"
  | "device-manual"
  | "ml-operations"
  | "system-architecture"
  | "api-reference"
  | "security-compliance";

export interface DocChunk {
  id: string;
  docId: string;
  title: string;
  category: DocCategory;
  source: string;
  heading: string;
  content: string;
  tokens: number;
}

export interface RetrievedChunk extends DocChunk {
  similarity: number;
  keywordScore: number;
  finalScore: number;
  snippet: string;
}

export interface RagCitation {
  index: number;
  title: string;
  source: string;
  heading: string;
  similarity: number;
}

export interface RagAnswer {
  query: string;
  answer: string;
  citations: RagCitation[];
  retrieved: RetrievedChunk[];
  latencyMs: number;
  mode: "extractive" | "llm";
}

// ─── Broker / transport ─────────────────────────────────────────────────────

export interface BrokerStats {
  connected: boolean;
  publishedMessages: number;
  deliveredMessages: number;
  activeSubscriptions: number;
  throughputMsgSec: number;
  transport: "in-browser" | "wss";
}

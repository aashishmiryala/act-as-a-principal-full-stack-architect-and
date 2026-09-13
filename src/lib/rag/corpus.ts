/**
 * Knowledge corpus for the RAG assistant.
 * ------------------------------------------------------------------
 * A curated set of documentation chunks spanning clinical protocols, the ESP32
 * device manual, ML-ops runbooks, system architecture, the API reference and
 * security/compliance. Chunks are intentionally self-contained (one idea each)
 * so retrieval returns tight, citable passages.
 */

import type { DocChunk, DocCategory } from "@/types";

interface RawChunk {
  docId: string;
  title: string;
  category: DocCategory;
  source: string;
  heading: string;
  content: string;
}

const RAW: RawChunk[] = [
  // ── Clinical protocols ────────────────────────────────────────────────────
  {
    docId: "cp-vitals",
    title: "Adult Vital Sign Reference Ranges",
    category: "clinical-protocol",
    source: "protocols/vitals.md",
    heading: "Normal ranges",
    content:
      "For a resting adult the accepted normal ranges are: heart rate 60–100 bpm, respiratory rate 12–20 breaths per minute, SpO₂ 95–100%, oral temperature 36.1–37.5 °C, systolic blood pressure 90–130 mmHg and diastolic 60–85 mmHg. HealthGuard personalises these ranges per patient using the admission baseline so that trend-based detectors flag deviation from the individual rather than the population.",
  },
  {
    docId: "cp-news2",
    title: "Early Warning Escalation (NEWS2-style)",
    category: "clinical-protocol",
    source: "protocols/escalation.md",
    heading: "Escalation tiers",
    content:
      "Alerts are graded info, warning and critical. Warning alerts require the bedside nurse to increase monitoring frequency and reassess within 15 minutes. Critical alerts trigger an immediate rapid-response escalation: notify the attending clinician, begin the metric-specific intervention and document the response. Two or more concurrent warning alerts on one patient are automatically promoted to a composite critical alert.",
  },
  {
    docId: "cp-hypoxemia",
    title: "Hypoxemia Response",
    category: "clinical-protocol",
    source: "protocols/hypoxemia.md",
    heading: "Low SpO₂ management",
    content:
      "SpO₂ at or below 92% is hypoxemia; at or below 88% it is severe hypoxemia and critical. First verify the MAX30102 probe placement and perfusion, then apply supplemental oxygen titrated to a target of 94–98% (88–92% for chronic CO₂ retainers such as COPD patients). Escalate to the attending clinician if saturation does not recover within five minutes.",
  },
  {
    docId: "cp-fall",
    title: "Fall Detection Response",
    category: "clinical-protocol",
    source: "protocols/falls.md",
    heading: "Post-fall workflow",
    content:
      "The fall detector fires on an accelerometer impact above 3 g followed by a stillness window under 0.35 g sustained for at least 1.5 seconds. On a fall alert dispatch a bedside check immediately, perform a primary survey for injury, check orientation and vitals, and do not move the patient if a spinal injury is suspected. All fall alerts are critical and cannot be auto-cleared.",
  },
  {
    docId: "cp-sepsis",
    title: "Sepsis Surveillance",
    category: "clinical-protocol",
    source: "protocols/sepsis.md",
    heading: "Sepsis screening triggers",
    content:
      "Suspect sepsis when temperature rises above 38 °C (or falls below 36 °C) together with tachycardia above 90 bpm and tachypnea above 20 breaths per minute. HealthGuard raises a composite alert when these three trend upward together. Draw lactate and blood cultures, start the sepsis-6 bundle within one hour and reassess.",
  },

  // ── Device manual ─────────────────────────────────────────────────────────
  {
    docId: "dm-hardware",
    title: "ESP32 HealthGuard Node — Hardware",
    category: "device-manual",
    source: "device/hardware.md",
    heading: "Board & sensors",
    content:
      "Each node is an ESP32-WROOM-32 module. Attached sensors are a MAX30102 pulse-oximeter for heart rate and SpO₂ (I²C address 0x57), an MLX90614 non-contact infra-red thermometer for body temperature (I²C 0x5A), an MPU-6050 six-axis IMU for motion and fall detection (I²C 0x68), an impedance pneumograph for respiration and an oscillometric cuff for blood pressure. Sensors share the I²C bus on GPIO 21 (SDA) and GPIO 22 (SCL).",
  },
  {
    docId: "dm-firmware",
    title: "Firmware Telemetry Loop",
    category: "device-manual",
    source: "device/firmware.md",
    heading: "Sampling & publishing",
    content:
      "The firmware samples all sensors at 1 Hz by default (configurable up to 10 Hz for the IMU), assembles a compact JSON telemetry frame containing metrics, sequence number, battery and RSSI, and publishes it to healthguard/{deviceId}/telemetry over MQTT with QoS 0. A retained status frame is published to healthguard/{deviceId}/status every 5 seconds so dashboards render immediately on connect.",
  },
  {
    docId: "dm-provisioning",
    title: "Device Provisioning",
    category: "device-manual",
    source: "device/provisioning.md",
    heading: "Onboarding a new node",
    content:
      "New nodes boot into provisioning mode and expose a SoftAP captive portal for Wi-Fi credentials and broker URL. The node then requests a device certificate, registers itself against the fleet registry and transitions to online. Firmware updates are delivered over-the-air (OTA); a failed OTA rolls back to the previous partition automatically.",
  },
  {
    docId: "dm-power",
    title: "Power & Connectivity",
    category: "device-manual",
    source: "device/power.md",
    heading: "Battery and Wi-Fi",
    content:
      "Nodes run from a 1200 mAh LiPo cell and report battery percentage in every frame. Below 8% the node is marked degraded and reduces the IMU sample rate to conserve power. Wi-Fi RSSI is reported in dBm; readings weaker than −80 dBm indicate a poor link and may cause dropped frames. The node buffers up to 60 seconds of telemetry locally and back-fills after a reconnect.",
  },

  // ── ML operations ─────────────────────────────────────────────────────────
  {
    docId: "ml-ensemble",
    title: "Anomaly Detection Ensemble",
    category: "ml-operations",
    source: "ml/ensemble.md",
    heading: "How scoring works",
    content:
      "The engine fuses four complementary detectors. Per metric it combines a Welford online z-score against the patient's long-run distribution, an EWMA residual score that catches drift and step-changes, and clinical rule scoring for absolute danger zones; each component is squashed with a logistic function and the fused per-metric score ranges 0–1, with 0.5 or above considered anomalous. In parallel an unsupervised Isolation Forest scores the standardised multivariate vital vector to catch joint deviations where several vitals drift together — patterns a per-metric view can miss. The Isolation Forest builds random isolation trees on a rolling window and re-fits online; anomalies isolate in fewer splits and score closer to 1, and a sustained high multivariate score raises a composite alert. Alert severities map to the LOW, MODERATE and HIGH tiers shown in the feed.",
  },
  {
    docId: "ml-hysteresis",
    title: "Hysteresis & Alert Debouncing",
    category: "ml-operations",
    source: "ml/hysteresis.md",
    heading: "Preventing alert flapping",
    content:
      "To avoid a single noisy sample raising and clearing alerts, the engine requires three consecutive anomalous samples before entering the alert state, and a return to zero consecutive anomalies before clearing. Critical clinical-rule breaches bypass the debounce and alert immediately. This hysteresis dramatically reduces alarm fatigue while preserving sensitivity to true events.",
  },
  {
    docId: "ml-baseline",
    title: "Per-patient Baseline Seeding",
    category: "ml-operations",
    source: "ml/baseline.md",
    heading: "Cold-start calibration",
    content:
      "When a device comes online the detectors are warm-started from the patient's admission baseline so anomaly scoring is calibrated from the first sample instead of needing a learning period. The estimators then adapt online as real telemetry arrives, gradually replacing the seeded prior with the observed distribution.",
  },
  {
    docId: "ml-fall",
    title: "Fall Detector State Machine",
    category: "ml-operations",
    source: "ml/fall.md",
    heading: "Impact-then-stillness",
    content:
      "The fall detector is a two-stage state machine on the MPU-6050 motion channel. Stage one waits for an impact spike above 3 g. Stage two, within a six-second window, looks for a sustained stillness window with mean motion under 0.35 g for at least 1.5 seconds. Matching both stages raises a critical fall alert and starts a 20-second cooldown to avoid duplicate alerts.",
  },
  {
    docId: "ml-metrics",
    title: "Model Quality Metrics",
    category: "ml-operations",
    source: "ml/metrics.md",
    heading: "Precision, recall, F1",
    content:
      "The pipeline tracks precision, recall and F1 against clinician-adjudicated labels. Target operating point is recall above 0.95 for critical events (never miss a real emergency) while keeping the false-alarm rate under two per patient-day. Detector weights and the anomaly threshold are the primary levers for moving along the precision–recall trade-off.",
  },

  // ── System architecture ───────────────────────────────────────────────────
  {
    docId: "sa-overview",
    title: "System Architecture Overview",
    category: "system-architecture",
    source: "architecture/overview.md",
    heading: "End-to-end data flow",
    content:
      "ESP32 nodes publish telemetry over MQTT to a broker. A telemetry ingestion service subscribes, validates and writes frames to a time-series store, and streams them to the anomaly engine. Detected anomalies become alerts persisted in Postgres and pushed to clients over WebSockets/Realtime. The React dashboard subscribes to live streams and queries history via the REST API. A RAG service answers natural-language questions over the documentation corpus.",
  },
  {
    docId: "sa-transport",
    title: "MQTT & WebSocket Transport",
    category: "system-architecture",
    source: "architecture/transport.md",
    heading: "Topic hierarchy",
    content:
      "Telemetry uses the topic pattern healthguard/{deviceId}/telemetry, status uses healthguard/{deviceId}/status (retained) and alerts use healthguard/{deviceId}/alerts. Dashboards subscribe with wildcards: healthguard/+/telemetry for all devices or healthguard/# for everything. Commands to a device are published to healthguard/{deviceId}/cmd. The browser client can bridge to a real broker over secure WebSockets (wss).",
  },
  {
    docId: "sa-scale",
    title: "Scaling the Ingestion Tier",
    category: "system-architecture",
    source: "architecture/scaling.md",
    heading: "Horizontal scale",
    content:
      "The ingestion service is stateless and scales horizontally behind the broker's shared subscriptions, partitioning devices across workers. The anomaly engine keeps per-device state, so devices are consistently hashed to workers to keep a device's stream on one instance. Time-series writes are batched; alerts are written individually for low latency.",
  },

  // ── API reference ─────────────────────────────────────────────────────────
  {
    docId: "api-devices",
    title: "API — Devices & Telemetry",
    category: "api-reference",
    source: "api/devices.md",
    heading: "Endpoints",
    content:
      "GET /devices lists the fleet; GET /devices/{id} returns one device with its latest status. GET /devices/{id}/telemetry?since=... returns historical frames from the time-series store. GET /patients and GET /patients/{id} expose patient records including the personalised baseline. All list endpoints support cursor pagination and RLS scopes results to the caller's ward.",
  },
  {
    docId: "api-alerts",
    title: "API — Alerts",
    category: "api-reference",
    source: "api/alerts.md",
    heading: "Alert lifecycle",
    content:
      "GET /alerts returns alerts newest-first with severity and acknowledgement fields. POST /alerts/{id}/ack acknowledges an alert, recording the acting user and timestamp. Alerts are also delivered live over the WebSocket/Realtime channel so open dashboards update without polling. Acknowledged alerts remain in history for audit.",
  },
  {
    docId: "api-rag",
    title: "API — RAG Assistant",
    category: "api-reference",
    source: "api/rag.md",
    heading: "Query endpoint",
    content:
      "POST /assistant/query accepts a natural-language question and returns an answer with inline citations plus the retrieved passages and their similarity scores. Retrieval combines TF-IDF cosine similarity with keyword overlap; when an LLM endpoint is configured the top passages are used as grounded context, otherwise an extractive answer is synthesised from the highest-scoring passages.",
  },

  // ── Security & compliance ─────────────────────────────────────────────────
  {
    docId: "sec-rls",
    title: "Row-Level Security",
    category: "security-compliance",
    source: "security/rls.md",
    heading: "Data isolation",
    content:
      "Every table has row-level security enabled. Patient, device, telemetry and alert rows are scoped by ward and role using policies keyed on auth.uid(). Clinicians see patients in their assigned wards, caregivers see only their linked patient, and admins have full access. The anon key can never read patient data directly; privileged reads go through policies or edge functions.",
  },
  {
    docId: "sec-auth",
    title: "Authentication & Roles",
    category: "security-compliance",
    source: "security/auth.md",
    heading: "Role model",
    content:
      "Users authenticate with email and password and receive a scoped session. Roles are admin, clinician, caregiver and patient. The role gates both the UI (which pages and controls are visible) and the API (which rows and mutations are permitted). Sessions expire and must be refreshed; all mutations are audit-logged with the acting user.",
  },
  {
    docId: "sec-phi",
    title: "PHI Handling & Compliance",
    category: "security-compliance",
    source: "security/phi.md",
    heading: "Protected health information",
    content:
      "Protected health information is encrypted in transit (TLS/wss) and at rest. Only the minimum necessary fields are sent to the client. Secrets such as the service-role key and broker credentials never reach the browser bundle. Access to PHI is logged for audit, supporting HIPAA and GDPR obligations, and telemetry can be pseudonymised for analytics.",
  },
];

let tokenized = 0;

export const CORPUS: DocChunk[] = RAW.map((c, i) => {
  const tokens = c.content.split(/\s+/).length;
  tokenized += tokens;
  return {
    id: `chunk_${i + 1}`,
    docId: c.docId,
    title: c.title,
    category: c.category,
    source: c.source,
    heading: c.heading,
    content: c.content,
    tokens,
  };
});

export const CORPUS_TOKEN_COUNT = tokenized;

export const CATEGORY_LABELS: Record<DocCategory, string> = {
  "clinical-protocol": "Clinical Protocol",
  "device-manual": "Device Manual",
  "ml-operations": "ML Operations",
  "system-architecture": "System Architecture",
  "api-reference": "API Reference",
  "security-compliance": "Security & Compliance",
};

/**
 * Anomaly-detection engine.
 * ------------------------------------------------------------------
 * A per-device, per-metric ensemble that fuses three complementary detectors:
 *
 *   1. Welford z-score  — deviation from the long-run per-patient distribution.
 *   2. EWMA residual    — deviation from the short-term trend (catches drift &
 *                         sudden step changes the long-run mean smooths over).
 *   3. Clinical rules   — absolute physiological danger zones (NEWS2-style).
 *
 * A dedicated fall detector runs on the accelerometer's motion channel: a large
 * impact spike followed by a "stillness" window is the classic fall signature.
 *
 * Scores are fused with a weighted soft-max style combiner and hysteresis is
 * applied so a single noisy sample can't flap an alert on/off.
 */

import type {
  Alert,
  AnomalyScore,
  Severity,
  TelemetryFrame,
  VitalMetric,
} from "@/types";
import { uid } from "@/lib/utils";
import { Ewma, RingBuffer, RunningStats, logistic } from "./statistics";
import { CLINICAL_RULES, METRIC_LABELS, METRIC_UNITS, recommendationFor } from "./clinical";

const STAT_METRICS: VitalMetric[] = [
  "heartRate",
  "spo2",
  "temperature",
  "respiration",
  "systolic",
  "diastolic",
];

interface MetricState {
  running: RunningStats;
  ewma: Ewma;
  window: RingBuffer;
  consecutive: number; // hysteresis counter
  active: boolean; // currently in anomaly state
}

interface FallState {
  window: RingBuffer;
  impactTs: number | null;
  cooldownUntil: number;
}

export interface DetectionResult {
  frame: TelemetryFrame;
  scores: AnomalyScore[];
  alerts: Alert[];
  compositeScore: number;
}

const SEVERITY_RANK: Record<Severity, number> = { info: 0, warning: 1, critical: 2 };

export class AnomalyEngine {
  private metrics = new Map<string, Map<VitalMetric, MetricState>>();
  private falls = new Map<string, FallState>();

  // Detector fusion weights.
  private readonly weights = { zscore: 0.42, ewma: 0.33, clinical: 0.25 };
  // Number of consecutive anomalous samples required to raise/clear an alert.
  private readonly enterThreshold = 3;

  private stateFor(deviceId: string, metric: VitalMetric): MetricState {
    let byMetric = this.metrics.get(deviceId);
    if (!byMetric) {
      byMetric = new Map();
      this.metrics.set(deviceId, byMetric);
    }
    let state = byMetric.get(metric);
    if (!state) {
      state = {
        running: new RunningStats(),
        ewma: new Ewma(0.2),
        window: new RingBuffer(30),
        consecutive: 0,
        active: false,
      };
      byMetric.set(metric, state);
    }
    return state;
  }

  private fallState(deviceId: string): FallState {
    let s = this.falls.get(deviceId);
    if (!s) {
      s = { window: new RingBuffer(12), impactTs: null, cooldownUntil: 0 };
      this.falls.set(deviceId, s);
    }
    return s;
  }

  /** Warm the detectors with a patient's baseline so scoring is calibrated from t=0. */
  seedBaseline(deviceId: string, baseline: Partial<Record<VitalMetric, number>>): void {
    for (const metric of STAT_METRICS) {
      const base = baseline[metric];
      if (base === undefined) continue;
      const state = this.stateFor(deviceId, metric);
      // Prime with a handful of samples around the baseline to establish variance.
      const spread = Math.max(0.5, base * 0.02);
      for (let i = 0; i < 12; i++) {
        const v = base + Math.sin(i) * spread;
        state.running.push(v);
        state.ewma.update(v);
        state.window.push(v);
      }
    }
  }

  /** Ingest one telemetry frame → per-metric scores + any raised alerts. */
  process(frame: TelemetryFrame): DetectionResult {
    const scores: AnomalyScore[] = [];
    const alerts: Alert[] = [];

    for (const metric of STAT_METRICS) {
      const value = frame.metrics[metric];
      if (value === undefined || Number.isNaN(value)) continue;

      const state = this.stateFor(frame.deviceId, metric);
      const zStat = state.running.zScore(value);
      const zEwma = state.ewma.zScore(value);

      // Update estimators *after* scoring so the current sample doesn't mask itself.
      state.running.push(value);
      state.ewma.update(value);
      state.window.push(value);

      const clinical = CLINICAL_RULES[metric].evaluate(value);
      const clinicalScore = clinical
        ? clinical.severity === "critical"
          ? 1
          : 0.7
        : 0;

      const zComponent = logistic(zStat, 1.05, 3);
      const ewmaComponent = logistic(zEwma, 1.15, 3);
      const fused =
        this.weights.zscore * zComponent +
        this.weights.ewma * ewmaComponent +
        this.weights.clinical * clinicalScore;

      const isAnomaly = fused >= 0.5 || clinical?.severity === "critical";

      scores.push({
        metric,
        value,
        score: Number(fused.toFixed(3)),
        zScore: Number(zStat.toFixed(2)),
        detector: "ensemble",
        isAnomaly,
      });

      // Hysteresis — require sustained anomaly before raising an alert.
      if (isAnomaly) {
        state.consecutive++;
      } else {
        state.consecutive = Math.max(0, state.consecutive - 1);
      }

      const shouldAlert =
        (state.consecutive >= this.enterThreshold || clinical?.severity === "critical") &&
        !state.active;

      if (shouldAlert) {
        state.active = true;
        const severity = this.severityFrom(fused, clinical?.severity);
        alerts.push(
          this.buildAlert(frame, metric, value, fused, severity, clinical?.note),
        );
      } else if (state.active && state.consecutive === 0) {
        state.active = false; // recovered
      }
    }

    // Fall detection on the motion channel.
    const fallAlert = this.detectFall(frame);
    if (fallAlert) alerts.push(fallAlert);

    const compositeScore = scores.length
      ? Number(
          (
            scores.reduce((a, s) => a + s.score, 0) / scores.length +
            0.15 * scores.filter((s) => s.isAnomaly).length
          ).toFixed(3),
        )
      : 0;

    return { frame, scores, alerts, compositeScore: Math.min(1, compositeScore) };
  }

  private detectFall(frame: TelemetryFrame): Alert | null {
    const motion = frame.metrics.motion;
    if (motion === undefined) return null;
    const s = this.fallState(frame.deviceId);
    s.window.push(motion);

    if (frame.ts < s.cooldownUntil) return null;

    // Stage 1: detect a high-impact spike (>3g).
    if (motion >= 3.0 && s.impactTs === null) {
      s.impactTs = frame.ts;
      return null;
    }

    // Stage 2: within 6s of an impact, look for a stillness window (near-zero motion).
    if (s.impactTs !== null) {
      const sinceImpact = frame.ts - s.impactTs;
      if (sinceImpact > 6000) {
        s.impactTs = null; // no stillness followed — likely just active movement
        return null;
      }
      if (sinceImpact >= 1500 && s.window.full && s.window.mean() < 0.35) {
        s.impactTs = null;
        s.cooldownUntil = frame.ts + 20000;
        return {
          id: uid("alert"),
          deviceId: frame.deviceId,
          patientId: frame.patientId,
          ts: frame.ts,
          severity: "critical",
          metric: "motion",
          title: "Fall detected",
          description:
            "Accelerometer registered a high-impact spike followed by post-fall stillness.",
          value: Number(motion.toFixed(2)),
          detector: "fall",
          score: 0.98,
          acknowledged: false,
          recommendation: recommendationFor("motion", "critical"),
        };
      }
    }
    return null;
  }

  private severityFrom(fused: number, clinical?: Severity): Severity {
    let s: Severity = "info";
    if (fused >= 0.82) s = "critical";
    else if (fused >= 0.5) s = "warning";
    if (clinical && SEVERITY_RANK[clinical] > SEVERITY_RANK[s]) s = clinical;
    return s;
  }

  private buildAlert(
    frame: TelemetryFrame,
    metric: VitalMetric,
    value: number,
    fused: number,
    severity: Severity,
    note?: string,
  ): Alert {
    const label = METRIC_LABELS[metric];
    const unit = METRIC_UNITS[metric];
    const title = note ?? `${label} anomaly`;
    return {
      id: uid("alert"),
      deviceId: frame.deviceId,
      patientId: frame.patientId,
      ts: frame.ts,
      severity,
      metric,
      title,
      description: `${label} reading of ${value.toFixed(1)} ${unit} deviates from the patient's monitored range (ensemble score ${(
        fused * 100
      ).toFixed(0)}%).`,
      value: Number(value.toFixed(1)),
      detector: "ensemble",
      score: Number(fused.toFixed(3)),
      acknowledged: false,
      recommendation: recommendationFor(metric, severity),
    };
  }

  reset(deviceId?: string): void {
    if (deviceId) {
      this.metrics.delete(deviceId);
      this.falls.delete(deviceId);
    } else {
      this.metrics.clear();
      this.falls.clear();
    }
  }
}

export const anomalyEngine = new AnomalyEngine();

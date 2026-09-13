/**
 * Anomaly-detection engine.
 * ------------------------------------------------------------------
 * A per-device ensemble that fuses four complementary detectors:
 *
 *   1. Welford z-score  — deviation from the long-run per-patient distribution.
 *   2. EWMA residual    — deviation from the short-term trend (catches drift &
 *                         sudden step changes the long-run mean smooths over).
 *   3. Clinical rules   — absolute physiological danger zones (NEWS2-style).
 *   4. Isolation Forest — an unsupervised multivariate detector over the
 *                         standardised vital vector that catches patterns where
 *                         several vitals drift together (which per-metric
 *                         detectors, looking one channel at a time, can miss).
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
import { IsolationForest, type Vector } from "./isolationForest";
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

interface IsoState {
  forest: IsolationForest;
  buffer: Vector[]; // rolling window of standardised vital vectors
  sinceFit: number;
  consecutive: number;
  active: boolean;
}

export interface DetectionResult {
  frame: TelemetryFrame;
  scores: AnomalyScore[];
  alerts: Alert[];
  compositeScore: number;
  /** Multivariate Isolation Forest anomaly score for this frame (0..1). */
  isoScore: number;
}

const SEVERITY_RANK: Record<Severity, number> = { info: 0, warning: 1, critical: 2 };

// Isolation-Forest tuning.
const ISO_WINDOW = 200; // normal vectors retained for (re)training
const ISO_MIN_TRAIN = 24; // start scoring once we have this many samples
const ISO_REFIT_EVERY = 5; // frames between re-fits
const ISO_ALERT_THRESHOLD = 0.6; // score to consider raising a multivariate alert
const ISO_CLEAR_THRESHOLD = 0.55; // score below which the state recovers
const ISO_MIN_TOP_Z = 1.8; // a genuinely deviating channel must accompany the score
// Frames that look clearly abnormal are kept OUT of the training window so the
// reference distribution stays "normal" and sustained events remain isolated.
const ISO_TRAIN_MAX_Z = 1.6;

export class AnomalyEngine {
  private metrics = new Map<string, Map<VitalMetric, MetricState>>();
  private falls = new Map<string, FallState>();
  private isos = new Map<string, IsoState>();

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

  private isoState(deviceId: string): IsoState {
    let s = this.isos.get(deviceId);
    if (!s) {
      s = {
        forest: new IsolationForest(80, 48),
        buffer: [],
        sinceFit: 0,
        consecutive: 0,
        active: false,
      };
      this.isos.set(deviceId, s);
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
    const zByMetric = new Map<VitalMetric, number>();

    for (const metric of STAT_METRICS) {
      const value = frame.metrics[metric];
      if (value === undefined || Number.isNaN(value)) continue;

      const state = this.stateFor(frame.deviceId, metric);
      const zStat = state.running.zScore(value);
      const zEwma = state.ewma.zScore(value);
      zByMetric.set(metric, zStat);

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

    // Multivariate Isolation Forest over the standardised vital vector.
    const iso = this.scoreIsolationForest(frame.deviceId, zByMetric);
    const isoAlert = this.evaluateIsoForest(frame, iso);
    if (isoAlert) alerts.push(isoAlert);

    // Fall detection on the motion channel.
    const fallAlert = this.detectFall(frame);
    if (fallAlert) alerts.push(fallAlert);

    const perMetricComposite = scores.length
      ? scores.reduce((a, s) => a + s.score, 0) / scores.length +
        0.15 * scores.filter((s) => s.isAnomaly).length
      : 0;
    // The Isolation Forest only lifts the composite once it is clearly anomalous,
    // so a calm patient keeps a low baseline risk index.
    const isoExcess = Math.max(0, iso.score - ISO_CLEAR_THRESHOLD) * 2;
    const compositeScore = Number(
      Math.min(1, perMetricComposite + 0.3 * isoExcess).toFixed(3),
    );

    return {
      frame,
      scores,
      alerts,
      compositeScore,
      isoScore: Number(iso.score.toFixed(3)),
    };
  }

  /** Update the per-device rolling window, (re)fit the forest and score the frame. */
  private scoreIsolationForest(
    deviceId: string,
    zByMetric: Map<VitalMetric, number>,
  ): { score: number; topMetric: VitalMetric; topAbsZ: number } {
    const s = this.isoState(deviceId);
    const vector: Vector = STAT_METRICS.map((m) => zByMetric.get(m) ?? 0);

    // Dominant contributing channel = largest absolute standardised deviation.
    let topMetric: VitalMetric = "heartRate";
    let maxAbs = 0;
    for (const [metric, z] of zByMetric) {
      if (Math.abs(z) > maxAbs) {
        maxAbs = Math.abs(z);
        topMetric = metric;
      }
    }

    // Only learn from frames that look normal (or during warm-up) so a sustained
    // event doesn't quietly become the new baseline.
    const warmingUp = s.buffer.length < ISO_MIN_TRAIN;
    if (warmingUp || maxAbs < ISO_TRAIN_MAX_Z) {
      s.buffer.push(vector);
      if (s.buffer.length > ISO_WINDOW) s.buffer.shift();
    }
    s.sinceFit++;

    if (s.buffer.length >= ISO_MIN_TRAIN && (!s.forest.fitted || s.sinceFit >= ISO_REFIT_EVERY)) {
      s.forest.fit(s.buffer);
      s.sinceFit = 0;
    }

    const score = s.forest.fitted ? s.forest.score(vector) : 0;
    return { score, topMetric, topAbsZ: maxAbs };
  }

  private evaluateIsoForest(
    frame: TelemetryFrame,
    iso: { score: number; topMetric: VitalMetric; topAbsZ: number },
  ): Alert | null {
    const s = this.isoState(frame.deviceId);

    // Require both a high isolation score *and* a genuinely deviating channel so
    // pure sensor noise can't raise a multivariate alert.
    if (iso.score >= ISO_ALERT_THRESHOLD && iso.topAbsZ >= ISO_MIN_TOP_Z) s.consecutive++;
    else s.consecutive = Math.max(0, s.consecutive - 1);

    if (s.active && iso.score < ISO_CLEAR_THRESHOLD) {
      s.active = false; // recovered
    }

    if (s.consecutive >= this.enterThreshold && !s.active) {
      s.active = true;
      const severity: Severity = iso.score >= 0.72 ? "critical" : "warning";
      const label = METRIC_LABELS[iso.topMetric];
      return {
        id: uid("alert"),
        deviceId: frame.deviceId,
        patientId: frame.patientId,
        ts: frame.ts,
        severity,
        metric: "composite",
        title: "Multivariate anomaly detected",
        description: `Isolation Forest isolated a joint deviation across vitals (score ${(
          iso.score * 100
        ).toFixed(0)}%). Dominant channel: ${label}.`,
        value: Number(iso.score.toFixed(3)),
        detector: "iforest",
        score: Number(iso.score.toFixed(3)),
        acknowledged: false,
        recommendation: recommendationFor(iso.topMetric, severity),
      };
    }
    return null;
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
      this.isos.delete(deviceId);
    } else {
      this.metrics.clear();
      this.falls.clear();
      this.isos.clear();
    }
  }
}

export const anomalyEngine = new AnomalyEngine();

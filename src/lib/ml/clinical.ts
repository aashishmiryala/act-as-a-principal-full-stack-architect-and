/**
 * Clinical decision rules (early-warning-score style).
 * ------------------------------------------------------------------
 * Complements the statistical detectors with fixed physiological thresholds
 * derived from NEWS2 / standard adult vital-sign ranges. Statistical detectors
 * catch *deviation from a patient's own baseline*; clinical rules catch
 * *absolute danger zones* regardless of baseline.
 */

import type { Severity, VitalMetric } from "@/types";

export interface ClinicalRule {
  metric: VitalMetric;
  label: string;
  unit: string;
  normal: [number, number];
  evaluate: (value: number) => { severity: Severity; note: string } | null;
}

const none = null;

export const CLINICAL_RULES: Record<VitalMetric, ClinicalRule> = {
  heartRate: {
    metric: "heartRate",
    label: "Heart Rate",
    unit: "bpm",
    normal: [60, 100],
    evaluate: (v) => {
      if (v >= 131) return { severity: "critical", note: "Severe tachycardia" };
      if (v >= 111) return { severity: "warning", note: "Tachycardia" };
      if (v <= 40) return { severity: "critical", note: "Severe bradycardia" };
      if (v <= 50) return { severity: "warning", note: "Bradycardia" };
      return none;
    },
  },
  spo2: {
    metric: "spo2",
    label: "SpO₂",
    unit: "%",
    normal: [95, 100],
    evaluate: (v) => {
      if (v <= 88) return { severity: "critical", note: "Severe hypoxemia" };
      if (v <= 92) return { severity: "warning", note: "Hypoxemia" };
      return none;
    },
  },
  temperature: {
    metric: "temperature",
    label: "Temperature",
    unit: "°C",
    normal: [36.1, 37.5],
    evaluate: (v) => {
      if (v >= 39.5) return { severity: "critical", note: "High-grade fever" };
      if (v >= 38.0) return { severity: "warning", note: "Fever" };
      if (v <= 35.0) return { severity: "critical", note: "Hypothermia" };
      if (v <= 35.9) return { severity: "warning", note: "Low body temperature" };
      return none;
    },
  },
  respiration: {
    metric: "respiration",
    label: "Respiration",
    unit: "rpm",
    normal: [12, 20],
    evaluate: (v) => {
      if (v >= 25) return { severity: "critical", note: "Severe tachypnea" };
      if (v >= 21) return { severity: "warning", note: "Tachypnea" };
      if (v <= 8) return { severity: "critical", note: "Bradypnea" };
      if (v <= 11) return { severity: "warning", note: "Low respiration rate" };
      return none;
    },
  },
  systolic: {
    metric: "systolic",
    label: "Systolic BP",
    unit: "mmHg",
    normal: [90, 130],
    evaluate: (v) => {
      if (v >= 180) return { severity: "critical", note: "Hypertensive crisis" };
      if (v >= 140) return { severity: "warning", note: "Stage-2 hypertension" };
      if (v <= 80) return { severity: "critical", note: "Severe hypotension" };
      if (v <= 90) return { severity: "warning", note: "Hypotension" };
      return none;
    },
  },
  diastolic: {
    metric: "diastolic",
    label: "Diastolic BP",
    unit: "mmHg",
    normal: [60, 85],
    evaluate: (v) => {
      if (v >= 120) return { severity: "critical", note: "Hypertensive crisis" };
      if (v >= 90) return { severity: "warning", note: "Diastolic hypertension" };
      if (v <= 45) return { severity: "warning", note: "Low diastolic pressure" };
      return none;
    },
  },
  motion: {
    metric: "motion",
    label: "Motion Index",
    unit: "g",
    normal: [0, 2.2],
    evaluate: (v) => {
      // A sharp accelerometer spike followed by stillness is handled by the
      // dedicated fall detector; this rule flags raw impact magnitude.
      if (v >= 3.2) return { severity: "critical", note: "High-impact event detected" };
      return none;
    },
  },
};

export const METRIC_LABELS: Record<VitalMetric, string> = {
  heartRate: "Heart Rate",
  spo2: "SpO₂",
  temperature: "Temperature",
  respiration: "Respiration",
  systolic: "Systolic BP",
  diastolic: "Diastolic BP",
  motion: "Motion",
};

export const METRIC_UNITS: Record<VitalMetric, string> = {
  heartRate: "bpm",
  spo2: "%",
  temperature: "°C",
  respiration: "rpm",
  systolic: "mmHg",
  diastolic: "mmHg",
  motion: "g",
};

export function recommendationFor(
  metric: VitalMetric | "composite",
  severity: Severity,
): string {
  if (severity === "critical") {
    switch (metric) {
      case "heartRate":
        return "Initiate cardiac monitoring, obtain 12-lead ECG and notify rapid-response team.";
      case "spo2":
        return "Apply supplemental oxygen, verify probe placement and escalate to attending clinician.";
      case "temperature":
        return "Begin active cooling/warming per protocol and evaluate for sepsis.";
      case "respiration":
        return "Assess airway/breathing, consider assisted ventilation and call for support.";
      case "systolic":
      case "diastolic":
        return "Recheck BP, review medications and escalate for possible cardiovascular event.";
      case "motion":
        return "Possible fall — dispatch bedside check immediately and assess for injury.";
      default:
        return "Multiple concurrent anomalies — perform full clinical reassessment now.";
    }
  }
  if (severity === "warning") {
    return "Increase monitoring frequency, document trend and reassess within 15 minutes.";
  }
  return "Continue routine monitoring.";
}

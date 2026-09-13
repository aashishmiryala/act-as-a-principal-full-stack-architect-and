/**
 * Physiological signal synthesiser.
 * ------------------------------------------------------------------
 * Generates realistic vital-sign waveforms for the ESP32 emulator: each metric
 * follows a slow circadian/behavioural drift, correlated cross-effects (e.g.
 * exertion raises HR + respiration and lowers SpO₂ slightly), and sensor noise
 * consistent with the real modules named in the device manifest (MAX30102,
 * MLX90614, MPU-6050, …). Scenario injection layers pathological events on top.
 */

import type { VitalBaseline, VitalMetric } from "@/types";
import { clamp, gaussian, mulberry32 } from "@/lib/utils";

export type ScenarioKind =
  | "healthy"
  | "tachycardia"
  | "bradycardia"
  | "hypoxemia"
  | "fever"
  | "hypertension"
  | "respiratory-distress"
  | "fall";

export interface Scenario {
  kind: ScenarioKind;
  label: string;
  description: string;
}

export const SCENARIOS: Scenario[] = [
  { kind: "healthy", label: "Healthy / stable", description: "Vitals within personalised baseline." },
  { kind: "tachycardia", label: "Tachycardia", description: "Sustained elevated heart rate." },
  { kind: "bradycardia", label: "Bradycardia", description: "Abnormally low heart rate." },
  { kind: "hypoxemia", label: "Hypoxemia", description: "Falling blood-oxygen saturation." },
  { kind: "fever", label: "Fever", description: "Rising core body temperature." },
  { kind: "hypertension", label: "Hypertensive episode", description: "Elevated blood pressure." },
  {
    kind: "respiratory-distress",
    label: "Respiratory distress",
    description: "Tachypnea with desaturation.",
  },
  { kind: "fall", label: "Fall event", description: "Impact spike then post-fall stillness." },
];

export interface SensorSample {
  metrics: Record<VitalMetric, number>;
}

/**
 * Stateful per-device signal source. `tick()` advances the internal phase and
 * returns the next multi-metric sample.
 */
export class SignalSource {
  private t = 0; // seconds of simulated time
  private rand: () => number;
  private scenario: ScenarioKind = "healthy";
  private scenarioProgress = 0; // 0..1 ramp so events emerge gradually
  private fallPhase: "idle" | "impact" | "still" = "idle";
  private fallTimer = 0;

  // Slow-varying latent activity level (0 = rest, 1 = exertion).
  private activity = 0.15;

  constructor(
    private readonly baseline: VitalBaseline,
    seed: number,
  ) {
    this.rand = mulberry32(seed);
  }

  setScenario(kind: ScenarioKind): void {
    if (kind === this.scenario) return;
    this.scenario = kind;
    this.scenarioProgress = 0;
    if (kind === "fall") {
      this.fallPhase = "impact";
      this.fallTimer = 0;
    }
  }

  get currentScenario(): ScenarioKind {
    return this.scenario;
  }

  tick(dtSec: number): SensorSample {
    this.t += dtSec;

    // Smooth ramp of scenario intensity.
    if (this.scenario !== "healthy" && this.scenarioProgress < 1) {
      this.scenarioProgress = clamp(this.scenarioProgress + dtSec / 12, 0, 1);
    }

    // Random-walk the latent activity level, with a gentle circadian bias.
    const circadian = 0.15 + 0.1 * Math.sin((this.t / 86400) * 2 * Math.PI);
    this.activity = clamp(
      this.activity + gaussian(this.rand, 0, 0.03) + (circadian - this.activity) * 0.01,
      0,
      1,
    );

    const b = this.baseline;
    const p = this.scenarioProgress;

    // Baseline oscillations (respiratory sinus arrhythmia etc.).
    const hrOsc = 2.2 * Math.sin((this.t / 4) * 2 * Math.PI);
    const exertion = this.activity;

    let heartRate = b.heartRate + hrOsc + exertion * 22 + gaussian(this.rand, 0, 1.3);
    let spo2 = b.spo2 - exertion * 1.2 + gaussian(this.rand, 0, 0.3);
    let temperature = b.temperature + 0.15 * Math.sin((this.t / 3600) * 2 * Math.PI) + gaussian(this.rand, 0, 0.03);
    let respiration = b.respiration + exertion * 6 + 1.1 * Math.sin((this.t / 5) * 2 * Math.PI) + gaussian(this.rand, 0, 0.5);
    let systolic = b.systolic + exertion * 12 + gaussian(this.rand, 0, 2.2);
    let diastolic = b.diastolic + exertion * 6 + gaussian(this.rand, 0, 1.6);
    let motion = this.baselineMotion(exertion);

    // Layer the active scenario on top.
    switch (this.scenario) {
      case "tachycardia":
        heartRate += 45 * p;
        respiration += 5 * p;
        break;
      case "bradycardia":
        heartRate -= 28 * p;
        break;
      case "hypoxemia":
        spo2 -= 12 * p;
        heartRate += 12 * p;
        break;
      case "fever":
        temperature += 2.6 * p;
        heartRate += 14 * p;
        respiration += 3 * p;
        break;
      case "hypertension":
        systolic += 55 * p;
        diastolic += 28 * p;
        heartRate += 8 * p;
        break;
      case "respiratory-distress":
        respiration += 14 * p;
        spo2 -= 8 * p;
        heartRate += 18 * p;
        break;
      case "fall":
        motion = this.tickFall(dtSec);
        break;
      case "healthy":
      default:
        break;
    }

    return {
      metrics: {
        heartRate: clamp(heartRate, 25, 220),
        spo2: clamp(spo2, 60, 100),
        temperature: clamp(temperature, 33, 42.5),
        respiration: clamp(respiration, 4, 45),
        systolic: clamp(systolic, 60, 250),
        diastolic: clamp(diastolic, 35, 150),
        motion: clamp(motion, 0, 6),
      },
    };
  }

  private baselineMotion(exertion: number): number {
    // Resting jitter around 1g gravity vector with occasional small movements.
    const base = 1.0 + exertion * 0.4;
    const twitch = this.rand() < 0.04 ? this.rand() * 1.2 : 0;
    return base + Math.abs(gaussian(this.rand, 0, 0.12)) + twitch;
  }

  private tickFall(dtSec: number): number {
    this.fallTimer += dtSec;
    if (this.fallPhase === "impact") {
      if (this.fallTimer < 0.8) return 3.4 + this.rand() * 1.6; // impact spike
      this.fallPhase = "still";
      this.fallTimer = 0;
    }
    if (this.fallPhase === "still") {
      if (this.fallTimer < 8) return 0.1 + Math.abs(gaussian(this.rand, 0, 0.04)); // stillness
      this.fallPhase = "idle";
      this.scenario = "healthy";
    }
    return this.baselineMotion(this.activity);
  }
}

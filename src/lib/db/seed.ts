/**
 * Seed dataset — patients and their ESP32 monitoring nodes.
 * ------------------------------------------------------------------
 * Mirrors what would be returned by `GET /patients` and `GET /devices` from the
 * PostgREST API. The `baseline` on each patient personalises the ML detectors.
 */

import type { Device, Patient, VitalBaseline } from "@/types";

interface SeedPair {
  patient: Patient;
  device: Device;
}

const WARDS = ["Cardiology", "Pulmonology", "ICU", "Geriatrics", "Neurology"];

function baseline(partial: Partial<VitalBaseline>): VitalBaseline {
  return {
    heartRate: 74,
    spo2: 98,
    temperature: 36.8,
    respiration: 16,
    systolic: 118,
    diastolic: 76,
    ...partial,
  };
}

const SENSORS: Device["sensors"] = [
  { kind: "heartRate", model: "MAX30102", unit: "bpm" },
  { kind: "spo2", model: "MAX30102", unit: "%" },
  { kind: "temperature", model: "MLX90614", unit: "°C" },
  { kind: "respiration", model: "Impedance-Pneumograph", unit: "rpm" },
  { kind: "systolic", model: "Oscillometric-BP", unit: "mmHg" },
  { kind: "diastolic", model: "Oscillometric-BP", unit: "mmHg" },
  { kind: "motion", model: "MPU-6050", unit: "g" },
];

const PEOPLE: Array<{
  name: string;
  sex: Patient["sex"];
  dob: string;
  condition: string;
  ward: string;
  base: Partial<VitalBaseline>;
}> = [
  { name: "Eleanor Whitfield", sex: "female", dob: "1948-03-11", condition: "Post-MI recovery", ward: "Cardiology", base: { heartRate: 78, systolic: 132, diastolic: 82 } },
  { name: "Marcus Delgado", sex: "male", dob: "1971-07-22", condition: "COPD exacerbation", ward: "Pulmonology", base: { spo2: 94, respiration: 19, heartRate: 82 } },
  { name: "Aiko Tanaka", sex: "female", dob: "1990-12-02", condition: "Post-operative monitoring", ward: "ICU", base: { heartRate: 72, temperature: 37.0 } },
  { name: "Samuel Osei", sex: "male", dob: "1955-09-14", condition: "Hypertension stage II", ward: "Cardiology", base: { systolic: 138, diastolic: 88, heartRate: 76 } },
  { name: "Priya Nair", sex: "female", dob: "1983-05-30", condition: "Sepsis watch", ward: "ICU", base: { temperature: 37.4, heartRate: 88, respiration: 18 } },
  { name: "Henry Fischer", sex: "male", dob: "1939-01-19", condition: "Fall-risk / frailty", ward: "Geriatrics", base: { heartRate: 70, systolic: 128 } },
  { name: "Sofia Romano", sex: "female", dob: "1976-11-08", condition: "Arrhythmia observation", ward: "Cardiology", base: { heartRate: 80 } },
  { name: "Liam O'Connor", sex: "male", dob: "2001-04-25", condition: "Asthma monitoring", ward: "Pulmonology", base: { spo2: 96, respiration: 17 } },
  { name: "Grace Mbeki", sex: "female", dob: "1962-08-17", condition: "Stroke rehabilitation", ward: "Neurology", base: { systolic: 134, heartRate: 74 } },
  { name: "Tomasz Kowalski", sex: "male", dob: "1958-02-03", condition: "Heart-failure NYHA III", ward: "Cardiology", base: { heartRate: 84, respiration: 18, spo2: 95 } },
  { name: "Fatima Zahra", sex: "female", dob: "1994-06-21", condition: "Post-partum monitoring", ward: "ICU", base: { heartRate: 78 } },
  { name: "David Chen", sex: "male", dob: "1945-10-30", condition: "Pneumonia recovery", ward: "Pulmonology", base: { spo2: 93, temperature: 37.2, respiration: 20 } },
];

function makeIp(i: number): string {
  return `10.20.${Math.floor(i / 250)}.${(i % 250) + 2}`;
}

function makeDeviceId(i: number): string {
  const hex = (0xa100 + i * 7).toString(16);
  return `esp32-${hex}`;
}

export function buildSeed(): SeedPair[] {
  const now = Date.now();
  return PEOPLE.map((p, i) => {
    const patientId = `pat_${(i + 1).toString().padStart(3, "0")}`;
    const wardIndex = WARDS.indexOf(p.ward);
    const patient: Patient = {
      id: patientId,
      mrn: `MRN-${(480127 + i * 31).toString()}`,
      fullName: p.name,
      sex: p.sex,
      dateOfBirth: p.dob,
      room: `${wardIndex + 2}${String.fromCharCode(65 + (i % 6))}`,
      ward: p.ward,
      condition: p.condition,
      admittedAt: now - (i + 1) * 3600_000 * (6 + (i % 12)),
      baseline: baseline(p.base),
    };

    const device: Device = {
      id: i === 0 ? "esp32-simulated-01" : makeDeviceId(i),
      name: i === 0 ? "ESP32-SIMULATED-01" : `HealthGuard Node ${String.fromCharCode(65 + i)}`,
      patientId,
      firmware: "hg-fw 2.4.1",
      hardware: "ESP32-WROOM-32",
      status: "online",
      batteryPct: 60 + ((i * 13) % 40),
      rssi: -48 - ((i * 7) % 30),
      ipAddress: makeIp(i),
      sampleRateHz: 1,
      sensors: SENSORS,
      lastSeen: now,
      uptimeSec: 3600 * (4 + (i % 20)),
      location: {
        lat: 37.7749 + (i % 5) * 0.0012,
        lng: -122.4194 + Math.floor(i / 5) * 0.0015,
        label: `${p.ward} · Room ${wardIndex + 2}${String.fromCharCode(65 + (i % 6))}`,
      },
      baseline: patient.baseline,
    };

    return { patient, device };
  });
}

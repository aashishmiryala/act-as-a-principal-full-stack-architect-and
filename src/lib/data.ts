export type Trend = 'up' | 'down' | 'stable'

export interface Vital {
  id: string
  label: string
  value: number
  unit: string
  min: number
  max: number
  trend: Trend
  history: number[]
  status: 'normal' | 'watch' | 'critical'
  icon: string
}

export interface Device {
  id: string
  name: string
  type: string
  battery: number
  signal: number
  online: boolean
  firmware: string
  lastSync: string
}

export interface Alert {
  id: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
  time: string
  patient: string
}

export interface Patient {
  id: string
  name: string
  age: number
  room: string
  risk: number
  hr: number
  spo2: number
  status: 'stable' | 'monitor' | 'urgent'
}

function series(base: number, spread: number, n = 32): number[] {
  const out: number[] = []
  let v = base
  for (let i = 0; i < n; i++) {
    v += (Math.random() - 0.5) * spread
    v = Math.max(base - spread * 2, Math.min(base + spread * 2, v))
    out.push(Math.round(v * 10) / 10)
  }
  return out
}

export const vitals: Vital[] = [
  {
    id: 'hr',
    label: 'Heart Rate',
    value: 78,
    unit: 'bpm',
    min: 60,
    max: 100,
    trend: 'stable',
    history: series(78, 6),
    status: 'normal',
    icon: 'heart',
  },
  {
    id: 'spo2',
    label: 'Blood Oxygen',
    value: 97,
    unit: '%',
    min: 95,
    max: 100,
    trend: 'stable',
    history: series(97, 1.2),
    status: 'normal',
    icon: 'droplet',
  },
  {
    id: 'temp',
    label: 'Body Temp',
    value: 37.6,
    unit: '°C',
    min: 36.1,
    max: 37.2,
    trend: 'up',
    history: series(37.4, 0.4),
    status: 'watch',
    icon: 'thermometer',
  },
  {
    id: 'bp',
    label: 'Systolic BP',
    value: 142,
    unit: 'mmHg',
    min: 90,
    max: 120,
    trend: 'up',
    history: series(138, 6),
    status: 'critical',
    icon: 'activity',
  },
]

export const devices: Device[] = [
  { id: 'd1', name: 'Wristband A2', type: 'Wearable ECG', battery: 82, signal: 94, online: true, firmware: '3.4.1', lastSync: '12s ago' },
  { id: 'd2', name: 'Pulse Oximeter', type: 'SpO₂ Sensor', battery: 61, signal: 88, online: true, firmware: '2.1.0', lastSync: '4s ago' },
  { id: 'd3', name: 'Smart Scale', type: 'Body Composition', battery: 45, signal: 72, online: true, firmware: '1.9.7', lastSync: '2m ago' },
  { id: 'd4', name: 'Bedside Hub', type: 'Edge Gateway', battery: 100, signal: 99, online: true, firmware: '5.0.2', lastSync: '1s ago' },
  { id: 'd5', name: 'Glucose Patch', type: 'CGM Sensor', battery: 18, signal: 64, online: false, firmware: '1.2.3', lastSync: '38m ago' },
]

export const alerts: Alert[] = [
  { id: 'a1', severity: 'critical', title: 'Elevated blood pressure', detail: 'Systolic BP crossed 140 mmHg for 3 consecutive readings.', time: '2 min ago', patient: 'E. Whitmore' },
  { id: 'a2', severity: 'warning', title: 'Temperature rising', detail: 'Core temperature trending upward — 37.6 °C.', time: '9 min ago', patient: 'E. Whitmore' },
  { id: 'a3', severity: 'warning', title: 'Low sensor battery', detail: 'Glucose patch battery at 18%. Schedule replacement.', time: '22 min ago', patient: 'System' },
  { id: 'a4', severity: 'info', title: 'AI model retrained', detail: 'Anomaly detector v12 deployed to edge gateway.', time: '1 hr ago', patient: 'System' },
]

export const patients: Patient[] = [
  { id: 'p1', name: 'Eleanor Whitmore', age: 68, room: 'ICU-04', risk: 82, hr: 78, spo2: 97, status: 'urgent' },
  { id: 'p2', name: 'Marcus Chen', age: 54, room: 'CCU-11', risk: 47, hr: 71, spo2: 98, status: 'monitor' },
  { id: 'p3', name: 'Priya Nair', age: 39, room: 'GEN-22', risk: 19, hr: 66, spo2: 99, status: 'stable' },
  { id: 'p4', name: 'David Okonkwo', age: 61, room: 'CCU-08', risk: 55, hr: 84, spo2: 96, status: 'monitor' },
]

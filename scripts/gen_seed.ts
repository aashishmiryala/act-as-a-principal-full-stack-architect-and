import { buildSeed } from "../src/lib/db/seed.ts";
import { CORPUS } from "../src/lib/rag/corpus.ts";

function q(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function json(v: unknown): string {
  return "'" + JSON.stringify(v).replace(/'/g, "''") + "'::jsonb";
}
function tsms(ms: number): string {
  return `to_timestamp(${Math.floor(ms)}::double precision / 1000)`;
}

const lines: string[] = [];
const pairs = buildSeed();

lines.push("-- patients");
for (const { patient: p } of pairs) {
  lines.push(
    `insert into public.patients (id, mrn, full_name, sex, date_of_birth, room, ward, condition, admitted_at, baseline) values (` +
      [q(p.id), q(p.mrn), q(p.fullName), q(p.sex), q(p.dateOfBirth), q(p.room), q(p.ward), q(p.condition), tsms(p.admittedAt), json(p.baseline)].join(", ") +
      `) on conflict (id) do update set mrn=excluded.mrn, full_name=excluded.full_name, sex=excluded.sex, date_of_birth=excluded.date_of_birth, room=excluded.room, ward=excluded.ward, condition=excluded.condition, admitted_at=excluded.admitted_at, baseline=excluded.baseline;`,
  );
}

lines.push("-- devices");
for (const { device: d } of pairs) {
  lines.push(
    `insert into public.devices (id, name, patient_id, firmware, hardware, status, battery_pct, rssi, ip_address, sample_rate_hz, sensors, location, last_seen, uptime_sec) values (` +
      [
        q(d.id), q(d.name), q(d.patientId), q(d.firmware), q(d.hardware), q(d.status),
        d.batteryPct, d.rssi, q(d.ipAddress), d.sampleRateHz, json(d.sensors), json(d.location),
        tsms(d.lastSeen), d.uptimeSec,
      ].join(", ") +
      `) on conflict (id) do update set name=excluded.name, patient_id=excluded.patient_id, firmware=excluded.firmware, hardware=excluded.hardware, status=excluded.status, battery_pct=excluded.battery_pct, rssi=excluded.rssi, ip_address=excluded.ip_address, sample_rate_hz=excluded.sample_rate_hz, sensors=excluded.sensors, location=excluded.location, last_seen=excluded.last_seen, uptime_sec=excluded.uptime_sec;`,
  );
}

lines.push("-- doc_chunks");
for (const c of CORPUS) {
  lines.push(
    `insert into public.doc_chunks (id, doc_id, title, category, source, heading, content, tokens) values (` +
      [q(c.id), q(c.docId), q(c.title), q(c.category), q(c.source), q(c.heading), q(c.content), c.tokens].join(", ") +
      `) on conflict (id) do update set doc_id=excluded.doc_id, title=excluded.title, category=excluded.category, source=excluded.source, heading=excluded.heading, content=excluded.content, tokens=excluded.tokens;`,
  );
}

console.log(lines.join("\n"));

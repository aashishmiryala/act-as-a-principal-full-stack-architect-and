import {
  Bot,
  BrainCircuit,
  Cpu,
  Database,
  Network,
  Radio,
  Server,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Badge";
import { Topics } from "@/lib/mqtt/broker";

const PIPELINE = [
  {
    icon: Cpu,
    title: "ESP32 Edge Nodes",
    color: "text-brand-300",
    desc: "MAX30102, MLX90614, MPU-6050 & BP cuff sampled by firmware at 1 Hz. Compact JSON telemetry published over MQTT with QoS 0; retained status every 5 s.",
    tags: ["ESP32-WROOM-32", "MQTT", "OTA"],
  },
  {
    icon: Radio,
    title: "MQTT / WebSocket Bus",
    color: "text-emerald-300",
    desc: "Hierarchical topics with +/# wildcards, retained messages and throughput metering. In-browser broker here; bridges to EMQX/Mosquitto over wss in production.",
    tags: ["Pub/Sub", "Wildcards", "Retained"],
  },
  {
    icon: BrainCircuit,
    title: "ML Anomaly Engine",
    color: "text-violet-300",
    desc: "Per-device ensemble: Welford z-score + EWMA residual + clinical rules per metric, plus an Isolation Forest over the multivariate vital vector, fused and squashed to 0–1, with hysteresis debouncing and a fall-detection state machine.",
    tags: ["z-score", "EWMA", "iForest", "NEWS2", "Fall"],
  },
  {
    icon: Database,
    title: "Persistence & Realtime",
    color: "text-amber-300",
    desc: "Telemetry to a time-series store, alerts to Postgres with row-level security. Clients subscribe over WebSockets/Realtime and query history via PostgREST.",
    tags: ["Postgres", "RLS", "Realtime"],
  },
  {
    icon: Bot,
    title: "RAG Assistant",
    color: "text-rose-300",
    desc: "TF-IDF vector store over the docs corpus with hybrid cosine + keyword ranking. Extractive answers locally; grounded LLM synthesis when an endpoint is configured.",
    tags: ["TF-IDF", "Cosine", "Citations"],
  },
  {
    icon: Server,
    title: "React Console",
    color: "text-sky-300",
    desc: "Vite + React + TS + Tailwind SPA. Live telemetry via useSyncExternalStore, Zustand for app state, Recharts for trends — transport-agnostic by design.",
    tags: ["Vite", "Zustand", "Recharts"],
  },
];

const SCHEMA = [
  { table: "users", cols: "id · email · full_name · role · created_at", note: "Auth + RBAC" },
  { table: "patients", cols: "id · mrn · name · sex · dob · ward · baseline", note: "PHI, RLS by ward" },
  { table: "devices", cols: "id · patient_id · firmware · status · battery · rssi", note: "ESP32 registry" },
  { table: "telemetry", cols: "device_id · ts · metrics(jsonb) · seq", note: "Time-series (hypertable)" },
  { table: "alerts", cols: "id · device_id · severity · metric · score · acked", note: "RLS by ward + role" },
  { table: "doc_chunks", cols: "id · doc_id · category · content · embedding", note: "RAG corpus (pgvector)" },
];

const STACK = [
  { group: "Edge / IoT", items: ["ESP32-WROOM-32", "FreeRTOS firmware", "MQTT client", "OTA updates"] },
  { group: "Transport", items: ["MQTT 3.1.1", "WebSocket (wss)", "QoS 0/1", "Retained + LWT"] },
  { group: "Intelligence", items: ["Online z-score", "EWMA", "Clinical rules", "TF-IDF RAG"] },
  { group: "Backend", items: ["Supabase / Postgres", "PostgREST", "Realtime", "Edge Functions (Deno)"] },
  { group: "Frontend", items: ["Vite", "React 18", "TypeScript", "Tailwind CSS", "Zustand", "Recharts"] },
  { group: "Security", items: ["Row-Level Security", "RBAC", "TLS in transit", "Audit logging"] },
];

export default function Architecture() {
  const topicExamples = [
    Topics.telemetry("esp32-a100"),
    Topics.telemetryAll(),
    Topics.status("esp32-a100"),
    Topics.alertsAll(),
    Topics.command("esp32-a100"),
    Topics.everything(),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Architecture"
        description="End-to-end reference for the modular AIoT HealthGuard platform."
        icon={<Network className="h-6 w-6" />}
      />

      {/* Pipeline */}
      <Card>
        <CardHeader
          title="End-to-end data flow"
          subtitle="Edge → Bus → ML → Persistence → RAG → UI"
          icon={<Workflow className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />}
        />
        <div className="grid gap-3 px-4 pb-5 md:grid-cols-2 xl:grid-cols-3">
          {PIPELINE.map((stage, i) => (
            <div
              key={stage.title}
              className="relative rounded-xl border border-white/5 bg-white/[0.02] p-4"
            >
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10">
                  <stage.icon className={`h-4.5 w-4.5 ${stage.color}`} style={{ width: 18, height: 18 }} />
                </div>
                <div className="text-sm font-semibold text-ink-50">
                  <span className="mr-1 text-ink-600">{i + 1}.</span>
                  {stage.title}
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-400">{stage.desc}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {stage.tags.map((t) => (
                  <Chip key={t} tone="neutral">
                    {t}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Topic hierarchy */}
        <Card>
          <CardHeader
            title="MQTT topic hierarchy"
            subtitle="Canonical topics & wildcard subscriptions"
            icon={<Radio className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />}
          />
          <div className="space-y-2 px-4 pb-4 font-mono text-xs">
            {topicExamples.map((t) => (
              <div
                key={t}
                className="flex items-center gap-2 rounded-lg border border-white/5 bg-ink-950/50 px-3 py-2"
              >
                <span className="text-emerald-400">›</span>
                <span className="text-ink-200">{t}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Schema */}
        <Card>
          <CardHeader
            title="Database schema"
            subtitle="Postgres tables with RLS — see supabase/migrations"
            icon={<Database className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />}
          />
          <div className="space-y-2 px-4 pb-4">
            {SCHEMA.map((t) => (
              <div key={t.table} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-brand-300">{t.table}</span>
                  <Chip tone="neutral">{t.note}</Chip>
                </div>
                <div className="mt-1 font-mono text-[11px] text-ink-500">{t.cols}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Stack */}
      <Card>
        <CardHeader
          title="Technology stack"
          subtitle="Modular, transport-agnostic layers"
          icon={<ShieldCheck className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />}
        />
        <div className="grid gap-4 px-4 pb-5 sm:grid-cols-2 lg:grid-cols-3">
          {STACK.map((s) => (
            <div key={s.group} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-300">
                {s.group}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.items.map((i) => (
                  <Chip key={i} tone="brand">
                    {i}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

# AIoT HealthGuard

A production-grade, modular **AIoT patient-monitoring platform** built end-to-end as a
Vite + React + TypeScript + Tailwind single-page application. It simulates the entire
edge-to-cloud stack — ESP32 vital-sign nodes, an MQTT/WebSocket telemetry bus, an online
ML anomaly-detection ensemble, a retrieval-augmented clinical assistant, role-based auth,
and a polished real-time console — with **zero external dependencies required to run**.

> The app runs fully in **simulation mode** out of the box. Optional environment variables
> wire it to a real Supabase backend, a real MQTT broker over WebSockets, or an LLM
> endpoint for RAG synthesis — see `.env.example`.

---

## Feature tour

| Area | What's implemented |
| --- | --- |
| **ESP32 IoT simulation** | `Esp32Device` fleet emulator with realistic physiological signal synthesis (circadian drift, cross-metric coupling, sensor noise), battery/RSSI dynamics, and injectable pathological scenarios. |
| **MQTT / WebSocket telemetry** | In-browser `MqttBroker` with hierarchical topics, `+`/`#` wildcards, retained messages, QoS semantics and live throughput metering. Bridges to a real broker via `VITE_MQTT_WSS_URL`. |
| **ML anomaly detection** | Per-device ensemble: Welford online **z-score** + **EWMA** residual + **clinical rules** (NEWS2-style), fused and logistic-squashed to a 0–1 score, with **hysteresis** debouncing and a two-stage **fall-detection** state machine. |
| **RAG documentation retrieval** | Dependency-free **TF-IDF vector store** + cosine/keyword hybrid ranking over a curated clinical/technical corpus, with cited extractive answers (or grounded LLM synthesis when configured). |
| **Authentication** | **Supabase Auth** email/password sign-in + registration with role-based sessions (admin / clinician / caregiver / patient). A `profiles` row is auto-provisioned by a Postgres trigger; the app degrades to a local demo session if offline so the preview always works. |
| **Backend & schema** | **Live Supabase Postgres** with **Row-Level Security** on every table (`supabase/migrations/0001_init.sql`). Alerts are persisted, streamed over **Realtime**, acknowledged and cleared through RLS-guarded policies. The RAG assistant runs as a **Supabase Edge Function** (`clinical-assistant`) that retrieves over the `doc_chunks` corpus server-side. |
| **React console** | Real-time dashboard, device fleet, per-patient monitoring with live charts, alert center, RAG assistant, IoT simulator/broker inspector, and an interactive architecture reference. |

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm run build     # type-check + production build
npm run build:preview   # emit a single self-contained dist-preview/index.html
```

### Demo accounts (simulation mode)

| Email | Role | Password |
| --- | --- | --- |
| `admin@healthguard.io` | admin | `healthguard` |
| `clinician@healthguard.io` | clinician | `healthguard` |
| `caregiver@healthguard.io` | caregiver | `healthguard` |

## Architecture

```
ESP32 nodes ──▶ MQTT/WebSocket bus ──▶ ML anomaly engine ──▶ alerts + persistence
     │                                        │                        │
   sensors                              telemetry hub ───────▶ React console (live)
                                                                        │
   docs corpus ─────────────▶ TF-IDF RAG retriever ──────▶ clinical assistant
```

See the in-app **Architecture** page and `docs/`/`supabase/` for the full reference.

### Project layout

```
src/
  lib/
    mqtt/broker.ts        # in-browser MQTT broker (topics, wildcards, retained)
    iot/                  # sensors.ts · device.ts · fleet.ts  (ESP32 emulation)
    ml/                   # statistics.ts · clinical.ts · anomaly.ts (ensemble)
    rag/                  # corpus.ts · vectorStore.ts · retriever.ts (RAG)
    db/                   # schema seed + repository (PostgREST-shaped)
    auth/auth.ts          # auth service (Supabase Auth-shaped)
    telemetryHub.ts       # MQTT → ML → alerts, useSyncExternalStore surface
  store/                  # zustand stores (auth, fleet, alerts)
  components/             # ui · charts · widgets · layout
  pages/                  # Dashboard · Devices · DeviceDetail · Alerts · Assistant · Simulator · Architecture · Login
supabase/migrations/      # Postgres schema + RLS policies
```

## Connecting the backend

The app ships wired to a live Supabase project via the public `VITE_SUPABASE_URL`
and `VITE_SUPABASE_ANON_KEY` (already committed to `.env`). To reproduce the
backend on your own project:

1. Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
2. Apply `supabase/migrations/0001_init.sql` (POST it to the Management API's
   `/database/query` endpoint, or `supabase db push`).
3. Seed patients/devices/doc_chunks: `npx tsx scripts/gen_seed.ts | <psql/query>`.
4. Deploy the edge function: `supabase functions deploy clinical-assistant`.

Secrets (service-role key, management token, LLM keys) must **never** ship in the
client bundle. Privileged reads/writes go through RLS policies or edge functions
(which receive `SUPABASE_SERVICE_ROLE_KEY` automatically at runtime). Optional
`LLM_API_URL` / `OPENAI_API_KEY` **function secrets** upgrade the assistant from
extractive to grounded-LLM synthesis.

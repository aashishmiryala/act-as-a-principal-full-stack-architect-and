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
| **Authentication** | Email/password sign-in + registration, role-based sessions (admin / clinician / caregiver / patient), persisted locally. Mirrors the Supabase Auth surface. |
| **Backend & schema** | Full Postgres schema with **Row-Level Security** in `supabase/migrations/0001_init.sql`, ready to apply to a Supabase project. |
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

## Connecting a real backend (optional)

1. Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
2. Apply `supabase/migrations/0001_init.sql` to your project.
3. Swap the repository/auth service internals for `@supabase/supabase-js` calls — the rest
   of the app is transport-agnostic by design.

Secrets (service-role key, broker credentials, LLM keys) must **never** ship in the client
bundle; privileged operations belong in Supabase Edge Functions.

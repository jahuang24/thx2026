# Hospital Flow Dashboard (MVP)

Production-ready MVP dashboard focused on unit-wide flow, room readiness, and safety alerts. This build is a **frontend-only MVP** that runs locally with mocked data, plus a CV event simulator and explainable bed recommendation logic.

## Quickstart

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## What’s Included

- **Unit overview** with occupancy, readiness, and live alerts
- **Room readiness** details with EVS/maintenance cues
- **Patient monitoring** alerts (mocked CV events)
- **Admissions & placement** with explainable scoring
- **Tasks board** for EVS/maintenance workflows
- **Admin view** for units/rooms
- **Role-aware UI copy** and HIPAA/assistive CV disclaimers

## Simulated CV Events

A local simulator emits CV events every ~6 seconds and triggers alerts via an in-memory realtime bus. The CV rules engine lives in `src/logic/cvProcessor.ts` and is designed to be replaced by a real inference pipeline later.

## Patient Monitor Tab (New)

- Route: `/monitor`
- Two internal sections:
  - `Patient Tracker` for live subject status + metrics + timeline
  - `Agent Feed` for relay messages with expandable evidence

### Privacy and Data Handling

- Webcam frames are processed locally in-browser.
- No face recognition, no identity tracking, and no embeddings are used.
- No video frames are stored or uploaded.
- Only derived metrics and event timestamps are kept in memory.

### Observed Signals and Non-Diagnostic Tags

- Agent output is evidence-first:
  - Example: `Observed: repeated hand-to-mouth contacts, forward-lean sustained...`
- Optional interpretive tags are explicitly marked non-diagnostic.
- UI and messages include: `Non-diagnostic. Flags observable behavior patterns only.`

### Dev Scenario Injectors

- In development mode (`import.meta.env.DEV`), `Patient Tracker` shows scenario injectors:
  - Inject nausea-like pattern
  - Inject posture drop
  - Inject drowsy pattern
- These inject synthetic derived events/metrics so the relay agent and feed can be tested without perfect camera behavior.

### Dedalus LLM Agent Setup

The monitor can run with a real LLM-backed autonomous relay through Dedalus API.

1. Copy `.env.example` to `.env`.
2. Set your Dedalus key in `VITE_DEDALUS_API_KEY`.
3. Start the app with `npm run dev`.
4. Open `/monitor` and check the header:
   - `Agent backend: DEDALUS` means Dedalus is active.
   - `Agent backend: RULES` means local fallback is active.

Important:
- The Dedalus request sends only derived metrics + event summaries.
- No video frames are uploaded.
- Because this is frontend-only, a `VITE_` key is exposed to the browser. For production, move Dedalus calls to a backend proxy.

Cost control knobs (`.env`):
- `VITE_DEDALUS_MODEL` (recommended low-cost model, default `openai/gpt-4o-mini`)
- `VITE_DEDALUS_MAX_TOKENS` (default `220`)
- `VITE_DEDALUS_MIN_CALL_INTERVAL_MS` (default `15000`)
- `VITE_DEDALUS_HEARTBEAT_MS` (default `90000`)
- `VITE_DEDALUS_ONLY_ALERTING` (default `true`, calls Dedalus mostly when rules detect actionable patterns)
- `VITE_DEDALUS_ERROR_BACKOFF_MS` (default `30000`)

## Architecture Notes (MVP)

- **Frontend only** (React + Vite + Tailwind)
- **In-memory store** for alerts and tasks
- **Realtime bus** via `EventTarget`
- **All data mocked in** `src/data/mock.ts`
- **Explainable placement** in `src/logic/recommendation.ts`

## Safety + Compliance Notes

- CV detections are **assistive only** and require human verification
- UI defaults to minimal PHI exposure
- Role-based access control, audit logging, and encryption notes are scaffolded in UI copy

## Scripts

- `npm run dev` - start local dev server
- `npm run build` - production build
- `npm run test` - run unit/component tests

## Defaults Assumed

- Single hospital unit with mock rooms and beds
- Mock auth (no password verification)
- CV detections are simulated locally

## Roadmap (Next 6 Features)

1. Backend API (Fastify + Prisma + Postgres) with RBAC and audit logging
2. WebSocket/SSE realtime streams for alerts and room status
3. CV event ingestion service + worker queue (BullMQ/Redis)
4. Patient portal with limited read-only views and education tasks
5. Staffing and workload analytics module
6. Compliance exports (audit log downloads, incident reports)

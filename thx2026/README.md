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

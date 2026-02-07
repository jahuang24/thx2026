# Copilot Instructions for Hospital Flow Dashboard

This document provides essential guidance for AI coding agents working on the Hospital Flow Dashboard project. It outlines the architecture, workflows, and conventions to ensure productive contributions.

## Project Overview

The Hospital Flow Dashboard is a production-ready MVP focused on unit-wide flow, room readiness, and safety alerts. It includes:
- **Unit Overview**: Displays occupancy, readiness, and live alerts.
- **Room Readiness**: Provides EVS/maintenance cues.
- **Patient Monitoring**: Simulates CV events and triggers alerts.
- **Admissions & Placement**: Features explainable scoring logic.
- **Tasks Board**: Manages EVS/maintenance workflows.
- **Admin View**: Offers unit/room management.

### Key Features
- **Simulated CV Events**: Events are emitted every ~6 seconds via an in-memory realtime bus. Logic resides in `src/logic/cvProcessor.ts`.
- **Patient Monitor Tab**: Located at `/monitor`, it includes:
  - `Patient Tracker`: Displays live subject status, metrics, and timeline.
  - `Agent Feed`: Shows relay messages with expandable evidence.

### Privacy Considerations
- Webcam frames are processed locally in-browser.
- No face recognition, identity tracking, or embeddings.
- No video frames are stored or uploaded.
- Only derived metrics and event timestamps are kept in memory.

## Developer Workflows

### Build and Run
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open the app at `http://localhost:5173`.

### Testing
- Unit tests are located in `src/test/`.
- Run tests with:
  ```bash
  npm test
  ```

### Decision Support Module
- Key file: `src/decision_support/index.ts`
- Demo script: `src/decision_support/demo_cli.ts`
- Run the demo:
  ```bash
  npx ts-node src/decision_support/demo_cli.ts
  ```

## Codebase Structure

### Major Components
- **Frontend**: Located in `src/`, includes React components, hooks, and pages.
- **Backend**: Located in `server/`, includes routes and database connections.
- **Decision Support**: Self-contained module for bed recommendations and pathfinding.

### Key Files
- `src/logic/cvProcessor.ts`: CV rules engine for simulated events.
- `src/services/realtime.ts`: In-memory realtime bus for event handling.
- `src/services/store.ts`: Centralized state management.
- `src/decision_support/index.ts`: Bed recommendation logic.

## Conventions and Patterns

### State Management
- Centralized in `src/services/store.ts`.
- Use `realtimeBus.emit` for event-driven updates.

### Component Design
- Follow modular and reusable patterns.
- Example: `src/components/AgentFeedPanel.tsx` handles agent feed UI.

### Testing
- Place tests in `src/test/`.
- Use descriptive test names and mock data from `src/data/mock.ts`.

### Decision Support
- Use `recommendBeds` for bed recommendations.
- Override defaults via `RecommendationConfig`.

## External Dependencies
- **Tailwind CSS**: Configured in `tailwind.config.js`.
- **Vite**: Development server and build tool.
- **Vitest**: Testing framework.
- **ts-node**: For running TypeScript scripts.

## Integration Points
- **Realtime Bus**: Facilitates communication between components.
- **Decision Support**: Integrates with patient monitoring and admissions.

---

For further details, refer to the [README.md](../README.md) files in the root and `src/decision_support/` directories.
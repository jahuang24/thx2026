import { beds, rooms } from '../data/mock';
import { NON_DIAGNOSTIC_DISCLAIMER } from '../agent/policy';
import { fetchPatients } from './patientApi';
import { store } from './store';
import type { AgentMessage, RollingMetricsSnapshot } from '../types/monitor';

interface AssignmentSnapshot {
  roomId: string | null;
  bedId: string | null;
}

const POLL_INTERVAL_MS = 10000;

const ZERO_METRICS: RollingMetricsSnapshot = {
  perclos: 0,
  handToMouthPerMin: 0,
  handToTemplePerMin: 0,
  forwardLeanSecondsPerMin: 0,
  postureChangeRate: 0,
  movementLevel: 0
};

function roomLabel(roomId: string | null) {
  if (!roomId) return 'Unassigned';
  const room = rooms.find((item) => item.id === roomId);
  return room ? `Room ${room.roomNumber}` : roomId;
}

function bedLabel(bedId: string | null) {
  if (!bedId) return 'Unassigned';
  const bed = beds.find((item) => item.id === bedId);
  return bed ? `Bed ${bed.bedLabel}` : bedId;
}

function createRoomChangeMessage(params: {
  patientId: string;
  from: AssignmentSnapshot;
  to: AssignmentSnapshot;
  ts: number;
}): AgentMessage {
  const fromLabel = `${roomLabel(params.from.roomId)} ${bedLabel(params.from.bedId)}`.trim();
  const toLabel = `${roomLabel(params.to.roomId)} ${bedLabel(params.to.bedId)}`.trim();
  return {
    id: `ops-room-change-${params.patientId}-${params.ts}`,
    ts: params.ts,
    subjectId: params.patientId,
    title: 'Monitor',
    severity: params.to.roomId ? 'LOW' : 'MED',
    confidence: 0.96,
    observed: `Observed: room assignment changed from ${fromLabel} to ${toLabel}.`,
    evidence: {
      metrics: ZERO_METRICS,
      criteriaMet: ['assignment delta detected'],
      recentEvents: []
    },
    recommendation: 'Verify transport handoff and room assignment records are up to date.',
    disclaimer: NON_DIAGNOSTIC_DISCLAIMER
  };
}

export function startOperationalSignalsWatcher() {
  let stopped = false;
  const previousByPatient = new Map<string, AssignmentSnapshot>();

  const poll = async () => {
    if (stopped) return;
    try {
      const patients = await fetchPatients();
      patients.forEach((patient) => {
        const current: AssignmentSnapshot = {
          roomId: patient.roomId ?? null,
          bedId: patient.bedId ?? null
        };
        const previous = previousByPatient.get(patient.id);
        previousByPatient.set(patient.id, current);
        if (!previous) return;
        const changed = previous.roomId !== current.roomId || previous.bedId !== current.bedId;
        if (!changed) return;

        const ts = Date.now();
        const message = createRoomChangeMessage({
          patientId: patient.id,
          from: previous,
          to: current,
          ts
        });
        store.addAgentMessage(message, 'SYSTEM');
        store.createOperationalAlert({
          category: 'ROOM_CHANGE',
          severity: current.roomId ? 'LOW' : 'MEDIUM',
          patientId: patient.id,
          roomId: current.roomId ?? undefined,
          notes: `${message.observed} Previous assignment: ${roomLabel(previous.roomId)} ${bedLabel(previous.bedId)}.`
        });
      });
    } catch {
      return;
    }
  };

  void poll();
  const timer = window.setInterval(() => {
    void poll();
  }, POLL_INTERVAL_MS);

  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}

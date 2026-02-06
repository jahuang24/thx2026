import type { Alert, AlertCategory, AlertSeverity, CVEvent } from '../types';

const DEDUP_WINDOW_MS = 10 * 60 * 1000;

const categoryMap: Record<CVEvent['eventType'], AlertCategory> = {
  FALL_DETECTED: 'FALL_RISK',
  BED_EXIT: 'BED_EXIT',
  PROLONGED_INACTIVITY: 'INACTIVITY',
  MISSING_BED_RAIL: 'EQUIPMENT',
  CALL_LIGHT: 'DISTRESS'
};

export interface CVProcessResult {
  alert: Alert | null;
  reason?: string;
}

export function processCvEvent(
  event: CVEvent,
  existingAlerts: Alert[],
  now: string
): CVProcessResult {
  const createdAt = new Date(now).toISOString();
  const category = categoryMap[event.eventType];

  const relevantAlerts = existingAlerts.filter((alert) =>
    (alert.roomId === event.roomId || alert.patientId === event.patientId) && alert.category === category
  );

  const eventTime = new Date(now).getTime();
  const deduped = relevantAlerts.find((alert) => {
    const created = new Date(alert.createdAt).getTime();
    return eventTime - created < DEDUP_WINDOW_MS && alert.status !== 'RESOLVED';
  });

  if (deduped) {
    return { alert: null, reason: 'Deduped: recent alert already open.' };
  }

  if (event.eventType === 'FALL_DETECTED' && event.confidence >= 0.75) {
    return {
      alert: buildAlert(event, createdAt, 'HIGH', category)
    };
  }

  if (event.eventType === 'BED_EXIT' && event.confidence >= 0.7) {
    return {
      alert: buildAlert(event, createdAt, 'MEDIUM', category)
    };
  }

  if (event.eventType === 'PROLONGED_INACTIVITY') {
    return {
      alert: buildAlert(event, createdAt, 'LOW', category)
    };
  }

  if (event.eventType === 'MISSING_BED_RAIL') {
    return {
      alert: buildAlert(event, createdAt, 'MEDIUM', category)
    };
  }

  if (event.eventType === 'CALL_LIGHT') {
    return {
      alert: buildAlert(event, createdAt, 'LOW', category)
    };
  }

  return { alert: null, reason: 'No rule matched.' };
}

function buildAlert(
  event: CVEvent,
  createdAt: string,
  severity: AlertSeverity,
  category: AlertCategory
): Alert {
  return {
    id: `alert-${Math.random().toString(36).slice(2, 8)}`,
    roomId: event.roomId,
    patientId: event.patientId ?? null,
    severity,
    category,
    status: 'OPEN',
    createdAt,
    notes: `Auto-generated from ${event.eventType} (${Math.round(event.confidence * 100)}% confidence).`
  };
}

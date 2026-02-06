import type { CVEvent, CVEventType } from '../types';
import { realtimeBus } from './realtime';

const eventTypes: CVEventType[] = [
  'FALL_DETECTED',
  'BED_EXIT',
  'PROLONGED_INACTIVITY',
  'MISSING_BED_RAIL',
  'CALL_LIGHT'
];

const randomId = () => Math.random().toString(36).slice(2, 9);

export function startCvSimulator(roomIds: string[], sensorIds: string[]) {
  const interval = setInterval(() => {
    const roomId = roomIds[Math.floor(Math.random() * roomIds.length)];
    const sensorId = sensorIds[Math.floor(Math.random() * sensorIds.length)];
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const event: CVEvent = {
      id: `event-${randomId()}`,
      sensorId,
      roomId,
      patientId: Math.random() > 0.4 ? 'patient-1' : null,
      eventType,
      confidence: Number((0.6 + Math.random() * 0.35).toFixed(2)),
      capturedAt: new Date().toISOString(),
      payload: { source: 'simulator' }
    };

    realtimeBus.emit('cvEventIngested', { event });
  }, 6000);

  return () => clearInterval(interval);
}

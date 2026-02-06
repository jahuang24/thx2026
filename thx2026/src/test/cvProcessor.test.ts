import { describe, expect, it } from 'vitest';
import { processCvEvent } from '../logic/cvProcessor';
import type { Alert, CVEvent } from '../types';

const baseEvent: CVEvent = {
  id: 'event-1',
  sensorId: 'sensor-1',
  roomId: 'room-1',
  patientId: 'patient-1',
  eventType: 'FALL_DETECTED',
  confidence: 0.9,
  capturedAt: new Date().toISOString(),
  payload: {}
};

describe('processCvEvent', () => {
  it('creates high severity alert for fall detection', () => {
    const result = processCvEvent(baseEvent, [], new Date().toISOString());
    expect(result.alert?.severity).toBe('HIGH');
  });

  it('dedupes recent alerts', () => {
    const now = new Date().toISOString();
    const existing: Alert[] = [
      {
        id: 'alert-1',
        roomId: 'room-1',
        patientId: 'patient-1',
        severity: 'HIGH',
        category: 'FALL_RISK',
        status: 'OPEN',
        createdAt: now
      }
    ];
    const result = processCvEvent(baseEvent, existing, now);
    expect(result.alert).toBeNull();
  });
});

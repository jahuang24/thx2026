import { describe, expect, it } from 'vitest';
import { recommendBeds } from '../logic/recommendation';
import type { Admission } from '../types';
import { beds, patients, rooms } from '../data/mock';

const admission: Admission = {
  id: 'admission-test',
  patientId: 'patient-3',
  requestedUnit: 'unit-a',
  requestedType: 'MED_SURG',
  admitStatus: 'PENDING',
  requestedAt: new Date().toISOString()
};

describe('recommendBeds', () => {
  it('returns ranked recommendations with rationale', () => {
    const results = recommendBeds(admission, rooms, beds, patients);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].rationale.length).toBeGreaterThan(0);
    expect(results[0].totalScore).toBeGreaterThanOrEqual(0);
  });
});

import type { Admission, Bed, Patient, RecommendationScore, Room } from '../types';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function recommendBeds(
  admission: Admission,
  rooms: Room[],
  beds: Bed[],
  patients: Patient[]
): RecommendationScore[] {
  const candidateBeds = beds.filter((bed) => !bed.occupied);
  const patient = patients.find((item) => item.id === admission.patientId);

  return candidateBeds
    .map((bed) => {
      const room = rooms.find((item) => item.id === bed.roomId);
      if (!room) {
        return null;
      }

      const roomTypeMatch = admission.requestedType === room.type ? 25 : 5;
      const readiness = room.status === 'READY' ? 25 : room.status === 'CLEANING' ? 10 : 0;
      const maintenance = room.maintenanceFlags.length === 0 ? 15 : -10;
      const occupancy = room.status === 'OCCUPIED' ? -15 : 10;
      const staffingLoad = 5;
      const patientRisk = patient?.fallRisk ? -5 : 5;

      const totalScore = clamp(
        roomTypeMatch + readiness + maintenance + occupancy + staffingLoad + patientRisk,
        0,
        100
      );

      const rationale = [
        roomTypeMatch >= 20 ? 'Room type matches request' : 'Room type mismatch',
        readiness >= 20 ? 'Room is ready' : 'Room not ready',
        maintenance >= 10 ? 'No maintenance flags' : 'Maintenance flagged',
        occupancy >= 0 ? 'Room has capacity' : 'Room currently occupied',
        patientRisk > 0 ? 'Patient has lower fall risk' : 'Patient requires fall precautions'
      ];

      return {
        bedId: bed.id,
        roomId: room.id,
        totalScore,
        factors: {
          roomTypeMatch,
          readiness,
          maintenance,
          occupancy,
          staffingLoad,
          patientRisk
        },
        rationale
      } satisfies RecommendationScore;
    })
    .filter((item): item is RecommendationScore => Boolean(item))
    .sort((a, b) => b.totalScore - a.totalScore);
}

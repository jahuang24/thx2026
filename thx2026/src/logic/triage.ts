import type { Alert, Bed, Message, Patient, Room } from '../types';
import type { PatientRecord } from '../services/patientApi';

export type TriageLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface TriageEntry {
  patientId: string;
  name: string;
  mrn: string;
  roomLabel: string;
  bedLabel: string;
  score: number;
  level: TriageLevel;
  reasons: string[];
  openAlertCount: number;
  unreadPatientMessages: number;
}

interface TriageInputs {
  patients: PatientRecord[];
  alerts: Alert[];
  messages: Message[];
  seededPatients: Patient[];
  rooms: Room[];
  beds: Bed[];
}

const symptomKeywords = [
  'pain',
  'short of breath',
  'breath',
  'dizzy',
  'chest',
  'bleed',
  'nausea',
  'vomit',
  'cannot',
  'help'
];

function clamp(min: number, value: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function scoreToLevel(score: number): TriageLevel {
  if (score >= 70) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

function acuityBaseScore(value: Patient['acuityLevel'] | undefined) {
  if (value === 'CRITICAL') return 55;
  if (value === 'HIGH') return 40;
  if (value === 'MEDIUM') return 25;
  if (value === 'LOW') return 10;
  return 18;
}

export function getTriagePalette(level: TriageLevel) {
  if (level === 'CRITICAL') {
    return {
      chip: 'bg-rose-600 text-white',
      card: 'border-rose-300 bg-rose-50',
      text: 'text-rose-700'
    };
  }
  if (level === 'HIGH') {
    return {
      chip: 'bg-orange-500 text-white',
      card: 'border-orange-300 bg-orange-50',
      text: 'text-orange-700'
    };
  }
  if (level === 'MEDIUM') {
    return {
      chip: 'bg-amber-400 text-amber-950',
      card: 'border-amber-300 bg-amber-50',
      text: 'text-amber-700'
    };
  }
  return {
    chip: 'bg-emerald-500 text-white',
    card: 'border-emerald-300 bg-emerald-50',
    text: 'text-emerald-700'
  };
}

export function buildTriageEntries({
  patients,
  alerts,
  messages,
  seededPatients,
  rooms,
  beds
}: TriageInputs): TriageEntry[] {
  const seededById = new Map(seededPatients.map((item) => [item.id, item]));
  const roomById = new Map(rooms.map((item) => [item.id, item]));
  const bedById = new Map(beds.map((item) => [item.id, item]));

  const entries = patients.map((patient) => {
    const seeded = seededById.get(patient.id);
    const openAlerts = alerts.filter((alert) => alert.status === 'OPEN' && alert.patientId === patient.id);
    const unreadPatientMessages = messages.filter(
      (message) => message.patientId === patient.id && message.sender === 'PATIENT' && !message.readByNurse
    );
    const latestPatientMessage = messages.find(
      (message) => message.patientId === patient.id && message.sender === 'PATIENT'
    );

    let score = acuityBaseScore(seeded?.acuityLevel);
    const reasons: string[] = [];

    if (seeded?.acuityLevel) {
      reasons.push(`Acuity baseline: ${seeded.acuityLevel}`);
    } else {
      reasons.push('Acuity baseline: unknown');
    }

    if (seeded?.mobilityRisk === 'HIGH') {
      score += 14;
      reasons.push('High mobility risk');
    } else if (seeded?.mobilityRisk === 'MEDIUM') {
      score += 7;
      reasons.push('Medium mobility risk');
    }

    if (seeded?.fallRisk) {
      score += 12;
      reasons.push('Fall risk flag present');
    }

    const highAlerts = openAlerts.filter((alert) => alert.severity === 'HIGH').length;
    const mediumAlerts = openAlerts.filter((alert) => alert.severity === 'MEDIUM').length;
    const lowAlerts = openAlerts.filter((alert) => alert.severity === 'LOW').length;
    score += clamp(0, highAlerts * 18, 36);
    score += clamp(0, mediumAlerts * 10, 20);
    score += clamp(0, lowAlerts * 5, 10);
    if (openAlerts.length > 0) {
      reasons.push(`${openAlerts.length} open alert(s)`);
    }

    score += clamp(0, unreadPatientMessages.length * 5, 15);
    if (unreadPatientMessages.length > 0) {
      reasons.push(`${unreadPatientMessages.length} unread patient message(s)`);
    }

    if (latestPatientMessage) {
      const normalized = latestPatientMessage.body.toLowerCase();
      const matched = symptomKeywords.find((keyword) => normalized.includes(keyword));
      if (matched) {
        score += 8;
        reasons.push(`Recent symptom phrase matched: "${matched}"`);
      }
    }

    const bed = patient.bedId ? bedById.get(patient.bedId) : undefined;
    const room = roomById.get(patient.roomId ?? bed?.roomId ?? '');
    const roomLabel = room?.roomNumber ?? 'Unassigned';
    const bedLabel = bed?.bedLabel ?? 'Unassigned';
    if (!room || !bed) {
      score += 4;
      reasons.push('Incomplete room/bed assignment');
    }

    const finalScore = clamp(0, score, 100);
    return {
      patientId: patient.id,
      name: patient.name || 'Patient',
      mrn: patient.mrn || 'Unknown',
      roomLabel,
      bedLabel,
      score: finalScore,
      level: scoreToLevel(finalScore),
      reasons: reasons.slice(0, 4),
      openAlertCount: openAlerts.length,
      unreadPatientMessages: unreadPatientMessages.length
    };
  });

  return entries.sort((left, right) => right.score - left.score);
}

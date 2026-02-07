import type { Alert, Bed, Message, Patient, Room } from '../types';
import type { PatientRecord } from '../services/patientApi';
import { normalizeBedId, normalizeRoomId } from '../services/patientApi';

export type TriageLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface TriageEntry {
  patientId: string;
  name: string;
  mrn: string;
  roomLabel: string;
  bedLabel: string;
  roomAssigned: boolean;
  latestPatientMessage: string;
  patientMessageSummary: string;
  patientMessageSignalScore: number;
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

const HIGH_URGENCY_PATTERNS = [
  /a lot of pain/i,
  /severe pain/i,
  /worst pain/i,
  /\b10\/10 pain\b/i,
  /can(?:not|'t) breathe/i,
  /shortness of breath/i,
  /chest pain/i,
  /heavy bleeding/i,
  /help me/i,
  /emergency/i
];

const MEDIUM_URGENCY_PATTERNS = [
  /\bpain\b/i,
  /\bdizzy\b/i,
  /\bnausea\b/i,
  /\bvomit/i,
  /\bshort of breath\b/i,
  /\blightheaded\b/i,
  /\bweak\b/i,
  /\bscared\b/i,
  /\banxious\b/i
];

const NEGATIVE_SENTIMENT_TERMS = [
  'pain',
  'hurt',
  'worse',
  'worst',
  'scared',
  'afraid',
  'panic',
  'cannot',
  "can't",
  'struggling',
  'bleeding',
  'urgent'
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

function evaluatePatientMessageSignal(patientMessages: Message[]) {
  if (!patientMessages.length) {
    return {
      score: 0,
      reasons: [] as string[],
      latestMessage: '',
      summary: ''
    };
  }

  const recentMessages = [...patientMessages]
    .sort((left, right) => new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime())
    .slice(0, 5);
  const latestMessage = recentMessages[0]?.body ?? '';
  const summary = recentMessages.map((message) => message.body.trim()).filter(Boolean).slice(0, 3).join(' | ');

  let score = 0;
  let highUrgencyHits = 0;
  let mediumUrgencyHits = 0;
  let sentimentHits = 0;

  recentMessages.forEach((message) => {
    const body = message.body.toLowerCase();
    const highMatched = HIGH_URGENCY_PATTERNS.some((pattern) => pattern.test(body));
    const mediumMatched = MEDIUM_URGENCY_PATTERNS.some((pattern) => pattern.test(body));
    const localSentimentHits = NEGATIVE_SENTIMENT_TERMS.filter((term) => body.includes(term)).length;

    if (highMatched) {
      highUrgencyHits += 1;
      score += 14;
    } else if (mediumMatched) {
      mediumUrgencyHits += 1;
      score += 7;
    }

    if (localSentimentHits > 0) {
      sentimentHits += localSentimentHits;
      score += Math.min(4, localSentimentHits);
    }
  });

  const reasons: string[] = [];
  if (highUrgencyHits > 0) {
    reasons.push(`Patient chat shows high-urgency distress terms (${highUrgencyHits} hit${highUrgencyHits > 1 ? 's' : ''})`);
  } else if (mediumUrgencyHits > 0) {
    reasons.push(`Patient chat shows symptom distress language (${mediumUrgencyHits} hit${mediumUrgencyHits > 1 ? 's' : ''})`);
  }
  if (sentimentHits >= 3) {
    reasons.push('Patient message sentiment indicates elevated distress');
  }

  return {
    score: clamp(0, score, 35),
    reasons,
    latestMessage,
    summary
  };
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
  const openAlertStatsByPatient = new Map<string, { total: number; high: number; medium: number; low: number }>();
  const patientMessagesByPatient = new Map<string, Message[]>();
  const unreadPatientMessageCount = new Map<string, number>();

  alerts.forEach((alert) => {
    if (alert.status !== 'OPEN' || !alert.patientId) return;
    const existing = openAlertStatsByPatient.get(alert.patientId) ?? {
      total: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    existing.total += 1;
    if (alert.severity === 'HIGH') existing.high += 1;
    if (alert.severity === 'MEDIUM') existing.medium += 1;
    if (alert.severity === 'LOW') existing.low += 1;
    openAlertStatsByPatient.set(alert.patientId, existing);
  });

  messages.forEach((message) => {
    if (message.sender !== 'PATIENT' || !message.patientId) return;
    const list = patientMessagesByPatient.get(message.patientId) ?? [];
    list.push(message);
    patientMessagesByPatient.set(message.patientId, list);
    if (!message.readByNurse) {
      unreadPatientMessageCount.set(message.patientId, (unreadPatientMessageCount.get(message.patientId) ?? 0) + 1);
    }
  });

  const entries = patients.map((patient) => {
    const roomId = normalizeRoomId(patient.roomId);
    const bedId = normalizeBedId(patient.bedId, roomId);
    const seeded = seededById.get(patient.id);
    const alertStats = openAlertStatsByPatient.get(patient.id) ?? { total: 0, high: 0, medium: 0, low: 0 };
    const patientMessages = patientMessagesByPatient.get(patient.id) ?? [];
    const unreadCount = unreadPatientMessageCount.get(patient.id) ?? 0;
    const messageSignal = evaluatePatientMessageSignal(patientMessages);

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

    score += clamp(0, alertStats.high * 18, 36);
    score += clamp(0, alertStats.medium * 10, 20);
    score += clamp(0, alertStats.low * 5, 10);
    if (alertStats.total > 0) {
      reasons.push(`${alertStats.total} open alert(s)`);
    }

    score += clamp(0, unreadCount * 5, 15);
    if (unreadCount > 0) {
      reasons.push(`${unreadCount} unread patient message(s)`);
    }

    score += messageSignal.score;
    if (messageSignal.reasons.length > 0) {
      reasons.push(...messageSignal.reasons);
    }

    const bed = bedId ? bedById.get(bedId) : undefined;
    const room = roomById.get(roomId ?? bed?.roomId ?? '');
    const roomLabel = room?.roomNumber ?? 'Unassigned';
    const bedLabel = bed?.bedLabel ?? 'Unassigned';
    if (!room || !bed) {
      score += 4;
      reasons.push('Incomplete room/bed assignment');
    }

    let finalScore = clamp(0, score, 100);
    let level = scoreToLevel(finalScore);
    if (!room && level === 'LOW') {
      level = 'MEDIUM';
      finalScore = Math.max(finalScore, 30);
      reasons.push('No room assignment: minimum triage level set to MEDIUM');
    }

    const prioritizedReasons = [
      ...messageSignal.reasons,
      ...reasons.filter((reason) => !messageSignal.reasons.includes(reason))
    ].slice(0, 4);

    return {
      patientId: patient.id,
      name: patient.name || 'Patient',
      mrn: patient.mrn || 'Unknown',
      roomLabel,
      bedLabel,
      roomAssigned: Boolean(room),
      latestPatientMessage: messageSignal.latestMessage,
      patientMessageSummary: messageSignal.summary,
      patientMessageSignalScore: messageSignal.score,
      score: finalScore,
      level,
      reasons: prioritizedReasons,
      openAlertCount: alertStats.total,
      unreadPatientMessages: unreadCount
    };
  });

  return entries.sort((left, right) => right.score - left.score);
}

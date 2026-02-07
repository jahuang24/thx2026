export type Role = 'Doctor' | 'Nurse' | 'EVS' | 'Admin';

export type RoomStatus = 'READY' | 'NOT_READY' | 'CLEANING' | 'NEEDS_MAINTENANCE' | 'OCCUPIED';
export type TaskType = 'CLEANING' | 'MAINTENANCE' | 'NURSING';
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE';
export type AlertStatus = 'OPEN' | 'ACK' | 'RESOLVED';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type AlertCategory =
  | 'FALL_RISK'
  | 'BED_EXIT'
  | 'DISTRESS'
  | 'INACTIVITY'
  | 'EQUIPMENT'
  | 'ROOM_CHANGE'
  | 'CONDITION_CHANGE';
export type CVEventType = 'FALL_DETECTED' | 'BED_EXIT' | 'PROLONGED_INACTIVITY' | 'MISSING_BED_RAIL' | 'CALL_LIGHT';
export type AdmissionStatus = 'PENDING' | 'ASSIGNED' | 'ADMITTED';
export type RoomType = 'ICU' | 'MED_SURG' | 'OBS' | 'ISOLATION';
export type AcuityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MobilityRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type MessageSender = 'PATIENT' | 'NURSE';

export interface Unit {
  id: string;
  name: string;
  floor: string;
}

export interface Room {
  id: string;
  unitId: string;
  roomNumber: string;
  type: RoomType;
  status: RoomStatus;
  lastCleanedAt: string | null;
  maintenanceFlags: string[];
  readinessReasons: string[];
}

export interface Bed {
  id: string;
  roomId: string;
  bedLabel: string;
  occupied: boolean;
  patientId: string | null;
}

export interface Patient {
  id: string;
  mrn: string;
  name?: string;
  age?: number;
  acuityLevel: AcuityLevel;
  mobilityRisk: MobilityRisk;
  fallRisk: boolean;
  notes?: string;
  unitId: string;
  roomId?: string | null;
  bedId?: string | null;
}

export interface Admission {
  id: string;
  patientId: string;
  requestedUnit: string;
  requestedType: RoomType;
  admitStatus: AdmissionStatus;
  requestedAt: string;
  assignedAt?: string;
}

export interface Task {
  id: string;
  roomId?: string;
  patientId?: string;
  type: TaskType;
  status: TaskStatus;
  assignedTo?: string;
  createdAt: string;
  dueAt?: string;
}

export interface Sensor {
  id: string;
  roomId: string;
  type: 'CAMERA';
  metadata: Record<string, string>;
}

export interface CVEvent {
  id: string;
  sensorId: string;
  roomId: string;
  patientId?: string | null;
  eventType: CVEventType;
  confidence: number;
  capturedAt: string;
  payload: Record<string, unknown>;
}

export interface Alert {
  id: string;
  roomId?: string;
  patientId?: string | null;
  severity: AlertSeverity;
  category: AlertCategory;
  status: AlertStatus;
  createdAt: string;
  acknowledgedBy?: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface Message {
  id: string;
  patientId: string;
  sender: MessageSender;
  body: string;
  sentAt: string;
  readByNurse: boolean;
  readByPatient: boolean;
}

export interface RecommendationScore {
  bedId: string;
  roomId: string;
  totalScore: number;
  factors: {
    roomTypeMatch: number;
    readiness: number;
    maintenance: number;
    occupancy: number;
    staffingLoad: number;
    patientRisk: number;
  };
  rationale: string[];
}

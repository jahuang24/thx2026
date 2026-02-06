import type {
  Admission,
  Alert,
  Bed,
  CVEvent,
  Patient,
  Room,
  Sensor,
  Task,
  Unit,
  User
} from '../types';

export const currentUser: User = {
  id: 'user-1',
  name: 'Jordan Lee',
  role: 'Nurse'
};

export const units: Unit[] = [
  { id: 'unit-a', name: 'North Tower 4A', floor: '4' },
  { id: 'unit-b', name: 'North Tower 4B', floor: '4' }
];

export const rooms: Room[] = [
  {
    id: 'room-401',
    unitId: 'unit-a',
    roomNumber: '401',
    type: 'ICU',
    status: 'OCCUPIED',
    lastCleanedAt: '2026-02-05T17:40:00Z',
    maintenanceFlags: [],
    readinessReasons: []
  },
  {
    id: 'room-402',
    unitId: 'unit-a',
    roomNumber: '402',
    type: 'ICU',
    status: 'CLEANING',
    lastCleanedAt: '2026-02-06T01:30:00Z',
    maintenanceFlags: ['Bed rail loose'],
    readinessReasons: ['EVS in progress', 'Maintenance pending']
  },
  {
    id: 'room-403',
    unitId: 'unit-a',
    roomNumber: '403',
    type: 'MED_SURG',
    status: 'READY',
    lastCleanedAt: '2026-02-06T03:12:00Z',
    maintenanceFlags: [],
    readinessReasons: []
  },
  {
    id: 'room-404',
    unitId: 'unit-a',
    roomNumber: '404',
    type: 'OBS',
    status: 'NOT_READY',
    lastCleanedAt: '2026-02-05T21:50:00Z',
    maintenanceFlags: ['Oxygen sensor calibration'],
    readinessReasons: ['Awaiting respiratory equipment']
  },
  {
    id: 'room-405',
    unitId: 'unit-b',
    roomNumber: '405',
    type: 'ISOLATION',
    status: 'READY',
    lastCleanedAt: '2026-02-06T02:05:00Z',
    maintenanceFlags: [],
    readinessReasons: []
  }
];

export const beds: Bed[] = [
  { id: 'bed-401a', roomId: 'room-401', bedLabel: 'A', occupied: true, patientId: 'patient-1' },
  { id: 'bed-401b', roomId: 'room-401', bedLabel: 'B', occupied: false, patientId: null },
  { id: 'bed-402a', roomId: 'room-402', bedLabel: 'A', occupied: false, patientId: null },
  { id: 'bed-403a', roomId: 'room-403', bedLabel: 'A', occupied: false, patientId: null },
  { id: 'bed-404a', roomId: 'room-404', bedLabel: 'A', occupied: false, patientId: null },
  { id: 'bed-405a', roomId: 'room-405', bedLabel: 'A', occupied: true, patientId: 'patient-2' }
];

export const patients: Patient[] = [
  {
    id: 'patient-1',
    mrn: 'MRN-043221',
    name: 'Morgan Riley',
    age: 72,
    acuityLevel: 'HIGH',
    mobilityRisk: 'HIGH',
    fallRisk: true,
    notes: 'Post-op day 1. Needs assistance for transfers.',
    unitId: 'unit-a',
    bedId: 'bed-401a'
  },
  {
    id: 'patient-2',
    mrn: 'MRN-058778',
    name: 'Sam Patel',
    age: 64,
    acuityLevel: 'MEDIUM',
    mobilityRisk: 'MEDIUM',
    fallRisk: false,
    notes: 'Respiratory monitoring. Call light within reach.',
    unitId: 'unit-b',
    bedId: 'bed-405a'
  },
  {
    id: 'patient-3',
    mrn: 'MRN-059112',
    name: 'Taylor Brooks',
    age: 51,
    acuityLevel: 'MEDIUM',
    mobilityRisk: 'LOW',
    fallRisk: false,
    notes: 'Awaiting admission. Needs telemetry.',
    unitId: 'unit-a'
  }
];

export const admissions: Admission[] = [
  {
    id: 'admission-1',
    patientId: 'patient-1',
    requestedUnit: 'unit-a',
    requestedType: 'ICU',
    admitStatus: 'ADMITTED',
    requestedAt: '2026-02-05T17:10:00Z',
    assignedAt: '2026-02-05T18:00:00Z'
  },
  {
    id: 'admission-2',
    patientId: 'patient-3',
    requestedUnit: 'unit-a',
    requestedType: 'MED_SURG',
    admitStatus: 'PENDING',
    requestedAt: '2026-02-06T05:15:00Z'
  }
];

export const tasks: Task[] = [
  {
    id: 'task-1',
    roomId: 'room-402',
    type: 'CLEANING',
    status: 'IN_PROGRESS',
    assignedTo: 'EVS-12',
    createdAt: '2026-02-06T01:40:00Z'
  },
  {
    id: 'task-2',
    roomId: 'room-404',
    type: 'MAINTENANCE',
    status: 'OPEN',
    assignedTo: 'BIO-4',
    createdAt: '2026-02-06T00:20:00Z'
  },
  {
    id: 'task-3',
    patientId: 'patient-1',
    type: 'NURSING',
    status: 'OPEN',
    createdAt: '2026-02-06T02:00:00Z'
  }
];

export const sensors: Sensor[] = [
  { id: 'sensor-401', roomId: 'room-401', type: 'CAMERA', metadata: { zone: 'north' } },
  { id: 'sensor-402', roomId: 'room-402', type: 'CAMERA', metadata: { zone: 'center' } },
  { id: 'sensor-403', roomId: 'room-403', type: 'CAMERA', metadata: { zone: 'south' } }
];

export const cvEvents: CVEvent[] = [
  {
    id: 'event-1',
    sensorId: 'sensor-401',
    roomId: 'room-401',
    patientId: 'patient-1',
    eventType: 'BED_EXIT',
    confidence: 0.82,
    capturedAt: '2026-02-06T05:42:00Z',
    payload: { durationSeconds: 12 }
  },
  {
    id: 'event-2',
    sensorId: 'sensor-402',
    roomId: 'room-402',
    patientId: null,
    eventType: 'MISSING_BED_RAIL',
    confidence: 0.65,
    capturedAt: '2026-02-06T04:25:00Z',
    payload: { side: 'left' }
  }
];

export const alerts: Alert[] = [
  {
    id: 'alert-1',
    roomId: 'room-401',
    patientId: 'patient-1',
    severity: 'HIGH',
    category: 'BED_EXIT',
    status: 'OPEN',
    createdAt: '2026-02-06T05:42:30Z'
  },
  {
    id: 'alert-2',
    roomId: 'room-402',
    patientId: null,
    severity: 'MEDIUM',
    category: 'EQUIPMENT',
    status: 'OPEN',
    createdAt: '2026-02-06T04:26:10Z'
  }
];

export const mockUsers: User[] = [
  currentUser,
  { id: 'user-2', name: 'Dr. Elise Tran', role: 'Doctor' },
  { id: 'user-3', name: 'Avery Chen', role: 'EVS' },
  { id: 'user-4', name: 'Admin', role: 'Admin' }
];

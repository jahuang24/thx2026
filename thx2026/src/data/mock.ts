import type {
  Admission,
  Alert,
  Bed,
  CVEvent,
  Message,
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
  },
  {
    id: 'room-406',
    unitId: 'unit-b',
    roomNumber: '406',
    type: 'MED_SURG',
    status: 'READY',
    lastCleanedAt: '2026-02-06T04:05:00Z',
    maintenanceFlags: [],
    readinessReasons: []
  },
  {
    id: 'room-407',
    unitId: 'unit-b',
    roomNumber: '407',
    type: 'OBS',
    status: 'NOT_READY',
    lastCleanedAt: '2026-02-05T23:05:00Z',
    maintenanceFlags: ['IV pump calibration'],
    readinessReasons: ['Equipment check pending']
  },
  {
    id: 'room-408',
    unitId: 'unit-a',
    roomNumber: '408',
    type: 'ICU',
    status: 'CLEANING',
    lastCleanedAt: '2026-02-06T02:55:00Z',
    maintenanceFlags: [],
    readinessReasons: ['EVS turnover in progress']
  },
  {
    id: 'room-409',
    unitId: 'unit-a',
    roomNumber: '409',
    type: 'MED_SURG',
    status: 'READY',
    lastCleanedAt: '2026-02-06T03:25:00Z',
    maintenanceFlags: [],
    readinessReasons: []
  },
  {
    id: 'room-410',
    unitId: 'unit-b',
    roomNumber: '410',
    type: 'OBS',
    status: 'READY',
    lastCleanedAt: '2026-02-06T04:15:00Z',
    maintenanceFlags: [],
    readinessReasons: []
  },
  {
    id: 'room-411',
    unitId: 'unit-b',
    roomNumber: '411',
    type: 'ISOLATION',
    status: 'NOT_READY',
    lastCleanedAt: '2026-02-05T22:10:00Z',
    maintenanceFlags: ['Air filter replacement'],
    readinessReasons: ['Isolation prep in progress']
  },
  {
    id: 'room-412',
    unitId: 'unit-a',
    roomNumber: '412',
    type: 'MED_SURG',
    status: 'READY',
    lastCleanedAt: '2026-02-06T01:15:00Z',
    maintenanceFlags: [],
    readinessReasons: []
  },
  {
    id: 'room-413',
    unitId: 'unit-b',
    roomNumber: '413',
    type: 'OBS',
    status: 'CLEANING',
    lastCleanedAt: '2026-02-06T00:45:00Z',
    maintenanceFlags: [],
    readinessReasons: ['EVS turnover in progress']
  },
  {
    id: 'room-414',
    unitId: 'unit-b',
    roomNumber: '414',
    type: 'MED_SURG',
    status: 'READY',
    lastCleanedAt: '2026-02-06T02:35:00Z',
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
  { id: 'bed-405a', roomId: 'room-405', bedLabel: 'A', occupied: true, patientId: 'patient-2' },
  { id: 'bed-406a', roomId: 'room-406', bedLabel: 'A', occupied: false, patientId: null },
  { id: 'bed-406b', roomId: 'room-406', bedLabel: 'B', occupied: false, patientId: null },
  { id: 'bed-407a', roomId: 'room-407', bedLabel: 'A', occupied: false, patientId: null },
  { id: 'bed-408a', roomId: 'room-408', bedLabel: 'A', occupied: false, patientId: null },
  { id: 'bed-408b', roomId: 'room-408', bedLabel: 'B', occupied: true, patientId: 'patient-3' },
  { id: 'bed-409a', roomId: 'room-409', bedLabel: 'A', occupied: false, patientId: null },
  { id: 'bed-409b', roomId: 'room-409', bedLabel: 'B', occupied: false, patientId: null },
  { id: 'bed-410a', roomId: 'room-410', bedLabel: 'A', occupied: false, patientId: null },
  { id: 'bed-411a', roomId: 'room-411', bedLabel: 'A', occupied: false, patientId: null },
  { id: 'bed-412a', roomId: 'room-412', bedLabel: 'A', occupied: false, patientId: null },
  { id: 'bed-413a', roomId: 'room-413', bedLabel: 'A', occupied: false, patientId: null },
  { id: 'bed-414a', roomId: 'room-414', bedLabel: 'A', occupied: false, patientId: null }
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

export const patientVitalsById: Record<
  string,
  {
    heartRate: number;
    respiration: number;
    spo2: number;
    bloodPressure: string;
    temperatureF: number;
  }
> = {
  'patient-1': { heartRate: 92, respiration: 20, spo2: 95, bloodPressure: '128/82', temperatureF: 99.1 },
  'patient-2': { heartRate: 78, respiration: 16, spo2: 97, bloodPressure: '122/76', temperatureF: 98.4 },
  'patient-3': { heartRate: 86, respiration: 18, spo2: 96, bloodPressure: '130/80', temperatureF: 98.9 }
};

export const vitalsPool: Array<{
  heartRate: number;
  respiration: number;
  spo2: number;
  bloodPressure: string;
  temperatureF: number;
}> = [
  { heartRate: 72, respiration: 14, spo2: 98, bloodPressure: '118/74', temperatureF: 98.2 },
  { heartRate: 88, respiration: 18, spo2: 96, bloodPressure: '126/80', temperatureF: 98.8 },
  { heartRate: 96, respiration: 22, spo2: 94, bloodPressure: '134/86', temperatureF: 99.4 },
  { heartRate: 80, respiration: 16, spo2: 97, bloodPressure: '120/78', temperatureF: 98.6 },
  { heartRate: 104, respiration: 20, spo2: 95, bloodPressure: '138/90', temperatureF: 99.1 }
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

export const messages: Message[] = [
  {
    id: 'msg-1',
    patientId: 'patient-1',
    sender: 'PATIENT',
    body: 'My IV line feels tight. Can someone check it?',
    sentAt: '2026-02-06T05:10:00Z',
    readByNurse: false,
    readByPatient: true
  },
  {
    id: 'msg-2',
    patientId: 'patient-1',
    sender: 'NURSE',
    body: 'On my way to take a look. Please keep your arm still.',
    sentAt: '2026-02-06T05:12:00Z',
    readByNurse: true,
    readByPatient: false
  },
  {
    id: 'msg-3',
    patientId: 'patient-2',
    sender: 'PATIENT',
    body: 'I am feeling a bit short of breath.',
    sentAt: '2026-02-06T04:55:00Z',
    readByNurse: true,
    readByPatient: true
  }
];

export const mockUsers: User[] = [
  currentUser,
  { id: 'user-2', name: 'Dr. Elise Tran', role: 'Doctor' },
  { id: 'user-3', name: 'Avery Chen', role: 'EVS' },
  { id: 'user-4', name: 'Admin', role: 'Admin' }
];

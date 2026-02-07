import { beds, rooms } from '../data/mock';

const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:5050';

const normalizeId = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.$oid) return String(obj.$oid);
    if (obj._id) return String(obj._id);
    if (obj.id) return String(obj.id);
  }
  if (value == null) return '';
  return String(value);
};

export const normalizeRoomId = (value: unknown): string | null => {
  if (!value) return null;
  const raw = String(value).trim();
  const direct = rooms.find((room) => room.id === raw);
  if (direct) return direct.id;

  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  const byNumber = rooms.find((room) => {
    const roomNumber = room.roomNumber.toLowerCase();
    return roomNumber === cleaned || `room${roomNumber}` === cleaned;
  });
  return byNumber?.id ?? null;
};

export const normalizeBedId = (value: unknown, normalizedRoomId?: string | null): string | null => {
  if (!value && !normalizedRoomId) return null;

  if (value) {
    const raw = String(value).trim();
    const direct = beds.find((bed) => bed.id === raw);
    if (direct) return direct.id;

    const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
    const byLabel = beds.find((bed) => {
      const room = rooms.find((roomItem) => roomItem.id === bed.roomId);
      const roomNumber = room?.roomNumber?.toLowerCase() ?? '';
      const combined = `${roomNumber}${bed.bedLabel.toLowerCase()}`;
      const prefixed = `bed${combined}`;
      return combined === cleaned || prefixed === cleaned;
    });
    if (byLabel) return byLabel.id;
  }

  if (normalizedRoomId) {
    const firstBed = beds.find((bed) => bed.roomId === normalizedRoomId);
    return firstBed?.id ?? null;
  }

  return null;
};

export type PatientRecord = {
  id: string;
  name: string;
  mrn: string;
  dob?: string | null;
  roomId?: string | null;
  bedId?: string | null;
};

export async function fetchPatients({ page = 1, limit = 10 } = {}): Promise<PatientRecord[]> {
  const response = await fetch(`${API_BASE}/patients?page=${page}&limit=${limit}`);
  if (!response.ok) {
    throw new Error('Failed to fetch patients');
  }
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data.map((item) => ({
    id: normalizeId(item._id ?? item.id),
    name: item.name ?? 'Patient',
    mrn: item.mrn ?? '',
    dob: item.dob ?? null,
    roomId: normalizeRoomId(item.roomId ?? null),
    bedId: normalizeBedId(item.bedId ?? null, normalizeRoomId(item.roomId ?? null))
  }));
}

export async function fetchPatientById(id: string): Promise<PatientRecord | null> {
  const response = await fetch(`${API_BASE}/patients/${id}`);
  if (!response.ok) return null;
  const item = await response.json();
  return {
    id: normalizeId(item._id ?? item.id),
    name: item.name ?? 'Patient',
    mrn: item.mrn ?? '',
    dob: item.dob ?? null,
    roomId: item.roomId ?? null,
    bedId: item.bedId ?? null
  };
}

export async function updatePatientAssignment(
  id: string,
  payload: { roomId?: string | null; bedId?: string | null; unitId?: string | null }
): Promise<boolean> {
  const response = await fetch(`${API_BASE}/patients/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return response.ok;
}

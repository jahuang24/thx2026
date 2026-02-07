import { beds, rooms } from '../data/mock';

const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:5050';
const DEFAULT_PATIENTS_TIMEOUT_MS = 4000;

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

type PatientRecordCacheEntry = {
  value: PatientRecord | null;
  at: number;
  inflight: Promise<PatientRecord | null> | null;
};

const patientByIdCache = new Map<string, PatientRecordCacheEntry>();

let cachedPatients: PatientRecord[] | null = null;
let cachedPatientsAt = 0;
let inflightPatients: Promise<PatientRecord[]> | null = null;

export function getCachedPatients(): PatientRecord[] | null {
  return cachedPatients;
}

export async function fetchPatients({
  page = 1,
  limit = 200,
  force = false,
  ttlMs = 5000,
  timeoutMs = DEFAULT_PATIENTS_TIMEOUT_MS
}: {
  page?: number;
  limit?: number;
  force?: boolean;
  ttlMs?: number;
  timeoutMs?: number;
} = {}): Promise<PatientRecord[]> {
  const useCache = !force && page === 1 && limit === 200;
  const now = Date.now();
  if (useCache && cachedPatients && now - cachedPatientsAt < ttlMs) {
    return cachedPatients;
  }
  if (useCache && inflightPatients) {
    return inflightPatients;
  }

  const request = (async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${API_BASE}/patients?page=${page}&limit=${limit}`, {
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error('Failed to fetch patients');
      }
      const data = await response.json();
      const normalized = Array.isArray(data)
        ? data.map((item) => ({
            id: normalizeId(item._id ?? item.id),
            name: item.name ?? 'Patient',
            mrn: item.mrn ?? '',
            dob: item.dob ?? null,
            roomId: normalizeRoomId(item.roomId ?? null),
            bedId: normalizeBedId(item.bedId ?? null, normalizeRoomId(item.roomId ?? null))
          }))
        : [];

      if (useCache) {
        cachedPatients = normalized;
        cachedPatientsAt = Date.now();
      }
      return normalized;
    } catch (err) {
      if (useCache && cachedPatients) {
        return cachedPatients;
      }
      throw err;
    } finally {
      window.clearTimeout(timeoutId);
    }
  })();

  if (useCache) {
    inflightPatients = request;
  }

  try {
    return await request;
  } finally {
    if (useCache) inflightPatients = null;
  }
}

export async function fetchPatientById(
  id: string,
  {
    force = false,
    ttlMs = 5000,
    timeoutMs = DEFAULT_PATIENTS_TIMEOUT_MS
  }: { force?: boolean; ttlMs?: number; timeoutMs?: number } = {}
): Promise<PatientRecord | null> {
  if (!id) return null;
  const entry = patientByIdCache.get(id) ?? { value: null, at: 0, inflight: null };
  const now = Date.now();
  if (!force && entry.value && now - entry.at < ttlMs) {
    return entry.value;
  }
  if (!force && entry.inflight) {
    return entry.inflight;
  }

  const request = (async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${API_BASE}/patients/${id}`, { signal: controller.signal });
      if (!response.ok) return entry.value ?? null;
      const item = await response.json();
      const normalized = {
        id: normalizeId(item._id ?? item.id),
        name: item.name ?? 'Patient',
        mrn: item.mrn ?? '',
        dob: item.dob ?? null,
        roomId: item.roomId ?? null,
        bedId: item.bedId ?? null
      };
      entry.value = normalized;
      entry.at = Date.now();
      return normalized;
    } catch {
      return entry.value ?? null;
    } finally {
      window.clearTimeout(timeoutId);
    }
  })();

  if (!force) {
    entry.inflight = request;
    patientByIdCache.set(id, entry);
  }

  try {
    return await request;
  } finally {
    if (!force) {
      entry.inflight = null;
      patientByIdCache.set(id, entry);
    }
  }
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

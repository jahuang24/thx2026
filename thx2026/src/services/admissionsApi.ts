const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:5050';
const DEFAULT_ADMISSIONS_TIMEOUT_MS = 4000;

const normalizeId = (value: any): string => {
  if (typeof value === 'string') return value;
  if (value?.$oid) return String(value.$oid);
  if (value?._id) return String(value._id);
  if (value?.id) return String(value.id);
  if (value == null) return '';
  return String(value);
};

export type AdmissionRecord = {
  id: string;
  patientId: string;
  requestedType: string;
  requestedUnit: string;
  admitStatus: 'PENDING' | 'ASSIGNED' | 'ADMITTED';
  requestedAt: string;
};

let cachedAdmissions: AdmissionRecord[] | null = null;
let cachedAdmissionsAt = 0;
let inflightAdmissions: Promise<AdmissionRecord[]> | null = null;

export function getCachedAdmissions(): AdmissionRecord[] | null {
  return cachedAdmissions;
}

export async function fetchAdmissions({
  force = false,
  ttlMs = 5000,
  timeoutMs = DEFAULT_ADMISSIONS_TIMEOUT_MS
}: { force?: boolean; ttlMs?: number; timeoutMs?: number } = {}): Promise<AdmissionRecord[]> {
  const useCache = !force;
  const now = Date.now();
  if (useCache && cachedAdmissions && now - cachedAdmissionsAt < ttlMs) {
    return cachedAdmissions;
  }
  if (useCache && inflightAdmissions) {
    return inflightAdmissions;
  }

  const request = (async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${API_BASE}/admissions`, { signal: controller.signal });
      if (!response.ok) return [];
      const data = await response.json();
      const normalized = Array.isArray(data)
        ? data
            .map((item) => ({
              id: normalizeId(item._id ?? item.id),
              patientId: normalizeId(item.patientId),
              requestedType: item.requestedType,
              requestedUnit: item.requestedUnit,
              admitStatus: item.admitStatus,
              requestedAt: item.requestedAt
            }))
            .filter((item) => item.id && item.patientId)
        : [];
      if (useCache) {
        cachedAdmissions = normalized;
        cachedAdmissionsAt = Date.now();
      }
      return normalized;
    } catch (err) {
      if (useCache && cachedAdmissions) return cachedAdmissions;
      return [];
    } finally {
      window.clearTimeout(timeoutId);
    }
  })();

  if (useCache) inflightAdmissions = request;
  try {
    return await request;
  } finally {
    if (useCache) inflightAdmissions = null;
  }
}

export async function ensureAdmissionsQueue({
  timeoutMs = DEFAULT_ADMISSIONS_TIMEOUT_MS
}: { timeoutMs?: number } = {}): Promise<number> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}/admissions/queue/ensure`, {
      method: 'POST',
      signal: controller.signal
    });
    if (!response.ok) return 0;
    const data = await response.json();
    return data?.created ?? 0;
  } catch {
    return 0;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function updateAdmissionStatus(
  id: string,
  payload: { admitStatus?: 'PENDING' | 'ASSIGNED' | 'ADMITTED'; assignedAt?: string }
): Promise<boolean> {
  const response = await fetch(`${API_BASE}/admissions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return response.ok;
}

export async function createAdmission(payload: {
  patientId: string;
  requestedType?: string;
  requestedUnit?: string;
  admitStatus?: 'PENDING' | 'ASSIGNED' | 'ADMITTED';
}): Promise<boolean> {
  const response = await fetch(`${API_BASE}/admissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return response.ok;
}

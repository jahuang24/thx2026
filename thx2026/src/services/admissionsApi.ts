const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:5050';

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

export async function fetchAdmissions(): Promise<AdmissionRecord[]> {
  const response = await fetch(`${API_BASE}/admissions`);
  if (!response.ok) return [];
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => ({
      id: normalizeId(item._id ?? item.id),
      patientId: normalizeId(item.patientId),
      requestedType: item.requestedType,
      requestedUnit: item.requestedUnit,
      admitStatus: item.admitStatus,
      requestedAt: item.requestedAt
    }))
    .filter((item) => item.id && item.patientId);
}

export async function ensureAdmissionsQueue(): Promise<number> {
  const response = await fetch(`${API_BASE}/admissions/queue/ensure`, {
    method: 'POST'
  });
  if (!response.ok) return 0;
  const data = await response.json();
  return data?.created ?? 0;
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

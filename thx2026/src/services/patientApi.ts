const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:5050';

const normalizeId = (value: any): string => {
  if (typeof value === 'string') return value;
  if (value?.$oid) return String(value.$oid);
  if (value?._id) return String(value._id);
  if (value?.id) return String(value.id);
  if (value == null) return '';
  return String(value);
};

export type PatientRecord = {
  id: string;
  name: string;
  mrn: string;
  dob?: string | null;
  roomId?: string | null;
  bedId?: string | null;
};

export async function fetchPatients(): Promise<PatientRecord[]> {
  const response = await fetch(`${API_BASE}/patients`);
  if (!response.ok) return [];
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data.map((item) => ({
    id: normalizeId(item._id ?? item.id),
    name: item.name ?? 'Patient',
    mrn: item.mrn ?? '',
    dob: item.dob ?? null,
    roomId: item.roomId ?? null,
    bedId: item.bedId ?? null
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

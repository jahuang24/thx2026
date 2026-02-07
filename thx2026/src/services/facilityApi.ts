import type { Bed, Room } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:5050';

const normalizeId = (value: any): string => {
  if (typeof value === 'string') return value;
  if (value?.$oid) return String(value.$oid);
  if (value?._id) return String(value._id);
  if (value?.id) return String(value.id);
  if (value == null) return '';
  return String(value);
};

export type RoomRecord = Room & { capacity?: number };

const normalizeRoom = (item: any): RoomRecord => ({
  id: normalizeId(item._id ?? item.id),
  unitId: item.unitId ?? '',
  roomNumber: item.roomNumber ?? '',
  type: item.type ?? 'MED_SURG',
  status: item.status ?? 'READY',
  capacity: item.capacity ?? undefined,
  lastCleanedAt: item.lastCleanedAt ?? null,
  maintenanceFlags: Array.isArray(item.maintenanceFlags) ? item.maintenanceFlags : [],
  readinessReasons: Array.isArray(item.readinessReasons) ? item.readinessReasons : []
});

const normalizeBed = (item: any): Bed => ({
  id: normalizeId(item._id ?? item.id),
  roomId: item.roomId ?? '',
  bedLabel: item.bedLabel ?? '',
  occupied: Boolean(item.occupied),
  patientId: item.patientId ?? null
});

export async function fetchRooms(): Promise<RoomRecord[]> {
  const response = await fetch(`${API_BASE}/rooms`);
  if (!response.ok) return [];
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data.map(normalizeRoom);
}

export async function fetchBeds(): Promise<Bed[]> {
  const response = await fetch(`${API_BASE}/beds`);
  if (!response.ok) return [];
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data.map(normalizeBed);
}

export async function updateRoomConfig(
  roomId: string,
  payload: { type?: Room['type']; capacity?: number }
): Promise<RoomRecord | null> {
  const response = await fetch(`${API_BASE}/rooms/${roomId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) return null;
  const data = await response.json();
  return normalizeRoom(data);
}

import { Link } from 'react-router-dom';
import type { Bed, Patient, Room } from '../types';
import { StatusPill } from './StatusPill';

export function RoomRow({
  room,
  beds,
  patients
}: {
  room: Room;
  beds: Bed[];
  patients: Patient[];
}) {
  const roomBeds = beds.filter((bed) => bed.roomId === room.id);
  const occupiedBeds = roomBeds.filter((bed) => bed.occupied);
  const patientNames = occupiedBeds
    .map((bed) => patients.find((patient) => patient.id === bed.patientId))
    .filter(Boolean)
    .map((patient) => patient?.name ?? 'Patient');

  return (
    <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] items-center gap-4 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm">
      <div>
        <p className="font-semibold text-ink-900">Room {room.roomNumber}</p>
        <p className="text-xs text-ink-500">{room.type.replace('_', ' ')}</p>
      </div>
      <StatusPill status={room.status} />
      <div>
        <p className="text-xs text-ink-500">Occupancy</p>
        <p className="font-semibold text-ink-900">
          {occupiedBeds.length}/{roomBeds.length}
        </p>
      </div>
      <div>
        <p className="text-xs text-ink-500">Patient</p>
        <p className="font-semibold text-ink-900">
          {patientNames.length > 0 ? patientNames.join(', ') : 'Unassigned'}
        </p>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Link
          to={`/rooms/${room.id}`}
          className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700"
        >
          View
        </Link>
      </div>
    </div>
  );
}

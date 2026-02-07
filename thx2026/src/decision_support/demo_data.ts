import type { BedDS, Coordinate, GridMap, PatientNeeds } from './types';

export const demoGridMap: GridMap = {
  kind: 'grid',
  width: 6,
  height: 6,
  cells: [
    // y = 0
    [w(), w(), w(), w(), w(), w()],
    // y = 1
    [w(), w(), w(), blocked(), w(), w()],
    // y = 2
    [w(), w(), slow(2), slow(2), w(), w()],
    // y = 3
    [w(), blocked(), blocked(), w(), w(), w()],
    // y = 4
    [w(), w(), w(), w(), w(), w()],
    // y = 5
    [w(), w(), w(), w(), w(), w()]
  ],
  restrictedCells: new Set(['2,3', '2,1'])
};

function w(): { walkable: boolean; weight?: number } {
  return { walkable: true };
}
function blocked(): { walkable: boolean; restricted: boolean } {
  return { walkable: false, restricted: true };
}
function slow(weight: number) {
  return { walkable: true, weight };
}

export const demoBeds: BedDS[] = [
  {
    bed_id: 'bed-icu-1',
    room_id: 'icu-1',
    available: true,
    room_type: 'icu',
    isolation_capable: true,
    equipment: ['oxygen', 'vent', 'telemetry'],
    location: { x: 4, y: 1 }
  },
  {
    bed_id: 'bed-icu-2',
    room_id: 'icu-2',
    available: false,
    room_type: 'icu',
    isolation_capable: true,
    equipment: ['oxygen', 'vent'],
    location: { x: 5, y: 1 }
  },
  {
    bed_id: 'bed-step-1',
    room_id: 'step-1',
    available: true,
    room_type: 'stepdown',
    isolation_capable: false,
    equipment: ['oxygen', 'telemetry'],
    location: { x: 1, y: 4 }
  },
  {
    bed_id: 'bed-reg-1',
    room_id: 'reg-1',
    available: true,
    room_type: 'regular',
    isolation_capable: false,
    equipment: ['oxygen'],
    location: { x: 3, y: 5 }
  },
  {
    bed_id: 'bed-reg-iso',
    room_id: 'reg-iso',
    available: true,
    room_type: 'regular',
    isolation_capable: true,
    equipment: ['oxygen'],
    location: { x: 0, y: 2 }
  }
];

export const demoPatients: Record<string, PatientNeeds> = {
  high_icu: {
    acuity: 'high',
    isolation_required: false,
    needs_oxygen: true,
    needs_vent: true,
    mobility_risk: true
  },
  high_no_icu: {
    acuity: 'high',
    isolation_required: false,
    needs_oxygen: true,
    needs_vent: false,
    mobility_risk: false
  },
  iso_patient: {
    acuity: 'medium',
    isolation_required: true,
    needs_oxygen: false,
    needs_vent: false
  },
  low_simple: {
    acuity: 'low',
    isolation_required: false,
    needs_oxygen: false,
    needs_vent: false
  }
};

export const nurseStart: Coordinate = { x: 0, y: 0 };

export const demoConfig = {
  weights: {
    room_match: 40,
    equipment_match: 25,
    distance: 1.2,
    acuity_penalty_non_icu_for_high: 30,
    mobility_bonus_short_distance: 0.6
  },
  behavior: {
    k_default: 3,
    exclude_unreachable: true,
    include_unreachable_with_penalty: false
  }
};

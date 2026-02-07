import { describe, expect, it } from 'vitest';
import { demoBeds, demoGridMap, demoPatients, nurseStart, recommendBeds, shortestPath } from '../decision_support';
import type { BedDS, GraphMap, GridMap, PatientNeeds } from '../decision_support';

describe('pathfinding', () => {
  const basicGrid: GridMap = {
    kind: 'grid',
    width: 3,
    height: 3,
    cells: [
      [{ walkable: true }, { walkable: true }, { walkable: true }],
      [{ walkable: true }, { walkable: true }, { walkable: true }],
      [{ walkable: true }, { walkable: true }, { walkable: true }]
    ]
  };

  it('handles start equals goal', () => {
    const res = shortestPath(basicGrid, { x: 1, y: 1 }, { x: 1, y: 1 });
    expect(res.reachable).toBe(true);
    expect(res.cost).toBe(0);
    expect(res.path).toEqual([{ x: 1, y: 1 }]);
  });

  it('returns unreachable when blocked', () => {
    const blocked: GridMap = {
      ...basicGrid,
      cells: [
        [{ walkable: true }, { walkable: false, restricted: true }, { walkable: true }],
        [{ walkable: true }, { walkable: false, restricted: true }, { walkable: true }],
        [{ walkable: true }, { walkable: false, restricted: true }, { walkable: true }]
      ]
    };
    const res = shortestPath(blocked, { x: 0, y: 0 }, { x: 2, y: 2 });
    expect(res.reachable).toBe(false);
  });

  it('prefers cheaper weighted path over shorter steps', () => {
    const weighted: GridMap = {
      kind: 'grid',
      width: 3,
      height: 2,
      cells: [
        [{ walkable: true }, { walkable: true, weight: 5 }, { walkable: true }],
        [{ walkable: true }, { walkable: true }, { walkable: true }]
      ]
    };
    const res = shortestPath(weighted, { x: 0, y: 0 }, { x: 2, y: 0 });
    // Best route should go down then across avoiding heavy middle cell
    expect(res.path).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 0 }
    ]);
  });

  it('returns invalid for missing graph nodes', () => {
    const graph: GraphMap = { kind: 'graph', nodes: { a: { id: 'a' } }, edges: [] };
    const res = shortestPath(graph, 'a', 'missing');
    expect(res.reachable).toBe(false);
    expect(res.reason).toBe('invalid start or goal');
  });
});

describe('recommendation', () => {
  const simplePatient: PatientNeeds = {
    acuity: 'medium',
    isolation_required: false,
    needs_oxygen: true,
    needs_vent: false
  };

  it('returns empty when no beds available', () => {
    const beds: BedDS[] = demoBeds.map((b) => ({ ...b, available: false }));
    const { recommendations, excluded } = recommendBeds(simplePatient, beds, nurseStart, demoGridMap);
    expect(recommendations.length).toBe(0);
    expect(excluded.length).toBeGreaterThan(0);
  });

  it('high acuity prefers ICU when available even if farther', () => {
    const { recommendations } = recommendBeds(demoPatients.high_icu, demoBeds, nurseStart, demoGridMap);
    expect(recommendations[0].room_id).toContain('icu');
  });

  it('high acuity without ICU applies penalty and notes', () => {
    const bedsNoICU = demoBeds.filter((b) => b.room_type !== 'icu');
    const { recommendations } = recommendBeds(demoPatients.high_no_icu, bedsNoICU, nurseStart, demoGridMap);
    expect(recommendations[0].notes.some((n) => n.includes('no ICU available'))).toBe(true);
    expect(recommendations[0].score_breakdown.acuity_penalty).toBeLessThan(0);
  });

  it('vent/oxygen constraints filter properly', () => {
    const patient: PatientNeeds = {
      acuity: 'medium',
      isolation_required: false,
      needs_oxygen: true,
      needs_vent: true
    };
    const { recommendations } = recommendBeds(patient, demoBeds, nurseStart, demoGridMap);
    expect(recommendations.every((r) => r.hard_constraints_passed.vent)).toBe(true);
  });

  it('unreachable beds are excluded by default', () => {
    const blockedMap: GridMap = {
      kind: 'grid',
      width: 2,
      height: 2,
      cells: [
        [{ walkable: true }, { walkable: false, restricted: true }],
        [{ walkable: true }, { walkable: false, restricted: true }]
      ]
    };
    const hardBed: BedDS = {
      bed_id: 'blocked',
      room_id: 'blocked',
      available: true,
      room_type: 'regular',
      isolation_capable: false,
      equipment: ['oxygen'],
      location: { x: 1, y: 0 }
    };
    const { recommendations, excluded } = recommendBeds(simplePatient, [hardBed], { x: 0, y: 0 }, blockedMap);
    expect(recommendations.length).toBe(0);
    expect(excluded[0].reason).toBe('unreachable');
  });
});

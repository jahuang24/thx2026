import { shortestPath } from './pathfinding.ts';
import type {
  BedDS,
  ExcludedCandidate,
  MapInput,
  PatientNeeds,
  Recommendation,
  RecommendationConfig,
  RecommendationOutput,
  RoomTypeDS,
  ScoreBreakdown
} from './types.ts';

type ResolvedConfig = {
  weights: {
    room_match: number;
    equipment_match: number;
    distance: number;
    acuity_penalty_non_icu_for_high: number;
    mobility_bonus_short_distance: number;
  };
  behavior: {
    exclude_unreachable: boolean;
    include_unreachable_with_penalty: boolean;
    k_default: number;
  };
};

const DEFAULT_CONFIG: ResolvedConfig = {
  weights: {
    room_match: 50,
    equipment_match: 30,
    distance: 1.5,
    acuity_penalty_non_icu_for_high: 35,
    mobility_bonus_short_distance: 0.5
  },
  behavior: {
    exclude_unreachable: true,
    include_unreachable_with_penalty: false,
    k_default: 3
  }
};

function ensureConfig(config?: RecommendationConfig): ResolvedConfig {
  return {
    weights: { ...DEFAULT_CONFIG.weights, ...(config?.weights || {}) },
    behavior: { ...DEFAULT_CONFIG.behavior, ...(config?.behavior || {}) }
  };
}

function checkHardConstraints(patient: PatientNeeds, bed: BedDS) {
  const checks = {
    available: bed.available,
    isolation: !patient.isolation_required || bed.isolation_capable,
    vent: !patient.needs_vent || bed.equipment.includes('vent'),
    oxygen: !patient.needs_oxygen || bed.equipment.includes('oxygen')
  };
  return { checks, allPass: Object.values(checks).every(Boolean) };
}

function roomMatchScore(patient: PatientNeeds, roomType: RoomTypeDS, weight: number) {
  if (patient.acuity === 'high') {
    return roomType === 'icu' ? weight : weight * -1; // penalize non-ICU
  }
  if (patient.acuity === 'medium') {
    if (roomType === 'icu') return weight * 0.6;
    if (roomType === 'stepdown') return weight;
    return weight * 0.8;
  }
  // low acuity
  if (roomType === 'icu') return weight * 0.2;
  return weight;
}

function equipmentScore(patient: PatientNeeds, equipment: string[], weight: number) {
  let score = 0;
  if (patient.needs_vent) score += equipment.includes('vent') ? weight * 0.5 : -weight * 0.5;
  if (patient.needs_oxygen) score += equipment.includes('oxygen') ? weight * 0.3 : -weight * 0.3;
  return score;
}

function mobilityScore(patient: PatientNeeds, distance: number, weight: number) {
  if (!patient.mobility_risk) return 0;
  return -distance * weight;
}

export function recommendBeds(
  patient: PatientNeeds,
  beds: BedDS[],
  startLocation: unknown,
  map: MapInput,
  config?: RecommendationConfig,
  k = DEFAULT_CONFIG.behavior.k_default
): RecommendationOutput {
  const cfg = ensureConfig(config);
  const excluded: ExcludedCandidate[] = [];

  const feasibleCandidates = beds
    .map((bed) => {
      const { checks, allPass } = checkHardConstraints(patient, bed);
      return { bed, checks, allPass };
    })
    .filter((candidate) => {
      if (!candidate.allPass) {
        excluded.push({
          bed_id: candidate.bed.bed_id,
          room_id: candidate.bed.room_id,
          reason: 'failed hard constraints'
        });
        return false;
      }
      return true;
    });

  const anyICU = feasibleCandidates.some((c) => c.bed.room_type === 'icu');

  const scored: Recommendation[] = [];

  for (const candidate of feasibleCandidates) {
    const { bed, checks } = candidate;
    const pathResult = shortestPath(map, startLocation as never, bed.location as never);

    if (!pathResult.reachable && cfg.behavior.exclude_unreachable && !cfg.behavior.include_unreachable_with_penalty) {
      excluded.push({ bed_id: bed.bed_id, room_id: bed.room_id, reason: pathResult.reason || 'unreachable' });
      continue;
    }

    const travel_cost = pathResult.cost;
    const roomScore = roomMatchScore(patient, bed.room_type, cfg.weights.room_match);
    const equipScore = equipmentScore(patient, bed.equipment, cfg.weights.equipment_match);
    const distancePenalty = -travel_cost * cfg.weights.distance;
    const acuityPenalty =
      patient.acuity === 'high' && bed.room_type !== 'icu'
        ? -cfg.weights.acuity_penalty_non_icu_for_high
        : 0;
    const mobilityBonus = mobilityScore(patient, travel_cost, cfg.weights.mobility_bonus_short_distance);

    const score_breakdown: ScoreBreakdown = {
      room_type: roomScore,
      equipment: equipScore,
      distance: distancePenalty,
      acuity_penalty: acuityPenalty,
      mobility_bonus: mobilityBonus
    };

    const score_total = Object.values(score_breakdown).reduce((a, b) => a + b, 0);

    const notes: string[] = [];
    if (patient.acuity === 'high' && bed.room_type !== 'icu' && !anyICU) {
      notes.push('no ICU available; applied penalty');
    }
    if (!pathResult.reachable) {
      notes.push('unreachable path; included with penalty');
    }

    scored.push({
      bed_id: bed.bed_id,
      room_id: bed.room_id,
      feasible: pathResult.reachable || cfg.behavior.include_unreachable_with_penalty,
      hard_constraints_passed: checks,
      score_total,
      score_breakdown,
      travel_cost,
      path: pathResult.path,
      notes
    });
  }

  const sorted = scored
    .sort((a, b) => {
      if (b.score_total !== a.score_total) return b.score_total - a.score_total;
      if (a.travel_cost !== b.travel_cost) return a.travel_cost - b.travel_cost;
      return a.bed_id.localeCompare(b.bed_id);
    })
    .slice(0, k ?? cfg.behavior.k_default);

  return { recommendations: sorted, excluded };
}

/**
 * Quick usage example:
 *
 * const result = recommendBeds(patientNeeds, bedList, nurseStart, map);
 * console.log(result.recommendations);
 */

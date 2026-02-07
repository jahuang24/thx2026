export type Acuity = 'low' | 'medium' | 'high';
export type RoomTypeDS = 'icu' | 'stepdown' | 'regular';

export interface PatientNeeds {
  acuity: Acuity;
  isolation_required: boolean;
  needs_oxygen: boolean;
  needs_vent: boolean;
  mobility_risk?: boolean;
}

export interface BedDS {
  bed_id: string;
  room_id: string;
  available: boolean;
  room_type: RoomTypeDS;
  isolation_capable: boolean;
  equipment: string[];
  location: Coordinate | GraphNodeId;
}

export type GraphNodeId = string;

export interface Coordinate {
  x: number;
  y: number;
}

export interface GridCell {
  walkable: boolean;
  weight?: number; // traversal cost multiplier (default 1)
  restricted?: boolean; // hard block if true
}

export interface GridMap {
  kind: 'grid';
  width: number;
  height: number;
  cells: GridCell[][]; // [y][x]
  restrictedCells?: Set<string>; // `${x},${y}` for blocks
}

export interface GraphNode {
  id: GraphNodeId;
  x?: number;
  y?: number;
  restricted?: boolean;
}

export interface GraphEdge {
  from: GraphNodeId;
  to: GraphNodeId;
  weight?: number;
  restricted?: boolean;
  bidirectional?: boolean; // default true
}

export interface GraphMap {
  kind: 'graph';
  nodes: Record<GraphNodeId, GraphNode>;
  edges: GraphEdge[];
  restrictedNodes?: Set<GraphNodeId>;
}

export interface PathResult<PathStep = Coordinate | GraphNodeId> {
  path: PathStep[];
  cost: number;
  reachable: boolean;
  reason?: string;
}

export interface ScoreBreakdown {
  room_type: number;
  equipment: number;
  distance: number;
  acuity_penalty: number;
  mobility_bonus: number;
}

export interface Recommendation {
  bed_id: string;
  room_id: string;
  feasible: boolean;
  hard_constraints_passed: Record<string, boolean>;
  score_total: number;
  score_breakdown: ScoreBreakdown;
  travel_cost: number;
  path: Array<Coordinate | GraphNodeId>;
  notes: string[];
}

export interface ExcludedCandidate {
  bed_id: string;
  room_id: string;
  reason: string;
}

export interface RecommendationConfig {
  weights?: {
    room_match?: number;
    equipment_match?: number;
    distance?: number; // negative penalty per unit distance
    acuity_penalty_non_icu_for_high?: number;
    mobility_bonus_short_distance?: number;
  };
  behavior?: {
    exclude_unreachable?: boolean;
    k_default?: number;
    include_unreachable_with_penalty?: boolean;
  };
}

export interface RecommendationOutput {
  recommendations: Recommendation[];
  excluded: ExcludedCandidate[];
}

export type MapInput = GridMap | GraphMap;

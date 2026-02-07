export type SubjectStatus = 'ACTIVE' | 'INACTIVE';

export interface RollingMetricsSnapshot {
  perclos: number;
  handToMouthPerMin: number;
  handToTemplePerMin: number;
  forwardLeanSecondsPerMin: number;
  postureChangeRate: number;
  movementLevel: number;
}

export type MonitorEventType =
  | 'HAND_TO_MOUTH'
  | 'HAND_TO_TEMPLE'
  | 'FORWARD_LEAN'
  | 'POSTURE_DROP'
  | 'PROLONGED_EYE_CLOSURE'
  | 'RESTLESSNESS_SPIKE'
  | 'NO_SUBJECT';

export interface MonitorEvent {
  id: string;
  ts: number;
  subjectId: string;
  type: MonitorEventType;
  detail?: string;
}

export interface PatientSubject {
  id: string;
  label: string;
  status: SubjectStatus;
  lastSeenAt: number;
  latestMetrics: RollingMetricsSnapshot;
  latestObservedSignals: string[];
}

export type AgentSeverity = 'LOW' | 'MED' | 'HIGH';

export type InterpretiveTag =
  | 'Possible nausea-like behavior pattern (non-diagnostic)'
  | 'Possible fatigue/drowsiness-like pattern (non-diagnostic)'
  | 'Possible distress-like pattern (non-diagnostic)'
  | 'Possible restlessness/agitation-like pattern (non-diagnostic)';

export interface AgentMessage {
  id: string;
  ts: number;
  subjectId: string;
  title: 'Check-in suggested' | 'Monitor';
  severity: AgentSeverity;
  confidence: number;
  observed: string;
  interpretiveTag?: InterpretiveTag;
  evidence: {
    metrics: RollingMetricsSnapshot;
    criteriaMet: string[];
    recentEvents: MonitorEvent[];
  };
  recommendation: string;
  disclaimer: string;
}

export type RelayState = 'NEUTRAL' | 'WATCHING' | 'ALERTED' | 'COOLDOWN';

export interface CalibrationProfile {
  blinkRatePerMin: number;
  movementLevel: number;
  headPose: number;
  completedAt: number;
}

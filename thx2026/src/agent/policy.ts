import type { CalibrationProfile, InterpretiveTag } from '../types/monitor';

export const NON_DIAGNOSTIC_DISCLAIMER = 'Non-diagnostic. Flags observable behavior patterns only.';

export const INTERPRETIVE_TAGS: Record<'nausea' | 'drowsy' | 'distress' | 'restless', InterpretiveTag> = {
  nausea: 'Possible nausea-like behavior pattern (non-diagnostic)',
  drowsy: 'Possible fatigue/drowsiness-like pattern (non-diagnostic)',
  distress: 'Possible distress-like pattern (non-diagnostic)',
  restless: 'Possible restlessness/agitation-like pattern (non-diagnostic)'
};

export interface AgentThresholds {
  evaluationIntervalMs: number;
  persistenceMs: number;
  cooldownMs: number;
  nauseaHandToMouthPerMin: number;
  nauseaHandEventsPerMinute: number;
  nauseaForwardLeanSecondsPerMin: number;
  nauseaPostureChangePerMin: number;
  postureDropStillnessSeconds: number;
  drowsyPerclos: number;
  lowMovement: number;
  highMovement: number;
  highPostureChange: number;
}

const DEFAULT_THRESHOLDS: AgentThresholds = {
  evaluationIntervalMs: 2000,
  persistenceMs: 15000,
  cooldownMs: 120000,
  nauseaHandToMouthPerMin: 2,
  nauseaHandEventsPerMinute: 3,
  nauseaForwardLeanSecondsPerMin: 15,
  nauseaPostureChangePerMin: 5,
  postureDropStillnessSeconds: 5,
  drowsyPerclos: 0.25,
  lowMovement: 0.25,
  highMovement: 0.65,
  highPostureChange: 7
};

export function buildThresholds(calibration: CalibrationProfile | null): AgentThresholds {
  if (!calibration) {
    return DEFAULT_THRESHOLDS;
  }

  const movementAdjustment = Math.max(-0.1, Math.min(0.1, (calibration.movementLevel - 0.45) * 0.25));
  const drowsyAdjustment = Math.max(-0.03, Math.min(0.03, (14 - calibration.blinkRatePerMin) * 0.005));

  return {
    ...DEFAULT_THRESHOLDS,
    drowsyPerclos: Math.max(0.2, Math.min(0.34, DEFAULT_THRESHOLDS.drowsyPerclos - drowsyAdjustment)),
    lowMovement: Math.max(0.15, Math.min(0.35, DEFAULT_THRESHOLDS.lowMovement + movementAdjustment)),
    highMovement: Math.max(0.55, Math.min(0.8, DEFAULT_THRESHOLDS.highMovement + movementAdjustment))
  };
}

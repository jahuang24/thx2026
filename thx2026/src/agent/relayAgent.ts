import { buildThresholds, INTERPRETIVE_TAGS, NON_DIAGNOSTIC_DISCLAIMER } from './policy';
import type {
  AgentMessage,
  AgentSeverity,
  CalibrationProfile,
  MonitorEvent,
  PatientSubject,
  RelayState
} from '../types/monitor';

interface SubjectRuntime {
  mode: RelayState;
  activeSince: number | null;
  cooldownUntil: number;
  lastSeverity: AgentSeverity | null;
  handledImmediateEvents: Set<string>;
}

type PatternKind =
  | 'NONE'
  | 'NAUSEA_LIKE'
  | 'DROWSY_LIKE'
  | 'RESTLESS_LIKE'
  | 'ACTIVITY'
  | 'MAJOR_POSTURE_SHIFT'
  | 'UNCERTAIN'
  | 'POSTURE_DROP';

export interface AgentEvaluationInput {
  ts: number;
  subject: PatientSubject;
  events60s: MonitorEvent[];
  newEvents: MonitorEvent[];
  calibration: CalibrationProfile | null;
}

export interface AgentEvaluationResult {
  observedSignals: string[];
  state: RelayState;
  message?: AgentMessage;
}

const severityRank: Record<AgentSeverity, number> = {
  LOW: 1,
  MED: 2,
  HIGH: 3
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function roundMetric(value: number) {
  return Number(value.toFixed(2));
}

function createObservedSignals(input: AgentEvaluationInput): string[] {
  const { latestMetrics } = input.subject;
  const signals: string[] = [];

  if (latestMetrics.handToMouthPerMin > 0.5) {
    signals.push(`repeated hand-to-mouth contacts (${roundMetric(latestMetrics.handToMouthPerMin)}/min)`);
  }
  if (latestMetrics.handToTemplePerMin > 0.5) {
    signals.push(`hand-to-temple contacts (${roundMetric(latestMetrics.handToTemplePerMin)}/min)`);
  }
  if (latestMetrics.forwardLeanSecondsPerMin >= 8) {
    signals.push(`forward-lean sustained (${roundMetric(latestMetrics.forwardLeanSecondsPerMin)}s/min)`);
  }
  if (latestMetrics.postureChangeRate >= 2) {
    signals.push(`frequent posture shifts (${roundMetric(latestMetrics.postureChangeRate)}/min)`);
  }
  if (latestMetrics.perclos >= 0.2) {
    signals.push(`eye-closure ratio elevated (PERCLOS ${roundMetric(latestMetrics.perclos)})`);
  }
  if (latestMetrics.movementLevel >= 0.65) {
    signals.push('restlessness elevated');
  }
  const recentNoSubject = input.events60s.some((event) => event.type === 'NO_SUBJECT');
  const majorPostureShiftSeen = input.events60s.some((event) => event.type === 'MAJOR_POSTURE_SHIFT');
  if (majorPostureShiftSeen) {
    signals.push('abrupt major posture shift observed');
  }
  if (recentNoSubject && signals.length === 0) {
    signals.push('subject intermittently not detected');
  }

  if (signals.length === 0) {
    signals.push('no strong observable behavior pattern in the current window');
  }

  return signals;
}

function toObservedLine(observedSignals: string[]) {
  return `Observed: ${observedSignals.join(', ')}.`;
}

function createMessageId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

function recentEventsForEvidence(events: MonitorEvent[]) {
  return [...events].sort((left, right) => right.ts - left.ts).slice(0, 8);
}

export class RelayAgent {
  private runtimeBySubject = new Map<string, SubjectRuntime>();

  reset() {
    this.runtimeBySubject.clear();
  }

  evaluate(input: AgentEvaluationInput): AgentEvaluationResult {
    const runtime = this.getOrCreateRuntime(input.subject.id);
    const thresholds = buildThresholds(input.calibration);
    const metrics = input.subject.latestMetrics;
    const handToMouthEvents = input.events60s.filter((event) => event.type === 'HAND_TO_MOUTH').length;
    const hasPostureDropNewEvent = input.newEvents.some((event) => event.type === 'POSTURE_DROP');
    const hasMajorPostureShiftNewEvent = input.newEvents.some((event) => event.type === 'MAJOR_POSTURE_SHIFT');
    const discomfortSignals =
      metrics.handToMouthPerMin >= 1.5 || metrics.forwardLeanSecondsPerMin >= 12 || metrics.postureChangeRate >= 3;
    const drowsySignals =
      metrics.perclos >= thresholds.drowsyPerclos &&
      metrics.movementLevel <= thresholds.lowMovement &&
      metrics.handToMouthPerMin < 1 &&
      metrics.forwardLeanSecondsPerMin < 12;
    const postureSensitiveMovementFloor = Math.max(0.4, thresholds.highMovement - 0.2);
    const restlessSignals =
      metrics.postureChangeRate >= thresholds.highPostureChange &&
      metrics.movementLevel >= postureSensitiveMovementFloor;
    const activitySignals =
      metrics.postureChangeRate >= 2 ||
      metrics.movementLevel >= 0.35 ||
      metrics.forwardLeanSecondsPerMin >= 8;
    const nauseaLike =
      (metrics.handToMouthPerMin >= thresholds.nauseaHandToMouthPerMin ||
        handToMouthEvents >= thresholds.nauseaHandEventsPerMinute) &&
      metrics.forwardLeanSecondsPerMin >= thresholds.nauseaForwardLeanSecondsPerMin &&
      (metrics.postureChangeRate >= thresholds.nauseaPostureChangePerMin ||
        metrics.movementLevel >= thresholds.highMovement);
    const uncertain = drowsySignals && discomfortSignals;

    const observedSignals = createObservedSignals(input);
    const evidenceEvents = recentEventsForEvidence(input.events60s);
    let criteriaMet: string[] = [];
    let pattern: PatternKind = 'NONE';
    let severity: AgentSeverity = 'LOW';
    let title: AgentMessage['title'] = 'Monitor';
    let recommendation = 'Continue observing for changes and re-evaluate trends.';
    let interpretiveTag: AgentMessage['interpretiveTag'];
    let confidence = 0.25;

    if (hasPostureDropNewEvent) {
      pattern = 'POSTURE_DROP';
      criteriaMet = ['posture-drop event detected'];
      severity = 'HIGH';
      title = 'Check-in suggested';
      recommendation = 'Urgent staff check-in suggested.';
      confidence = clamp01(0.68 + Math.max(0, 0.24 - metrics.movementLevel * 0.55));
    } else if (hasMajorPostureShiftNewEvent) {
      pattern = 'MAJOR_POSTURE_SHIFT';
      criteriaMet = ['major posture-shift event detected'];
      severity = 'MED';
      title = 'Check-in suggested';
      recommendation = 'Abrupt posture change detected; prompt check-in suggested.';
      confidence = clamp01(0.56 + Math.min(metrics.movementLevel, 0.34));
    } else if (nauseaLike) {
      pattern = 'NAUSEA_LIKE';
      criteriaMet = [
        `hand-to-mouth ${roundMetric(metrics.handToMouthPerMin)}/min`,
        `forward lean ${roundMetric(metrics.forwardLeanSecondsPerMin)}s/min`,
        `posture change ${roundMetric(metrics.postureChangeRate)}/min`
      ];
      severity = metrics.handToMouthPerMin >= 4 && metrics.postureChangeRate >= thresholds.highPostureChange ? 'HIGH' : 'MED';
      title = 'Check-in suggested';
      recommendation = 'Staff check-in suggested if this pattern persists.';
      interpretiveTag = INTERPRETIVE_TAGS.nausea;
      confidence = clamp01(
        0.45 +
          (Math.min(metrics.handToMouthPerMin, 5) / 5) * 0.25 +
          (Math.min(metrics.forwardLeanSecondsPerMin, 35) / 35) * 0.2 +
          (Math.min(metrics.postureChangeRate, 10) / 10) * 0.1
      );
    } else if (uncertain) {
      pattern = 'UNCERTAIN';
      criteriaMet = ['drowsy and discomfort-like signals overlap', 'signal interpretation uncertain'];
      severity = 'MED';
      title = 'Check-in suggested';
      recommendation = 'Observed pattern is uncertain; a brief check-in is suggested.';
      interpretiveTag = INTERPRETIVE_TAGS.distress;
      confidence = clamp01(0.5 + metrics.perclos * 0.2 + Math.min(metrics.handToMouthPerMin / 6, 0.2));
      observedSignals.push('pattern is uncertain due to overlapping indicators');
    } else if (drowsySignals) {
      pattern = 'DROWSY_LIKE';
      criteriaMet = [
        `PERCLOS ${roundMetric(metrics.perclos)} >= ${thresholds.drowsyPerclos}`,
        `movement ${roundMetric(metrics.movementLevel)} <= ${thresholds.lowMovement}`
      ];
      severity = 'LOW';
      title = 'Monitor';
      recommendation = 'Continue monitoring for prolonged low-responsiveness patterns.';
      interpretiveTag = INTERPRETIVE_TAGS.drowsy;
      confidence = clamp01(0.42 + metrics.perclos * 0.35);
    } else if (restlessSignals) {
      pattern = 'RESTLESS_LIKE';
      criteriaMet = [
        `posture changes ${roundMetric(metrics.postureChangeRate)}/min`,
        `movement ${roundMetric(metrics.movementLevel)}`
      ];
      severity = 'LOW';
      title = 'Monitor';
      recommendation = 'Continue monitoring and consider a comfort check if pattern persists.';
      interpretiveTag = INTERPRETIVE_TAGS.restless;
      confidence = clamp01(0.4 + Math.min(metrics.postureChangeRate / 12, 0.3) + metrics.movementLevel * 0.2);
    } else if (activitySignals) {
      pattern = 'ACTIVITY';
      criteriaMet = [
        `posture changes ${roundMetric(metrics.postureChangeRate)}/min`,
        `movement ${roundMetric(metrics.movementLevel)}`
      ];
      severity = 'LOW';
      title = 'Monitor';
      recommendation = 'Observed activity increased; continue watching short-term trend.';
      confidence = clamp01(0.28 + Math.min(metrics.postureChangeRate / 12, 0.25) + metrics.movementLevel * 0.2);
    }

    const shouldEmitImmediately = pattern === 'POSTURE_DROP' || pattern === 'MAJOR_POSTURE_SHIFT';
    const hasActionablePattern = pattern !== 'NONE';
    const inCooldown = input.ts < runtime.cooldownUntil;
    const canEscalateInCooldown =
      inCooldown && runtime.lastSeverity ? severityRank[severity] > severityRank[runtime.lastSeverity] : false;
    let emitMessage = false;
    let requiredPersistenceMs = thresholds.persistenceMs;

    if (pattern === 'RESTLESS_LIKE') {
      requiredPersistenceMs = Math.max(6000, Math.round(thresholds.persistenceMs * 0.6));
    } else if (pattern === 'ACTIVITY') {
      requiredPersistenceMs = 2500;
    }

    if (shouldEmitImmediately) {
      const immediateEvent = input.newEvents.find(
        (event) => event.type === 'POSTURE_DROP' || event.type === 'MAJOR_POSTURE_SHIFT'
      );
      if (immediateEvent && !runtime.handledImmediateEvents.has(immediateEvent.id)) {
        runtime.handledImmediateEvents.add(immediateEvent.id);
        emitMessage = true;
      }
    } else if (hasActionablePattern) {
      if (runtime.activeSince === null) {
        runtime.activeSince = input.ts;
      }
      const persistedLongEnough = input.ts - runtime.activeSince >= requiredPersistenceMs;
      if (persistedLongEnough && (!inCooldown || canEscalateInCooldown)) {
        emitMessage = true;
      }
    } else {
      runtime.activeSince = null;
    }

    if (!hasActionablePattern) {
      runtime.mode = inCooldown ? 'COOLDOWN' : 'NEUTRAL';
      return { observedSignals, state: runtime.mode };
    }

    if (emitMessage) {
      runtime.mode = 'ALERTED';
      runtime.cooldownUntil = input.ts + thresholds.cooldownMs;
      runtime.lastSeverity = severity;
      runtime.activeSince = null;

      const observed =
        pattern === 'POSTURE_DROP'
          ? 'Observed: sudden posture drop + prolonged stillness.'
          : pattern === 'MAJOR_POSTURE_SHIFT'
            ? 'Observed: abrupt major posture shift detected in a short interval.'
            : toObservedLine(observedSignals);
      const message: AgentMessage = {
        id: createMessageId(input.subject.id),
        ts: input.ts,
        subjectId: input.subject.id,
        title,
        severity,
        confidence: clamp01(confidence),
        observed,
        interpretiveTag:
          pattern === 'POSTURE_DROP' || pattern === 'MAJOR_POSTURE_SHIFT' ? undefined : interpretiveTag,
        evidence: {
          metrics,
          criteriaMet,
          recentEvents: evidenceEvents
        },
        recommendation,
        disclaimer: NON_DIAGNOSTIC_DISCLAIMER
      };
      return { observedSignals, state: runtime.mode, message };
    }

    runtime.mode = inCooldown ? 'COOLDOWN' : 'WATCHING';
    return { observedSignals, state: runtime.mode };
  }

  private getOrCreateRuntime(subjectId: string) {
    const existing = this.runtimeBySubject.get(subjectId);
    if (existing) {
      return existing;
    }
    const runtime: SubjectRuntime = {
      mode: 'NEUTRAL',
      activeSince: null,
      cooldownUntil: 0,
      lastSeverity: null,
      handledImmediateEvents: new Set()
    };
    this.runtimeBySubject.set(subjectId, runtime);
    return runtime;
  }
}

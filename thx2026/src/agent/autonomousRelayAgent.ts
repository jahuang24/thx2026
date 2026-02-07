import { DedalusClient, type AgentBackend, type DedalusDecision } from './dedalusClient';
import { NON_DIAGNOSTIC_DISCLAIMER } from './policy';
import { RelayAgent, type AgentEvaluationInput, type AgentEvaluationResult } from './relayAgent';
import type { AgentMessage, AgentSeverity, RelayState } from '../types/monitor';

interface AutonomousRuntime {
  cooldownUntil: number;
  lastSeverity: AgentSeverity | null;
  lastDedalusCallTs: number;
  nextRetryTs: number;
  lastSignature: string;
}

interface AutonomousStatus {
  backend: AgentBackend;
  configured: boolean;
  lastError: string | null;
}

const severityRank: Record<AgentSeverity, number> = {
  LOW: 1,
  MED: 2,
  HIGH: 3
};

const MIN_CALL_INTERVAL_MS = Number(import.meta.env.VITE_DEDALUS_MIN_CALL_INTERVAL_MS ?? 15000);
const HEARTBEAT_MS = Number(import.meta.env.VITE_DEDALUS_HEARTBEAT_MS ?? 90000);
const ERROR_BACKOFF_MS = Number(import.meta.env.VITE_DEDALUS_ERROR_BACKOFF_MS ?? 30000);
const ONLY_ALERTING =
  String(import.meta.env.VITE_DEDALUS_ONLY_ALERTING ?? 'true')
    .trim()
    .toLowerCase() !== 'false';

function createMessageId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

function toObservedLine(observedSignals: string[]) {
  return `Observed: ${observedSignals.join(', ')}.`;
}

function safeObservedText(messageObserved: string, observedSignals: string[]) {
  if (messageObserved.startsWith('Observed:')) {
    return messageObserved;
  }
  return toObservedLine(observedSignals);
}

function recentEventsForEvidence(input: AgentEvaluationInput) {
  return [...input.events60s].sort((left, right) => right.ts - left.ts).slice(0, 8);
}

export class AutonomousRelayAgent {
  private readonly rulesAgent = new RelayAgent();
  private readonly dedalusClient = new DedalusClient();
  private readonly runtimeBySubject = new Map<string, AutonomousRuntime>();
  private lastError: string | null = null;
  private backend: AgentBackend = this.dedalusClient.isConfigured() ? 'DEDALUS' : 'RULES';

  getStatus(): AutonomousStatus {
    return {
      backend: this.backend,
      configured: this.dedalusClient.isConfigured(),
      lastError: this.lastError
    };
  }

  reset() {
    this.runtimeBySubject.clear();
    this.lastError = null;
    this.backend = this.dedalusClient.isConfigured() ? 'DEDALUS' : 'RULES';
    this.rulesAgent.reset();
  }

  async evaluate(input: AgentEvaluationInput): Promise<AgentEvaluationResult> {
    const fallback = this.rulesAgent.evaluate(input);
    if (!this.dedalusClient.isConfigured()) {
      this.backend = 'RULES';
      return fallback;
    }

    const runtime = this.getOrCreateRuntime(input.subject.id);
    if (!this.shouldCallDedalus(input, fallback, runtime)) {
      this.backend = 'RULES';
      return fallback;
    }

    runtime.lastDedalusCallTs = input.ts;

    try {
      const decision = await this.dedalusClient.evaluate(input);
      runtime.nextRetryTs = 0;
      runtime.lastSignature = this.buildSignature(input);
      this.backend = 'DEDALUS';
      this.lastError = null;
      return this.mergeDecision(input, decision, fallback);
    } catch (error) {
      runtime.nextRetryTs = input.ts + ERROR_BACKOFF_MS;
      this.backend = 'RULES';
      this.lastError = error instanceof Error ? error.message : 'Dedalus call failed.';
      return fallback;
    }
  }

  private mergeDecision(
    input: AgentEvaluationInput,
    decision: DedalusDecision,
    fallback: AgentEvaluationResult
  ): AgentEvaluationResult {
    const subjectId = input.subject.id;
    const runtime = this.getOrCreateRuntime(subjectId);
    const now = input.ts;
    const observedSignals = decision.observedSignals.length ? decision.observedSignals : fallback.observedSignals;
    const inCooldown = now < runtime.cooldownUntil;

    const hasUrgentFallbackEvent = input.newEvents.some(
      (event) => event.type === 'POSTURE_DROP' || event.type === 'MAJOR_POSTURE_SHIFT'
    );
    // Keep emergency posture-event path conservative.
    if (hasUrgentFallbackEvent && fallback.message && !decision.emitMessage) {
      return fallback;
    }

    if (!decision.emitMessage || !decision.message) {
      const state: RelayState = inCooldown ? 'COOLDOWN' : decision.state;
      return {
        observedSignals,
        state
      };
    }

    const requestedSeverity = decision.message.severity;
    const canEscalateInCooldown =
      inCooldown && runtime.lastSeverity ? severityRank[requestedSeverity] > severityRank[runtime.lastSeverity] : false;
    const canEmit = !inCooldown || canEscalateInCooldown;

    if (!canEmit) {
      return {
        observedSignals,
        state: 'COOLDOWN'
      };
    }

    runtime.cooldownUntil = now + 120000;
    runtime.lastSeverity = requestedSeverity;

    const message: AgentMessage = {
      id: createMessageId(subjectId),
      ts: now,
      subjectId,
      title: decision.message.title,
      severity: decision.message.severity,
      confidence: Math.max(0, Math.min(1, decision.message.confidence)),
      observed: safeObservedText(decision.message.observed, observedSignals),
      interpretiveTag: decision.message.interpretiveTag,
      evidence: {
        metrics: input.subject.latestMetrics,
        criteriaMet: decision.message.criteriaMet,
        recentEvents: recentEventsForEvidence(input)
      },
      recommendation: decision.message.recommendation,
      disclaimer: NON_DIAGNOSTIC_DISCLAIMER
    };

    return {
      observedSignals,
      state: 'ALERTED',
      message
    };
  }

  private getOrCreateRuntime(subjectId: string) {
    const existing = this.runtimeBySubject.get(subjectId);
    if (existing) {
      return existing;
    }
    const runtime: AutonomousRuntime = {
      cooldownUntil: 0,
      lastSeverity: null,
      lastDedalusCallTs: 0,
      nextRetryTs: 0,
      lastSignature: ''
    };
    this.runtimeBySubject.set(subjectId, runtime);
    return runtime;
  }

  private shouldCallDedalus(
    input: AgentEvaluationInput,
    fallback: AgentEvaluationResult,
    runtime: AutonomousRuntime
  ): boolean {
    const now = input.ts;
    if (now < runtime.nextRetryTs) {
      return false;
    }

    const hasUrgentEvent = input.newEvents.some(
      (event) => event.type === 'POSTURE_DROP' || event.type === 'MAJOR_POSTURE_SHIFT'
    );
    if (hasUrgentEvent) {
      return true;
    }

    const hasActionableRules = fallback.state === 'WATCHING' || fallback.state === 'ALERTED' || !!fallback.message;
    if (ONLY_ALERTING && !hasActionableRules) {
      const sinceLast = now - runtime.lastDedalusCallTs;
      return sinceLast >= HEARTBEAT_MS;
    }

    const sinceLast = now - runtime.lastDedalusCallTs;
    if (sinceLast < MIN_CALL_INTERVAL_MS) {
      return false;
    }

    const signature = this.buildSignature(input);
    const changed = signature !== runtime.lastSignature;
    if (!changed && sinceLast < HEARTBEAT_MS) {
      return false;
    }

    return true;
  }

  private buildSignature(input: AgentEvaluationInput): string {
    const metrics = input.subject.latestMetrics;
    const bucket = (value: number, step: number) => Math.round(value / step);
    const eventCounts: Record<string, number> = {};
    input.events60s.forEach((event) => {
      eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
    });
    const eventsKey = Object.entries(eventCounts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([type, count]) => `${type}:${count}`)
      .join('|');
    return [
      `p=${bucket(metrics.perclos, 0.03)}`,
      `hm=${bucket(metrics.handToMouthPerMin, 0.5)}`,
      `ht=${bucket(metrics.handToTemplePerMin, 0.5)}`,
      `fl=${bucket(metrics.forwardLeanSecondsPerMin, 3)}`,
      `pc=${bucket(metrics.postureChangeRate, 1)}`,
      `mv=${bucket(metrics.movementLevel, 0.05)}`,
      `events=${eventsKey}`
    ].join(';');
  }
}

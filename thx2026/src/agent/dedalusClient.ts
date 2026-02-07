import type { AgentEvaluationInput } from './relayAgent';
import type { AgentSeverity, InterpretiveTag, RelayState } from '../types/monitor';

export type AgentBackend = 'RULES' | 'DEDALUS';

export interface DedalusDecisionMessage {
  title: 'Check-in suggested' | 'Monitor';
  severity: AgentSeverity;
  confidence: number;
  observed: string;
  interpretiveTag?: InterpretiveTag;
  recommendation: string;
  criteriaMet: string[];
}

export interface DedalusDecision {
  state: RelayState;
  observedSignals: string[];
  emitMessage: boolean;
  message?: DedalusDecisionMessage;
}

interface DedalusChatResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

const ALLOWED_INTERPRETIVE_TAGS = new Set<InterpretiveTag>([
  'Possible nausea-like behavior pattern (non-diagnostic)',
  'Possible fatigue/drowsiness-like pattern (non-diagnostic)',
  'Possible distress-like pattern (non-diagnostic)',
  'Possible restlessness/agitation-like pattern (non-diagnostic)'
]);

const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const DEFAULT_BASE_URL = 'https://api.dedaluslabs.ai';
const DEFAULT_TIMEOUT_MS = 9000;
const DEFAULT_MAX_TOKENS = 220;

const SYSTEM_PROMPT = [
  'Safety-constrained monitor relay. Never diagnose.',
  'Input is derived metrics/events only.',
  'Return strict JSON with:',
  '{"state":"NEUTRAL|WATCHING|ALERTED|COOLDOWN","observedSignals":["..."],"emitMessage":boolean,"message?":{"title":"Check-in suggested|Monitor","severity":"LOW|MED|HIGH","confidence":0..1,"observed":"Observed: ...","interpretiveTag?":"allowed only","recommendation":"...","criteriaMet":["..."]}}',
  'Allowed interpretiveTag values only:',
  '- Possible nausea-like behavior pattern (non-diagnostic)',
  '- Possible fatigue/drowsiness-like pattern (non-diagnostic)',
  '- Possible distress-like pattern (non-diagnostic)',
  '- Possible restlessness/agitation-like pattern (non-diagnostic)',
  'Keep output concise.'
].join('\n');

function stripCodeFence(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    const withoutStart = trimmed.replace(/^```(?:json)?\s*/i, '');
    return withoutStart.replace(/\s*```$/, '').trim();
  }
  return trimmed;
}

function parseContentAsJson(content: string) {
  const cleaned = stripCodeFence(content);
  return JSON.parse(cleaned) as unknown;
}

function isRelayState(value: unknown): value is RelayState {
  return value === 'NEUTRAL' || value === 'WATCHING' || value === 'ALERTED' || value === 'COOLDOWN';
}

function isSeverity(value: unknown): value is AgentSeverity {
  return value === 'LOW' || value === 'MED' || value === 'HIGH';
}

function isTitle(value: unknown): value is 'Check-in suggested' | 'Monitor' {
  return value === 'Check-in suggested' || value === 'Monitor';
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
}

function summarizeEvents(input: AgentEvaluationInput) {
  const counts: Record<string, number> = {};
  input.events60s.forEach((event) => {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
  });
  const recentNew = input.newEvents
    .slice(-6)
    .map((event) => ({ type: event.type, ageSec: Math.max(0, Math.round((input.ts - event.ts) / 1000)) }));
  return { counts60s: counts, recentNew };
}

function validateDecision(candidate: unknown): DedalusDecision {
  if (typeof candidate !== 'object' || !candidate) {
    throw new Error('Dedalus response is not a valid object.');
  }

  const raw = candidate as Record<string, unknown>;
  if (!isRelayState(raw.state)) {
    throw new Error('Dedalus response missing valid state.');
  }
  if (typeof raw.emitMessage !== 'boolean') {
    throw new Error('Dedalus response missing emitMessage boolean.');
  }

  const observedSignals = toStringArray(raw.observedSignals);
  if (!observedSignals.length) {
    throw new Error('Dedalus response missing observedSignals.');
  }

  if (!raw.emitMessage) {
    return { state: raw.state, observedSignals, emitMessage: false };
  }

  if (typeof raw.message !== 'object' || !raw.message) {
    throw new Error('Dedalus emitMessage=true but message is missing.');
  }
  const rawMessage = raw.message as Record<string, unknown>;
  if (!isTitle(rawMessage.title)) {
    throw new Error('Dedalus message has invalid title.');
  }
  if (!isSeverity(rawMessage.severity)) {
    throw new Error('Dedalus message has invalid severity.');
  }
  if (typeof rawMessage.confidence !== 'number') {
    throw new Error('Dedalus message confidence must be a number.');
  }
  if (typeof rawMessage.observed !== 'string' || !rawMessage.observed.trim()) {
    throw new Error('Dedalus message observed is required.');
  }
  if (typeof rawMessage.recommendation !== 'string' || !rawMessage.recommendation.trim()) {
    throw new Error('Dedalus message recommendation is required.');
  }

  let interpretiveTag: InterpretiveTag | undefined;
  if (typeof rawMessage.interpretiveTag === 'string') {
    if (ALLOWED_INTERPRETIVE_TAGS.has(rawMessage.interpretiveTag as InterpretiveTag)) {
      interpretiveTag = rawMessage.interpretiveTag as InterpretiveTag;
    } else {
      throw new Error('Dedalus message interpretiveTag is not allowed.');
    }
  }

  return {
    state: raw.state,
    observedSignals,
    emitMessage: true,
    message: {
      title: rawMessage.title,
      severity: rawMessage.severity,
      confidence: clamp01(rawMessage.confidence),
      observed: rawMessage.observed.trim(),
      interpretiveTag,
      recommendation: rawMessage.recommendation.trim(),
      criteriaMet: toStringArray(rawMessage.criteriaMet)
    }
  };
}

export class DedalusClient {
  private readonly apiKey = import.meta.env.VITE_DEDALUS_API_KEY as string | undefined;
  private readonly baseUrl = (import.meta.env.VITE_DEDALUS_API_URL as string | undefined) ?? DEFAULT_BASE_URL;
  private readonly model = (import.meta.env.VITE_DEDALUS_MODEL as string | undefined) ?? DEFAULT_MODEL;
  private readonly timeoutMs = Number(import.meta.env.VITE_DEDALUS_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  private readonly maxTokens = Number(import.meta.env.VITE_DEDALUS_MAX_TOKENS ?? DEFAULT_MAX_TOKENS);

  isConfigured() {
    return !!this.apiKey;
  }

  async evaluate(input: AgentEvaluationInput): Promise<DedalusDecision> {
    if (!this.apiKey) {
      throw new Error('VITE_DEDALUS_API_KEY is not configured.');
    }

    const eventSummary = summarizeEvents(input);
    const payload = {
      ts: input.ts,
      subjectId: input.subject.id,
      metrics: {
        perclos: round2(input.subject.latestMetrics.perclos),
        handToMouthPerMin: round2(input.subject.latestMetrics.handToMouthPerMin),
        handToTemplePerMin: round2(input.subject.latestMetrics.handToTemplePerMin),
        forwardLeanSecondsPerMin: round2(input.subject.latestMetrics.forwardLeanSecondsPerMin),
        postureChangeRate: round2(input.subject.latestMetrics.postureChangeRate),
        movementLevel: round2(input.subject.latestMetrics.movementLevel)
      },
      eventSummary,
      calibration: input.calibration
        ? {
            blinkRatePerMin: round2(input.calibration.blinkRatePerMin),
            movementLevel: round2(input.calibration.movementLevel),
            headPose: round2(input.calibration.headPose)
          }
        : null
    };

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          max_tokens: this.maxTokens,
          stream: false,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify(payload) }
          ]
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Dedalus API ${response.status}: ${errorBody || 'request failed'}`);
      }

      const data = (await response.json()) as DedalusChatResponse;
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('Dedalus returned empty content.');
      }

      const parsed = parseContentAsJson(content);
      return validateDecision(parsed);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Dedalus request timed out.');
      }
      throw error instanceof Error ? error : new Error('Dedalus request failed.');
    } finally {
      window.clearTimeout(timeoutId);
    }
  }
}

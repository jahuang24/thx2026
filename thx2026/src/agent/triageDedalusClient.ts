import type { TriageEntry, TriageLevel } from '../logic/triage';

export interface TriageSuggestion {
  patientId: string;
  level: TriageLevel;
  confidence: number;
  rationale: string;
}

interface DedalusTriageResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const DEFAULT_BASE_URL = 'https://api.dedaluslabs.ai';
const DEFAULT_TIMEOUT_MS = 9000;
const DEFAULT_MAX_TOKENS = 320;

const SYSTEM_PROMPT = [
  'You assist a hospital operations triage board.',
  'This is non-diagnostic prioritization only.',
  'Use room assignment status, alerts, symptom text, patient message sentiment/urgency, and board reasons to suggest triage level.',
  'Return strict JSON only with shape:',
  '{"suggestions":[{"patientId":"string","level":"LOW|MEDIUM|HIGH|CRITICAL","confidence":0..1,"rationale":"short reason"}]}',
  'Never include any extra text.'
].join('\n');

function stripCodeFence(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    const withoutStart = trimmed.replace(/^```(?:json)?\s*/i, '');
    return withoutStart.replace(/\s*```$/, '').trim();
  }
  return trimmed;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function isTriageLevel(value: unknown): value is TriageLevel {
  return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'CRITICAL';
}

function parseAndValidate(content: string): TriageSuggestion[] {
  const parsed = JSON.parse(stripCodeFence(content)) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Dedalus triage response is not an object.');
  }
  const rawSuggestions = (parsed as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(rawSuggestions)) {
    throw new Error('Dedalus triage response missing suggestions.');
  }
  return rawSuggestions
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const suggestion = item as {
        patientId?: unknown;
        level?: unknown;
        confidence?: unknown;
        rationale?: unknown;
      };
      if (typeof suggestion.patientId !== 'string' || !isTriageLevel(suggestion.level)) {
        return null;
      }
      if (typeof suggestion.confidence !== 'number' || typeof suggestion.rationale !== 'string') {
        return null;
      }
      return {
        patientId: suggestion.patientId,
        level: suggestion.level,
        confidence: clamp01(suggestion.confidence),
        rationale: suggestion.rationale.trim()
      } satisfies TriageSuggestion;
    })
    .filter((value): value is TriageSuggestion => Boolean(value));
}

export class TriageDedalusClient {
  private readonly apiKey = import.meta.env.VITE_DEDALUS_API_KEY as string | undefined;
  private readonly baseUrl = (import.meta.env.VITE_DEDALUS_API_URL as string | undefined) ?? DEFAULT_BASE_URL;
  private readonly model = (import.meta.env.VITE_DEDALUS_MODEL as string | undefined) ?? DEFAULT_MODEL;
  private readonly timeoutMs = Number(import.meta.env.VITE_DEDALUS_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  private readonly maxTokens = Number(import.meta.env.VITE_DEDALUS_TRIAGE_MAX_TOKENS ?? DEFAULT_MAX_TOKENS);

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async evaluate(entries: TriageEntry[]): Promise<Record<string, TriageSuggestion>> {
    if (!this.apiKey || !entries.length) {
      return {};
    }

    const payload = {
      boardTs: Date.now(),
      patients: entries.map((entry) => ({
        patientId: entry.patientId,
        score: entry.score,
        currentLevel: entry.level,
        roomAssigned: entry.roomAssigned,
        openAlerts: entry.openAlertCount,
        unreadSymptoms: entry.unreadPatientMessages,
        messageSignalScore: entry.patientMessageSignalScore,
        reasons: entry.reasons.slice(0, 4),
        symptomText: entry.latestPatientMessage.slice(0, 240),
        messageSummary: entry.patientMessageSummary.slice(0, 400)
      }))
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
        return {};
      }
      const data = (await response.json()) as DedalusTriageResponse;
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        return {};
      }

      const suggestions = parseAndValidate(content);
      const validIds = new Set(entries.map((entry) => entry.patientId));
      return suggestions.reduce<Record<string, TriageSuggestion>>((acc, suggestion) => {
        if (!validIds.has(suggestion.patientId)) {
          return acc;
        }
        acc[suggestion.patientId] = suggestion;
        return acc;
      }, {});
    } catch {
      return {};
    } finally {
      window.clearTimeout(timeoutId);
    }
  }
}

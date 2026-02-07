import type { Message } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:5050';
const DEFAULT_MESSAGES_TIMEOUT_MS = 4000;

const normalizeMessage = (input: any): Message => {
  const id = input?.id ?? input?._id ?? `msg-${Date.now()}`;
  return {
    id: String(id),
    patientId: String(input?.patientId ?? ''),
    sender: input?.sender === 'NURSE' ? 'NURSE' : 'PATIENT',
    body: String(input?.body ?? ''),
    sentAt: String(input?.sentAt ?? new Date().toISOString()),
    readByNurse: Boolean(input?.readByNurse),
    readByPatient: Boolean(input?.readByPatient)
  };
};

type MessagesCacheEntry = {
  value: Message[];
  at: number;
  inflight: Promise<Message[]> | null;
};

const messagesByPatientCache = new Map<string, MessagesCacheEntry>();

export async function fetchMessagesForPatient(
  patientId: string,
  {
    force = false,
    ttlMs = 5000,
    timeoutMs = DEFAULT_MESSAGES_TIMEOUT_MS,
    limit = 200
  }: { force?: boolean; ttlMs?: number; timeoutMs?: number; limit?: number } = {}
): Promise<Message[]> {
  if (!patientId) return [];
  const entry = messagesByPatientCache.get(patientId) ?? { value: [], at: 0, inflight: null };
  const now = Date.now();
  if (!force && entry.value.length && now - entry.at < ttlMs) {
    return entry.value;
  }
  if (!force && entry.inflight) {
    return entry.inflight;
  }

  const request = (async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(
        `${API_BASE}/messages?patientId=${encodeURIComponent(patientId)}&limit=${limit}`,
        { signal: controller.signal }
      );
      if (!response.ok) return entry.value;
      const data = (await response.json()) as any[];
      const normalized = Array.isArray(data)
        ? data
            .map(normalizeMessage)
            .filter((message) => message.patientId && message.body)
            .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
        : [];
      entry.value = normalized;
      entry.at = Date.now();
      return normalized;
    } catch {
      return entry.value;
    } finally {
      window.clearTimeout(timeoutId);
    }
  })();

  if (!force) {
    entry.inflight = request;
    messagesByPatientCache.set(patientId, entry);
  }

  try {
    return await request;
  } finally {
    if (!force) {
      entry.inflight = null;
      messagesByPatientCache.set(patientId, entry);
    }
  }
}


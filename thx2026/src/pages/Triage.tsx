import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TriageDedalusClient, type TriageSuggestion } from '../agent/triageDedalusClient';
import { alerts, beds, patients as seededPatients, rooms } from '../data/mock';
import { buildTriageEntries, getTriagePalette, type TriageEntry, type TriageLevel } from '../logic/triage';
import { realtimeBus } from '../services/realtime';
import { fetchPatients, type PatientRecord } from '../services/patientApi';
import { store } from '../services/store';

type FilterLevel = 'ALL' | TriageLevel;
type DedalusState = 'OFF' | 'READY' | 'APPLYING' | 'ERROR';

const levelRank: Record<TriageLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

const levelScore: Record<TriageLevel, number> = {
  LOW: 20,
  MEDIUM: 40,
  HIGH: 60,
  CRITICAL: 80
};

function mergeDedalusSuggestion(
  entry: TriageEntry,
  suggestion: TriageSuggestion | undefined
): TriageEntry {
  if (!suggestion) {
    if (!entry.roomAssigned && levelRank[entry.level] < levelRank.MEDIUM) {
      return {
        ...entry,
        level: 'MEDIUM',
        score: Math.max(entry.score, 30),
        reasons: [...entry.reasons, 'No room assignment: minimum triage level set to MEDIUM'].slice(0, 5)
      };
    }
    return entry;
  }

  const weightedScore = Math.round(entry.score * 0.45 + levelScore[suggestion.level] * 0.55);
  let nextLevel = suggestion.level;
  let nextScore = Math.max(0, Math.min(100, weightedScore));

  if (!entry.roomAssigned && levelRank[nextLevel] < levelRank.MEDIUM) {
    nextLevel = 'MEDIUM';
    nextScore = Math.max(nextScore, 30);
  }

  return {
    ...entry,
    level: nextLevel,
    score: nextScore,
    reasons: [`Dedalus triage signal: ${suggestion.rationale}`, ...entry.reasons].slice(0, 5)
  };
}

export function TriagePage() {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [messagesVersion, setMessagesVersion] = useState(0);
  const [alertsVersion, setAlertsVersion] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<FilterLevel>('ALL');
  const [loading, setLoading] = useState(true);
  const [dedalusSuggestions, setDedalusSuggestions] = useState<Record<string, TriageSuggestion>>({});
  const [dedalusState, setDedalusState] = useState<DedalusState>('OFF');
  const dedalusRef = useRef(new TriageDedalusClient());
  const lastSignatureRef = useRef('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const result = await fetchPatients();
      if (active) {
        setPatients(result);
        setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribeMessageNew = realtimeBus.on('newMessage', () => setMessagesVersion((value) => value + 1));
    const unsubscribeMessageUpdated = realtimeBus.on('messageUpdated', () => setMessagesVersion((value) => value + 1));
    const unsubscribeAlertNew = realtimeBus.on('newAlert', () => setAlertsVersion((value) => value + 1));
    const unsubscribeAlertUpdated = realtimeBus.on('alertUpdated', () => setAlertsVersion((value) => value + 1));

    return () => {
      unsubscribeMessageNew();
      unsubscribeMessageUpdated();
      unsubscribeAlertNew();
      unsubscribeAlertUpdated();
    };
  }, []);

  const triageEntries = useMemo(
    () =>
      buildTriageEntries({
        patients,
        alerts: [...alerts, ...store.alerts],
        messages: store.messages,
        seededPatients,
        rooms,
        beds
      }),
    [alertsVersion, messagesVersion, patients]
  );

  useEffect(() => {
    const client = dedalusRef.current;
    if (!client.isConfigured()) {
      setDedalusSuggestions({});
      setDedalusState('OFF');
      return;
    }
    if (!triageEntries.length) {
      setDedalusSuggestions({});
      setDedalusState('READY');
      return;
    }

    const signature = triageEntries
      .map((entry) =>
        [
          entry.patientId,
          entry.score,
          entry.level,
          entry.roomAssigned ? '1' : '0',
          entry.openAlertCount,
          entry.unreadPatientMessages,
          entry.latestPatientMessage.slice(0, 120),
          entry.patientMessageSignalScore,
          entry.patientMessageSummary.slice(0, 120)
        ].join(':')
      )
      .join('|');
    if (signature === lastSignatureRef.current) {
      return;
    }
    lastSignatureRef.current = signature;
    let cancelled = false;
    setDedalusState('APPLYING');
    void client
      .evaluate(triageEntries)
      .then((result) => {
        if (cancelled) return;
        setDedalusSuggestions(result);
        setDedalusState('READY');
      })
      .catch(() => {
        if (cancelled) return;
        setDedalusState('ERROR');
      });
    return () => {
      cancelled = true;
    };
  }, [triageEntries]);

  const resolvedEntries = useMemo(
    () => triageEntries.map((entry) => mergeDedalusSuggestion(entry, dedalusSuggestions[entry.patientId])),
    [dedalusSuggestions, triageEntries]
  );

  const filteredEntries = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return resolvedEntries.filter((entry) => {
      const levelMatches = filterLevel === 'ALL' || entry.level === filterLevel;
      const searchMatches =
        !normalized ||
        entry.name.toLowerCase().includes(normalized) ||
        entry.mrn.toLowerCase().includes(normalized) ||
        entry.roomLabel.toLowerCase().includes(normalized) ||
        entry.bedLabel.toLowerCase().includes(normalized);
      return levelMatches && searchMatches;
    });
  }, [filterLevel, resolvedEntries, searchTerm]);

  const counts = useMemo(
    () => ({
      critical: resolvedEntries.filter((entry) => entry.level === 'CRITICAL').length,
      high: resolvedEntries.filter((entry) => entry.level === 'HIGH').length,
      medium: resolvedEntries.filter((entry) => entry.level === 'MEDIUM').length,
      low: resolvedEntries.filter((entry) => entry.level === 'LOW').length
    }),
    [resolvedEntries]
  );

  const renderCard = (entry: TriageEntry) => {
    const palette = getTriagePalette(entry.level);
    return (
      <article key={entry.patientId} className={`rounded-2xl border p-4 ${palette.card}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-ink-900">{entry.name}</h3>
            <p className="text-xs text-ink-600">MRN {entry.mrn}</p>
            <p className="mt-1 text-sm text-ink-700">
              Room {entry.roomLabel} - Bed {entry.bedLabel}
            </p>
          </div>
          <div className="text-right">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${palette.chip}`}>
              {entry.level}
            </span>
            <p className={`mt-2 text-sm font-semibold ${palette.text}`}>Score: {entry.score}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-white/80 px-2 py-1 text-ink-700">
            Open alerts: {entry.openAlertCount}
          </span>
          <span className="rounded-full bg-white/80 px-2 py-1 text-ink-700">
            Unread symptoms: {entry.unreadPatientMessages}
          </span>
        </div>

        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-700">
          {entry.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to={`/monitor/${entry.patientId}`}
            className="rounded-full bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Open Monitor
          </Link>
          <Link
            to={`/patients/${entry.patientId}`}
            className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700"
          >
            Patient Details
          </Link>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
        <h2 className="text-xl font-display font-semibold text-ink-900">Triage Board</h2>
        <p className="mt-1 text-sm text-ink-500">
          Color-coded symptom severity classification for rapid prioritization.
        </p>
        <p className="mt-2 text-xs text-ink-500">
          Dedalus triage assist:{' '}
          <span className="font-semibold text-ink-700">
            {dedalusState === 'OFF'
              ? 'OFF'
              : dedalusState === 'APPLYING'
                ? 'Applying'
                : dedalusState === 'ERROR'
                  ? 'Fallback to local scoring'
                  : 'Active'}
          </span>
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-700">Critical</p>
          <p className="mt-2 text-3xl font-semibold text-rose-800">{counts.critical}</p>
        </div>
        <div className="rounded-2xl border border-orange-300 bg-orange-50 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-orange-700">High</p>
          <p className="mt-2 text-3xl font-semibold text-orange-800">{counts.high}</p>
        </div>
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Medium</p>
          <p className="mt-2 text-3xl font-semibold text-amber-800">{counts.medium}</p>
        </div>
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Low</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-800">{counts.low}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
        <div className="grid gap-3 md:grid-cols-[180px_1fr]">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
            Severity Filter
            <select
              value={filterLevel}
              onChange={(event) => setFilterLevel(event.target.value as FilterLevel)}
              className="mt-2 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-800"
            >
              <option value="ALL">All Levels</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
            Search Patient / Room
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, MRN, room, bed..."
              className="mt-2 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-800"
            />
          </label>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white/70 p-6 text-sm text-ink-500">
          Loading triage board...
        </div>
      ) : filteredEntries.length ? (
        <section className="grid gap-4 lg:grid-cols-2">{filteredEntries.map(renderCard)}</section>
      ) : (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white/70 p-6 text-sm text-ink-500">
          No patients match the current filter.
        </div>
      )}
    </div>
  );
}

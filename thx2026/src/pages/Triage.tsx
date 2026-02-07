import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { alerts, beds, patients as seededPatients, rooms } from '../data/mock';
import { buildTriageEntries, getTriagePalette, type TriageEntry, type TriageLevel } from '../logic/triage';
import { realtimeBus } from '../services/realtime';
import { fetchPatients, type PatientRecord } from '../services/patientApi';
import { store } from '../services/store';

type FilterLevel = 'ALL' | TriageLevel;

export function TriagePage() {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [messagesVersion, setMessagesVersion] = useState(0);
  const [alertsVersion, setAlertsVersion] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<FilterLevel>('ALL');
  const [loading, setLoading] = useState(true);

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

  const filteredEntries = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return triageEntries.filter((entry) => {
      const levelMatches = filterLevel === 'ALL' || entry.level === filterLevel;
      const searchMatches =
        !normalized ||
        entry.name.toLowerCase().includes(normalized) ||
        entry.mrn.toLowerCase().includes(normalized) ||
        entry.roomLabel.toLowerCase().includes(normalized) ||
        entry.bedLabel.toLowerCase().includes(normalized);
      return levelMatches && searchMatches;
    });
  }, [filterLevel, searchTerm, triageEntries]);

  const counts = useMemo(
    () => ({
      critical: triageEntries.filter((entry) => entry.level === 'CRITICAL').length,
      high: triageEntries.filter((entry) => entry.level === 'HIGH').length,
      medium: triageEntries.filter((entry) => entry.level === 'MEDIUM').length,
      low: triageEntries.filter((entry) => entry.level === 'LOW').length
    }),
    [triageEntries]
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

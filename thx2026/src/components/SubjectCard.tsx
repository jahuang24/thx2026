import type { PatientSubject, RelayState } from '../types/monitor';
import { patientVitalsById, vitalsPool } from '../data/mock';

interface SubjectCardProps {
  subject: PatientSubject;
  relayState: RelayState;
  selected: boolean;
  onSelect: (subjectId: string) => void;
}

const relayLabels: Record<RelayState, string> = {
  NEUTRAL: 'Monitoring',
  WATCHING: 'Watching',
  ALERTED: 'Alerted',
  COOLDOWN: 'Post-alert'
};

function hashToIndex(input: string, size: number) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % size;
  }
  return hash;
}

function formatLastSeen(ts: number) {
  if (!ts) {
    return 'Never';
  }
  return new Date(ts).toLocaleTimeString();
}

export function SubjectCard({ subject, relayState, selected, onSelect }: SubjectCardProps) {
  const roomBedLabel =
    subject.roomLabel
      ? `Room ${subject.roomLabel}${subject.bedLabel ? ` - Bed ${subject.bedLabel}` : ''}`
      : 'No room assigned';
  const vitals =
    patientVitalsById[subject.id] ??
    vitalsPool[hashToIndex(subject.id, vitalsPool.length)];
  const vitalsDisplay = {
    hr: vitals ? `${vitals.heartRate}` : '—',
    rr: vitals ? `${vitals.respiration}` : '—',
    spo2: vitals ? `${vitals.spo2}` : '—',
    bp: vitals ? vitals.bloodPressure : '—',
    temp: vitals ? `${vitals.temperatureF.toFixed(1)}°F` : '—'
  };

  return (
    <button
      type="button"
      className={`subject-card${selected ? ' subject-card--selected' : ''}`}
      onClick={() => onSelect(subject.id)}
    >
      <div className="subject-card__head">
        <div>
          <h3>{subject.label}</h3>
          <p>{roomBedLabel}</p>
        </div>
        <div className="subject-card__badges">
          <span className={`status-pill status-pill--${subject.status.toLowerCase()}`}>{subject.status}</span>
          <span className={`status-pill status-pill--relay-${relayState.toLowerCase()}`}>
            {relayLabels[relayState]}
          </span>
        </div>
      </div>
      <p className="subject-card__meta">Last activity: {formatLastSeen(subject.lastSeenAt)}</p>
      <div className="subject-card__signals">
        <div className="subject-card__signals-title">Vitals (device feed)</div>
        <div className="subject-card__vitals">
          <div>
            <span>HR</span>
            <strong>
              {vitalsDisplay.hr}
              {vitals ? <em>bpm</em> : null}
            </strong>
          </div>
          <div>
            <span>RR</span>
            <strong>
              {vitalsDisplay.rr}
              {vitals ? <em>rpm</em> : null}
            </strong>
          </div>
          <div>
            <span>SpO2</span>
            <strong>
              {vitalsDisplay.spo2}
              {vitals ? <em>%</em> : null}
            </strong>
          </div>
          <div>
            <span>BP</span>
            <strong>{vitalsDisplay.bp}</strong>
          </div>
          <div>
            <span>Temp</span>
            <strong>{vitalsDisplay.temp}</strong>
          </div>
        </div>
      </div>
      <div className="subject-card__signals">
        <div className="subject-card__signals-title">Behavioral observations</div>
        {subject.latestObservedSignals.length ? (
          <ul>
            {subject.latestObservedSignals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
        ) : (
          <p className="subject-card__empty">No notable observations yet.</p>
        )}
      </div>
    </button>
  );
}

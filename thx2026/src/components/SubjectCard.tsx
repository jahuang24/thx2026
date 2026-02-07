import { MetricChips } from './MetricChips';
import type { PatientSubject, RelayState } from '../types/monitor';

interface SubjectCardProps {
  subject: PatientSubject;
  relayState: RelayState;
  selected: boolean;
  onSelect: (subjectId: string) => void;
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

  return (
    <button
      type="button"
      className={`subject-card${selected ? ' subject-card--selected' : ''}`}
      onClick={() => onSelect(subject.id)}
    >
      <div className="subject-card__head">
        <div>
          <h3>{subject.label}</h3>
          <p>{subject.id}</p>
        </div>
        <div className="subject-card__badges">
          <span className={`status-pill status-pill--${subject.status.toLowerCase()}`}>{subject.status}</span>
          <span className={`status-pill status-pill--relay-${relayState.toLowerCase()}`}>{relayState}</span>
        </div>
      </div>
      <p className="subject-card__focus">{selected ? 'Focused subject' : 'Click to focus'}</p>
      <p className="subject-card__meta">Last seen: {formatLastSeen(subject.lastSeenAt)}</p>
      <p className="subject-card__meta">{roomBedLabel}</p>
      <MetricChips metrics={subject.latestMetrics} />
      <div className="subject-card__signals">
        <div className="subject-card__signals-title">Latest observed signals</div>
        {subject.latestObservedSignals.length ? (
          <ul>
            {subject.latestObservedSignals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
        ) : (
          <p className="subject-card__empty">No observed signals yet.</p>
        )}
      </div>
    </button>
  );
}


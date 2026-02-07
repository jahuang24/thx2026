import { SubjectCard } from './SubjectCard';
import type { MonitorEvent, PatientSubject, RelayState } from '../types/monitor';

interface PatientTrackerPanelProps {
  subjects: PatientSubject[];
  selectedSubjectId: string;
  relayStateBySubject: Record<string, RelayState>;
  onSelectSubject: (subjectId: string) => void;
  events: MonitorEvent[];
}

function formatEventTs(ts: number) {
  return new Date(ts).toLocaleTimeString();
}

const eventLabels: Record<MonitorEvent['type'], string> = {
  HAND_TO_MOUTH: 'Hand-to-mouth motion',
  HAND_TO_TEMPLE: 'Hand-to-temple motion',
  FORWARD_LEAN: 'Forward lean',
  POSTURE_DROP: 'Posture drop',
  PROLONGED_EYE_CLOSURE: 'Prolonged eye closure',
  RESTLESSNESS_SPIKE: 'Restlessness spike',
  NO_SUBJECT: 'No subject detected'
};

export function PatientTrackerPanel({
  subjects,
  selectedSubjectId,
  relayStateBySubject,
  onSelectSubject,
  events
}: PatientTrackerPanelProps) {
  const timelineEvents = [...events].sort((left, right) => right.ts - left.ts).slice(0, 18);

  return (
    <div className="tracker-grid tracker-grid--scalable">
      <section className="monitor-card tracker-subjects">
        <div className="tracker-section-head">
          <h3>Patient overview</h3>
          <p>{subjects.length === 1 ? '1 patient' : `${subjects.length} patients`}</p>
        </div>
        <div className="tracker-subjects__list">
          {subjects.map((subject, index) => (
            <div key={subject.id} className="tracker-subject-shell">
              {subjects.length > 1 ? (
                <div className="tracker-subject-shell__label">Patient {index + 1}</div>
              ) : null}
              <SubjectCard
                subject={subject}
                selected={subject.id === selectedSubjectId}
                onSelect={onSelectSubject}
                relayState={relayStateBySubject[subject.id] ?? 'NEUTRAL'}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="monitor-card tracker-events">
        <div className="tracker-section-head">
          <h3>Recent events</h3>
          <p>Recent behavioral activity</p>
        </div>
        {timelineEvents.length ? (
          <ul className="timeline-list">
            {timelineEvents.map((event) => (
              <li key={event.id}>
                <span>{formatEventTs(event.ts)}</span>
                <strong>{eventLabels[event.type]}</strong>
                {event.detail ? <p>{event.detail}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state compact">
            <h3>No events yet</h3>
            <p>Recent behavioral events will appear here.</p>
          </div>
        )}
      </section>

    </div>
  );
}

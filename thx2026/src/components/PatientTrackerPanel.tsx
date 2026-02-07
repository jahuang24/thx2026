import type { RefObject } from 'react';
import { SubjectCard } from './SubjectCard';
import type { MonitorEvent, PatientSubject, RelayState } from '../types/monitor';

interface PatientTrackerPanelProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  debugCanvasRef: RefObject<HTMLCanvasElement | null>;
  monitorRunning: boolean;
  starting: boolean;
  errorMessage: string | null;
  noSubjectDetected: boolean;
  debugOverlay: boolean;
  onDebugOverlayChange: (value: boolean) => void;
  subjects: PatientSubject[];
  selectedSubjectId: string;
  relayStateBySubject: Record<string, RelayState>;
  onSelectSubject: (subjectId: string) => void;
  events: MonitorEvent[];
  showDevInjectors: boolean;
  onInjectScenario: (scenario: 'nausea' | 'posture-drop' | 'drowsy') => void;
}

function formatEventTs(ts: number) {
  return new Date(ts).toLocaleTimeString();
}

export function PatientTrackerPanel({
  videoRef,
  debugCanvasRef,
  monitorRunning,
  starting,
  errorMessage,
  noSubjectDetected,
  debugOverlay,
  onDebugOverlayChange,
  subjects,
  selectedSubjectId,
  relayStateBySubject,
  onSelectSubject,
  events,
  showDevInjectors,
  onInjectScenario
}: PatientTrackerPanelProps) {
  const timelineEvents = [...events].sort((left, right) => right.ts - left.ts).slice(0, 18);

  return (
    <div className="tracker-grid tracker-grid--scalable">
      <section className="monitor-card tracker-subjects">
        <div className="tracker-section-head">
          <h3>Patient tracker</h3>
          <p>{subjects.length} subject(s)</p>
        </div>
        <div className="tracker-subjects__list">
          {subjects.map((subject, index) => (
            <div key={subject.id} className="tracker-subject-shell">
              <div className="tracker-subject-shell__label">Camera {index + 1}</div>
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
          <h3>Event timeline</h3>
          <p>Recent behavior events</p>
        </div>
        {timelineEvents.length ? (
          <ul className="timeline-list">
            {timelineEvents.map((event) => (
              <li key={event.id}>
                <span>{formatEventTs(event.ts)}</span>
                <strong>{event.type}</strong>
                {event.detail ? <p>{event.detail}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state compact">
            <h3>No events yet</h3>
            <p>Start the monitor to populate recent event activity.</p>
          </div>
        )}
      </section>

      <section className="monitor-card tracker-preview tracker-preview--compact">
        <div className="tracker-preview__head">
          <div>
            <h3>Camera surface (optional)</h3>
            <p>Video preview is secondary for multi-camera scaling.</p>
          </div>
          <label className="toggle-input">
            <input
              type="checkbox"
              checked={debugOverlay}
              onChange={(event) => onDebugOverlayChange(event.target.checked)}
            />
            Debug overlay
          </label>
        </div>

        <div className="preview-frame preview-frame--compact">
          <video ref={videoRef} autoPlay muted playsInline />
          <canvas ref={debugCanvasRef} className="preview-overlay" />
          {!monitorRunning ? <div className="preview-overlay-label">Monitor stopped</div> : null}
          {starting ? (
            <div className="preview-overlay-label preview-overlay-label--skeleton">Starting monitor...</div>
          ) : null}
          {noSubjectDetected && monitorRunning ? <div className="preview-alert">No subject detected</div> : null}
        </div>

        {errorMessage ? <p className="monitor-error">{errorMessage}</p> : null}

        {showDevInjectors ? (
          <div className="dev-injector">
            <h4>Inject Scenario (DEV)</h4>
            <div className="dev-injector__buttons">
              <button type="button" onClick={() => onInjectScenario('nausea')}>
                Inject nausea-like scenario
              </button>
              <button type="button" onClick={() => onInjectScenario('posture-drop')}>
                Inject posture drop
              </button>
              <button type="button" onClick={() => onInjectScenario('drowsy')}>
                Inject drowsy scenario
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

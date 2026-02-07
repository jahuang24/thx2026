import { useState } from 'react';
import type { AgentMessage } from '../types/monitor';

interface AgentMessageCardProps {
  message: AgentMessage;
}

function formatTimestamp(ts: number) {
  return new Date(ts).toLocaleTimeString();
}

const eventLabels: Record<AgentMessage['evidence']['recentEvents'][number]['type'], string> = {
  HAND_TO_MOUTH: 'Hand-to-mouth motion',
  HAND_TO_TEMPLE: 'Hand-to-temple motion',
  FORWARD_LEAN: 'Forward lean',
  POSTURE_DROP: 'Posture drop',
  PROLONGED_EYE_CLOSURE: 'Prolonged eye closure',
  RESTLESSNESS_SPIKE: 'Restlessness spike',
  NO_SUBJECT: 'No subject detected'
};

function humanizeCriterion(criterion: string) {
  return criterion
    .replace(/PERCLOS/gi, 'Eye-closure')
    .replace(/hand-to-mouth/gi, 'hand-to-mouth')
    .replace(/forward lean/gi, 'forward lean')
    .replace(/posture change/gi, 'posture change')
    .replace(/movement/gi, 'movement')
    .replace(/signal interpretation uncertain/gi, 'interpretation uncertain');
}

export function AgentMessageCard({ message }: AgentMessageCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="agent-message-card">
      <header className="agent-message-card__head">
        <div>
          <h3>{message.title}</h3>
          <p>{formatTimestamp(message.ts)}</p>
        </div>
        <div className="agent-message-card__meta">
          <span className={`severity-pill severity-pill--${message.severity.toLowerCase()}`}>{message.severity}</span>
          <span className="confidence-pill">Confidence {Math.round(message.confidence * 100)}%</span>
        </div>
      </header>
      <p className="agent-message-card__observed">{message.observed}</p>
      {message.interpretiveTag ? <p className="agent-message-card__tag">{message.interpretiveTag}</p> : null}
      <p className="agent-message-card__recommendation">{message.recommendation}</p>
      <p className="agent-message-card__disclaimer">{message.disclaimer}</p>

      <button type="button" className="agent-message-card__toggle" onClick={() => setExpanded((current) => !current)}>
        {expanded ? 'Hide details' : 'Show details'}
      </button>

      {expanded ? (
        <div className="agent-message-card__evidence">
          <div>
            <h4>Indicators</h4>
            {message.evidence.criteriaMet.length ? (
              <ul>
                {message.evidence.criteriaMet.map((criterion) => (
                  <li key={criterion}>{humanizeCriterion(criterion)}</li>
                ))}
              </ul>
            ) : (
              <p>Criteria not available.</p>
            )}
          </div>
          <div>
            <h4>Recent events</h4>
            {message.evidence.recentEvents.length ? (
              <ul>
                {message.evidence.recentEvents.map((event) => (
                  <li key={event.id}>
                    <span>{new Date(event.ts).toLocaleTimeString()}</span> -{' '}
                    <strong>{eventLabels[event.type]}</strong>
                    {event.detail ? ` (${event.detail})` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No recent events.</p>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}

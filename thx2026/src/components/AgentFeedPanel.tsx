import { useMemo, useState } from 'react';
import { AgentMessageCard } from './AgentMessageCard';
import type { AgentMessage, AgentSeverity } from '../types/monitor';

interface AgentFeedPanelProps {
  messages: AgentMessage[];
}

type SeverityFilter = 'ALL' | AgentSeverity;

export function AgentFeedPanel({ messages }: AgentFeedPanelProps) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMessages = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return messages.filter((message) => {
      const severityMatches = severityFilter === 'ALL' || message.severity === severityFilter;
      const textMatches =
        !normalizedSearch ||
        message.observed.toLowerCase().includes(normalizedSearch) ||
        message.title.toLowerCase().includes(normalizedSearch);
      return severityMatches && textMatches;
    });
  }, [messages, searchTerm, severityFilter]);

  return (
    <section className="monitor-card monitor-feed">
      <div className="tracker-section-head">
        <h3>Agent feed</h3>
        <p>{filteredMessages.length} visible message(s)</p>
      </div>
      <div className="monitor-feed__controls">
        <label>
          Severity
          <select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)}
            className="monitor-input"
          >
            <option value="ALL">All</option>
            <option value="HIGH">High</option>
            <option value="MED">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </label>
        <label>
          Search observed text
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="monitor-input"
            placeholder="forward-lean, posture drop, uncertain..."
          />
        </label>
      </div>

      {filteredMessages.length ? (
        <div className="monitor-feed__list">
          {filteredMessages.map((message) => (
            <AgentMessageCard key={message.id} message={message} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3>No agent messages yet</h3>
          <p>The relay agent will post here when sustained patterns or priority events are observed.</p>
        </div>
      )}
    </section>
  );
}

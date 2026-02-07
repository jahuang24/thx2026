export type MonitorViewTab = 'tracker' | 'feed';

interface MonitorTabsProps {
  activeTab: MonitorViewTab;
  onTabChange: (tab: MonitorViewTab) => void;
}

export function MonitorTabs({ activeTab, onTabChange }: MonitorTabsProps) {
  return (
    <div className="monitor-tabs" role="tablist" aria-label="Patient Monitor sections">
      <button
        type="button"
        className={`monitor-tabs__tab${activeTab === 'tracker' ? ' monitor-tabs__tab--active' : ''}`}
        onClick={() => onTabChange('tracker')}
        role="tab"
        aria-selected={activeTab === 'tracker'}
      >
        Patient Tracker
      </button>
      <button
        type="button"
        className={`monitor-tabs__tab${activeTab === 'feed' ? ' monitor-tabs__tab--active' : ''}`}
        onClick={() => onTabChange('feed')}
        role="tab"
        aria-selected={activeTab === 'feed'}
      >
        Agent Feed
      </button>
    </div>
  );
}

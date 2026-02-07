import type { RollingMetricsSnapshot } from '../types/monitor';

interface MetricChipsProps {
  metrics: RollingMetricsSnapshot;
}

const formatters: Record<keyof RollingMetricsSnapshot, (value: number) => string> = {
  perclos: (value) => value.toFixed(2),
  handToMouthPerMin: (value) => `${value.toFixed(1)}/min`,
  handToTemplePerMin: (value) => `${value.toFixed(1)}/min`,
  forwardLeanSecondsPerMin: (value) => `${value.toFixed(1)}s/min`,
  postureChangeRate: (value) => `${value.toFixed(1)}/min`,
  movementLevel: (value) => value.toFixed(2)
};

const labels: Record<keyof RollingMetricsSnapshot, string> = {
  perclos: 'PERCLOS',
  handToMouthPerMin: 'Hand->Mouth',
  handToTemplePerMin: 'Hand->Temple',
  forwardLeanSecondsPerMin: 'Forward Lean',
  postureChangeRate: 'Posture Changes',
  movementLevel: 'Movement'
};

export function MetricChips({ metrics }: MetricChipsProps) {
  return (
    <div className="metric-chips">
      {(Object.keys(metrics) as (keyof RollingMetricsSnapshot)[]).map((key) => (
        <div key={key} className="metric-chip">
          <span className="metric-chip__label">{labels[key]}</span>
          <strong className="metric-chip__value">{formatters[key](metrics[key])}</strong>
        </div>
      ))}
    </div>
  );
}

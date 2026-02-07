import { describe, expect, it } from 'vitest';
import { RelayAgent } from '../agent/relayAgent';
import type { AgentEvaluationInput } from '../agent/relayAgent';
import type { MonitorEvent, PatientSubject, RollingMetricsSnapshot } from '../types/monitor';

const baseMetrics: RollingMetricsSnapshot = {
  perclos: 0.08,
  handToMouthPerMin: 0,
  handToTemplePerMin: 0,
  forwardLeanSecondsPerMin: 4,
  postureChangeRate: 0,
  movementLevel: 0.2
};

function makeInput(
  ts: number,
  metrics: RollingMetricsSnapshot,
  overrides?: Partial<Pick<AgentEvaluationInput, 'events60s' | 'newEvents'>>
): AgentEvaluationInput {
  const subject: PatientSubject = {
    id: 'patient-1',
    label: 'Subject A',
    status: 'ACTIVE',
    lastSeenAt: ts,
    latestMetrics: metrics,
    latestObservedSignals: []
  };

  return {
    ts,
    subject,
    events60s: overrides?.events60s ?? [],
    newEvents: overrides?.newEvents ?? [],
    calibration: null
  };
}

describe('RelayAgent posture sensitivity', () => {
  it('surfaces posture-shift signals at lower rates', () => {
    const agent = new RelayAgent();
    const result = agent.evaluate(
      makeInput(1_000, {
        ...baseMetrics,
        postureChangeRate: 2
      })
    );

    expect(result.observedSignals.join(' ')).toContain('frequent posture shifts');
  });

  it('emits a restless feed message after shorter posture persistence', () => {
    const agent = new RelayAgent();
    const restlessMetrics: RollingMetricsSnapshot = {
      ...baseMetrics,
      postureChangeRate: 4,
      movementLevel: 0.46
    };

    const first = agent.evaluate(makeInput(1_000, restlessMetrics));
    expect(first.state).toBe('WATCHING');
    expect(first.message).toBeUndefined();

    const second = agent.evaluate(makeInput(7_200, restlessMetrics));
    expect(second.state).toBe('ALERTED');
    expect(second.message?.severity).toBe('LOW');
    expect(second.message?.evidence.criteriaMet.join(' ')).toContain('posture changes');
  });

  it('emits a low-threshold activity message for mild sustained posture change', () => {
    const agent = new RelayAgent();
    const mildActivityMetrics: RollingMetricsSnapshot = {
      ...baseMetrics,
      postureChangeRate: 2,
      movementLevel: 0.31
    };

    const first = agent.evaluate(makeInput(1_000, mildActivityMetrics));
    expect(first.state).toBe('WATCHING');
    expect(first.message).toBeUndefined();

    const second = agent.evaluate(makeInput(5_200, mildActivityMetrics));
    expect(second.state).toBe('ALERTED');
    expect(second.message?.title).toBe('Monitor');
    expect(second.message?.recommendation).toContain('activity increased');
  });

  it('emits immediately for a major posture-shift event', () => {
    const agent = new RelayAgent();
    const ts = 2_000;
    const majorEvent: MonitorEvent = {
      id: 'major-shift-1',
      ts,
      subjectId: 'patient-1',
      type: 'MAJOR_POSTURE_SHIFT',
      detail: 'Abrupt major posture shift detected.'
    };

    const result = agent.evaluate(
      makeInput(
        ts,
        {
          ...baseMetrics,
          postureChangeRate: 1,
          movementLevel: 0.22
        },
        { events60s: [majorEvent], newEvents: [majorEvent] }
      )
    );

    expect(result.state).toBe('ALERTED');
    expect(result.message?.severity).toBe('MED');
    expect(result.message?.title).toBe('Check-in suggested');
    expect(result.message?.observed).toContain('abrupt major posture shift');
  });
});

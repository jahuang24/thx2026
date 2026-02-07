import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgentFeedPanel } from '../components/AgentFeedPanel';
import { PatientTrackerPanel } from '../components/PatientTrackerPanel';
import { AutonomousRelayAgent } from '../agent/autonomousRelayAgent';
import { startMonitorSession, type MonitorSession } from '../monitor/mediapipe';
import { useMonitorStore } from '../store/monitorStore';
import type { CalibrationProfile, MonitorEvent, MonitorEventType, PatientSubject, RollingMetricsSnapshot } from '../types/monitor';

const CALIBRATION_SECONDS = 20;
const zeroMetrics: RollingMetricsSnapshot = {
  perclos: 0,
  handToMouthPerMin: 0,
  handToTemplePerMin: 0,
  forwardLeanSecondsPerMin: 0,
  postureChangeRate: 0,
  movementLevel: 0
};

function createSyntheticEvent(subjectId: string, type: MonitorEventType, ts: number, detail?: string): MonitorEvent {
  return {
    id: `synthetic-${type}-${subjectId}-${ts}-${Math.random().toString(36).slice(2, 7)}`,
    ts,
    subjectId,
    type,
    detail
  };
}

function averageMetric(samples: RollingMetricsSnapshot[], field: keyof RollingMetricsSnapshot) {
  if (!samples.length) {
    return 0;
  }
  return samples.reduce((sum, sample) => sum + sample[field], 0) / samples.length;
}

function updateSubject(subject: PatientSubject, updates: Partial<PatientSubject>): PatientSubject {
  return { ...subject, ...updates };
}

export function PatientMonitorPage() {
  const { state, actions } = useMonitorStore();
  const [starting, setStarting] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationRemaining, setCalibrationRemaining] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noSubjectDetected, setNoSubjectDetected] = useState(false);
  const [debugOverlay, setDebugOverlay] = useState(false);
  const [agentBackendLabel, setAgentBackendLabel] = useState('RULES');
  const [agentBackendError, setAgentBackendError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const relayAgentRef = useRef(new AutonomousRelayAgent());
  const sessionRef = useRef<MonitorSession | null>(null);
  const calibrationIntervalRef = useRef<number | null>(null);
  const calibrationTimeoutRef = useRef<number | null>(null);
  const lastEvaluatedTsRef = useRef(0);
  const noSubjectRef = useRef(false);
  const debugOverlayRef = useRef(debugOverlay);
  const evaluationRunningRef = useRef(false);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    debugOverlayRef.current = debugOverlay;
  }, [debugOverlay]);

  const selectedSubject = useMemo(
    () => state.subjects.find((subject) => subject.id === state.selectedSubjectId),
    [state.selectedSubjectId, state.subjects]
  );
  const activeSubjects = useMemo(
    () => state.subjects.filter((subject) => subject.status === 'ACTIVE').length,
    [state.subjects]
  );
  const highSeverityAlerts = useMemo(
    () => state.agentFeed.filter((message) => message.severity === 'HIGH').length,
    [state.agentFeed]
  );

  const runAgentEvaluation = useCallback(async () => {
    if (evaluationRunningRef.current) {
      return;
    }
    evaluationRunningRef.current = true;
    const now = Date.now();
    const currentState = stateRef.current;
    const subject = currentState.subjects.find((item) => item.id === currentState.selectedSubjectId);
    if (!subject) {
      evaluationRunningRef.current = false;
      return;
    }
    if (noSubjectRef.current) {
      actions.setAgentState(subject.id, 'NEUTRAL');
      actions.upsertSubject(updateSubject(subject, { latestObservedSignals: ['No subject detected in current window.'] }));
      evaluationRunningRef.current = false;
      return;
    }
    const events60s = currentState.events.filter(
      (event) => event.subjectId === subject.id && now - event.ts <= 60000
    );
    const newEvents = currentState.events.filter(
      (event) => event.subjectId === subject.id && event.ts > lastEvaluatedTsRef.current
    );
    lastEvaluatedTsRef.current = now;

    try {
      const result = await relayAgentRef.current.evaluate({
        ts: now,
        subject,
        events60s,
        newEvents,
        calibration: currentState.calibration
      });
      const status = relayAgentRef.current.getStatus();
      setAgentBackendLabel(status.configured ? status.backend : 'RULES');
      setAgentBackendError(status.lastError);
      actions.setAgentState(subject.id, result.state);
      actions.upsertSubject(updateSubject(subject, { latestObservedSignals: result.observedSignals }));
      if (result.message) {
        actions.addAgentMessage(result.message);
      }
    } finally {
      evaluationRunningRef.current = false;
    }
  }, [actions]);

  const handleProcessedFrame = useCallback(
    (frame: { metrics: RollingMetricsSnapshot; events: MonitorEvent[]; noSubjectDetected: boolean }) => {
      const currentState = stateRef.current;
      const subject = currentState.subjects.find((item) => item.id === currentState.selectedSubjectId);
      if (!subject) {
        return;
      }
      const now = Date.now();
      const updatedSubject = updateSubject(subject, {
        status: frame.noSubjectDetected ? 'INACTIVE' : 'ACTIVE',
        lastSeenAt: frame.noSubjectDetected ? subject.lastSeenAt : now,
        latestMetrics: frame.noSubjectDetected ? zeroMetrics : frame.metrics
      });
      actions.upsertSubject(updatedSubject);
      frame.events.forEach((event) => actions.addEvent(event));
      noSubjectRef.current = frame.noSubjectDetected;
      setNoSubjectDetected(frame.noSubjectDetected);
    },
    [actions]
  );

  const stopMonitor = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.stop();
      sessionRef.current = null;
    }
    actions.setMonitorRunning(false);
    setStarting(false);
    setNoSubjectDetected(false);
    noSubjectRef.current = false;
  }, [actions]);

  const startMonitor = useCallback(async () => {
    if (state.monitorRunning || starting || !videoRef.current || !selectedSubject) {
      return;
    }
    setErrorMessage(null);
    setStarting(true);
    try {
      const session = await startMonitorSession({
        subjectId: selectedSubject.id,
        videoElement: videoRef.current,
        debugCanvas: debugCanvasRef.current,
        shouldShowDebugOverlay: () => debugOverlayRef.current,
        onFrame: handleProcessedFrame
      });
      sessionRef.current = session;
      lastEvaluatedTsRef.current = Date.now();
      actions.setMonitorRunning(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to start monitor.');
    } finally {
      setStarting(false);
    }
  }, [actions, handleProcessedFrame, selectedSubject, starting, state.monitorRunning]);

  const clearCalibrationTimers = useCallback(() => {
    if (calibrationIntervalRef.current) {
      window.clearInterval(calibrationIntervalRef.current);
      calibrationIntervalRef.current = null;
    }
    if (calibrationTimeoutRef.current) {
      window.clearTimeout(calibrationTimeoutRef.current);
      calibrationTimeoutRef.current = null;
    }
    setCalibrationRemaining(0);
  }, []);

  const calibrate = useCallback(() => {
    if (!state.monitorRunning || calibrating) {
      return;
    }
    clearCalibrationTimers();
    setCalibrating(true);
    setCalibrationRemaining(CALIBRATION_SECONDS);
    const samples: RollingMetricsSnapshot[] = [];
    let ticks = 0;
    calibrationIntervalRef.current = window.setInterval(() => {
      const currentState = stateRef.current;
      const subject = currentState.subjects.find((item) => item.id === currentState.selectedSubjectId);
      if (subject) {
        samples.push(subject.latestMetrics);
      }
      ticks += 1;
      setCalibrationRemaining(Math.max(0, CALIBRATION_SECONDS - ticks));
    }, 1000);

    calibrationTimeoutRef.current = window.setTimeout(() => {
      clearCalibrationTimers();
      const averagePerclos = averageMetric(samples, 'perclos');
      const averageMovement = averageMetric(samples, 'movementLevel');
      const averageLean = averageMetric(samples, 'forwardLeanSecondsPerMin');
      const profile: CalibrationProfile = {
        blinkRatePerMin: Math.max(6, Math.min(26, Math.round((1 - averagePerclos) * 22))),
        movementLevel: Number(averageMovement.toFixed(2)),
        headPose: Number((averageLean / 60).toFixed(2)),
        completedAt: Date.now()
      };
      actions.setCalibration(profile);
      setCalibrating(false);
    }, CALIBRATION_SECONDS * 1000);
  }, [actions, calibrating, clearCalibrationTimers, state.monitorRunning]);

  const resetAll = useCallback(() => {
    stopMonitor();
    clearCalibrationTimers();
    relayAgentRef.current.reset();
    const status = relayAgentRef.current.getStatus();
    setAgentBackendLabel(status.configured ? status.backend : 'RULES');
    setAgentBackendError(null);
    actions.resetAll();
    setCalibrating(false);
    setErrorMessage(null);
    setNoSubjectDetected(false);
    lastEvaluatedTsRef.current = 0;
  }, [actions, clearCalibrationTimers, stopMonitor]);

  const injectScenario = useCallback(
    (scenario: 'nausea' | 'posture-drop' | 'drowsy') => {
      const currentState = stateRef.current;
      const subject = currentState.subjects.find((item) => item.id === currentState.selectedSubjectId);
      if (!subject) {
        return;
      }
      const now = Date.now();

      if (scenario === 'nausea') {
        const metrics: RollingMetricsSnapshot = {
          perclos: 0.14,
          handToMouthPerMin: 3.4,
          handToTemplePerMin: 1.2,
          forwardLeanSecondsPerMin: 28,
          postureChangeRate: 6.8,
          movementLevel: 0.74
        };
        actions.upsertSubject(updateSubject(subject, { latestMetrics: metrics, status: 'ACTIVE', lastSeenAt: now }));
        actions.addEvent(createSyntheticEvent(subject.id, 'HAND_TO_MOUTH', now - 10000, 'Synthetic hand-to-mouth.'));
        actions.addEvent(createSyntheticEvent(subject.id, 'HAND_TO_MOUTH', now - 8000, 'Synthetic hand-to-mouth.'));
        actions.addEvent(createSyntheticEvent(subject.id, 'HAND_TO_MOUTH', now - 5000, 'Synthetic hand-to-mouth.'));
        actions.addEvent(createSyntheticEvent(subject.id, 'FORWARD_LEAN', now - 4000, 'Synthetic forward lean.'));
        actions.addEvent(createSyntheticEvent(subject.id, 'RESTLESSNESS_SPIKE', now - 2000, 'Synthetic restlessness.'));
      }

      if (scenario === 'posture-drop') {
        const metrics: RollingMetricsSnapshot = {
          perclos: 0.2,
          handToMouthPerMin: 0.5,
          handToTemplePerMin: 0.2,
          forwardLeanSecondsPerMin: 8,
          postureChangeRate: 1.3,
          movementLevel: 0.1
        };
        actions.upsertSubject(updateSubject(subject, { latestMetrics: metrics, status: 'ACTIVE', lastSeenAt: now }));
        actions.addEvent(createSyntheticEvent(subject.id, 'POSTURE_DROP', now - 1000, 'Synthetic posture drop.'));
      }

      if (scenario === 'drowsy') {
        const metrics: RollingMetricsSnapshot = {
          perclos: 0.32,
          handToMouthPerMin: 0.3,
          handToTemplePerMin: 0.2,
          forwardLeanSecondsPerMin: 6,
          postureChangeRate: 1.1,
          movementLevel: 0.16
        };
        actions.upsertSubject(updateSubject(subject, { latestMetrics: metrics, status: 'ACTIVE', lastSeenAt: now }));
        actions.addEvent(
          createSyntheticEvent(subject.id, 'PROLONGED_EYE_CLOSURE', now - 1000, 'Synthetic prolonged eye closure.')
        );
      }
      void runAgentEvaluation();
    },
    [actions, runAgentEvaluation]
  );

  useEffect(() => {
    if (!state.monitorRunning) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      void runAgentEvaluation();
    }, 2000);
    return () => window.clearInterval(interval);
  }, [runAgentEvaluation, state.monitorRunning]);

  useEffect(() => {
    const status = relayAgentRef.current.getStatus();
    setAgentBackendLabel(status.configured ? status.backend : 'RULES');
    setAgentBackendError(status.lastError);
  }, []);

  useEffect(() => {
    return () => {
      stopMonitor();
      clearCalibrationTimers();
    };
  }, [clearCalibrationTimers, stopMonitor]);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-semibold text-ink-900">Patient Monitor</h2>
            <p className="mt-1 text-sm text-ink-500">
              Non-diagnostic. Flags observable behavior patterns only.
            </p>
            <p className="mt-2 text-xs text-ink-400">
              Agent backend: <span className="font-semibold text-ink-700">{agentBackendLabel}</span>
              {agentBackendError ? ` (fallback active: ${agentBackendError})` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-ink-950 px-4 py-2 text-xs font-semibold text-white"
              onClick={startMonitor}
              disabled={state.monitorRunning || starting}
            >
              Start
            </button>
            <button
              type="button"
              className="rounded-full border border-ink-200 px-4 py-2 text-xs font-semibold text-ink-700"
              onClick={stopMonitor}
              disabled={!state.monitorRunning && !starting}
            >
              Stop
            </button>
            <button
              type="button"
              className="rounded-full border border-ink-200 px-4 py-2 text-xs font-semibold text-ink-700"
              onClick={calibrate}
              disabled={!state.monitorRunning || calibrating}
            >
              {calibrating ? `Calibrating (${calibrationRemaining}s)` : 'Calibrate'}
            </button>
            <button
              type="button"
              className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700"
              onClick={resetAll}
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-400">Subjects Tracked</p>
          <p className="mt-3 text-2xl font-semibold text-ink-900">{state.subjects.length}</p>
          <p className="mt-1 text-xs text-ink-500">{activeSubjects} active right now</p>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-400">Feed Messages</p>
          <p className="mt-3 text-2xl font-semibold text-ink-900">{state.agentFeed.length}</p>
          <p className="mt-1 text-xs text-ink-500">{highSeverityAlerts} high-severity</p>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-400">Monitor State</p>
          <p className="mt-3 text-2xl font-semibold text-ink-900">
            {state.monitorRunning ? 'Running' : 'Stopped'}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            {state.monitorRunning ? 'Streaming derived signals' : 'Awaiting start'}
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
          <PatientTrackerPanel
            videoRef={videoRef}
            debugCanvasRef={debugCanvasRef}
            monitorRunning={state.monitorRunning}
            starting={starting}
            errorMessage={errorMessage}
            noSubjectDetected={noSubjectDetected}
            debugOverlay={debugOverlay}
            onDebugOverlayChange={setDebugOverlay}
            subjects={state.subjects}
            selectedSubjectId={state.selectedSubjectId}
            relayStateBySubject={state.agentStateBySubject}
            onSelectSubject={actions.selectSubject}
            events={state.events}
            showDevInjectors={import.meta.env.DEV}
            onInjectScenario={injectScenario}
          />
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
          <AgentFeedPanel messages={state.agentFeed} />
        </div>
      </section>

      {!selectedSubject ? (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white/80 p-4 text-sm text-ink-500">
          No subject selected. Select a subject from the tracker panel to continue.
        </div>
      ) : null}
    </div>
  );
}

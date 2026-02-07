import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AgentFeedPanel } from '../components/AgentFeedPanel';
import { PatientTrackerPanel } from '../components/PatientTrackerPanel';
import { AutonomousRelayAgent } from '../agent/autonomousRelayAgent';
import { startMonitorSession, type MonitorSession } from '../monitor/mediapipe';
import { beds, patients, rooms } from '../data/mock';
import { useMonitorStore } from '../store/monitorStore';
import type {
  CalibrationProfile,
  PatientSubject,
  RollingMetricsSnapshot,
  MonitorEvent
} from '../types/monitor';
import { fetchPatientById, updatePatientAssignment, type PatientRecord } from '../services/patientApi';
import { createAdmission, fetchAdmissions, updateAdmissionStatus } from '../services/admissionsApi';
import { store as appStore } from '../services/store';

const CALIBRATION_SECONDS = 20;
const zeroMetrics: RollingMetricsSnapshot = {
  perclos: 0,
  handToMouthPerMin: 0,
  handToTemplePerMin: 0,
  forwardLeanSecondsPerMin: 0,
  postureChangeRate: 0,
  movementLevel: 0
};

function averageMetric(samples: RollingMetricsSnapshot[], field: keyof RollingMetricsSnapshot) {
  if (!samples.length) {
    return 0;
  }
  return samples.reduce((sum, sample) => sum + sample[field], 0) / samples.length;
}

function updateSubject(subject: PatientSubject, updates: Partial<PatientSubject>): PatientSubject {
  return { ...subject, ...updates };
}

function buildSubjectsFromAssignments(): PatientSubject[] {
  const occupiedBeds = beds.filter((bed) => bed.occupied);
  if (!occupiedBeds.length) {
    return [
      {
        id: 'S-001',
        label: 'Subject A',
        status: 'INACTIVE',
        lastSeenAt: 0,
        latestMetrics: zeroMetrics,
        latestObservedSignals: [],
        roomLabel: null,
        bedLabel: null
      }
    ];
  }

  return occupiedBeds.map((bed, index) => {
    const room = rooms.find((item) => item.id === bed.roomId);
    const patient = bed.patientId ? patients.find((item) => item.id === bed.patientId) : undefined;
    return {
      id: patient?.id ?? `S-${String(index + 1).padStart(3, '0')}`,
      label: patient?.name ?? `Subject ${String.fromCharCode(65 + index)}`,
      status: 'INACTIVE' as const,
      lastSeenAt: 0,
      latestMetrics: zeroMetrics,
      latestObservedSignals: [],
      roomLabel: room?.roomNumber ?? null,
      bedLabel: bed.bedLabel ?? null
    };
  });
}

export function PatientMonitorPage() {
  const { state, actions } = useMonitorStore();
  const { patientId } = useParams();
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [patientLoading, setPatientLoading] = useState(true);
  const [assignmentUpdating, setAssignmentUpdating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationRemaining, setCalibrationRemaining] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noSubjectDetected, setNoSubjectDetected] = useState(false);
  const [agentBackendLabel, setAgentBackendLabel] = useState('RULES');
  const [agentBackendError, setAgentBackendError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const relayAgentRef = useRef(new AutonomousRelayAgent());
  const sessionRef = useRef<MonitorSession | null>(null);
  const calibrationIntervalRef = useRef<number | null>(null);
  const calibrationTimeoutRef = useRef<number | null>(null);
  const lastEvaluatedTsRef = useRef(0);
  const noSubjectRef = useRef(false);
  const evaluationRunningRef = useRef(false);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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

  const assignedBed = useMemo(() => {
    if (!patient?.bedId) return null;
    return beds.find((bed) => bed.id === patient.bedId) ?? null;
  }, [patient?.bedId]);

  const assignedRoom = useMemo(() => {
    const roomId = patient?.roomId ?? assignedBed?.roomId;
    if (!roomId) return null;
    return rooms.find((room) => room.id === roomId) ?? null;
  }, [assignedBed?.roomId, patient?.roomId]);

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
        appStore.addAgentMessage(result.message, 'MONITOR');
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
        debugCanvas: null,
        shouldShowDebugOverlay: () => false,
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
    let active = true;
    if (!patientId) {
      setPatient(null);
      setPatientLoading(false);
      return () => undefined;
    }
    const load = async () => {
      const result = await fetchPatientById(patientId);
      if (active) {
        setPatient(result);
        setPatientLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [patientId]);

  useEffect(() => {
    if (patientId || state.subjects.length > 0) {
      return;
    }
    const seededSubjects = buildSubjectsFromAssignments();
    actions.setSubjects(seededSubjects, seededSubjects[0]?.id);
  }, [actions, patientId, state.subjects.length]);

  useEffect(() => {
    if (!patient || !patient.id) {
      return;
    }
    const roomLabel = assignedRoom?.roomNumber ?? null;
    const bedLabel = assignedBed?.bedLabel ?? null;
    const existing = state.subjects.find((subject) => subject.id === patient.id);
    if (!existing) {
      const subject: PatientSubject = {
        id: patient.id,
        label: patient.name ?? 'Patient',
        status: 'INACTIVE',
        lastSeenAt: 0,
        latestMetrics: zeroMetrics,
        latestObservedSignals: [],
        roomLabel,
        bedLabel
      };
      actions.setSubjects([subject], patient.id);
      return;
    }
    actions.upsertSubject(
      updateSubject(existing, {
        label: patient.name ?? existing.label,
        roomLabel,
        bedLabel
      })
    );
  }, [
    actions,
    assignedBed?.bedLabel,
    assignedRoom?.roomNumber,
    patient,
    state.subjects
  ]);

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
            {patient ? (
              <div className="mt-2 space-y-1 text-sm text-ink-600">
                <div>
                  {patient.name ?? 'Patient'} - MRN {patient.mrn || 'Unknown'}
                </div>
                <div>
                  {assignedRoom
                    ? `Room ${assignedRoom.roomNumber}${assignedBed ? ` - Bed ${assignedBed.bedLabel}` : ''}`
                    : 'No room assigned'}
                </div>
              </div>
            ) : patientLoading ? (
              <p className="mt-2 text-sm text-ink-500">Loading patient...</p>
            ) : (
              <p className="mt-2 text-sm text-rose-600">Patient record not found.</p>
            )}
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
            <button
              type="button"
              className="rounded-full border border-ink-200 px-4 py-2 text-xs font-semibold text-ink-700 disabled:opacity-60"
              onClick={async () => {
                if (!patient?.id || assignmentUpdating) return;
                setAssignmentUpdating(true);
                const cleared = await updatePatientAssignment(patient.id, {
                  roomId: null,
                  bedId: null,
                  unitId: null
                });
                if (cleared) {
                  const admissions = await fetchAdmissions();
                  const existing = admissions.find((item) => item.patientId === patient.id);
                  if (existing) {
                    await updateAdmissionStatus(existing.id, { admitStatus: 'PENDING' });
                  } else {
                    await createAdmission({ patientId: patient.id, admitStatus: 'PENDING' });
                  }
                  const refreshed = await fetchPatientById(patient.id);
                  setPatient(refreshed);
                }
                setAssignmentUpdating(false);
              }}
              disabled={!patient?.id || assignmentUpdating}
            >
              {assignmentUpdating ? 'Updating...' : 'Return to admissions'}
            </button>
          </div>
        </div>
      </header>

      <section className="monitor-video-panel rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
        <div className="tracker-preview__head">
          <div>
            <h3>Live video feed</h3>
            <p>16:9 wide feed for the focused subject.</p>
          </div>
        </div>

        <div className="preview-frame monitor-video-frame">
          <video ref={videoRef} autoPlay muted playsInline />
          {!state.monitorRunning ? <div className="preview-overlay-label">Monitor stopped</div> : null}
          {starting ? (
            <div className="preview-overlay-label preview-overlay-label--skeleton">Starting monitor...</div>
          ) : null}
          {noSubjectDetected && state.monitorRunning ? <div className="preview-alert">No subject detected</div> : null}
        </div>

        {errorMessage ? <p className="monitor-error">{errorMessage}</p> : null}
      </section>

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
            subjects={state.subjects}
            selectedSubjectId={state.selectedSubjectId}
            relayStateBySubject={state.agentStateBySubject}
            onSelectSubject={actions.selectSubject}
            events={state.events}
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

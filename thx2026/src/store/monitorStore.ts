import { createContext, createElement, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type {
  AgentMessage,
  CalibrationProfile,
  MonitorEvent,
  PatientSubject,
  RelayState,
  RollingMetricsSnapshot
} from '../types/monitor';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const MAX_AGENT_MESSAGES = 50;

export const emptyMetrics: RollingMetricsSnapshot = {
  perclos: 0,
  handToMouthPerMin: 0,
  handToTemplePerMin: 0,
  forwardLeanSecondsPerMin: 0,
  postureChangeRate: 0,
  movementLevel: 0
};

export interface MonitorStoreState {
  subjects: PatientSubject[];
  events: MonitorEvent[];
  agentFeed: AgentMessage[];
  monitorRunning: boolean;
  selectedSubjectId: string;
  agentStateBySubject: Record<string, RelayState>;
  calibration: CalibrationProfile | null;
}

interface MonitorStoreActions {
  upsertSubject: (subject: PatientSubject) => void;
  addEvent: (event: MonitorEvent) => void;
  addAgentMessage: (message: AgentMessage) => void;
  setMonitorRunning: (running: boolean) => void;
  setSubjects: (subjects: PatientSubject[], selectedSubjectId?: string) => void;
  selectSubject: (subjectId: string) => void;
  setAgentState: (subjectId: string, state: RelayState) => void;
  setCalibration: (calibration: CalibrationProfile | null) => void;
  resetAll: () => void;
}

interface MonitorStoreContextValue {
  state: MonitorStoreState;
  actions: MonitorStoreActions;
}

type Action =
  | { type: 'UPSERT_SUBJECT'; payload: PatientSubject }
  | { type: 'ADD_EVENT'; payload: MonitorEvent }
  | { type: 'ADD_AGENT_MESSAGE'; payload: AgentMessage }
  | { type: 'SET_MONITOR_RUNNING'; payload: boolean }
  | { type: 'SET_SUBJECTS'; payload: { subjects: PatientSubject[]; selectedSubjectId?: string } }
  | { type: 'SELECT_SUBJECT'; payload: string }
  | { type: 'SET_AGENT_STATE'; payload: { subjectId: string; state: RelayState } }
  | { type: 'SET_CALIBRATION'; payload: CalibrationProfile | null }
  | { type: 'RESET_ALL' };

const initialState: MonitorStoreState = {
  subjects: [],
  events: [],
  agentFeed: [],
  monitorRunning: false,
  selectedSubjectId: '',
  agentStateBySubject: {},
  calibration: null
};

function pruneRecentEvents(events: MonitorEvent[], nowTs: number) {
  return events.filter((event) => nowTs - event.ts <= FIVE_MINUTES_MS);
}

function reducer(state: MonitorStoreState, action: Action): MonitorStoreState {
  switch (action.type) {
    case 'UPSERT_SUBJECT': {
      const existing = state.subjects.find((subject) => subject.id === action.payload.id);
      if (!existing) {
        return { ...state, subjects: [...state.subjects, action.payload] };
      }
      return {
        ...state,
        subjects: state.subjects.map((subject) => (subject.id === action.payload.id ? action.payload : subject))
      };
    }
    case 'ADD_EVENT': {
      const withNew = [...state.events, action.payload];
      return { ...state, events: pruneRecentEvents(withNew, action.payload.ts) };
    }
    case 'ADD_AGENT_MESSAGE': {
      const sorted = [action.payload, ...state.agentFeed].sort((left, right) => right.ts - left.ts);
      return { ...state, agentFeed: sorted.slice(0, MAX_AGENT_MESSAGES) };
    }
    case 'SET_MONITOR_RUNNING':
      return { ...state, monitorRunning: action.payload };
    case 'SET_SUBJECTS': {
      const subjects = action.payload.subjects;
      const selectedSubjectId = action.payload.selectedSubjectId ?? subjects[0]?.id ?? '';
      const agentStateBySubject = subjects.reduce<Record<string, RelayState>>((acc, subject) => {
        acc[subject.id] = state.agentStateBySubject[subject.id] ?? 'NEUTRAL';
        return acc;
      }, {});
      return {
        ...state,
        subjects,
        selectedSubjectId,
        agentStateBySubject
      };
    }
    case 'SELECT_SUBJECT':
      return { ...state, selectedSubjectId: action.payload };
    case 'SET_AGENT_STATE':
      return {
        ...state,
        agentStateBySubject: {
          ...state.agentStateBySubject,
          [action.payload.subjectId]: action.payload.state
        }
      };
    case 'SET_CALIBRATION':
      return { ...state, calibration: action.payload };
    case 'RESET_ALL':
      return initialState;
    default:
      return state;
  }
}

const MonitorStoreContext = createContext<MonitorStoreContextValue | null>(null);

export function MonitorStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const actions: MonitorStoreActions = useMemo(
    () => ({
      upsertSubject: (subject) => dispatch({ type: 'UPSERT_SUBJECT', payload: subject }),
      addEvent: (event) => dispatch({ type: 'ADD_EVENT', payload: event }),
      addAgentMessage: (message) => dispatch({ type: 'ADD_AGENT_MESSAGE', payload: message }),
      setMonitorRunning: (running) => dispatch({ type: 'SET_MONITOR_RUNNING', payload: running }),
      setSubjects: (subjects, selectedSubjectId) =>
        dispatch({ type: 'SET_SUBJECTS', payload: { subjects, selectedSubjectId } }),
      selectSubject: (subjectId) => dispatch({ type: 'SELECT_SUBJECT', payload: subjectId }),
      setAgentState: (subjectId, relayState) =>
        dispatch({ type: 'SET_AGENT_STATE', payload: { subjectId, state: relayState } }),
      setCalibration: (calibration) => dispatch({ type: 'SET_CALIBRATION', payload: calibration }),
      resetAll: () => dispatch({ type: 'RESET_ALL' })
    }),
    []
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return createElement(MonitorStoreContext.Provider, { value }, children);
}

export function useMonitorStore() {
  const context = useContext(MonitorStoreContext);
  if (!context) {
    throw new Error('useMonitorStore must be used inside MonitorStoreProvider');
  }
  return context;
}

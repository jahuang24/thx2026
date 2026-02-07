
import { useEffect, useMemo, useRef, useState } from 'react';
import { patients } from '../data/mock';
import { realtimeBus } from '../services/realtime';
import { store } from '../services/store';

type SpeechRecognition = any;

type Mode = 'WAITING' | 'CAPTURING';

type MicState = 'idle' | 'listening' | 'blocked' | 'unsupported' | 'error';

const WAKE_WORD = 'baymax';
const SILENCE_MS = 1200;

export function PatientPortalPage() {

  const [, setMicState] = useState<MicState>('idle');
  const [mode, setMode] = useState<Mode>('WAITING');
  const [captured, setCaptured] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState(store.messages);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldRunRef = useRef(true);
  const wakeIndexRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const modeRef = useRef<Mode>('WAITING');
  const capturedRef = useRef('');

  const patient = patients[0];

  useEffect(() => {
    const unsubscribeNew = realtimeBus.on('newMessage', () => setMessages([...store.messages]));
    const unsubscribeUpdate = realtimeBus.on('messageUpdated', () => setMessages([...store.messages]));
    return () => {
      unsubscribeNew();
      unsubscribeUpdate();
    };
  }, []);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const resetCapture = () => {
    setMode('WAITING');
    modeRef.current = 'WAITING';
    wakeIndexRef.current = null;
    setCaptured('');
    capturedRef.current = '';
    clearSilenceTimer();
  };

  const sendToDoctor = (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || !patient?.id) return false;
    store.sendPatientMessage(patient.id, trimmed);
    setMessages([...store.messages]);
    return true;
  };

  const scheduleSend = () => {
    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => {
      if (modeRef.current !== 'CAPTURING') return;
      const sent = sendToDoctor(capturedRef.current);
      resetCapture();
      if (!sent) {
        setError('I heard “baymax”, but no message followed. Try again.');
      }
    }, SILENCE_MS);
  };

  useEffect(() => {
    const SpeechRecognitionApi =
      (globalThis as any).webkitSpeechRecognition ?? (globalThis as any).SpeechRecognition;

    if (!window.isSecureContext) {
      setMicState('blocked');
      setError('Microphone access requires HTTPS or http://localhost.');
      return;
    }

    if (!SpeechRecognitionApi) {
      setMicState('unsupported');
      setError('Speech recognition is not available in this browser.');
      return;
    }

    shouldRunRef.current = true;
    const recognition = new SpeechRecognitionApi();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      setError(null);
      const latestChunk = event.results[event.results.length - 1]?.[0]?.transcript ?? '';
      const combined = Array.from(event.results)
        .map((result: any) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (!combined && !latestChunk) return;

      if (modeRef.current === 'WAITING') {
        const loweredLatest = latestChunk.toLowerCase();
        const idxLatest = loweredLatest.lastIndexOf(WAKE_WORD);
        if (idxLatest < 0) return;
        const afterWake = latestChunk.slice(idxLatest + WAKE_WORD.length).trim();
        setCaptured('');
        capturedRef.current = '';
        wakeIndexRef.current = 0;
        setMode('CAPTURING');
        modeRef.current = 'CAPTURING';
        setCaptured(afterWake);
        capturedRef.current = afterWake;
        scheduleSend();
        return;
      }

      if (modeRef.current === 'CAPTURING') {
        const message = latestChunk.trim();
        setCaptured(message);
        capturedRef.current = message;
        scheduleSend();
      }
    };

    recognition.onerror = (event: any) => {
      const code = event?.error;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setMicState('blocked');
        setError('Microphone access is blocked. Allow permission to continue.');
        shouldRunRef.current = false;
        return;
      }
      if (code === 'no-speech' || code === 'aborted') return;
      setMicState('error');
      setError('Microphone error. Try again.');
    };

    recognition.onend = () => {
      if (!shouldRunRef.current) return;
      try {
        recognition.start();
        setMicState('listening');
      } catch {
        setMicState('idle');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldRunRef.current = false;
      clearSilenceTimer();
      try {
        recognition.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, []);

  const handleEnableMic = async () => {
    setError(null);
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }
      try {
        recognitionRef.current?.start?.();
        setMicState('listening');
      } catch (err: any) {
        if (err?.name === 'InvalidStateError') {
          setMicState('listening');
          return;
        }
        throw err;
      }
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setMicState('blocked');
        setError('Microphone permission denied.');
        return;
      }
      setMicState('error');
      setError('Unable to start microphone. Try again.');
    }
  };

  const handleReset = () => {
    resetCapture();
    setError(null);
  };

  const outgoing = useMemo(() => {
    if (!patient?.id) return [];
    return messages.filter((msg) => msg.patientId === patient.id && msg.sender === 'PATIENT');
  }, [messages, patient?.id]);

  const incoming = useMemo(() => {
    if (!patient?.id) return [];
    return messages.filter((msg) => msg.patientId === patient.id && msg.sender === 'NURSE');
  }, [messages, patient?.id]);

  const vitals = [
    { label: 'Heart Rate', value: '84', unit: 'bpm', note: 'Stable' },
    { label: 'Blood Pressure', value: '124/78', unit: 'mmHg', note: 'Within goal' },
    { label: 'Oxygen', value: '97', unit: '%', note: 'Good' },
    { label: 'Respiration', value: '18', unit: 'rpm', note: 'Even' }
  ];

  const journey = [
    { label: 'Triage', time: '08:45' },
    { label: 'Diagnostics', time: '09:20' },
    { label: 'Provider review', time: '10:05' },
    { label: 'Treatment plan', time: '10:40' },
    { label: 'Discharge prep', time: 'Pending' }
  ];
  const currentStepIndex = 3;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f3f7ff,_#ffffff_55%,_#f7fafc)] px-6 py-10 text-slate-900">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
        <section className="rounded-[32px] border border-slate-200 bg-white/95 p-7 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                Your Care Assistant
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900">
                Hello, {patient?.name ?? 'there'}
              </h1>
              <p className="mt-3 text-base text-slate-600">
                Say “baymax”, then speak your message. We will send it to your care team.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              {patient?.name ?? 'Patient'} · {patient?.mrn ?? 'MRN'}
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="rounded-2xl border border-slate-200 bg-sky-50/70 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Listening</p>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                    mode === 'WAITING'
                      ? 'bg-white text-slate-500'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      mode === 'WAITING' ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'
                    }`}
                  />
                  {mode === 'WAITING' ? 'Ready' : 'Listening'}
                </span>
              </div>
              <p className="mt-3 text-base text-slate-700">
                {mode === 'WAITING'
                  ? 'Say “baymax” to start your message.'
                  : 'Pause when finished and we will send it.'}
              </p>
              {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
              <button
                onClick={handleEnableMic}
                className="mt-4 rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white"
              >
                Enable microphone
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">Your Message</p>
              <p className="mt-3 text-lg font-semibold text-slate-900">
                {captured ? `“${captured}”` : 'No message yet.'}
              </p>
              <button
                onClick={handleReset}
                className="mt-4 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Clear
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">Messages From Your Nurse</p>
              <div className="mt-3 space-y-3">
                {incoming.length === 0 ? (
                  <p className="text-sm text-slate-500">No new messages.</p>
                ) : (
                  incoming.slice(0, 4).map((msg) => (
                    <div
                      key={msg.id}
                      className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-slate-700"
                    >
                      {msg.body}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">Your Sent Messages</p>
              <div className="mt-3 space-y-3">
                {outgoing.length === 0 ? (
                  <p className="text-sm text-slate-500">No messages sent yet.</p>
                ) : (
                  outgoing.slice(0, 4).map((msg) => (
                    <div
                      key={msg.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm text-slate-700"
                    >
                      {msg.body}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[32px] border border-slate-200 bg-white/95 p-7 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                  Vitals
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Latest Readings</h2>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Stable
              </span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {vitals.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {item.label}
                  </p>
                  <div className="mt-2 flex items-end gap-2">
                    <p className="text-3xl font-semibold text-slate-900">{item.value}</p>
                    <span className="text-xs text-slate-500">{item.unit}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{item.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-white/95 p-7 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                  Your Care Journey
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Where You Are</h2>
              </div>
              <span className="text-xs text-slate-400">
                Room {patient?.bedId?.replace('bed-', '') ?? 'TBD'}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {journey.map((step, index) => {
                const isCurrent = index === currentStepIndex;
                const isComplete = index < currentStepIndex;
                return (
                  <div
                    key={step.label}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                      isCurrent
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : isComplete
                          ? 'border-emerald-200 bg-emerald-50/80 text-slate-800'
                          : 'border-slate-100 bg-white text-slate-700'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold">{step.label}</p>
                      <p className={`text-xs ${isCurrent ? 'text-white/70' : 'text-slate-400'}`}>
                        {isCurrent ? 'In progress' : isComplete ? 'Complete' : 'Upcoming'}
                      </p>
                    </div>
                    <span className={`text-xs ${isCurrent ? 'text-white/70' : 'text-slate-400'}`}>
                      {step.time}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

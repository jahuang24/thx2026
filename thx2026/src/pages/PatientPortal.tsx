import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { realtimeBus } from '../services/realtime';
import { store } from '../services/store';
import { clearPatientSession, getPatientSession } from '../services/patientSession';
import { fetchPatientById, type PatientRecord } from '../services/patientApi';
import { fetchMessagesForPatient } from '../services/messagesApi';
import { useFacilityData } from '../hooks/useFacilityData';

type SpeechRecognition = any;

type Mode = 'WAITING' | 'CAPTURING';

type MicState = 'idle' | 'listening' | 'blocked' | 'unsupported' | 'error';

const WAKE_WORD = 'baymax';
const SILENCE_MS = 300;
const BAYMAX_CHAT_TIMEOUT_MS = 12000;
const BAYMAX_CHAT_RETRY_TIMEOUT_MS = 18000;

export function PatientPortalPage() {
  const { rooms, beds } = useFacilityData();
  const [micState, setMicState] = useState<MicState>('idle');
  const [micEnabled, setMicEnabled] = useState(false);
  const [mode, setMode] = useState<Mode>('WAITING');
  const [captured, setCaptured] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState(store.messages);
  const [medicalRecord, setMedicalRecord] = useState<any | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [baymaxReply, setBaymaxReply] = useState<string | null>(null);
  const [baymaxError, setBaymaxError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [patientRecord, setPatientRecord] = useState<PatientRecord | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const shouldRunRef = useRef(false);
  const micEnabledRef = useRef(false);
  const wakeIndexRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const modeRef = useRef<Mode>('WAITING');
  const capturedRef = useRef('');
  const sendToNurseRef = useRef(false);
  const awaitingNurseMessageRef = useRef(false);
  const dispatchingCaptureRef = useRef(false);
  const voiceQuotaExceededRef = useRef(false);

  const navigate = useNavigate();
  const patient = getPatientSession();
  const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:5050';

  const [voiceId, setVoiceId] = useState('5e3JKXK83vvgQqBcdUol');

  const AVAILABLE_VOICES = [
    { id: '5e3JKXK83vvgQqBcdUol', name: 'Baymax' },
    { id: 'fO96OTVqTn6bBvyybd7U', name: 'Kermit' },
    { id: 'wJ5MX7uuKXZwFqGdWM4N', name: 'Raj' },
    { id: 'eVItLK1UvXctxuaRV2Oq', name: 'mommy'},
  ];

  useEffect(() => {
    if (!patient?.id) return;
    let active = true;
    const timeoutId = window.setTimeout(() => {
      if (!active) return;
      setRecordError('Medical record is taking longer than expected.');
      setRecordLoading(false);
    }, 4000);
    const fetchRecord = async () => {
      setRecordLoading(true);
      setRecordError(null);
      try {
        const controller = new AbortController();
        const requestTimeout = window.setTimeout(() => controller.abort(), 8000);
        const response = await fetch(`${API_BASE}/patients/${patient.id}/records`, {
          signal: controller.signal
        });
        window.clearTimeout(requestTimeout);
        if (!response.ok) {
          setRecordError('Unable to load medical record.');
          return;
        }
        const data = await response.json();
        if (active) setMedicalRecord(data);
      } catch {
        if (active) setRecordError('Unable to reach the server.');
      } finally {
        if (active) setRecordLoading(false);
        window.clearTimeout(timeoutId);
      }
    };
    void fetchRecord();
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [API_BASE, patient?.id]);

  useEffect(() => {
    let active = true;
    if (!patient?.id) return () => undefined;
    const loadPatient = async () => {
      const cached = await fetchPatientById(patient.id);
      if (active) setPatientRecord(cached);
      const result = await fetchPatientById(patient.id, { force: true, timeoutMs: 8000 });
      if (active) setPatientRecord(result);
    };
    void loadPatient();
    return () => {
      active = false;
    };
  }, [patient?.id]);

  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  useEffect(() => {
    const unsubscribeNew = realtimeBus.on('newMessage', () => {
      if (!patient?.id) return;
      setMessages(store.messages.filter((msg) => msg.patientId === patient.id));
    });
    const unsubscribeUpdate = realtimeBus.on('messageUpdated', () => {
      if (!patient?.id) return;
      setMessages(store.messages.filter((msg) => msg.patientId === patient.id));
    });
    return () => {
      unsubscribeNew();
      unsubscribeUpdate();
    };
  }, [patient?.id]);

  useEffect(() => {
    let active = true;
    if (!patient?.id) return () => undefined;
    const seed = store.messages.filter((msg) => msg.patientId === patient.id);
    if (seed.length) {
      setMessages(seed);
    }
    const load = async () => {
      const result = await fetchMessagesForPatient(patient.id, { force: true, timeoutMs: 8000 });
      if (active) setMessages(result);
    };
    void load();
    return () => {
      active = false;
    };
  }, [patient?.id]);

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
    setLiveTranscript('');
    clearSilenceTimer();
  };

  const resumeMicAfterSpeech = () => {
    shouldRunRef.current = micEnabledRef.current;
    if (!micEnabledRef.current) return;
    try {
      recognitionRef.current?.start?.();
    } catch {}
  };

  const speakWithBrowserFallback = async (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      return false;
    }
    return new Promise<boolean>((resolve) => {
      try {
        const synthesis = window.speechSynthesis;
        synthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 0.9;
        utterance.volume = 1;

        const voices = synthesis.getVoices();
        const preferredVoice =
          voices.find((voice) => /^en/i.test(voice.lang) && /Google|Microsoft|Samantha|Zira/i.test(voice.name)) ??
          voices.find((voice) => /^en/i.test(voice.lang)) ??
          null;
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onend = () => resolve(true);
        utterance.onerror = () => resolve(false);
        synthesis.speak(utterance);
      } catch {
        resolve(false);
      }
    });
  };

  const speak = async (text: string) => {
    shouldRunRef.current = false;
    try {
      recognitionRef.current?.stop?.();
    } catch {}

    const safeText = text?.trim() || 'I am here with you.';

    try {
      if (voiceQuotaExceededRef.current) {
        throw Object.assign(new Error('Baymax voice quota exceeded'), { code: 'VOICE_QUOTA_EXCEEDED' });
      }

      const requestVoiceAudio = async (selectedVoiceId: string) => {
        const response = await fetch(`${API_BASE}/patients/speak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: safeText, voiceId: selectedVoiceId })
        });
        if (!response.ok) {
          const raw = await response.text();
          let parsed: any = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {}
          const err = Object.assign(
            new Error(parsed?.message || raw || 'Voice failed'),
            { code: parsed?.code || `HTTP_${response.status}` }
          );
          throw err;
        }
        return response.blob();
      };

      let audioBlob: Blob;
      try {
        audioBlob = await requestVoiceAudio(voiceId);
      } catch {
        audioBlob = await requestVoiceAudio('5e3JKXK83vvgQqBcdUol');
      }
      if (!audioBlob.size || !audioBlob.type.includes('audio')) {
        throw new Error('Invalid audio payload');
      }
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;
      audio.volume = 1;
      audio.preload = 'auto';

      await new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          activeAudioRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          activeAudioRef.current = null;
          reject(new Error('Audio playback failed'));
        };
        void audio.play().catch(reject);
      });
    } catch (err) {
      console.error('Speech Error:', err);
      const code = (err as any)?.code;
      if (code === 'VOICE_QUOTA_EXCEEDED') {
        voiceQuotaExceededRef.current = true;
      }
      const fallbackSpoken = await speakWithBrowserFallback(safeText);
      if (!fallbackSpoken) {
        if (code === 'VOICE_QUOTA_EXCEEDED') {
          setBaymaxError('Baymax voice service is unavailable right now.');
        } else {
          setBaymaxError('Voice service unavailable. Baymax replied in text only.');
        }
      } else {
        setBaymaxError(null);
      }
    } finally {
      resumeMicAfterSpeech();
    }
  };

  const sendToDoctor = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || !patient?.id) return false;
    const sent = await store.sendPatientMessage(patient.id, trimmed);
    if (sent) {
      setMessages(store.messages.filter((msg) => msg.patientId === patient.id));
      return true;
    }
    return false;
  };

  const sendExchangeToNurse = async (question: string, reply: string) => {
    if (!patient?.id) return;
    await store.sendPatientMessage(patient.id, `[Patient → Baymax] ${question}`);
    await store.sendPatientMessage(patient.id, `[Baymax] ${reply}`);
    setMessages(store.messages.filter((msg) => msg.patientId === patient.id));
  };

  const askBaymax = async (question: string) => {
    if (!patient?.id) return;
    setBaymaxError(null);
    setBaymaxReply(null);
    const fetchReplyWithTimeout = async (timeoutMs: number) => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(`${API_BASE}/patients/${patient.id}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: question }),
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error(`BAYMAX_HTTP_${response.status}`);
        }
        const data = await response.json();
        return (data.reply ?? '').trim() || 'I am here. How can I help you further?';
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    try {
      let reply: string;
      try {
        reply = await fetchReplyWithTimeout(BAYMAX_CHAT_TIMEOUT_MS);
      } catch {
        reply = await fetchReplyWithTimeout(BAYMAX_CHAT_RETRY_TIMEOUT_MS);
      }
      setBaymaxReply(reply);
      await speak(reply);
      await sendExchangeToNurse(question, reply);
    } catch {
      setBaymaxError('Unable to reach Baymax right now.');
      await speak('I am having trouble connecting right now. Please try again.');
    }
  };

  const dispatchCapturedMessage = async () => {
    if (dispatchingCaptureRef.current) return;
    if (modeRef.current !== 'CAPTURING') return;
    dispatchingCaptureRef.current = true;
    try {
      const payload = capturedRef.current;
      const normalizedPayload = payload.trim();
      const shouldSendToNurse = sendToNurseRef.current || awaitingNurseMessageRef.current;
      sendToNurseRef.current = false;
      awaitingNurseMessageRef.current = false;
      resetCapture();
      if (!normalizedPayload) {
        setError('I heard baymax, but did not catch a request. Try again.');
        return;
      }
      if (shouldSendToNurse) {
        const sent = await sendToDoctor(normalizedPayload);
        if (!sent) {
          setError('Unable to send your message. Try again.');
          return;
        }
        shouldRunRef.current = micEnabledRef.current;
        try {
          recognitionRef.current?.start?.();
        } catch {}
        return;
      }
      await askBaymax(normalizedPayload);
    } finally {
      dispatchingCaptureRef.current = false;
    }
  };

  const scheduleSend = () => {
    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => {
      void dispatchCapturedMessage();
    }, SILENCE_MS);
  };

  const assignedBed = useMemo(() => {
    if (!patientRecord?.bedId) return null;
    return beds.find((bed) => bed.id === patientRecord.bedId) ?? null;
  }, [beds, patientRecord?.bedId]);

  const assignedRoom = useMemo(() => {
    const roomId = patientRecord?.roomId ?? assignedBed?.roomId;
    if (!roomId) return null;
    return rooms.find((room) => room.id === roomId) ?? null;
  }, [assignedBed?.roomId, patientRecord?.roomId, rooms]);

  const isBaymaxSpeaking = mode !== 'WAITING' || Boolean(baymaxReply);

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
        const loweredCombined = combined.toLowerCase();
        const idxCombined = loweredCombined.lastIndexOf(WAKE_WORD);
        if (idxCombined < 0) return;
        if (wakeIndexRef.current !== null && idxCombined <= wakeIndexRef.current) return;
        wakeIndexRef.current = idxCombined;
        const afterWake = combined.slice(idxCombined + WAKE_WORD.length).trim();
        setLiveTranscript(afterWake);
        const loweredAfter = afterWake.toLowerCase();
        const normalizedAfter = loweredAfter.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
        const nurseCommand =
          normalizedAfter.includes('send a message to the nurse') ||
          normalizedAfter.includes('send a message to my nurse') ||
          normalizedAfter.includes('send a message to nurse') ||
          normalizedAfter.includes('message the nurse') ||
          normalizedAfter.includes('message my nurse') ||
          normalizedAfter.includes('tell the nurse') ||
          normalizedAfter.includes('tell my nurse') ||
          /send.*(message|note).*(nurse)/i.test(normalizedAfter) ||
          /(message|tell|send).*nurse/i.test(normalizedAfter);
        if (nurseCommand) {
          sendToNurseRef.current = true;
          awaitingNurseMessageRef.current = true;
          setCaptured('');
          capturedRef.current = '';
          wakeIndexRef.current = 0;
          setMode('CAPTURING');
          modeRef.current = 'CAPTURING';
          speak('What do you want to send?');
          return;
        }
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
        const latestResult = event.results[event.results.length - 1];
        const message = latestChunk.trim();
        setLiveTranscript(combined);
        if (message) {
          setCaptured(message);
          capturedRef.current = message;
        }
        if (latestResult?.isFinal) {
          clearSilenceTimer();
          void dispatchCapturedMessage();
          return;
        }
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

    recognition.onstart = () => {
      setMicState('listening');
    };

    recognition.onend = () => {
      setMicState('idle');
      if (!shouldRunRef.current || !micEnabledRef.current) return;
      try {
        recognition.start();
      } catch {
        return;
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

  useEffect(() => {
    const watchdog = window.setInterval(() => {
      if (!micEnabled || !shouldRunRef.current) return;
      if (!recognitionRef.current) return;
      if (micState === 'listening') return;
      try {
        recognitionRef.current.start();
      } catch {
        return;
      }
    }, 4000);
    return () => window.clearInterval(watchdog);
  }, [micEnabled, micState]);

  const handleEnableMic = async () => {
    setError(null);
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }
      setMicEnabled(true);
      micEnabledRef.current = true;
      shouldRunRef.current = true;
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

  const handleDisableMic = () => {
    shouldRunRef.current = false;
    setMicEnabled(false);
    micEnabledRef.current = false;
    try {
      recognitionRef.current?.stop?.();
    } catch {}
    setMicState('idle');
  };

  const handleToggleMic = () => {
    if (micEnabled) {
      handleDisableMic();
      return;
    }
    void handleEnableMic();
  };

  const handleReset = () => {
    resetCapture();
    setError(null);
  };

  const chatMessages = useMemo(() => {
    if (!patient?.id) return [];
    return messages
      .filter((msg) => msg.patientId === patient.id)
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  }, [messages, patient?.id]);

  const formatChatBody = (body: string) => {
    const trimmed = body.trim();
    const withoutBracketPrefix = trimmed.replace(/^\[[^\]]+\]\s*/u, '');
    return withoutBracketPrefix.replace(/^Patient\s*→\s*Baymax\s*/iu, '');
  };

  const getChatSpeaker = (msg: { sender: string; body: string }) => {
    if (msg.sender === 'NURSE') return 'Nurse';
    const trimmed = msg.body.trim();
    if (/^\[Baymax\]/iu.test(trimmed)) return 'Baymax';
    if (/^\[Patient\s*→\s*Baymax\]/iu.test(trimmed)) return 'You';
    return 'You';
  };

  const vitals = [
    { label: 'Heart Rate', value: '84', unit: 'bpm', note: 'Stable' },
    { label: 'Blood Pressure', value: '124/78', unit: 'mmHg', note: 'Stable' },
    { label: 'Oxygen', value: '97', unit: '%', note: 'Stable' },
    { label: 'Respiration', value: '18', unit: 'rpm', note: 'Stable' }
  ];

  const journey = [
    { label: 'Triage', time: '08:45' },
    { label: 'Diagnostics', time: '09:20' },
    { label: 'Provider review', time: '10:05' },
    { label: 'Treatment plan', time: '10:40' },
    { label: 'Discharge prep', time: 'Pending' }
  ];
  const currentStepIndex = 3;

  if (!patient) {
    return (
      <div className="creative-shell text-ink-950">
        <div className="creative-backdrop" aria-hidden />
        <div className="relative z-10 min-h-screen px-6 py-12">
          <div className="mx-auto max-w-xl rounded-[32px] border border-white/70 bg-white/80 p-8 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-ink-400">
              Patient Portal
            </p>
            <h1 className="mt-4 text-3xl font-semibold text-ink-900">Please sign in</h1>
            <p className="mt-3 text-sm text-ink-600">
              Sign in to view your messages and medical record.
            </p>
            <button
              onClick={() => navigate('/patient-login')}
              className="mt-6 rounded-full bg-ink-950 px-5 py-3 text-sm font-semibold text-white"
            >
              Go to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="creative-shell text-ink-950">
      <div className="creative-backdrop" aria-hidden />
      <div className="relative z-10 min-h-screen px-6 py-10">
        <div className="mx-auto max-w-7xl">
          <section className="rounded-[32px] border border-white/70 bg-white/80 p-8 shadow-panel">
            
            <div className="grid lg:grid-cols-2" style={{ gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 3fr)' }}>
              {/* LEFT SIDE: Vitals & Journey */}
              <div className="space-y-8">
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="mt-3 text-4xl font-semibold text-ink-900">Hello {patient?.name ?? 'there'}</h2>
                    </div>

                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {vitals.map((vital) => (
                    <div key={vital.label} className="rounded-2xl border border-white/70 bg-white/80 p-4">
                      <div className="flex items-start justify-between">
                        <p className="text-base text-black">{vital.label}</p>
                      </div>
                      <div className="flex items-start justify-between">
                        <p className="mt-2 text-2xl font-semibold text-ink-900">
                          {vital.value}
                          <span className="ml-1 text-sm font-medium text-ink-400">{vital.unit}</span>
                        </p>
                        <p className="text-base text-emerald-600">{vital.note}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-white/70 bg-white/80 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-ink-900">Care Journey</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {journey.map((step, index) => {
                      const isActive = index === currentStepIndex;
                      const isComplete = index < currentStepIndex;
                      return (
                        <div
                          key={step.label}
                          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
                            isActive
                              ? 'border-ink-950 bg-ink-950 text-white'
                              : 'border-white/70 bg-white/80 text-ink-700'
                          }`}
                        >
                          <span className="font-semibold">{step.label}</span>
                          <span className="text-xs">
                            {isComplete ? 'Completed' : isActive ? 'In progress' : step.time}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/70 bg-white/80 p-5 flex flex-col">
                  <p className="text-lg font-semibold text-ink-900">Your Medical Record</p>
                  {recordLoading ? (
                    <p className="mt-3 text-sm text-ink-500">Loading record…</p>
                  ) : recordError ? (
                    <p className="mt-3 text-sm text-rose-600">{recordError}</p>
                  ) : medicalRecord ? (
                    <div className="mt-3 space-y-3 text-sm text-ink-700">
                      <div>
                        <p className="text-base font-semibold text-ink-600">Allergies</p>
                        <p className="mt-1">
                          {medicalRecord.allergies?.length ? medicalRecord.allergies.join(', ') : 'None listed'}
                        </p>
                      </div>
                      <div>
                        <p className="text-base font-semibold text-ink-600">Conditions</p>
                        <p className="mt-1">
                          {medicalRecord.conditions?.length ? medicalRecord.conditions.join(', ') : 'None listed'}
                        </p>
                      </div>
                      <div>
                        <p className="text-base font-semibold text-ink-600">Documents</p>
                        {Array.isArray(medicalRecord.documents) && medicalRecord.documents.length > 0 ? (
                          <div className="mt-2 space-y-2">
                            {medicalRecord.documents.map((doc: any, index: number) => (
                              <div
                                key={doc.id ?? `${doc.name ?? 'doc'}-${index}`}
                                className="flex rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-xs text-ink-600"
                              >
                                <span className="mr-3 text-ink-900 ">●</span>
                                <p className="text-sm font-semibold text-ink-900">
                                  {doc.title ?? doc.name ?? `Document ${index + 1}`}
                                </p>
                                
                                {doc.summary && <p className="mt-1 text-xs text-ink-600">{doc.summary}</p>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-sm text-ink-500">No documents available.</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-ink-500">No record available.</p>
                  )}
                </div>

                <button
                  onClick={() => {
                    clearPatientSession();
                    navigate('/patient-login');
                  }}
                  className="rounded-full bg-slate-200 px-6 py-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-300"
                >
                  Sign out
                </button>

              </div>


              {/* RIGHT SIDE: Care Assistant */}
              <div className="space-y-8 lg:border-l lg:border-white/20 lg:pl-12">
                <div>
                  <div className="flex flex-wrap items-start justify-end gap-4">
                    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-ink-700">
                      {assignedRoom ? `Room ${assignedRoom.roomNumber}` : 'Room not assigned'} · {assignedBed ? `Bed ${assignedBed.bedLabel}` : ''} · {patient.mrn}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Assistant Voice</label>
                  <select 
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                    className="rounded-lg border border-white/70 bg-white/50 px-2 py-1 text-xs text-ink-700 outline-none focus:border-ink-950"
                  >
                    {AVAILABLE_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div className="baymax-stage">
                  <div className="baymax-stage__header">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-ink-400">Baymax Live</p>
                      <p className="mt-2 text-sm text-ink-700">
                        {mode === 'WAITING'
                          ? 'Say “baymax” to ask a question.'
                          : 'Pause when finished and we will send it.'}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                        micEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-ink-500'
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          micEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-ink-400'
                        }`}
                      />
                      {micEnabled ? (mode === 'WAITING' ? 'Ready' : 'Listening') : ''}
                    </span>
                  </div>

                  <div className="baymax-stage__body">
                    <div
                      className={`baymax-avatar baymax-avatar--hero ${
                        isBaymaxSpeaking ? 'baymax-avatar--speaking' : ''
                      }`}
                      aria-hidden
                    >
                      <svg viewBox="0 0 120 160">
                        <defs>
                          <radialGradient id="baymaxHighlight" cx="50%" cy="35%" r="70%">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                            <stop offset="60%" stopColor="#f3f4f6" stopOpacity="0.95" />
                            <stop offset="100%" stopColor="#e5e7eb" stopOpacity="0.9" />
                          </radialGradient>
                        </defs>
                        <g className="baymax-avatar__body">
                          <rect x="26" y="40" width="68" height="94" rx="34" fill="url(#baymaxHighlight)" />
                          <ellipse cx="60" cy="36" rx="28" ry="26" fill="url(#baymaxHighlight)" />
                        </g>
                        <g className="baymax-avatar__face">
                          <circle cx="50" cy="30" r="4" fill="#111827" />
                          <circle cx="70" cy="30" r="4" fill="#111827" />
                          <line
                            className="baymax-avatar__mouth"
                            x1="54" y1="30" x2="66" y2="30"
                            stroke="#111827"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </g>
                        <ellipse cx="100" cy="205" rx="70" ry="12" fill="#cbd5f5" opacity="0.35" />
                      </svg>
                    </div>
                    <div className="baymax-stage__copy">
                      <p className="text-xs text-ink-400">
                        Heard: {liveTranscript ? `“${liveTranscript}”` : 'Listening…'}
                      </p>
                      <p className="mt-2 text-base font-semibold text-ink-900">
                        {captured ? `“${captured}”` : 'No message captured yet.'}
                      </p>
                      <button
                        onClick={handleReset}
                        className="mt-3 inline-flex rounded-full border border-white/70 bg-white/80 px-4 py-2 text-xs font-semibold text-ink-700"
                      >
                        Clear
                      </button>
                      {(baymaxError || error) && (
                        <p className="mt-3 text-xs text-rose-600">{baymaxError || error}</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleToggleMic}
                    className={`mic-toggle ${micEnabled ? 'mic-toggle--on' : ''}`}
                    aria-pressed={micEnabled}
                    type="button"
                  >
                    <span className="mic-toggle__track">
                      <span className="mic-toggle__thumb" />
                    </span>
                    <span className="mic-toggle__label">{micEnabled ? 'Mic On' : 'Mic Off'}</span>
                  </button>
                </div>

                <div className="rounded-2xl border border-white/70 bg-white/80 p-5">
                  <p className="text-sm font-semibold text-ink-900">Messages</p>
                  <div className="mt-4 space-y-3 chat-thread">
                    {chatMessages.length === 0 ? (
                      <p className="text-sm text-ink-500">No messages yet.</p>
                    ) : (
                      chatMessages.slice(0, 6).map((msg) => (
                        <div
                          key={msg.id}
                          className={`rounded-2xl border px-4 py-3 text-sm ${
                            getChatSpeaker(msg) === 'You'
                              ? 'border-white/70 bg-white/70 text-ink-700'
                              : 'border-emerald-100 bg-emerald-50/70 text-ink-700'
                          }`}
                        >
                          <p className="text-xs font-semibold text-ink-500">{getChatSpeaker(msg)}</p>
                          <p className="mt-2">{formatChatBody(msg.body)}</p>
                          <p className="mt-2 text-xs text-ink-400">
                            {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}


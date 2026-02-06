import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { patients } from '../data/mock';
import { realtimeBus } from '../services/realtime';
import { store } from '../services/store';
import type { Message } from '../types';

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function PatientPortalPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>(store.messages);
  const [activePatientId, setActivePatientId] = useState<string>(() => patients[0]?.id ?? '');
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const unsubscribeNew = realtimeBus.on('newMessage', () => setMessages([...store.messages]));
    const unsubscribeUpdate = realtimeBus.on('messageUpdated', () => setMessages([...store.messages]));
    return () => {
      unsubscribeNew();
      unsubscribeUpdate();
    };
  }, []);

  useEffect(() => {
    if (activePatientId) {
      store.markThreadReadByPatient(activePatientId);
      setMessages([...store.messages]);
    }
  }, [activePatientId]);

  const activePatient = patients.find((patient) => patient.id === activePatientId);

  const thread = useMemo(() => {
    return messages
      .filter((message) => message.patientId === activePatientId)
      .slice()
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  }, [messages, activePatientId]);

  const handleSend = () => {
    if (!activePatientId || !draft.trim()) return;
    store.sendPatientMessage(activePatientId, draft.trim());
    setDraft('');
    setMessages([...store.messages]);
  };

  return (
    <div className="min-h-screen bg-transparent px-6 py-10 text-ink-950">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              onClick={() => navigate('/')}
              className="mb-4 text-sm font-semibold text-ink-500 hover:text-ink-900"
            >
              &larr; Back to Login
            </button>
            <p className="text-xs uppercase tracking-[0.3em] text-ink-400">Patient Portal</p>
            <h1 className="text-3xl font-display font-semibold text-ink-950">Message Your Care Team</h1>
            <p className="mt-2 text-sm text-ink-500">
              Send updates, questions, or requests. For emergencies, use the call light or dial 911.
            </p>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-panel">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">
              Patient
            </label>
            <select
              value={activePatientId}
              onChange={(event) => setActivePatientId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-ink-200 bg-white/90 px-3 py-2 text-sm text-ink-900 focus:border-ink-400 focus:outline-none"
            >
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name ?? 'Patient'} • {patient.mrn}
                </option>
              ))}
            </select>
          </div>
        </header>

        <section className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-panel">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-ink-400">Conversation</p>
              <h2 className="text-xl font-display font-semibold text-ink-900">
                {activePatient?.name ?? 'Patient'}
              </h2>
            </div>
            <p className="text-xs text-ink-400">Last updated in real time</p>
          </div>

          <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-2 scrollbar-thin">
            {thread.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink-200 bg-white/80 p-5 text-sm text-ink-500">
                No messages yet. Share how you are feeling to start the conversation.
              </div>
            ) : (
              thread.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'PATIENT' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm shadow-panel ${
                      message.sender === 'PATIENT'
                        ? 'bg-ink-950 text-white'
                        : 'bg-white/90 text-ink-800'
                    }`}
                  >
                    <p>{message.body}</p>
                    <p
                      className={`mt-2 text-[11px] ${
                        message.sender === 'PATIENT' ? 'text-white/70' : 'text-ink-400'
                      }`}
                    >
                      {message.sender === 'PATIENT' ? 'You' : 'Care Team'} • {formatTime(message.sentAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 space-y-3 border-t border-ink-100 pt-4">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              placeholder="Type your message to the nurse team..."
              className="w-full rounded-2xl border border-ink-200 bg-white/90 px-4 py-3 text-sm text-ink-900 focus:border-ink-400 focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-ink-400">
                Messages are delivered to the nurse dashboard as notifications.
              </p>
              <button
                onClick={handleSend}
                className="rounded-full bg-ink-950 px-4 py-2 text-xs font-semibold text-white"
              >
                Send message
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

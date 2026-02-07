import { useEffect, useMemo, useState } from 'react';
import { fetchPatients, type PatientRecord } from '../services/patientApi';
import { realtimeBus } from '../services/realtime';
import { store } from '../services/store';

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function MessagesPage() {
  const [messages, setMessages] = useState(store.messages);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [activePatientId, setActivePatientId] = useState<string>('');
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
    let active = true;
    const loadPatients = async () => {
      const result = await fetchPatients();
      if (!active) return;
      setPatients(result);
      if (!activePatientId && result.length) {
        setActivePatientId(result[0].id);
      }
    };
    void loadPatients();
    return () => {
      active = false;
    };
  }, [activePatientId]);

  useEffect(() => {
    if (activePatientId) {
      void store.markThreadReadByNurse(activePatientId);
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

  const unreadCount = useMemo(
    () => messages.filter((message) => message.sender === 'PATIENT' && !message.readByNurse).length,
    [messages]
  );

  const patientsWithMeta = useMemo(() => {
    return patients.map((patient) => {
      const patientMessages = messages.filter((message) => message.patientId === patient.id);
      const lastMessage = patientMessages[0];
      const unread = patientMessages.filter(
        (message) => message.sender === 'PATIENT' && !message.readByNurse
      ).length;
      return { patient, lastMessage, unread };
    });
  }, [messages, patients]);

  const handleSend = async () => {
    if (!activePatientId || !draft.trim()) return;
    const sent = await store.sendNurseMessage(activePatientId, draft.trim());
    if (sent) {
      setDraft('');
      setMessages([...store.messages]);
    }
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-display font-semibold text-ink-900">Patient Messages</h2>
            <p className="text-sm text-ink-500">Keep two-way communication in one place.</p>
          </div>
          <div className="rounded-full bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-600">
            {unreadCount} unread patient message{unreadCount === 1 ? '' : 's'}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
          <h3 className="text-sm font-semibold text-ink-900">Active Patients</h3>
          <div className="mt-4 space-y-2">
            {patientsWithMeta.map(({ patient, lastMessage, unread }) => (
              <button
                key={patient.id}
                onClick={() => setActivePatientId(patient.id)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                  activePatientId === patient.id
                    ? 'border-ink-900 bg-ink-950 text-white'
                    : 'border-ink-100 bg-white/90 text-ink-800 hover:bg-ink-100/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{patient.name ?? 'Patient'}</p>
                    <p
                      className={`mt-1 text-xs ${
                        activePatientId === patient.id ? 'text-white/70' : 'text-ink-500'
                      }`}
                    >
                      {lastMessage?.body ?? 'No messages yet'}
                    </p>
                  </div>
                  {unread > 0 && (
                    <span
                      className={`ml-2 rounded-full px-2 py-1 text-xs font-semibold ${
                        activePatientId === patient.id
                          ? 'bg-white/20 text-white'
                          : 'bg-rose-500/10 text-rose-600'
                      }`}
                    >
                      {unread}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-ink-400">Conversation</p>
              <h3 className="text-lg font-display font-semibold text-ink-900">
                {activePatient?.name ?? 'Patient'}
              </h3>
            </div>
            <p className="text-xs text-ink-400">
              Room {activePatient?.bedId?.replace('bed-', '') ?? 'TBD'}
            </p>
          </div>

          <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-2 scrollbar-thin">
            {thread.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink-200 bg-white/80 p-4 text-sm text-ink-500">
                No messages yet. Send a quick update to start the thread.
              </div>
            ) : (
              thread.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'NURSE' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[72%] rounded-2xl px-4 py-3 text-sm shadow-panel ${
                      message.sender === 'NURSE'
                        ? 'bg-ink-950 text-white'
                        : 'bg-white/90 text-ink-800'
                    }`}
                  >
                    <p>{message.body}</p>
                    <p
                      className={`mt-2 text-[11px] ${
                        message.sender === 'NURSE' ? 'text-white/70' : 'text-ink-400'
                      }`}
                    >
                      {message.sender === 'NURSE' ? 'Nurse' : 'Patient'} • {formatTime(message.sentAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-ink-100 pt-4">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              placeholder="Send reassurance, next steps, or questions."
              className="w-full rounded-2xl border border-ink-200 bg-white/90 px-4 py-3 text-sm text-ink-900 focus:border-ink-400 focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-ink-400">Messages are logged for care-team continuity.</p>
              <button
                onClick={handleSend}
                className="rounded-full bg-ink-950 px-4 py-2 text-xs font-semibold text-white"
              >
                Send reply
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

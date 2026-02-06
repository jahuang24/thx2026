import { useEffect, useMemo, useState } from 'react';
import { AlertList } from '../components/AlertList';
import { RoomRow } from '../components/RoomRow';
import { StatCard } from '../components/StatCard';
import { alerts as seedAlerts, beds, patients, rooms } from '../data/mock';
import { realtimeBus } from '../services/realtime';
import { store } from '../services/store';

export function DoctorDashboard() {
  const [liveAlerts, setLiveAlerts] = useState(seedAlerts);
  const [messages, setMessages] = useState(store.messages);

  useEffect(() => {
    const unsubscribe = realtimeBus.on('newAlert', ({ alert }) => {
      setLiveAlerts((prev) => [alert as typeof prev[number], ...prev]);
    });
    const unsubscribeMessages = realtimeBus.on('newMessage', () => setMessages([...store.messages]));
    const unsubscribeMessagesUpdated = realtimeBus.on('messageUpdated', () =>
      setMessages([...store.messages])
    );
    return () => {
      unsubscribe();
      unsubscribeMessages();
      unsubscribeMessagesUpdated();
    };
  }, []);

  const stats = useMemo(() => {
    const readyRooms = rooms.filter((room) => room.status === 'READY').length;
    const cleaningRooms = rooms.filter((room) => room.status === 'CLEANING').length;
    const occupiedBeds = beds.filter((bed) => bed.occupied).length;
    const occupancyRate = Math.round((occupiedBeds / beds.length) * 100);
    const unreadMessages = messages.filter(
      (message) => message.sender === 'PATIENT' && !message.readByNurse
    ).length;

    return {
      occupancyRate,
      readyRooms,
      cleaningRooms,
      openAlerts: store.alerts.filter((alert) => alert.status === 'OPEN').length,
      unreadMessages
    };
  }, [messages]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Occupancy"
          value={`${stats.occupancyRate}%`}
          hint="Live bed utilization"
          accent="bg-slateBlue-600/10 text-slateBlue-700"
          icon={<span className="text-lg">▣</span>}
        />
        <StatCard
          label="Rooms Ready"
          value={`${stats.readyRooms}`}
          hint="Immediate placement"
          accent="bg-forest-500/10 text-forest-600"
          icon={<span className="text-lg">✓</span>}
        />
        <StatCard
          label="Rooms Cleaning"
          value={`${stats.cleaningRooms}`}
          hint="EVS in progress"
          accent="bg-teal-500/10 text-teal-700"
          icon={<span className="text-lg">✧</span>}
        />
        <StatCard
          label="Open Alerts"
          value={`${stats.openAlerts}`}
          hint="Operational safety" 
          accent="bg-rose-500/10 text-rose-600"
          icon={<span className="text-lg">!</span>}
        />
        <StatCard
          label="Patient Messages"
          value={`${stats.unreadMessages}`}
          hint="Unread requests"
          accent="bg-amber-500/10 text-amber-700"
          icon={<span className="text-lg">✉</span>}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2.3fr_1fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-semibold text-ink-900">Unit Rooms</h2>
            <button className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700">
              Filter
            </button>
          </div>
          <div className="space-y-3">
            {rooms.map((room) => (
              <RoomRow key={room.id} room={room} beds={beds} patients={patients} />
            ))}
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-semibold text-ink-900">Live Alerts</h2>
              <span className="text-xs text-ink-400">Updated in real-time</span>
            </div>
            <div className="mt-4 max-h-[360px] overflow-y-auto pr-2 scrollbar-thin">
              <AlertList alerts={liveAlerts} />
            </div>
          </section>
          <section className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-semibold text-ink-900">Patient Messages</h2>
              <span className="text-xs text-ink-400">Unread requests</span>
            </div>
            <div className="mt-4 space-y-3">
              {messages
                .filter((message) => message.sender === 'PATIENT')
                .slice(0, 4)
                .map((message) => {
                  const patient = patients.find((item) => item.id === message.patientId);
                  return (
                    <div
                      key={message.id}
                      className={`rounded-xl border p-3 ${
                        message.readByNurse
                          ? 'border-ink-100 bg-white/90'
                          : 'border-amber-200 bg-amber-50/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-ink-900">
                          {patient?.name ?? 'Patient'}
                        </p>
                        <span className="text-[11px] text-ink-400">
                          {new Date(message.sentAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-ink-600">{message.body}</p>
                    </div>
                  );
                })}
              {messages.filter((message) => message.sender === 'PATIENT').length === 0 && (
                <div className="rounded-xl border border-dashed border-ink-200 bg-white/80 p-3 text-xs text-ink-500">
                  No patient messages yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

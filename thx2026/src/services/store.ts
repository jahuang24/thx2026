import type { Alert, CVEvent, Message, Task } from '../types';
import {
  alerts as seedAlerts,
  cvEvents as seedCvEvents,
  messages as seedMessages,
  tasks as seedTasks
} from '../data/mock';
import { processCvEvent } from '../logic/cvProcessor';
import { realtimeBus } from './realtime';

const MESSAGE_STORAGE_KEY = 'thx.messages.v1';
const MESSAGE_CHANNEL_NAME = 'thx.messages.channel';

const loadStoredMessages = () => {
  if (typeof localStorage === 'undefined') return [...seedMessages];
  try {
    const raw = localStorage.getItem(MESSAGE_STORAGE_KEY);
    if (!raw) return [...seedMessages];
    const parsed = JSON.parse(raw) as Message[];
    return Array.isArray(parsed) ? parsed : [...seedMessages];
  } catch {
    return [...seedMessages];
  }
};

class Store {
  alerts: Alert[] = [...seedAlerts];
  cvEvents: CVEvent[] = [...seedCvEvents];
  tasks: Task[] = [...seedTasks];
  messages: Message[] = loadStoredMessages();
  private messageChannel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window === 'undefined') return;

    if ('BroadcastChannel' in window) {
      this.messageChannel = new BroadcastChannel(MESSAGE_CHANNEL_NAME);
      this.messageChannel.addEventListener('message', (event) => {
        const payload = event.data as { type?: string; messages?: Message[] } | null;
        if (payload?.type === 'messages' && Array.isArray(payload.messages)) {
          this.messages = payload.messages;
          realtimeBus.emit('messageUpdated', { source: 'broadcast' });
        }
      });
    }

    window.addEventListener('storage', (event) => {
      if (event.key !== MESSAGE_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as Message[];
        if (Array.isArray(parsed)) {
          this.messages = parsed;
          realtimeBus.emit('messageUpdated', { source: 'storage' });
        }
      } catch {
        return;
      }
    });
  }

  private syncMessages() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify(this.messages));
    }
    this.messageChannel?.postMessage({ type: 'messages', messages: this.messages });
  }

  ingestCvEvent(event: CVEvent) {
    this.cvEvents = [event, ...this.cvEvents].slice(0, 50);

    const result = processCvEvent(event, this.alerts, new Date().toISOString());
    if (result.alert) {
      this.alerts = [result.alert, ...this.alerts];
      realtimeBus.emit('newAlert', { alert: result.alert });
    }

    realtimeBus.emit('cvEventIngested', { event });
  }

  acknowledgeAlert(alertId: string, note: string, user: string) {
    this.alerts = this.alerts.map((alert) =>
      alert.id === alertId
        ? {
            ...alert,
            status: 'ACK',
            acknowledgedBy: user,
            notes: note || alert.notes
          }
        : alert
    );
    const updated = this.alerts.find((alert) => alert.id === alertId);
    if (updated) {
      realtimeBus.emit('alertUpdated', { alert: updated });
    }
  }

  resolveAlert(alertId: string) {
    this.alerts = this.alerts.map((alert) =>
      alert.id === alertId
        ? {
            ...alert,
            status: 'RESOLVED'
          }
        : alert
    );
    const updated = this.alerts.find((alert) => alert.id === alertId);
    if (updated) {
      realtimeBus.emit('alertUpdated', { alert: updated });
    }
  }

  updateTask(taskId: string, status: Task['status']) {
    this.tasks = this.tasks.map((task) => (task.id === taskId ? { ...task, status } : task));
    const updated = this.tasks.find((task) => task.id === taskId);
    if (updated) {
      realtimeBus.emit('taskUpdated', { task: updated });
    }
  }

  sendPatientMessage(patientId: string, body: string) {
    const message: Message = {
      id: `msg-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      patientId,
      sender: 'PATIENT',
      body,
      sentAt: new Date().toISOString(),
      readByNurse: false,
      readByPatient: true
    };
    this.messages = [message, ...this.messages];
    this.syncMessages();
    realtimeBus.emit('newMessage', { message });
    return message;
  }

  sendNurseMessage(patientId: string, body: string) {
    const message: Message = {
      id: `msg-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      patientId,
      sender: 'NURSE',
      body,
      sentAt: new Date().toISOString(),
      readByNurse: true,
      readByPatient: false
    };
    this.messages = [message, ...this.messages];
    this.syncMessages();
    realtimeBus.emit('newMessage', { message });
    return message;
  }

  markThreadReadByNurse(patientId: string) {
    let changed = false;
    this.messages = this.messages.map((message) => {
      if (message.patientId === patientId && message.sender === 'PATIENT' && !message.readByNurse) {
        changed = true;
        return { ...message, readByNurse: true };
      }
      return message;
    });
    if (changed) {
      this.syncMessages();
      realtimeBus.emit('messageUpdated', { patientId });
    }
  }

  markThreadReadByPatient(patientId: string) {
    let changed = false;
    this.messages = this.messages.map((message) => {
      if (message.patientId === patientId && message.sender === 'NURSE' && !message.readByPatient) {
        changed = true;
        return { ...message, readByPatient: true };
      }
      return message;
    });
    if (changed) {
      this.syncMessages();
      realtimeBus.emit('messageUpdated', { patientId });
    }
  }
}

export const store = new Store();

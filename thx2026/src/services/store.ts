import type { Alert, CVEvent, Message, Task } from '../types';
import {
  alerts as seedAlerts,
  cvEvents as seedCvEvents,
  tasks as seedTasks
} from '../data/mock';
import { processCvEvent } from '../logic/cvProcessor';
import { realtimeBus } from './realtime';

const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:5050';
const MESSAGES_ENDPOINT = `${API_BASE}/messages`;

const normalizeMessage = (input: any): Message => {
  const id = input?.id ?? input?._id ?? `msg-${Date.now()}`;
  return {
    id: String(id),
    patientId: String(input?.patientId ?? ''),
    sender: input?.sender === 'NURSE' ? 'NURSE' : 'PATIENT',
    body: String(input?.body ?? ''),
    sentAt: String(input?.sentAt ?? new Date().toISOString()),
    readByNurse: Boolean(input?.readByNurse),
    readByPatient: Boolean(input?.readByPatient)
  };
};

class Store {
  alerts: Alert[] = [...seedAlerts];
  cvEvents: CVEvent[] = [...seedCvEvents];
  tasks: Task[] = [...seedTasks];
  messages: Message[] = [];

  constructor() {
    if (typeof window === 'undefined') return;
    void this.refreshMessages();
    window.setInterval(() => {
      void this.refreshMessages();
    }, 5000);
  }

  async refreshMessages() {
    try {
      const response = await fetch(MESSAGES_ENDPOINT);
      if (!response.ok) return;
      const data = (await response.json()) as any[];
      this.messages = Array.isArray(data)
        ? data
            .map(normalizeMessage)
            .filter((message) => message.patientId && message.body)
            .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
        : [];
      realtimeBus.emit('messageUpdated', { source: 'api' });
    } catch {
      return;
    }
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

  async sendPatientMessage(patientId: string, body: string) {
    const payload = {
      patientId,
      sender: 'PATIENT',
      body,
      sentAt: new Date().toISOString(),
      readByNurse: false,
      readByPatient: true
    };

    try {
      const response = await fetch(MESSAGES_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) return null;
      const created = normalizeMessage(await response.json());
      this.messages = [created, ...this.messages.filter((msg) => msg.id !== created.id)];
      realtimeBus.emit('newMessage', { message: created });
      void this.refreshMessages();
      return created;
    } catch {
      return null;
    }
  }

  async sendNurseMessage(patientId: string, body: string) {
    const payload = {
      patientId,
      sender: 'NURSE',
      body,
      sentAt: new Date().toISOString(),
      readByNurse: true,
      readByPatient: false
    };

    try {
      const response = await fetch(MESSAGES_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) return null;
      const created = normalizeMessage(await response.json());
      this.messages = [created, ...this.messages.filter((msg) => msg.id !== created.id)];
      realtimeBus.emit('newMessage', { message: created });
      void this.refreshMessages();
      return created;
    } catch {
      return null;
    }
  }

  async markThreadReadByNurse(patientId: string) {
    const changed = this.messages.some(
      (message) => message.patientId === patientId && message.sender === 'PATIENT' && !message.readByNurse
    );
    if (changed) {
      this.messages = this.messages.map((message) =>
        message.patientId === patientId && message.sender === 'PATIENT'
          ? { ...message, readByNurse: true }
          : message
      );
      realtimeBus.emit('messageUpdated', { patientId });
    }
    try {
      await fetch(`${MESSAGES_ENDPOINT}/read/thread`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, reader: 'NURSE' })
      });
      void this.refreshMessages();
    } catch {
      return;
    }
  }

  async markThreadReadByPatient(patientId: string) {
    const changed = this.messages.some(
      (message) => message.patientId === patientId && message.sender === 'NURSE' && !message.readByPatient
    );
    if (changed) {
      this.messages = this.messages.map((message) =>
        message.patientId === patientId && message.sender === 'NURSE'
          ? { ...message, readByPatient: true }
          : message
      );
      realtimeBus.emit('messageUpdated', { patientId });
    }
    try {
      await fetch(`${MESSAGES_ENDPOINT}/read/thread`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, reader: 'PATIENT' })
      });
      void this.refreshMessages();
    } catch {
      return;
    }
  }
}

export const store = new Store();

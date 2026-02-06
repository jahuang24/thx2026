import type { Alert, CVEvent, Task } from '../types';
import { alerts as seedAlerts, cvEvents as seedCvEvents, tasks as seedTasks } from '../data/mock';
import { processCvEvent } from '../logic/cvProcessor';
import { realtimeBus } from './realtime';

class Store {
  alerts: Alert[] = [...seedAlerts];
  cvEvents: CVEvent[] = [...seedCvEvents];
  tasks: Task[] = [...seedTasks];

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
}

export const store = new Store();

import { useState } from 'react';
import { store } from '../services/store';

export function TasksPage() {
  const [tasks, setTasks] = useState(store.tasks);

  const handleUpdate = (taskId: string, status: 'OPEN' | 'IN_PROGRESS' | 'DONE') => {
    store.updateTask(taskId, status);
    setTasks([...store.tasks]);
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-panel">
        <h2 className="text-2xl font-display font-semibold text-ink-900">EVS & Maintenance Tasks</h2>
        <p className="text-sm text-ink-500">Track cleaning and maintenance readiness workflows.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {(['OPEN', 'IN_PROGRESS', 'DONE'] as const).map((status) => (
          <div key={status} className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
            <h3 className="text-sm font-semibold text-ink-900">{status.replace('_', ' ')}</h3>
            <div className="mt-4 space-y-3">
              {tasks
                .filter((task) => task.status === status)
                .map((task) => (
                  <div key={task.id} className="rounded-xl border border-ink-100 bg-white/90 p-3">
                    <p className="text-sm font-semibold text-ink-900">{task.type}</p>
                    <p className="text-xs text-ink-500">Task {task.id}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {status !== 'OPEN' && (
                        <button
                          onClick={() => handleUpdate(task.id, 'OPEN')}
                          className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700"
                        >
                          Move to open
                        </button>
                      )}
                      {status !== 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleUpdate(task.id, 'IN_PROGRESS')}
                          className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700"
                        >
                          In progress
                        </button>
                      )}
                      {status !== 'DONE' && (
                        <button
                          onClick={() => handleUpdate(task.id, 'DONE')}
                          className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700"
                        >
                          Done
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

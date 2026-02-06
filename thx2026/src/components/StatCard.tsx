import type { ReactNode } from 'react';

export function StatCard({
  label,
  value,
  hint,
  accent,
  icon
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ink-400">{label}</p>
          <p className="mt-2 text-2xl font-display font-semibold text-ink-900">{value}</p>
        </div>
        <div className={`rounded-full p-3 ${accent ?? 'bg-ink-100 text-ink-700'}`}>{icon}</div>
      </div>
      {hint ? <p className="mt-3 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

// Verifica lembretes vencidos enquanto o app está aberto. Sem servidor,
// não há como avisar com o app fechado (ver FEATURES: 'push').

import { dueReminders, markFired, rollForwardStale } from '../domain/reminders.js';
import { dueRoutines, markRoutineRun } from '../domain/routines.js';

export function startReminderScheduler(store, onDue, { intervalMs = 15_000, clock = () => new Date(), onRoutine } = {}) {
  store.update((d) => rollForwardStale(d, clock()));

  function tick() {
    const now = clock();
    const routines = onRoutine ? dueRoutines(store.getState(), now) : [];
    if (routines.length) {
      store.update((d) => routines.forEach((r) => markRoutineRun(d, r.id, now)));
      for (const r of routines) onRoutine(r);
    }
    const due = dueReminders(store.getState(), now);
    if (!due.length) return;
    store.update((d) => due.forEach((r) => markFired(d, r.id, now)));
    for (const r of due) onDue(r);
  }

  tick();
  const timer = setInterval(tick, intervalMs);
  const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

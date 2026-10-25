// Verifica lembretes vencidos enquanto o app está aberto. Sem servidor,
// não há como avisar com o app fechado (ver FEATURES: 'push').

import { dueReminders, markFired, rollForwardStale } from '../domain/reminders.js';

export function startReminderScheduler(store, onDue, { intervalMs = 15_000, clock = () => new Date() } = {}) {
  store.update((d) => rollForwardStale(d, clock()));

  function tick() {
    const now = clock();
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

import { uid } from '../core/ids.js';
import { audit, scoped } from '../data/schema.js';

export const REPEAT_OPTIONS = { none: 'Uma vez', daily: 'Todos os dias', weekly: 'Toda semana' };

export function listReminders(state) {
  return scoped(state, 'reminders').slice().sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function upcomingReminders(state, now = new Date(), limit = 5) {
  return listReminders(state).filter((r) => !r.done && new Date(r.dueAt) >= startOfDay(now)).slice(0, limit);
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function validateReminder({ title, dueAt }) {
  const errors = {};
  const clean = (title || '').trim();
  if (clean.length < 2) errors.title = 'Escreva o que deve ser lembrado.';
  if (clean.length > 120) errors.title = 'Use no máximo 120 caracteres.';
  if (!dueAt || Number.isNaN(new Date(dueAt).getTime())) errors.dueAt = 'Informe data e horário válidos.';
  return errors;
}

export function addReminder(draft, { title, dueAt, repeat = 'none', residentId = null }) {
  const errors = validateReminder({ title, dueAt });
  if (Object.keys(errors).length) return { ok: false, errors };
  const reminder = {
    id: uid('rem'),
    householdId: draft.session.householdId,
    residentId,
    title: title.trim(),
    dueAt: new Date(dueAt).toISOString(),
    repeat: REPEAT_OPTIONS[repeat] ? repeat : 'none',
    done: false,
    lastFiredAt: null,
    createdAt: new Date().toISOString(),
  };
  draft.reminders.push(reminder);
  audit(draft, 'reminder.create', { reminderId: reminder.id });
  return { ok: true, reminder };
}

function find(draft, id) {
  return draft.reminders.find((r) => r.id === id && r.householdId === draft.session.householdId);
}

export function setReminderDone(draft, id, done) {
  const r = find(draft, id);
  if (!r) return false;
  r.done = done;
  return true;
}

export function removeReminder(draft, id) {
  const before = draft.reminders.length;
  draft.reminders = draft.reminders.filter((r) => !(r.id === id && r.householdId === draft.session.householdId));
  return before !== draft.reminders.length;
}

export function nextOccurrence(iso, repeat) {
  const d = new Date(iso);
  if (repeat === 'daily') d.setDate(d.getDate() + 1);
  else if (repeat === 'weekly') d.setDate(d.getDate() + 7);
  else return null;
  return d.toISOString();
}

// Lembretes que venceram e ainda não foram avisados. Lembretes muito
// antigos (mais de 12 h) não disparam para evitar avisos acumulados
// quando o app fica dias fechado.
export function dueReminders(state, now = new Date()) {
  const limit = now.getTime() - 12 * 60 * 60 * 1000;
  return scoped(state, 'reminders').filter((r) => {
    if (r.done) return false;
    const t = new Date(r.dueAt).getTime();
    return t <= now.getTime() && t >= limit && r.lastFiredAt !== r.dueAt;
  });
}

// Marca como avisado. Repetitivos avançam para a próxima ocorrência futura.
export function markFired(draft, id, now = new Date()) {
  const r = find(draft, id);
  if (!r) return;
  r.lastFiredAt = r.dueAt;
  if (r.repeat !== 'none') {
    let next = nextOccurrence(r.dueAt, r.repeat);
    while (next && new Date(next) <= now) next = nextOccurrence(next, r.repeat);
    r.dueAt = next;
  }
}

// Ao abrir o app, lembretes repetitivos que ficaram no passado avançam,
// sem disparar aviso.
export function rollForwardStale(draft, now = new Date()) {
  const limit = now.getTime() - 12 * 60 * 60 * 1000;
  for (const r of draft.reminders) {
    if (r.repeat === 'none' || r.done) continue;
    while (new Date(r.dueAt).getTime() < limit) r.dueAt = nextOccurrence(r.dueAt, r.repeat);
  }
}

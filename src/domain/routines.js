// Rotinas: momentos em que a assistente pode puxar conversa sozinha.
// Só disparam se a pessoa criou e ativou a rotina (autorização explícita),
// no horário e nos dias escolhidos.

import { uid } from '../core/ids.js';
import { audit, scoped } from '../data/schema.js';
import { formatDateLong, formatTime, listToText } from '../core/format.js';
import { getResident, displayName } from './residents.js';
import { listReminders } from './reminders.js';
import { pendingShopping } from './shopping.js';

export const ROUTINE_TYPES = {
  'bom-dia': { label: 'Bom dia', description: 'Cumprimenta e conta os lembretes do dia e a lista de compras.', defaultTime: '08:00' },
  'boa-noite': { label: 'Boa noite', description: 'Deseja boa noite e adianta os lembretes de amanhã.', defaultTime: '21:00' },
  mensagem: { label: 'Mensagem personalizada', description: 'Fala uma mensagem escrita por você.', defaultTime: '15:00' },
};

export const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WINDOW_MS = 2 * 60 * 60 * 1000; // depois de 2 h, a rotina do dia é pulada

const lcFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);

export function listRoutines(state) {
  return scoped(state, 'routines').slice().sort((a, b) => a.time.localeCompare(b.time));
}

export function validateRoutine({ type, time, days, message }) {
  const errors = {};
  if (!ROUTINE_TYPES[type]) errors.type = 'Escolha o tipo de rotina.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) errors.time = 'Informe um horário válido.';
  if (!Array.isArray(days) || !days.length) errors.days = 'Escolha pelo menos um dia.';
  if (type === 'mensagem') {
    const clean = (message || '').trim();
    if (clean.length < 3) errors.message = 'Escreva a mensagem que a assistente vai falar.';
    if (clean.length > 200) errors.message = 'Use no máximo 200 caracteres.';
  }
  return errors;
}

export function addRoutine(draft, data) {
  const errors = validateRoutine(data);
  if (Object.keys(errors).length) return { ok: false, errors };
  const routine = {
    id: uid('rot'),
    householdId: draft.session.householdId,
    residentId: data.residentId || null,
    type: data.type,
    time: data.time,
    days: [...new Set(data.days.map(Number))].filter((d) => ALL_DAYS.includes(d)).sort(),
    message: data.type === 'mensagem' ? data.message.trim() : '',
    enabled: data.enabled !== false,
    lastRunDate: null,
    createdAt: new Date().toISOString(),
  };
  draft.routines.push(routine);
  audit(draft, 'routine.create', { routineId: routine.id, type: routine.type });
  return { ok: true, routine };
}

function find(draft, id) {
  return draft.routines.find((r) => r.id === id && r.householdId === draft.session.householdId);
}

export function setRoutineEnabled(draft, id, enabled) {
  const r = find(draft, id);
  if (!r) return false;
  r.enabled = enabled;
  audit(draft, enabled ? 'routine.enable' : 'routine.disable', { routineId: id });
  return true;
}

export function removeRoutine(draft, id) {
  const before = draft.routines.length;
  draft.routines = draft.routines.filter((r) => !(r.id === id && r.householdId === draft.session.householdId));
  return before !== draft.routines.length;
}

export function localDateKey(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function scheduledAt(routine, now) {
  const [h, m] = routine.time.split(':').map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d;
}

// Rotinas ativas cujo horário de hoje já chegou (até 2 h atrás) e que
// ainda não rodaram hoje.
export function dueRoutines(state, now = new Date()) {
  const today = localDateKey(now);
  return scoped(state, 'routines').filter((r) => {
    if (!r.enabled || r.lastRunDate === today || !r.days.includes(now.getDay())) return false;
    const diff = now.getTime() - scheduledAt(r, now).getTime();
    return diff >= 0 && diff <= WINDOW_MS;
  });
}

// Marca como executada hoje (também usada para pular rotinas perdidas).
export function markRoutineRun(draft, id, now = new Date()) {
  const r = find(draft, id);
  if (r) r.lastRunDate = localDateKey(now);
}

function remindersOn(state, day, residentId) {
  const key = localDateKey(day);
  return listReminders(state).filter((r) => !r.done && localDateKey(new Date(r.dueAt)) === key && (!residentId || !r.residentId || r.residentId === residentId));
}

export function buildRoutineMessage(state, routine, now = new Date()) {
  const person = getResident(state, routine.residentId);
  const name = person ? `, ${displayName(person)}` : '';
  if (routine.type === 'mensagem') return `${person ? displayName(person) + ', ' : ''}${routine.message}`;

  if (routine.type === 'bom-dia') {
    const today = remindersOn(state, now, routine.residentId).filter((r) => new Date(r.dueAt) >= now);
    const items = pendingShopping(state).length;
    const parts = [`Bom dia${name}! Hoje é ${formatDateLong(now)}.`];
    if (today.length) parts.push(`Você tem ${today.length === 1 ? 'um lembrete' : `${today.length} lembretes`} hoje: ${listToText(today.map((r) => `${lcFirst(r.title)} às ${formatTime(r.dueAt)}`))}.`);
    else parts.push('Você não tem lembretes para hoje.');
    if (items) parts.push(`A lista de compras tem ${items === 1 ? 'um item' : `${items} itens`}.`);
    return parts.join(' ');
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const next = remindersOn(state, tomorrow, routine.residentId);
  const parts = [`Boa noite${name}!`];
  if (next.length) parts.push(`Amanhã você tem ${next.length === 1 ? 'um lembrete' : `${next.length} lembretes`}: ${listToText(next.map((r) => `${lcFirst(r.title)} às ${formatTime(r.dueAt)}`))}.`);
  else parts.push('Amanhã você não tem lembretes marcados.');
  parts.push('Durma bem.');
  return parts.join(' ');
}

export function describeDays(days) {
  if (days.length === 7) return 'Todos os dias';
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return 'Dias úteis';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Fins de semana';
  return days.map((d) => WEEKDAY_LABELS[d]).join(', ');
}

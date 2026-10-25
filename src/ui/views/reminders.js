// Lembretes: lista, criação e aviso quando vencem (com o app aberto).

import { h, icon } from '../../core/dom.js';
import { openModal, confirmDialog } from '../components/overlay.js';
import { button, emptyState, field, notice, setFieldErrors, statusTag, viewHeader } from '../components/common.js';
import { REPEAT_OPTIONS, addReminder, listReminders, removeReminder, setReminderDone } from '../../domain/reminders.js';
import { listResidents, getResident, displayName } from '../../domain/residents.js';
import { formatWhen, toLocalInputValue } from '../../core/format.js';

function groupReminders(list, now) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const groups = { atrasados: [], hoje: [], proximos: [], concluidos: [] };
  for (const r of list) {
    const due = new Date(r.dueAt);
    if (r.done) groups.concluidos.push(r);
    else if (due < now && r.repeat === 'none') groups.atrasados.push(r);
    else if (due <= end) groups.hoje.push(r);
    else groups.proximos.push(r);
  }
  return groups;
}

const GROUP_TITLES = { atrasados: 'Passaram do horário', hoje: 'Hoje', proximos: 'Próximos', concluidos: 'Concluídos' };

function reminderItem(ctx, r, state, now) {
  const who = getResident(state, r.residentId);
  const id = `rem-done-${r.id}`;
  return h('li', { class: `reminder${r.done ? ' is-done' : ''}` },
    h('label', { class: 'reminder-check', for: id },
      h('input', { type: 'checkbox', id, checked: r.done, onchange: (e) => ctx.store.update((d) => setReminderDone(d, r.id, e.target.checked)) }),
      h('span', { class: 'reminder-box', 'aria-hidden': 'true' }, icon('check', { size: 20 })),
      h('span', { class: 'sr-only' }, r.done ? 'Marcar como pendente' : 'Marcar como concluído')),
    h('div', { class: 'reminder-text' },
      h('p', { class: 'reminder-title' }, r.title),
      h('p', { class: 'reminder-meta' }, [formatWhen(r.dueAt, now), r.repeat !== 'none' ? REPEAT_OPTIONS[r.repeat].toLowerCase() : null, who ? `para ${displayName(who)}` : null].filter(Boolean).join(' · '))),
    h('button', {
      type: 'button', class: 'icon-btn', 'aria-label': `Excluir lembrete ${r.title}`,
      onclick: async () => {
        if (await confirmDialog({ title: 'Excluir lembrete?', message: `"${r.title}" será apagado.`, confirmLabel: 'Excluir', danger: true })) {
          ctx.store.update((d) => removeReminder(d, r.id));
        }
      },
    }, icon('trash')));
}

export function render(ctx) {
  const state = ctx.store.getState();
  const now = new Date();
  const groups = groupReminders(listReminders(state), now);
  const total = Object.values(groups).reduce((n, g) => n + g.length, 0);
  return h('div', { class: 'page' },
    viewHeader('Lembretes', {
      subtitle: 'Também dá para criar falando: "me lembre de tomar água às 15h".',
      tag: statusTag('real'),
      actions: [
        button('Rotinas', { variant: 'ghost', iconName: 'sun', onClick: () => ctx.navigate('rotinas') }),
        button('Novo lembrete', { variant: 'primary', iconName: 'plus', onClick: () => openReminderForm(ctx) }),
      ],
    }),
    notice('Os avisos aparecem na tela e por voz somente enquanto o AI Care estiver aberto. Avisos com o app fechado dependem de um servidor de notificações (planejado).', { kind: 'info' }),
    total
      ? Object.entries(groups).filter(([, list]) => list.length).map(([key, list]) => h('section', { class: 'panel' },
        h('h2', { class: 'panel-title' }, GROUP_TITLES[key], h('span', { class: 'count' }, String(list.length))),
        h('ul', { class: 'reminder-list' }, list.map((r) => reminderItem(ctx, r, state, now)))))
      : emptyState('Nenhum lembrete ainda.', 'Toque em "Novo lembrete" ou peça para a assistente.'));
}

export function openReminderForm(ctx) {
  const state = ctx.store.getState();
  const start = new Date(Date.now() + 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  const people = listResidents(state);
  const form = h('form', { class: 'form', novalidate: true },
    field('O que lembrar', h('input', { id: 'rm-title', name: 'title', class: 'input', maxlength: 120, autofocus: true, placeholder: 'Ex.: Tomar um copo de água' })),
    h('div', { class: 'form-grid' },
      field('Data e horário', h('input', { id: 'rm-due', name: 'dueAt', type: 'datetime-local', class: 'input', value: toLocalInputValue(start) })),
      field('Repetir', h('select', { id: 'rm-repeat', name: 'repeat', class: 'input' }, Object.entries(REPEAT_OPTIONS).map(([k, v]) => h('option', { value: k }, v)))),
      field('Para quem', h('select', { id: 'rm-who', name: 'residentId', class: 'input' },
        h('option', { value: '' }, 'Toda a casa'),
        people.map((p) => h('option', { value: p.id, selected: p.id === state.session.activeResidentId }, displayName(p)))))));
  const { close } = openModal({
    title: 'Novo lembrete',
    body: form,
    actions: [button('Cancelar', { onClick: () => close() }), button('Criar lembrete', { variant: 'primary', onClick: () => form.requestSubmit() })],
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const result = ctx.store.update((d) => addReminder(d, {
      title: fd.get('title') || '',
      dueAt: fd.get('dueAt') ? new Date(fd.get('dueAt')).toISOString() : '',
      repeat: fd.get('repeat'),
      residentId: fd.get('residentId') || null,
    }));
    if (!result.ok) { setFieldErrors(form, result.errors); return; }
    close();
    ctx.toast('Lembrete criado.', { kind: 'ok' });
  });
}

// Aviso de lembrete vencido: cartão grande + fala.
export function showReminderAlert(ctx, reminder) {
  const who = getResident(ctx.store.getState(), reminder.residentId);
  const spoken = `${who ? displayName(who) + ', ' : ''}lembrete: ${reminder.title}.`;
  const { close } = openModal({
    title: 'Lembrete',
    size: 'md',
    className: 'modal-reminder',
    body: h('div', { class: 'reminder-alert' },
      icon('bell', { size: 48 }),
      h('p', { class: 'reminder-alert-title' }, reminder.title),
      who ? h('p', { class: 'reminder-alert-who' }, `Para ${displayName(who)}`) : null),
    actions: [
      button('Lembrar em 10 minutos', {
        onClick: () => {
          ctx.store.update((d) => addReminder(d, { title: reminder.title, dueAt: new Date(Date.now() + 10 * 60_000).toISOString(), residentId: reminder.residentId }));
          close();
        },
      }),
      button('Feito', {
        variant: 'primary', iconName: 'check',
        onClick: () => {
          if (reminder.repeat === 'none') ctx.store.update((d) => setReminderDone(d, reminder.id, true));
          close();
        },
      }),
    ],
  });
  ctx.say(spoken);
}

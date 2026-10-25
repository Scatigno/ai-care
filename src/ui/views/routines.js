// Rotinas: horários em que a assistente pode puxar conversa.

import { h, icon } from '../../core/dom.js';
import { openModal, confirmDialog } from '../components/overlay.js';
import { button, emptyState, field, notice, setFieldErrors, statusTag, toggle, viewHeader } from '../components/common.js';
import {
  ROUTINE_TYPES, WEEKDAY_LABELS, addRoutine, buildRoutineMessage, describeDays, listRoutines, removeRoutine, setRoutineEnabled,
} from '../../domain/routines.js';
import { listResidents, getResident, displayName } from '../../domain/residents.js';

export function render(ctx) {
  const state = ctx.store.getState();
  const routines = listRoutines(state);
  return h('div', { class: 'page page-narrow' },
    viewHeader('Rotinas', {
      subtitle: 'Momentos em que a assistente fala sem você chamar.',
      tag: statusTag('real'),
      actions: [button('Nova rotina', { variant: 'primary', iconName: 'plus', onClick: () => openRoutineForm(ctx) })],
    }),
    notice('A assistente só puxa conversa nas rotinas que estiverem ativadas aqui, e só com o AI Care aberto na tela. Para deixar o iPad como central, ative "Manter a tela ligada" em Configurações.', { kind: 'info' }),
    routines.length
      ? h('ul', { class: 'routine-list' }, routines.map((r) => {
        const who = getResident(state, r.residentId);
        return h('li', { class: `panel routine${r.enabled ? '' : ' is-off'}` },
          h('div', { class: 'routine-head' },
            h('span', { class: 'routine-time' }, r.time),
            h('div', { class: 'routine-text' },
              h('h2', { class: 'routine-title' }, ROUTINE_TYPES[r.type]?.label || r.type),
              h('p', { class: 'routine-meta' }, [describeDays(r.days), who ? `para ${displayName(who)}` : 'para a casa'].join(' · '))),
            toggle(`rt-on-${r.id}`, r.enabled ? 'Ativa' : 'Desligada', r.enabled, (v) => ctx.store.update((d) => setRoutineEnabled(d, r.id, v)))),
          h('p', { class: 'routine-preview' }, `"${buildRoutineMessage(state, r)}"`),
          h('div', { class: 'button-row' },
            button('Ouvir agora', { variant: 'ghost', size: 'sm', iconName: 'speaker', onClick: () => showRoutine(ctx, r) }),
            button('Excluir', {
              variant: 'danger-ghost', size: 'sm', iconName: 'trash',
              onClick: async () => {
                if (await confirmDialog({ title: 'Excluir rotina?', message: `A rotina "${ROUTINE_TYPES[r.type]?.label}" das ${r.time} será apagada.`, confirmLabel: 'Excluir', danger: true })) ctx.store.update((d) => removeRoutine(d, r.id));
              },
            })));
      }))
      : emptyState('Nenhuma rotina.', 'Crie uma rotina de bom dia para ouvir os lembretes do dia.'));
}

function openRoutineForm(ctx) {
  const state = ctx.store.getState();
  const typeSelect = h('select', { id: 'rt-type', name: 'type', class: 'input' },
    Object.entries(ROUTINE_TYPES).map(([k, t]) => h('option', { value: k }, t.label)));
  const timeInput = h('input', { id: 'rt-time', name: 'time', type: 'time', class: 'input', value: ROUTINE_TYPES['bom-dia'].defaultTime });
  const messageField = field('Mensagem', h('textarea', { id: 'rt-msg', name: 'message', class: 'input', rows: 2, maxlength: 200, placeholder: 'Ex.: Que tal beber um copo de água agora?' }));
  messageField.hidden = true;
  const description = h('p', { class: 'fine' }, ROUTINE_TYPES['bom-dia'].description);
  typeSelect.addEventListener('change', () => {
    const t = ROUTINE_TYPES[typeSelect.value];
    timeInput.value = t.defaultTime;
    description.textContent = t.description;
    messageField.hidden = typeSelect.value !== 'mensagem';
  });
  const days = h('fieldset', { class: 'fieldset' }, h('legend', {}, 'Dias'),
    h('div', { class: 'day-picker' }, WEEKDAY_LABELS.map((label, i) => h('label', { class: 'day', for: `rt-day-${i}` },
      h('input', { type: 'checkbox', id: `rt-day-${i}`, name: 'days', value: String(i), checked: true }), h('span', {}, label)))),
    h('p', { class: 'field-error', 'data-for': 'days' }));
  const form = h('form', { class: 'form', novalidate: true },
    h('div', { class: 'form-grid' },
      field('Tipo', typeSelect),
      field('Horário', timeInput),
      field('Para quem', h('select', { id: 'rt-who', name: 'residentId', class: 'input' },
        h('option', { value: '' }, 'Toda a casa'),
        listResidents(state).map((p) => h('option', { value: p.id, selected: p.id === state.session.activeResidentId }, displayName(p)))))),
    description,
    messageField,
    days,
    h('label', { class: 'check', for: 'rt-consent' }, h('input', { type: 'checkbox', id: 'rt-consent', name: 'consent' }),
      h('span', {}, 'Autorizo a assistente a falar sozinha neste horário.')),
    h('p', { class: 'field-error form-error', 'aria-live': 'polite' }));

  const { close } = openModal({
    title: 'Nova rotina',
    body: form,
    actions: [button('Cancelar', { onClick: () => close() }), button('Criar rotina', { variant: 'primary', onClick: () => form.requestSubmit() })],
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    if (!fd.get('consent')) { form.querySelector('.form-error').textContent = 'Marque a autorização para criar a rotina.'; return; }
    const result = ctx.store.update((d) => addRoutine(d, {
      type: fd.get('type'), time: fd.get('time'), days: fd.getAll('days'), message: fd.get('message') || '', residentId: fd.get('residentId') || null,
    }));
    if (!result.ok) {
      const dayErr = form.querySelector('[data-for="days"]');
      dayErr.textContent = result.errors.days || '';
      setFieldErrors(form, result.errors);
      return;
    }
    close();
    ctx.toast('Rotina criada e ativada.', { kind: 'ok' });
  });
}

// Exibe e fala a mensagem da rotina.
export function showRoutine(ctx, routine) {
  const text = buildRoutineMessage(ctx.store.getState(), routine);
  const { close } = openModal({
    title: ROUTINE_TYPES[routine.type]?.label || 'Rotina',
    size: 'md',
    className: 'modal-reminder',
    body: h('div', { class: 'reminder-alert' }, icon('sun', { size: 48 }), h('p', { class: 'routine-spoken' }, text)),
    actions: [button('Ouvir de novo', { iconName: 'speaker', onClick: () => ctx.say(text) }), button('Obrigado', { variant: 'primary', onClick: () => close() })],
    onClose: () => ctx.speech.stopSpeaking(),
  });
  ctx.say(text);
}

// Memória individual: cada pessoa consulta, corrige e exclui o que a
// assistente sabe sobre ela.

import { h, icon } from '../../core/dom.js';
import { openModal, confirmDialog } from '../components/overlay.js';
import { button, emptyState, field, notice, statusTag, viewHeader } from '../components/common.js';
import { MEMORY_CATEGORIES, addMemory, memoriesFor, removeMemory, updateMemory } from '../../domain/memory.js';
import { listResidents, getResident, displayName, initials } from '../../domain/residents.js';
import { formatDateTime } from '../../core/format.js';

let selectedId = null;

export function render(ctx, params = {}) {
  const state = ctx.store.getState();
  if (params.residentId) selectedId = params.residentId;
  if (!getResident(state, selectedId)) selectedId = state.session.activeResidentId || listResidents(state)[0]?.id || null;
  const person = getResident(state, selectedId);
  const people = listResidents(state);

  const header = viewHeader('Memórias', {
    subtitle: 'O que a assistente lembra sobre cada pessoa. Tudo pode ser corrigido ou apagado.',
    tag: statusTag('real'),
    actions: person ? [button('Nova memória', { variant: 'primary', iconName: 'plus', onClick: () => openMemoryForm(ctx, person.id) })] : [],
  });

  if (!people.length) return h('div', { class: 'page' }, header, emptyState('Cadastre um morador para começar.'));

  const tabs = h('div', { class: 'person-tabs', role: 'tablist', 'aria-label': 'Pessoa' }, people.map((p) =>
    h('button', {
      type: 'button', role: 'tab', class: `person-tab${p.id === selectedId ? ' is-active' : ''}`, 'aria-selected': String(p.id === selectedId),
      onclick: () => { selectedId = p.id; ctx.navigate('memorias', { focus: false }); },
    }, h('span', { class: `mini-avatar av-${p.color}` }, initials(p.name)), displayName(p))));

  const items = memoriesFor(state, person.id);
  const groups = Object.entries(MEMORY_CATEGORIES).map(([key, label]) => [key, label, items.filter((m) => m.category === key)]).filter(([, , list]) => list.length);

  return h('div', { class: 'page' },
    header,
    tabs,
    notice('Conversas completas não são guardadas. Só fica salvo o que a pessoa pede ("lembre que…") ou o que é cadastrado aqui. A assistente não analisa emoções.', { kind: 'info' }),
    groups.length
      ? h('div', { class: 'memory-groups' }, groups.map(([key, label, list]) => h('section', { class: 'panel' },
        h('h2', { class: 'panel-title' }, label, h('span', { class: 'count' }, String(list.length))),
        h('ul', { class: 'memory-list' }, list.map((m) => h('li', { class: 'memory' },
          h('div', { class: 'memory-text' },
            h('p', {}, m.text),
            h('small', {}, `${m.source === 'conversa' ? 'Pedido na conversa' : 'Cadastrado manualmente'} · ${formatDateTime(m.updatedAt)}`)),
          h('div', { class: 'memory-actions' },
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Corrigir memória', onclick: () => openMemoryForm(ctx, person.id, m) }, icon('edit')),
            h('button', {
              type: 'button', class: 'icon-btn', 'aria-label': 'Apagar memória',
              onclick: async () => {
                if (await confirmDialog({ title: 'Apagar memória?', message: `"${m.text}"`, confirmLabel: 'Apagar', danger: true })) ctx.store.update((d) => removeMemory(d, m.id));
              },
            }, icon('trash')))))))))
      : emptyState(`Nada guardado sobre ${displayName(person)}.`, 'Diga "lembre que eu gosto de…" na conversa ou toque em "Nova memória".'));
}

function openMemoryForm(ctx, residentId, memory = null) {
  const person = getResident(ctx.store.getState(), residentId);
  const form = h('form', { class: 'form', novalidate: true },
    field('Categoria', h('select', { id: 'mf-cat', name: 'category', class: 'input' },
      Object.entries(MEMORY_CATEGORIES).map(([k, v]) => h('option', { value: k, selected: (memory?.category || 'preferencias') === k }, v)))),
    field('O que lembrar', h('textarea', { id: 'mf-text', name: 'text', class: 'input', rows: 3, maxlength: 280, autofocus: true }, memory?.text || '')),
    h('p', { class: 'field-error form-error', 'aria-live': 'polite' }));
  const { close } = openModal({
    title: memory ? 'Corrigir memória' : `Nova memória de ${displayName(person)}`,
    body: form,
    actions: [button('Cancelar', { onClick: () => close() }), button('Salvar', { variant: 'primary', onClick: () => form.requestSubmit() })],
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = { residentId, category: fd.get('category'), text: fd.get('text') || '' };
    const result = ctx.store.update((d) => (memory ? updateMemory(d, memory.id, payload) : addMemory(d, payload)));
    if (!result.ok) { form.querySelector('.form-error').textContent = result.error; return; }
    close();
    ctx.toast('Memória salva.', { kind: 'ok' });
  });
}

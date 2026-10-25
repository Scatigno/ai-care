// Cadastro de moradores, familiares e visitantes.

import { h, icon } from '../../core/dom.js';
import { openModal, confirmDialog } from '../components/overlay.js';
import { button, emptyState, field, notice, segmented, setFieldErrors, statusTag, viewHeader } from '../components/common.js';
import {
  RESIDENT_KINDS, AVATAR_COLORS, addResident, updateResident, removeResident, listResidents,
  setActiveResident, displayName, initials, identificationHistory, getResident,
} from '../../domain/residents.js';
import { memoriesFor } from '../../domain/memory.js';
import { formatDateTime } from '../../core/format.js';

let filter = 'todos';

const COLOR_NAMES = { teal: 'Verde-azulado', indigo: 'Índigo', amber: 'Âmbar', rose: 'Rosa', green: 'Verde', slate: 'Cinza' };

function residentCard(ctx, r, state) {
  const isActive = state.session.activeResidentId === r.id;
  const memCount = memoriesFor(state, r.id).length;
  return h('li', { class: `person-card${isActive ? ' is-active' : ''}` },
    h('div', { class: 'person-main' },
      h('span', { class: `avatar-circle av-${r.color}` }, initials(r.name)),
      h('div', { class: 'person-text' },
        h('h3', { class: 'person-name' }, r.name),
        h('p', { class: 'person-meta' }, [r.nickname && r.nickname !== r.name ? `"${r.nickname}"` : null, r.relation].filter(Boolean).join(' · ') || RESIDENT_KINDS[r.kind]),
        h('div', { class: 'person-tags' },
          h('span', { class: `tag tag-kind` }, RESIDENT_KINDS[r.kind]),
          r.isEmergencyContact ? h('span', { class: 'tag tag-sos' }, 'Contato de emergência') : null,
          r.isFictitious ? h('span', { class: 'tag tag-fict' }, 'Fictício') : null,
          isActive ? h('span', { class: 'tag tag-real' }, 'Usando agora') : null))),
    h('dl', { class: 'person-facts' },
      h('div', {}, h('dt', {}, 'Telefone'), h('dd', {}, r.phone || '—')),
      h('div', {}, h('dt', {}, 'Memórias'), h('dd', {}, String(memCount))),
      h('div', {}, h('dt', {}, 'Biometria'), h('dd', {}, 'Desativada'))),
    h('div', { class: 'person-actions' },
      !isActive ? button('Usar agora', { variant: 'ghost', size: 'sm', onClick: () => ctx.store.update((d) => setActiveResident(d, r.id, 'manual')) }) : null,
      button('Memórias', { variant: 'ghost', size: 'sm', iconName: 'brain', onClick: () => ctx.navigate('memorias', { residentId: r.id }) }),
      button('Editar', { variant: 'secondary', size: 'sm', iconName: 'edit', onClick: () => openResidentForm(ctx, r) })));
}

export function render(ctx) {
  const state = ctx.store.getState();
  const all = listResidents(state);
  const shown = filter === 'todos' ? all : all.filter((r) => r.kind === filter);
  const filters = { todos: `Todos (${all.length})` };
  const plural = { morador: 'Moradores', familiar: 'Familiares', visitante: 'Visitantes' };
  for (const k of Object.keys(RESIDENT_KINDS)) filters[k] = `${plural[k]} (${all.filter((r) => r.kind === k).length})`;

  return h('div', { class: 'page' },
    viewHeader('Moradores', {
      subtitle: 'Moradores, familiares e visitantes desta residência.',
      actions: [button('Novo cadastro', { variant: 'primary', iconName: 'plus', onClick: () => openResidentForm(ctx) })],
    }),
    notice('Nesta fase use somente dados fictícios. Reconhecimento facial e de voz estão desativados e só serão liberados com consentimento e validação.', { kind: 'demo' }),
    segmented('filtro-moradores', filters, filter, (v) => { filter = v; ctx.navigate('moradores', { focus: false }); }),
    shown.length
      ? h('ul', { class: 'person-grid' }, shown.map((r) => residentCard(ctx, r, state)))
      : emptyState('Nenhum cadastro nesta categoria.', 'Toque em "Novo cadastro" para adicionar.'));
}

export function openResidentForm(ctx, resident = null) {
  const isEdit = Boolean(resident);
  const r = resident || {
    kind: 'morador', name: '', nickname: '', relation: '', phone: '', isEmergencyContact: false, color: 'teal',
    preferences: { treatment: '', notes: '' }, permissions: { manageResidents: false, manageReminders: true, viewCameras: false },
  };
  const input = (name, value, attrs = {}) => h('input', { id: `rf-${name}`, name, value: value || '', class: 'input', ...attrs });
  const check = (name, checked, label) => h('label', { class: 'check', for: `rf-${name}` },
    h('input', { type: 'checkbox', id: `rf-${name}`, name, checked }), h('span', {}, label));

  const kindSelect = h('select', { id: 'rf-kind', name: 'kind', class: 'input' },
    Object.entries(RESIDENT_KINDS).map(([k, label]) => h('option', { value: k, selected: r.kind === k }, label)));
  const colorPicker = h('div', { class: 'color-picker', role: 'radiogroup', 'aria-label': 'Cor do perfil' },
    AVATAR_COLORS.map((c) => h('label', { class: `color-swatch av-${c}`, title: COLOR_NAMES[c], for: `rf-color-${c}` },
      h('input', { type: 'radio', name: 'color', id: `rf-color-${c}`, value: c, checked: r.color === c, 'aria-label': COLOR_NAMES[c] }))));

  const history = isEdit ? identificationHistory(ctx.store.getState(), r.id).slice(0, 5) : [];

  const form = h('form', { class: 'form', novalidate: true },
    h('div', { class: 'form-grid' },
      field('Nome completo', input('name', r.name, { autocomplete: 'off', maxlength: 80, required: true, autofocus: true })),
      field('Como prefere ser chamado(a)', input('treatment', r.preferences?.treatment, { placeholder: 'Ex.: Dona Helena', maxlength: 60 })),
      field('Tipo de cadastro', kindSelect),
      field('Apelido', input('nickname', r.nickname, { maxlength: 40 })),
      field('Parentesco ou função', input('relation', r.relation, { placeholder: 'Ex.: Filho, Cuidadora', maxlength: 60 })),
      field('Telefone', input('phone', r.phone, { type: 'tel', inputmode: 'tel', placeholder: '(11) 90000-0000', maxlength: 20 }))),
    check('isEmergencyContact', r.isEmergencyContact, 'Contato de emergência (aparece no SOS)'),
    h('fieldset', { class: 'fieldset' }, h('legend', {}, 'Cor do perfil'), colorPicker),
    field('Observações e preferências', h('textarea', { id: 'rf-notes', name: 'notes', class: 'input', rows: 2, maxlength: 280 }, r.preferences?.notes || '')),
    h('fieldset', { class: 'fieldset' }, h('legend', {}, 'Permissões'),
      check('perm-manageResidents', r.permissions?.manageResidents, 'Pode gerenciar cadastros'),
      check('perm-manageReminders', r.permissions?.manageReminders, 'Pode criar e editar lembretes'),
      check('perm-viewCameras', r.permissions?.viewCameras, 'Pode ver câmeras')),
    h('p', { class: 'fine' }, 'As permissões ficam registradas e serão aplicadas quando o login individual existir (Fase 7).'),
    h('fieldset', { class: 'fieldset' }, h('legend', {}, 'Identificação biométrica'),
      h('div', { class: 'bio-row' }, h('span', {}, 'Reconhecimento facial'), statusTag('planned', 'Desativado')),
      h('div', { class: 'bio-row' }, h('span', {}, 'Reconhecimento de voz'), statusTag('planned', 'Desativado')),
      h('p', { class: 'fine' }, 'Nenhuma foto, imagem ou amostra de voz é coletada. Quando existir, será opcional, com consentimento explícito e exclusão a qualquer momento.')),
    !isEdit ? check('fictitious', false, 'Confirmo que estes dados são fictícios (fase de testes)') : null,
    history.length ? h('details', { class: 'details' },
      h('summary', {}, 'Histórico de identificação'),
      h('ul', { class: 'log-list' }, history.map((e) => h('li', { class: 'log-item' },
        h('span', { class: 'log-when' }, formatDateTime(e.at)),
        h('span', { class: 'log-what' }, e.method === 'manual-voz' ? 'Disse o próprio nome' : 'Escolheu o nome na tela'))))) : null,
    h('p', { class: 'field-error form-error', 'aria-live': 'polite' }));

  const { close } = openModal({
    title: isEdit ? `Editar ${r.name}` : 'Novo cadastro',
    size: 'lg',
    body: form,
    actions: (() => {
      const list = [];
      if (isEdit) list.push(button('Excluir', { variant: 'danger-ghost', iconName: 'trash', onClick: () => remove() }));
      list.push(h('span', { class: 'spacer' }));
      list.push(button('Cancelar', { onClick: () => close() }));
      list.push(button(isEdit ? 'Salvar' : 'Cadastrar', { variant: 'primary', onClick: () => form.requestSubmit() }));
      return list;
    })(),
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    if (!isEdit && !fd.get('fictitious')) {
      form.querySelector('.form-error').textContent = 'Marque a confirmação de que os dados são fictícios.';
      return;
    }
    const data = {
      kind: fd.get('kind'),
      name: fd.get('name') || '',
      nickname: fd.get('nickname') || '',
      relation: fd.get('relation') || '',
      phone: fd.get('phone') || '',
      isEmergencyContact: Boolean(fd.get('isEmergencyContact')),
      color: fd.get('color') || 'teal',
      preferences: { treatment: fd.get('treatment') || '', notes: fd.get('notes') || '' },
      permissions: {
        manageResidents: Boolean(fd.get('perm-manageResidents')),
        manageReminders: Boolean(fd.get('perm-manageReminders')),
        viewCameras: Boolean(fd.get('perm-viewCameras')),
      },
    };
    const result = ctx.store.update((d) => (isEdit ? updateResident(d, r.id, data) : addResident(d, data)));
    if (!result.ok) {
      setFieldErrors(form, result.errors);
      return;
    }
    close();
    ctx.toast(isEdit ? 'Cadastro atualizado.' : `${result.resident.name} foi cadastrado(a).`, { kind: 'ok' });
  });

  async function remove() {
    const ok = await confirmDialog({
      title: 'Excluir cadastro?',
      message: `${r.name} e todas as memórias e o histórico de identificação desta pessoa serão apagados. Não é possível desfazer.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    ctx.store.update((d) => removeResident(d, r.id));
    close();
    ctx.toast('Cadastro excluído.', { kind: 'ok' });
  }
}

// Seletor de "quem está usando" (identificação manual).
export function openResidentPicker(ctx) {
  const state = ctx.store.getState();
  const people = listResidents(state);
  const { close } = openModal({
    title: 'Quem está usando?',
    size: 'md',
    body: h('div', { class: 'picker' },
      people.length
        ? h('ul', { class: 'picker-list' }, people.map((r) => h('li', {},
          h('button', {
            type: 'button',
            class: `picker-item${state.session.activeResidentId === r.id ? ' is-active' : ''}`,
            onclick: () => {
              ctx.store.update((d) => setActiveResident(d, r.id, 'manual'));
              close();
              ctx.toast(`Olá, ${displayName(getResident(ctx.store.getState(), r.id))}!`, { kind: 'ok' });
            },
          },
          h('span', { class: `avatar-circle av-${r.color}` }, initials(r.name)),
          h('span', { class: 'picker-text' }, h('strong', {}, displayName(r)), h('small', {}, `${RESIDENT_KINDS[r.kind]}${r.relation ? ' · ' + r.relation : ''}`)),
          state.session.activeResidentId === r.id ? icon('check') : null))))
        : emptyState('Ninguém cadastrado ainda.'),
      h('p', { class: 'fine' }, 'Identificação manual: a pessoa escolhe o próprio nome. O reconhecimento facial e de voz está desativado nesta versão.'),
      h('div', { class: 'modal-actions' },
        button('Novo cadastro', { iconName: 'plus', onClick: () => { close(); openResidentForm(ctx); } }),
        button('Gerenciar moradores', { variant: 'ghost', onClick: () => { close(); ctx.navigate('moradores'); } }))),
  });
}

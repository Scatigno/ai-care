import { h, icon } from '../../core/dom.js';
import { button, emptyState, statusTag, viewHeader } from '../components/common.js';
import { addShoppingItems, clearBought, listShopping, removeShopping, toggleShopping } from '../../domain/shopping.js';

export function render(ctx) {
  const items = listShopping(ctx.store.getState());
  const pending = items.filter((i) => !i.done);
  const bought = items.filter((i) => i.done);
  const input = h('input', { id: 'shop-input', name: 'item', class: 'input', placeholder: 'Ex.: Arroz, feijão', maxlength: 120, autocomplete: 'off', enterkeyhint: 'done', 'aria-label': 'Item para comprar' });
  const form = h('form', { class: 'inline-form', onsubmit: (e) => {
    e.preventDefault();
    const names = input.value.split(/,|\s+e\s+/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    const r = ctx.store.update((d) => addShoppingItems(d, names, d.session.activeResidentId));
    if (r.existing.length) ctx.toast(`${r.existing.join(', ')} já estava na lista.`);
    document.getElementById('shop-input')?.focus();
  } }, input, button('Adicionar', { variant: 'primary', iconName: 'plus', type: 'submit' }));

  const row = (i) => h('li', { class: `shop-item${i.done ? ' is-done' : ''}` },
    h('label', { class: 'reminder-check', for: `shop-${i.id}` },
      h('input', { type: 'checkbox', id: `shop-${i.id}`, checked: i.done, onchange: () => ctx.store.update((d) => toggleShopping(d, i.id)) }),
      h('span', { class: 'reminder-box', 'aria-hidden': 'true' }, icon('check', { size: 20 })),
      h('span', { class: 'shop-name' }, i.name)),
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remover ${i.name}`, onclick: () => ctx.store.update((d) => removeShopping(d, i.id)) }, icon('x')));

  return h('div', { class: 'page page-narrow' },
    viewHeader('Lista de compras', { subtitle: 'Fale "adicione leite na lista" ou escreva abaixo.', tag: statusTag('real') }),
    h('section', { class: 'panel' }, form,
      pending.length ? h('ul', { class: 'shop-list' }, pending.map(row)) : emptyState('Nada para comprar.')),
    bought.length ? h('section', { class: 'panel' },
      h('div', { class: 'panel-head' },
        h('h2', { class: 'panel-title' }, 'Já comprados', h('span', { class: 'count' }, String(bought.length))),
        button('Limpar comprados', { variant: 'ghost', onClick: () => ctx.store.update((d) => clearBought(d)) })),
      h('ul', { class: 'shop-list' }, bought.map(row))) : null);
}

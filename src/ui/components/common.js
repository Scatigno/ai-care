import { h, icon } from '../../core/dom.js';
import { STATUS, feature } from '../../data/features.js';

// Etiqueta de status: Funcional / Demonstração / Planejado.
export function statusTag(status, text) {
  return h('span', { class: `tag tag-${status}`, title: STATUS[status]?.description }, text || STATUS[status]?.label || status);
}

export function featureTag(featureId) {
  const f = feature(featureId);
  return f ? statusTag(f.status) : null;
}

export function button(label, { variant = 'secondary', iconName, onClick, type = 'button', size, ariaLabel, id } = {}) {
  return h('button', {
    type,
    id,
    class: `btn btn-${variant}${size ? ' btn-' + size : ''}`,
    onclick: onClick,
    'aria-label': ariaLabel,
  }, iconName ? icon(iconName) : null, label ? h('span', {}, label) : null);
}

export function viewHeader(title, { subtitle, actions = [], tag } = {}) {
  return h('header', { class: 'view-header' },
    h('div', { class: 'view-header-text' },
      h('h1', { class: 'view-title' }, title, tag ? ' ' : null, tag),
      subtitle ? h('p', { class: 'view-subtitle' }, subtitle) : null),
    actions.length ? h('div', { class: 'view-actions' }, actions) : null);
}

export function notice(text, { kind = 'info', title } = {}) {
  return h('div', { class: `notice notice-${kind}`, role: kind === 'danger' ? 'alert' : 'note' },
    icon(kind === 'danger' ? 'sos' : kind === 'demo' ? 'info' : 'shield'),
    h('div', {}, title ? h('strong', {}, title) : null, title ? ' ' : null, text));
}

export function emptyState(text, hint) {
  return h('div', { class: 'empty' }, h('p', { class: 'empty-text' }, text), hint ? h('p', { class: 'empty-hint' }, hint) : null);
}

export function field(labelText, control, { error, hint, id } = {}) {
  const wrap = h('div', { class: `field${error ? ' has-error' : ''}` },
    h('label', { class: 'field-label', for: id || control.id }, labelText),
    control,
    hint ? h('p', { class: 'field-hint' }, hint) : null,
    h('p', { class: 'field-error', 'aria-live': 'polite' }, error || ''));
  return wrap;
}

export function setFieldErrors(form, errors) {
  for (const el of form.querySelectorAll('.field')) {
    el.classList.remove('has-error');
    const p = el.querySelector('.field-error');
    if (p) p.textContent = '';
  }
  for (const [name, message] of Object.entries(errors)) {
    const control = form.querySelector(`[name="${name}"]`);
    const wrap = control?.closest('.field');
    if (wrap) {
      wrap.classList.add('has-error');
      wrap.querySelector('.field-error').textContent = message;
    }
  }
  const first = form.querySelector('.has-error input, .has-error select, .has-error textarea');
  first?.focus();
}

export function segmented(name, options, value, onChange) {
  return h('div', { class: 'segmented', role: 'radiogroup' },
    Object.entries(options).map(([val, label]) => {
      const id = `${name}-${val}`;
      return h('label', { class: 'segmented-option', for: id },
        h('input', {
          type: 'radio', name, id, value: val, checked: val === String(value),
          onchange: () => onChange(val),
        }),
        h('span', {}, label));
    }));
}

export function toggle(id, labelText, checked, onChange, { disabled = false, hint } = {}) {
  return h('label', { class: `toggle${disabled ? ' is-disabled' : ''}`, for: id },
    h('input', { type: 'checkbox', role: 'switch', id, checked, disabled, onchange: (e) => onChange(e.target.checked) }),
    h('span', { class: 'toggle-track', 'aria-hidden': 'true' }, h('span', { class: 'toggle-thumb' })),
    h('span', { class: 'toggle-text' }, h('span', {}, labelText), hint ? h('small', {}, hint) : null));
}

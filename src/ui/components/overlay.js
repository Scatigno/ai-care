import { h, icon } from '../../core/dom.js';

// Diálogo modal acessível (foco preso, Esc fecha, restaura o foco).
export function openModal({ title, body, actions = [], size = 'md', onClose, className = '', dismissible = true }) {
  const previous = document.activeElement;
  const titleId = `m-${Math.random().toString(36).slice(2, 8)}`;
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
    previous?.focus?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && dismissible) close();
    if (e.key === 'Tab') trap(e);
  };
  const dialog = h('div', { class: `modal modal-${size} ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('div', { class: 'modal-head' },
      h('h2', { id: titleId, class: 'modal-title' }, title),
      dismissible ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Fechar', onclick: close }, icon('x')) : null),
    h('div', { class: 'modal-body' }, typeof body === 'function' ? body(close) : body),
    actions.length ? h('div', { class: 'modal-actions' }, typeof actions === 'function' ? actions(close) : actions) : null);
  const overlay = h('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay && dismissible) close(); } }, dialog);

  function trap(e) {
    const focusables = [...dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => {
    const target = dialog.querySelector('[autofocus], input, select, textarea') || dialog.querySelector('.modal-actions button, .modal-body button') || dialog;
    target.focus?.();
  });
  return { close, dialog };
}

// Confirmação construída na própria página (confirm() não existe no Artifact).
export function confirmDialog({ title, message, confirmLabel = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const { close } = openModal({
      title,
      size: 'sm',
      body: h('p', { class: 'modal-text' }, message),
      actions: [
        h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => { answered = true; close(); resolve(false); } }, 'Cancelar'),
        h('button', { type: 'button', class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, onclick: () => { answered = true; close(); resolve(true); } }, confirmLabel),
      ],
      onClose: () => { if (!answered) resolve(false); },
    });
  });
}

let toastHost;
export function toast(message, { kind = 'info', timeout = 4000 } = {}) {
  if (!toastHost) {
    toastHost = h('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastHost);
  }
  const el = h('div', { class: `toast toast-${kind}` }, message);
  toastHost.append(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 300);
  }, timeout);
}

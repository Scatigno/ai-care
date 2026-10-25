// Casca da aplicação: cabeçalho, navegação, roteador de telas e serviços
// compartilhados entre as telas (contexto).

import { h, clear, icon } from '../core/dom.js';
import { VIEWS, findView } from './views/index.js';
import { applyAppearance, effectiveTheme } from '../services/theme.js';
import { activeResident, displayName, initials } from '../domain/residents.js';
import { startReminderScheduler } from '../services/scheduler.js';
import { openSos } from './views/emergency.js';
import { openResidentPicker } from './views/residents.js';
import { showReminderAlert } from './views/reminders.js';
import { showRoutine } from './views/routines.js';
import { setKeepAwake } from '../services/wakelock.js';
import { openOnboarding } from './views/onboarding.js';
import { toast } from './components/overlay.js';
import { createEmptyState } from '../data/schema.js';
import { resetTranscript } from './views/assistant.js';

function createUiState() {
  const state = { listening: false, camera: false, speaking: false };
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      Object.assign(state, patch);
      listeners.forEach((fn) => fn(state));
    },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

export function mountApp(root, { store, speech }) {
  const ui = createUiState();
  let currentView = null;
  let currentId = null;
  let currentEl = null;

  // Quem quiser acompanhar a fala (o avatar mexe a boca) se inscreve aqui.
  const speechListeners = new Set();
  const emitSpeech = (ev) => speechListeners.forEach((fn) => fn(ev));

  const ctx = {
    store,
    speech,
    ui,
    toast,
    navigate,
    openResidentPicker: () => openResidentPicker(ctx),
    openSos: (origin = 'botao', opts) => openSos(ctx, origin, opts),
    // Apaga tudo e volta à configuração inicial (sem dados de exemplo).
    wipe() {
      store.replace(createEmptyState());
      resetTranscript();
      navigate('inicio');
      openOnboarding(ctx);
    },
    // Fala um texto com a voz da assistente escolhida, se a voz estiver ligada.
    say(text, { onStart, onEnd } = {}) {
      const { voice, assistant } = store.getState().settings;
      if (!voice.enabled || !speech.supportsSynthesis) { onEnd?.(); return; }
      speech.speak(text, {
        gender: assistant.gender || 'female',
        rate: voice.rate,
        onStart: () => { ui.set({ speaking: true }); emitSpeech({ type: 'start', text, rate: voice.rate }); onStart?.(); },
        onBoundary: (ci) => emitSpeech({ type: 'boundary', ci }),
        onEnd: () => { ui.set({ speaking: false }); emitSpeech({ type: 'end' }); onEnd?.(); },
      });
    },
    onSpeech(fn) {
      speechListeners.add(fn);
      return () => speechListeners.delete(fn);
    },
  };

  // ---------- Cabeçalho ----------
  const residentBtn = h('button', { type: 'button', class: 'resident-chip', onclick: () => ctx.openResidentPicker() });
  const micPill = h('span', { class: 'live-pill live-mic', hidden: true, role: 'status' }, h('span', { class: 'live-dot' }), 'Microfone ativo');
  const camPill = h('span', { class: 'live-pill live-cam', hidden: true, role: 'status' }, h('span', { class: 'live-dot' }), 'Câmera ativa');
  const themeBtn = h('button', { type: 'button', class: 'icon-btn', onclick: toggleTheme });
  const sosBtn = h('button', { type: 'button', class: 'sos-btn', onclick: () => ctx.openSos('botao'), 'aria-label': 'SOS emergência' }, h('span', { class: 'sos-label' }, 'SOS'));

  const header = h('header', { class: 'topbar' },
    h('a', { class: 'brand', href: '#inicio', onclick: (e) => { e.preventDefault(); navigate('inicio'); } },
      brandMark(), h('span', { class: 'brand-name' }, 'AI Care')),
    h('div', { class: 'topbar-center' }, residentBtn),
    h('div', { class: 'topbar-right' }, micPill, camPill, themeBtn, sosBtn));

  const demoBar = h('div', { class: 'demo-bar' },
    h('span', {}, h('strong', {}, 'Versão de teste.'), ' Dados fictícios, salvos só neste aparelho. Nenhum alerta real é enviado.'),
    h('button', { type: 'button', class: 'link-btn', onclick: () => navigate('recursos') }, 'O que já funciona?'));

  // ---------- Navegação ----------
  const navButtons = new Map();
  const nav = h('nav', { class: 'nav', 'aria-label': 'Navegação principal' },
    VIEWS.filter((v) => v.nav).map((v) => {
      const b = h('button', { type: 'button', class: `nav-item${v.compact ? '' : ' nav-extra'}`, onclick: () => navigate(v.id) },
        icon(v.icon, { size: 26 }), h('span', { class: 'nav-label' }, v.navLabel || v.title));
      navButtons.set(v.id, b);
      return b;
    }));

  const main = h('main', { class: 'view', id: 'view', tabindex: '-1' });
  const shell = h('div', { class: 'shell' }, demoBar, header, h('div', { class: 'body' }, nav, main));
  clear(root).append(shell);

  // ---------- Roteamento ----------
  function navigate(id, params = {}) {
    const view = findView(id) || findView('inicio');
    currentView?.destroy?.();
    currentId = view.id;
    currentView = view.module;
    clear(main);
    currentEl = view.module.render(ctx, params);
    main.append(currentEl);
    main.scrollTop = 0;
    for (const [vid, b] of navButtons) {
      b.classList.toggle('is-active', vid === view.id || view.parent === vid);
      if (vid === view.id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    }
    document.title = view.id === 'inicio' ? 'AI Care' : `${view.title} · AI Care`;
    try {
      if (location.hash.slice(1) !== view.id) history.replaceState(null, '', `#${view.id}`);
    } catch { /* ambiente sem history */ }
    if (params.focus !== false && view.id !== 'inicio') main.focus({ preventScroll: true });
  }

  function rerender() {
    if (!currentView) return;
    if (currentView.update) {
      currentView.update(store.getState());
      return;
    }
    const scroll = main.scrollTop;
    clear(main);
    currentEl = currentView.render(ctx, {});
    main.append(currentEl);
    main.scrollTop = scroll;
  }

  // ---------- Atualizações ----------
  function refreshHeader() {
    const state = store.getState();
    const r = activeResident(state);
    clear(residentBtn).append(
      h('span', { class: `mini-avatar av-${r?.color || 'slate'}` }, r ? initials(r.name) : '?'),
      h('span', { class: 'resident-chip-text' },
        h('small', {}, 'Quem está usando'),
        h('span', {}, r ? displayName(r) : 'Escolher pessoa')));
    residentBtn.setAttribute('aria-label', r ? `Pessoa ativa: ${displayName(r)}. Trocar` : 'Escolher quem está usando');
    const theme = effectiveTheme(state.settings);
    clear(themeBtn).append(icon(theme === 'dark' ? 'sun' : 'moon'));
    themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Usar modo claro' : 'Usar modo escuro');
  }

  function toggleTheme() {
    const next = effectiveTheme(store.getState().settings) === 'dark' ? 'light' : 'dark';
    store.update((d) => { d.settings.theme = next; });
  }

  let lastSettings = null;
  let keepAwake = null;
  function syncKeepAwake(on) {
    if (on === keepAwake) return;
    keepAwake = on;
    setKeepAwake(on).then((r) => { if (on && !r.ok) toast(r.message, { kind: 'warn', timeout: 6000 }); });
  }
  store.subscribe((state) => {
    if (state.settings !== lastSettings) {
      applyAppearance(state.settings);
      lastSettings = state.settings;
      syncKeepAwake(state.settings.keepAwake);
    }
    refreshHeader();
    rerender();
  });
  globalThis.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', refreshHeader);

  ui.on((s) => {
    micPill.hidden = !s.listening;
    camPill.hidden = !s.camera;
  });

  applyAppearance(store.getState().settings);
  refreshHeader();

  const initial = (() => { try { return location.hash.slice(1); } catch { return ''; } })();
  navigate(findView(initial) ? initial : 'inicio', { focus: false });
  globalThis.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (id && id !== currentId && findView(id)) navigate(id);
  });

  startReminderScheduler(store, (reminder) => showReminderAlert(ctx, reminder), { onRoutine: (routine) => showRoutine(ctx, routine) });
  syncKeepAwake(store.getState().settings.keepAwake);

  if (!store.getState().settings.onboardingDone) openOnboarding(ctx);

  if (store.storageKind !== 'localStorage') {
    toast('Este navegador não permite salvar dados. As alterações valem só até fechar a página.', { kind: 'warn', timeout: 7000 });
  }
  return ctx;
}

export function brandMark() {
  const span = document.createElement('span');
  span.className = 'brand-mark';
  span.setAttribute('aria-hidden', 'true');
  // Casa + arco de voz: a residência que conversa.
  span.innerHTML = '<svg viewBox="0 0 32 32" width="32" height="32"><rect width="32" height="32" rx="9" fill="currentColor"/><path d="M8 16.5 16 10l8 6.5V24H8z" fill="none" stroke="var(--accent-ink)" stroke-width="2.4" stroke-linejoin="round"/><path d="M13.2 19.6a3.6 3.6 0 0 1 5.6 0" fill="none" stroke="var(--accent-ink)" stroke-width="2.2" stroke-linecap="round"/></svg>';
  return span;
}

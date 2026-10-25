// Avatar da tela principal. Mostra o avatar 3D quando ligado nas
// configurações e o aparelho permite (WebGL); enquanto carrega, mostra o
// retrato do personagem; se não der certo, volta para o avatar ilustrado.
// A interface é a mesma do avatar ilustrado: setGender, setState, destroy,
// mais speak/boundary/stopSpeaking para a sincronização labial.

import { h } from '../../core/dom.js';
import { createAvatar } from './avatar.js';
import { loadAvatar3D, canUse3D, AVATAR_BASE, PORTRAIT } from './avatar3d/load.js';

export function createAssistantAvatar({ gender = 'female', prefer3d = true, onFallback } = {}) {
  const el = h('div', { class: 'avatar-host' });
  let svg = null;
  let three = null;
  let layer = null;
  let current = gender;
  let state = 'idle';
  let destroyed = false;

  function showSvg() {
    el.dataset.avatar = 'svg';
    el.classList.remove('is-3d');
    if (!svg) {
      svg = createAvatar({ gender: current, size: 'lg' });
      el.prepend(svg.el);
    }
    svg.setGender(current);
    svg.setState(state);
  }

  async function show3d() {
    el.dataset.avatar = 'loading';
    el.classList.add('is-3d');
    const poster = h('img', { class: 'avatar3d-poster', src: PORTRAIT[current], alt: '' });
    layer = h('div', { class: 'avatar3d-layer', role: 'img', 'aria-label': `Personagem virtual em 3D ${current === 'male' ? 'do assistente' : 'da assistente'}` }, poster);
    el.append(layer);
    try {
      const mod = await loadAvatar3D();
      if (destroyed) return;
      three = await mod.createAvatar3D({ gender: current, base: AVATAR_BASE, container: layer });
      if (destroyed) { three.destroy(); return; }
      three.setState(state);
      el.dataset.avatar = '3d';
      layer.classList.add('is-ready');
      if (svg) { svg.destroy(); svg.el.remove(); svg = null; }
    } catch (err) {
      console.warn('Avatar 3D indisponível:', err);
      three = null;
      layer?.remove();
      layer = null;
      if (!destroyed) { showSvg(); onFallback?.(err); }
    }
  }

  if (prefer3d && canUse3D()) show3d();
  else showSvg();

  const api = {
    el,
    get mode() { return el.dataset.avatar; },
    setGender(g) {
      current = g;
      if (three) three.setGender(g);
      else if (svg) svg.setGender(g);
      const poster = layer?.querySelector('.avatar3d-poster');
      if (poster) poster.src = PORTRAIT[g];
    },
    setState(s) {
      state = s;
      el.dataset.state = s;
      three?.setState(s);
      svg?.setState(s);
    },
    speak(text, opts) { three?.speak(text, opts); },
    boundary(ci) { three?.boundary(ci); },
    stopSpeaking() { three?.stopSpeaking(); },
    debug: () => three?.debug() || null,
    destroy() {
      destroyed = true;
      three?.destroy();
      svg?.destroy();
    },
  };
  el.avatarApi = api; // usado pelos testes de ponta a ponta
  return api;
}

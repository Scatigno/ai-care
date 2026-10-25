// Carrega o avatar 3D só quando for usado. No app publicado ele é um
// arquivo à parte (avatar3d.js, ~500 KB) para não atrasar a abertura; no
// desenvolvimento vem direto dos módulos.

/* global __AICARE_BUNDLED__ */
const BUNDLED = typeof __AICARE_BUNDLED__ !== 'undefined';

export const AVATAR_BASE = BUNDLED ? 'public/avatars/' : '/public/avatars/';
export const PORTRAIT = { female: `${AVATAR_BASE}f002/portrait.webp`, male: `${AVATAR_BASE}m014/portrait.webp` };

let pending = null;

export function loadAvatar3D() {
  if (globalThis.AICareAvatar3D) return Promise.resolve(globalThis.AICareAvatar3D);
  if (pending) return pending;
  pending = (BUNDLED ? loadScript('avatar3d.js') : import(new URL('./scene.js', import.meta.url).href))
    .then((mod) => globalThis.AICareAvatar3D || mod)
    .catch((err) => { pending = null; throw err; });
  return pending;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => (globalThis.AICareAvatar3D ? resolve(globalThis.AICareAvatar3D) : reject(new Error('avatar3d.js sem conteúdo')));
    s.onerror = () => reject(new Error('Não foi possível carregar avatar3d.js'));
    document.head.append(s);
  });
}

export function canUse3D() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

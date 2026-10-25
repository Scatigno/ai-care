// Mantém a tela ligada enquanto o app está aberto (Screen Wake Lock API).
// O sistema solta o bloqueio quando a página sai de vista; ele é pedido
// de novo quando a página volta.

let sentinel = null;
let wanted = false;

export function wakeLockSupported() {
  return Boolean(globalThis.navigator?.wakeLock?.request);
}

async function acquire() {
  if (!wanted || sentinel || document.visibilityState !== 'visible') return { ok: true };
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener?.('release', () => { sentinel = null; });
    return { ok: true };
  } catch {
    sentinel = null;
    return { ok: false, message: 'O navegador não deixou manter a tela ligada. Verifique se o modo Pouca Energia está desligado.' };
  }
}

function onVisibility() {
  if (document.visibilityState === 'visible') acquire();
}

export async function setKeepAwake(on) {
  wanted = on;
  if (!on) {
    document.removeEventListener('visibilitychange', onVisibility);
    try { await sentinel?.release(); } catch { /* já solto */ }
    sentinel = null;
    return { ok: true };
  }
  if (!wakeLockSupported()) return { ok: false, message: 'Este navegador não permite manter a tela ligada.' };
  document.addEventListener('visibilitychange', onVisibility);
  return acquire();
}

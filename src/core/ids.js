// Gera identificadores únicos com prefixo legível (ex.: "res_k3f9...").
export function uid(prefix = 'id') {
  let random;
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    random = globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  } else {
    random = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
  return `${prefix}_${random}`;
}

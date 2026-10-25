// Adaptadores de persistência. A interface é propositalmente mínima
// (load/save/clear) para que um backend remoto possa substituí-la depois.

export function createMemoryAdapter(initial = null) {
  let value = initial;
  return {
    kind: 'memory',
    load: () => (value ? JSON.parse(value) : null),
    save: (state) => { value = JSON.stringify(state); },
    clear: () => { value = null; },
  };
}

// localStorage pode falhar (modo privado, sandbox, cota). Nesses casos
// o app continua funcionando em memória e avisa o usuário.
export function createLocalStorageAdapter(key) {
  const fallback = createMemoryAdapter();
  let available = true;
  try {
    const probe = '__aicare_probe__';
    globalThis.localStorage.setItem(probe, '1');
    globalThis.localStorage.removeItem(probe);
  } catch {
    available = false;
  }
  if (!available) return { ...fallback, kind: 'memory-fallback' };

  return {
    kind: 'localStorage',
    load() {
      try {
        const raw = globalThis.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    save(state) {
      try {
        globalThis.localStorage.setItem(key, JSON.stringify(state));
      } catch (err) {
        console.warn('[AI Care] Não foi possível salvar os dados localmente.', err);
      }
    },
    clear() {
      try { globalThis.localStorage.removeItem(key); } catch { /* ignorado */ }
    },
  };
}

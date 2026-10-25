// Estado central da aplicação. Mudanças passam por update(), que clona o
// estado, aplica a função de alteração, persiste e notifica os assinantes.

export function createStore({ adapter, initialState, migrate = (s) => s }) {
  const loaded = adapter.load();
  let state = loaded ? migrate(loaded) : initialState();
  const listeners = new Set();
  adapter.save(state);

  function notify(prev) {
    for (const fn of listeners) fn(state, prev);
  }

  return {
    get state() { return state; },
    getState: () => state,
    update(mutator) {
      const prev = state;
      const draft = structuredClone(state);
      const result = mutator(draft);
      state = draft;
      adapter.save(state);
      notify(prev);
      return result;
    },
    replace(next) {
      const prev = state;
      state = migrate(next);
      adapter.save(state);
      notify(prev);
    },
    reset() {
      const prev = state;
      state = initialState();
      adapter.save(state);
      notify(prev);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    storageKind: adapter.kind,
  };
}

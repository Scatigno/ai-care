// Ponto de entrada do AI Care.

import { createStore } from './core/store.js';
import { createLocalStorageAdapter } from './core/storage.js';
import { STORAGE_KEY, createInitialState, migrate } from './data/schema.js';
import { createSpeech } from './services/speech.js';
import { mountApp } from './ui/app.js';

function registerServiceWorker() {
  // Service worker só em hospedagem própria (https ou localhost); o
  // Artifact do claude.ai não permite.
  try {
    if (!('serviceWorker' in navigator)) return;
    const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!secure || document.documentElement.dataset.build === 'artifact') return;
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  } catch { /* ignorado */ }
}

const store = createStore({
  adapter: createLocalStorageAdapter(STORAGE_KEY),
  initialState: () => createInitialState(),
  migrate,
});

const app = mountApp(document.getElementById('app'), { store, speech: createSpeech() });
globalThis.__aicare = app; // facilita testes automatizados e depuração
registerServiceWorker();

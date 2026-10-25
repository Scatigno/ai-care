// Modelo de dados da plataforma. Toda entidade de domínio carrega
// householdId, e toda residência carrega tenantId. Isso prepara o
// isolamento multi-tenant que o backend fará cumprir na Fase 7.

import { uid } from '../core/ids.js';
import { buildSeed } from './seed.js';

export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'aicare:v1';

export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'system', // 'system' | 'light' | 'dark'
  fontScale: 1, // 1 | 1.15 | 1.3
  assistant: { gender: null, name: '' }, // gender: 'female' | 'male'
  voice: { enabled: true, rate: 0.95, conversationMode: true, wakeWord: false },
  conversationProvider: 'local', // 'local' | 'claude'
  keepAwake: false, // manter a tela ligada (Screen Wake Lock)
  avatarStyle: '3d', // '3d' (personagem 3D) ou 'illustrated' (ilustração leve)
  onboardingDone: false,
});

export const ASSISTANT_DEFAULT_NAMES = { female: 'Clara', male: 'Rafael' };

export function createEmptyState(now = new Date()) {
  const tenantId = uid('ten');
  const householdId = uid('hh');
  return {
    schemaVersion: SCHEMA_VERSION,
    tenant: { id: tenantId, name: 'Cliente de demonstração', plan: 'demo', createdAt: now.toISOString() },
    households: [{ id: householdId, tenantId, name: 'Residência de demonstração', createdAt: now.toISOString() }],
    session: { householdId, activeResidentId: null },
    settings: structuredClone(DEFAULT_SETTINGS),
    residents: [],
    memories: [],
    reminders: [],
    shopping: [],
    devices: [],
    routines: [],
    alerts: [],
    identificationLog: [],
    audit: [],
  };
}

// Estado inicial com dados fictícios para testes.
export function createInitialState(now = new Date()) {
  const state = createEmptyState(now);
  buildSeed(state, now);
  return state;
}

// Migração de versões salvas anteriormente. Hoje só garante campos
// ausentes; versões futuras adicionam passos aqui.
export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || !raw.session) return createInitialState();
  const base = createEmptyState();
  const state = { ...base, ...raw };
  state.settings = {
    ...structuredClone(DEFAULT_SETTINGS),
    ...(raw.settings || {}),
    assistant: { ...DEFAULT_SETTINGS.assistant, ...(raw.settings?.assistant || {}) },
    voice: { ...DEFAULT_SETTINGS.voice, ...(raw.settings?.voice || {}) },
  };
  for (const key of ['residents', 'memories', 'reminders', 'shopping', 'devices', 'routines', 'alerts', 'identificationLog', 'audit']) {
    if (!Array.isArray(state[key])) state[key] = [];
  }
  state.schemaVersion = SCHEMA_VERSION;
  return state;
}

// Seleciona apenas registros da residência ativa (isolamento por residência).
export function scoped(state, collection) {
  const hh = state.session.householdId;
  return (state[collection] || []).filter((item) => item.householdId === hh);
}

export function activeHousehold(state) {
  return state.households.find((h) => h.id === state.session.householdId) || null;
}

export function audit(draft, action, details = {}) {
  draft.audit.unshift({
    id: uid('aud'),
    at: new Date().toISOString(),
    householdId: draft.session.householdId,
    action,
    details,
  });
  if (draft.audit.length > 500) draft.audit.length = 500;
}

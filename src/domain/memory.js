import { uid } from '../core/ids.js';
import { audit, scoped } from '../data/schema.js';

export const MEMORY_CATEGORIES = {
  preferencias: 'Preferências',
  rotinas: 'Rotinas',
  compromissos: 'Compromissos',
  lembretes: 'Lembretes',
  pessoais: 'Informações pessoais autorizadas',
  tarefas: 'Tarefas pendentes',
  contexto: 'Contexto de conversas',
};

export function memoriesFor(state, residentId) {
  return scoped(state, 'memories').filter((m) => m.residentId === residentId);
}

export function addMemory(draft, { residentId, category, text, source = 'manual' }) {
  const clean = (text || '').trim();
  if (!residentId) return { ok: false, error: 'Escolha de quem é esta memória.' };
  if (!MEMORY_CATEGORIES[category]) return { ok: false, error: 'Categoria inválida.' };
  if (clean.length < 2) return { ok: false, error: 'Escreva o que deve ser lembrado.' };
  if (clean.length > 280) return { ok: false, error: 'Use no máximo 280 caracteres.' };
  const now = new Date().toISOString();
  const memory = { id: uid('mem'), householdId: draft.session.householdId, residentId, category, text: clean, source, createdAt: now, updatedAt: now };
  draft.memories.push(memory);
  audit(draft, 'memory.create', { memoryId: memory.id, residentId, source });
  return { ok: true, memory };
}

export function updateMemory(draft, id, { category, text }) {
  const memory = draft.memories.find((m) => m.id === id && m.householdId === draft.session.householdId);
  if (!memory) return { ok: false, error: 'Memória não encontrada.' };
  const clean = (text || '').trim();
  if (clean.length < 2) return { ok: false, error: 'Escreva o que deve ser lembrado.' };
  if (category && MEMORY_CATEGORIES[category]) memory.category = category;
  memory.text = clean.slice(0, 280);
  memory.updatedAt = new Date().toISOString();
  audit(draft, 'memory.update', { memoryId: id });
  return { ok: true, memory };
}

export function removeMemory(draft, id) {
  const before = draft.memories.length;
  draft.memories = draft.memories.filter((m) => !(m.id === id && m.householdId === draft.session.householdId));
  if (draft.memories.length !== before) audit(draft, 'memory.delete', { memoryId: id });
  return draft.memories.length !== before;
}

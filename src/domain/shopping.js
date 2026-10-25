import { uid } from '../core/ids.js';
import { scoped } from '../data/schema.js';
import { normalizeText } from '../services/conversation/normalize.js';

export function listShopping(state) {
  return scoped(state, 'shopping');
}

export function pendingShopping(state) {
  return listShopping(state).filter((i) => !i.done);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Adiciona itens ignorando duplicados pendentes. Devolve os nomes
// adicionados e os que já estavam na lista.
export function addShoppingItems(draft, names, addedBy = null) {
  const added = [];
  const existing = [];
  const pending = draft.shopping.filter((i) => i.householdId === draft.session.householdId && !i.done);
  for (const raw of names) {
    const name = capitalize(raw.trim().replace(/\s+/g, ' ')).slice(0, 60);
    if (name.length < 2) continue;
    const key = normalizeText(name);
    if (pending.some((i) => normalizeText(i.name) === key)) {
      existing.push(name);
      continue;
    }
    const item = { id: uid('shp'), householdId: draft.session.householdId, name, done: false, addedBy, createdAt: new Date().toISOString() };
    draft.shopping.push(item);
    pending.push(item);
    added.push(name);
  }
  return { added, existing };
}

export function removeShoppingByName(draft, name) {
  const key = normalizeText(name);
  const before = draft.shopping.length;
  draft.shopping = draft.shopping.filter((i) => !(i.householdId === draft.session.householdId && normalizeText(i.name) === key));
  return before !== draft.shopping.length;
}

export function toggleShopping(draft, id) {
  const item = draft.shopping.find((i) => i.id === id && i.householdId === draft.session.householdId);
  if (item) item.done = !item.done;
}

export function removeShopping(draft, id) {
  draft.shopping = draft.shopping.filter((i) => !(i.id === id && i.householdId === draft.session.householdId));
}

export function clearBought(draft) {
  draft.shopping = draft.shopping.filter((i) => !(i.householdId === draft.session.householdId && i.done));
}

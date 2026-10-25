import { uid } from '../core/ids.js';
import { audit, scoped } from '../data/schema.js';

export const RESIDENT_KINDS = {
  morador: 'Morador',
  familiar: 'Familiar',
  visitante: 'Visitante',
};

export const AVATAR_COLORS = ['teal', 'indigo', 'amber', 'rose', 'green', 'slate'];

export function listResidents(state, kind) {
  const all = scoped(state, 'residents');
  return kind ? all.filter((r) => r.kind === kind) : all;
}

export function getResident(state, id) {
  return scoped(state, 'residents').find((r) => r.id === id) || null;
}

export function activeResident(state) {
  return getResident(state, state.session.activeResidentId);
}

export function emergencyContacts(state) {
  return scoped(state, 'residents').filter((r) => r.isEmergencyContact && r.phone);
}

export function displayName(resident) {
  if (!resident) return '';
  return resident.preferences?.treatment || resident.nickname || resident.name.split(' ')[0];
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function validateResident(data) {
  const errors = {};
  const name = (data.name || '').trim();
  if (name.length < 2) errors.name = 'Informe o nome com pelo menos 2 letras.';
  if (name.length > 80) errors.name = 'Use no máximo 80 caracteres.';
  if (!RESIDENT_KINDS[data.kind]) errors.kind = 'Escolha um tipo de cadastro.';
  const phone = (data.phone || '').trim();
  if (phone && phone.replace(/\D/g, '').length < 8) errors.phone = 'Telefone incompleto.';
  if (data.isEmergencyContact && !phone) errors.phone = 'Contato de emergência precisa de telefone.';
  return errors;
}

function normalize(data) {
  return {
    kind: data.kind,
    name: data.name.trim(),
    nickname: (data.nickname || '').trim(),
    relation: (data.relation || '').trim(),
    phone: (data.phone || '').trim(),
    isEmergencyContact: Boolean(data.isEmergencyContact),
    color: AVATAR_COLORS.includes(data.color) ? data.color : 'teal',
    preferences: {
      treatment: (data.preferences?.treatment || '').trim(),
      notes: (data.preferences?.notes || '').trim(),
    },
    permissions: {
      manageResidents: Boolean(data.permissions?.manageResidents),
      manageReminders: Boolean(data.permissions?.manageReminders),
      viewCameras: Boolean(data.permissions?.viewCameras),
    },
  };
}

export function addResident(draft, data) {
  const errors = validateResident(data);
  if (Object.keys(errors).length) return { ok: false, errors };
  const now = new Date().toISOString();
  const resident = {
    id: uid('res'),
    householdId: draft.session.householdId,
    ...normalize(data),
    // Biometria nunca nasce ativada. Ver docs/DECISOES.md (D-006).
    consent: { faceRecognition: false, voiceRecognition: false },
    isFictitious: data.isFictitious !== false,
    createdAt: now,
    updatedAt: now,
  };
  draft.residents.push(resident);
  if (!draft.session.activeResidentId && resident.kind === 'morador') draft.session.activeResidentId = resident.id;
  audit(draft, 'resident.create', { residentId: resident.id });
  return { ok: true, resident };
}

export function updateResident(draft, id, data) {
  const resident = draft.residents.find((r) => r.id === id && r.householdId === draft.session.householdId);
  if (!resident) return { ok: false, errors: { _: 'Cadastro não encontrado.' } };
  const errors = validateResident(data);
  if (Object.keys(errors).length) return { ok: false, errors };
  Object.assign(resident, normalize(data), { updatedAt: new Date().toISOString() });
  audit(draft, 'resident.update', { residentId: id });
  return { ok: true, resident };
}

// Exclusão remove também as memórias e o histórico de identificação da
// pessoa (direito de exclusão, LGPD art. 18).
export function removeResident(draft, id) {
  const before = draft.residents.length;
  draft.residents = draft.residents.filter((r) => !(r.id === id && r.householdId === draft.session.householdId));
  if (draft.residents.length === before) return false;
  draft.memories = draft.memories.filter((m) => m.residentId !== id);
  draft.identificationLog = draft.identificationLog.filter((e) => e.residentId !== id);
  for (const r of draft.reminders) if (r.residentId === id) r.residentId = null;
  if (draft.session.activeResidentId === id) draft.session.activeResidentId = null;
  audit(draft, 'resident.delete', { residentId: id });
  return true;
}

// Identificação manual: a própria pessoa escolhe quem está falando.
export function setActiveResident(draft, id, method = 'manual') {
  if (id && !draft.residents.some((r) => r.id === id && r.householdId === draft.session.householdId)) return false;
  draft.session.activeResidentId = id;
  if (id) {
    draft.identificationLog.unshift({
      id: uid('idl'),
      householdId: draft.session.householdId,
      residentId: id,
      method,
      at: new Date().toISOString(),
    });
    if (draft.identificationLog.length > 200) draft.identificationLog.length = 200;
  }
  return true;
}

export function identificationHistory(state, residentId) {
  return scoped(state, 'identificationLog').filter((e) => !residentId || e.residentId === residentId);
}

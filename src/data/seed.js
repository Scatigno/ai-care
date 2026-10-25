// Dados fictícios para testes iniciais. Nenhum dado aqui pertence a
// pessoas reais; os telefones usam o padrão 0000 propositalmente.

import { uid } from '../core/ids.js';

function at(now, dayOffset, hours, minutes) {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

export function buildSeed(state, now = new Date()) {
  const householdId = state.session.householdId;
  state.households[0].name = 'Residência Demonstração (fictícia)';
  const created = now.toISOString();
  const base = { householdId, isFictitious: true, createdAt: created, updatedAt: created };

  const helena = {
    ...base,
    id: uid('res'),
    kind: 'morador',
    name: 'Helena Duarte',
    nickname: 'Dona Helena',
    relation: 'Moradora principal',
    phone: '',
    isEmergencyContact: false,
    color: 'teal',
    preferences: { treatment: 'Dona Helena', notes: 'Prefere conversas sem pressa.' },
    permissions: { manageResidents: true, manageReminders: true, viewCameras: false },
    consent: { faceRecognition: false, voiceRecognition: false },
  };
  const marcos = {
    ...base,
    id: uid('res'),
    kind: 'familiar',
    name: 'Marcos Duarte',
    nickname: 'Marcos',
    relation: 'Filho',
    phone: '(11) 90000-0001',
    isEmergencyContact: true,
    color: 'indigo',
    preferences: { treatment: 'Marcos', notes: '' },
    permissions: { manageResidents: true, manageReminders: true, viewCameras: true },
    consent: { faceRecognition: false, voiceRecognition: false },
  };
  const bia = {
    ...base,
    id: uid('res'),
    kind: 'visitante',
    name: 'Beatriz Lima',
    nickname: 'Bia',
    relation: 'Cuidadora (visitas às terças)',
    phone: '(11) 90000-0002',
    isEmergencyContact: true,
    color: 'amber',
    preferences: { treatment: 'Bia', notes: '' },
    permissions: { manageResidents: false, manageReminders: true, viewCameras: false },
    consent: { faceRecognition: false, voiceRecognition: false },
  };
  state.residents.push(helena, marcos, bia);
  state.session.activeResidentId = helena.id;

  const mem = (category, text) => ({ ...base, id: uid('mem'), residentId: helena.id, category, text, source: 'manual' });
  state.memories.push(
    mem('preferencias', 'Gosta de café com pouco açúcar.'),
    mem('preferencias', 'Prefere ser chamada de Dona Helena.'),
    mem('rotinas', 'Caminha no quintal por volta das 9h.'),
    mem('compromissos', 'Almoço de domingo com a família (exemplo).'),
  );

  const rem = (title, dueAt, repeat = 'none', residentId = helena.id) => ({
    ...base, id: uid('rem'), residentId, title, dueAt, repeat, done: false, lastFiredAt: null,
  });
  state.reminders.push(
    rem('Beber um copo de água', at(now, 0, 10, 0), 'daily'),
    rem('Ligar para o Marcos', at(now, 0, 18, 0)),
    rem('Regar as plantas', at(now, 1, 8, 30), 'weekly'),
  );

  for (const name of ['Leite', 'Pão de forma', 'Banana']) {
    state.shopping.push({ ...base, id: uid('shp'), name, done: false, addedBy: helena.id });
  }

  state.devices.push({
    ...base,
    id: uid('dev'),
    name: 'Câmera frontal do iPad',
    room: 'Sala',
    type: 'ipad-camera',
    address: '',
  });
}

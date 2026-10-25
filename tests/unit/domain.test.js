import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, createEmptyState, migrate, scoped } from '../../src/data/schema.js';
import { addResident, removeResident, validateResident, listResidents } from '../../src/domain/residents.js';
import { addMemory, memoriesFor } from '../../src/domain/memory.js';
import { addReminder, dueReminders, markFired, rollForwardStale } from '../../src/domain/reminders.js';
import { addDevice, listDevices } from '../../src/domain/devices.js';
import { logSosActivation } from '../../src/domain/emergency.js';
import { FEATURES } from '../../src/data/features.js';

const NOW = new Date(2026, 9, 25, 10, 0, 0);

test('dados iniciais são fictícios e sem biometria ativada', () => {
  const s = createInitialState(NOW);
  assert.ok(s.residents.length >= 3);
  for (const r of s.residents) {
    assert.equal(r.isFictitious, true);
    assert.equal(r.consent.faceRecognition, false);
    assert.equal(r.consent.voiceRecognition, false);
    if (r.phone) assert.match(r.phone, /90000-000\d/, 'telefones de exemplo usam padrão fictício');
  }
});

test('isolamento por residência: dados de outra residência não aparecem', () => {
  const s = createInitialState(NOW);
  const other = { id: 'hh_outra', tenantId: 'ten_outro', name: 'Outra casa' };
  s.households.push(other);
  s.residents.push({ ...s.residents[0], id: 'res_x', householdId: other.id, name: 'Pessoa de outra casa' });
  assert.ok(!listResidents(s).some((r) => r.id === 'res_x'));
  s.session.householdId = other.id;
  assert.deepEqual(scoped(s, 'residents').map((r) => r.id), ['res_x']);
});

test('validação de cadastro', () => {
  assert.ok(validateResident({ name: 'A', kind: 'morador' }).name);
  assert.ok(validateResident({ name: 'Ana', kind: 'xx' }).kind);
  assert.ok(validateResident({ name: 'Ana', kind: 'familiar', isEmergencyContact: true }).phone);
  assert.deepEqual(validateResident({ name: 'Ana', kind: 'familiar', phone: '(11) 90000-0003', isEmergencyContact: true }), {});
});

test('novo cadastro nunca nasce com biometria e gera auditoria', () => {
  const s = createEmptyState(NOW);
  const r = addResident(s, { name: 'Teste', kind: 'morador', consent: { faceRecognition: true } });
  assert.ok(r.ok);
  assert.equal(r.resident.consent.faceRecognition, false);
  assert.equal(s.session.activeResidentId, r.resident.id, 'primeiro morador vira o ativo');
  assert.equal(s.audit[0].action, 'resident.create');
});

test('exclusão remove memórias e histórico da pessoa', () => {
  const s = createInitialState(NOW);
  const id = s.session.activeResidentId;
  assert.ok(memoriesFor(s, id).length > 0);
  s.identificationLog.push({ id: 'x', householdId: s.session.householdId, residentId: id, method: 'manual', at: NOW.toISOString() });
  removeResident(s, id);
  assert.equal(s.memories.filter((m) => m.residentId === id).length, 0);
  assert.equal(s.identificationLog.filter((e) => e.residentId === id).length, 0);
  assert.equal(s.session.activeResidentId, null);
  assert.ok(s.reminders.every((r) => r.residentId !== id));
});

test('memória valida tamanho e categoria', () => {
  const s = createInitialState(NOW);
  const id = s.session.activeResidentId;
  assert.equal(addMemory(s, { residentId: id, category: 'inexistente', text: 'abc' }).ok, false);
  assert.equal(addMemory(s, { residentId: id, category: 'rotinas', text: 'x' }).ok, false);
  assert.equal(addMemory(s, { residentId: id, category: 'rotinas', text: 'a'.repeat(281) }).ok, false);
  assert.equal(addMemory(s, { residentId: id, category: 'rotinas', text: 'Dorme às 22h.' }).ok, true);
});

test('lembretes: vencimento, disparo único e repetição', () => {
  const s = createEmptyState(NOW);
  addReminder(s, { title: 'Uma vez', dueAt: new Date(NOW.getTime() - 60_000).toISOString() });
  addReminder(s, { title: 'Diário', dueAt: new Date(NOW.getTime() - 60_000).toISOString(), repeat: 'daily' });
  addReminder(s, { title: 'Futuro', dueAt: new Date(NOW.getTime() + 3_600_000).toISOString() });
  addReminder(s, { title: 'Antigo demais', dueAt: new Date(NOW.getTime() - 24 * 3_600_000).toISOString() });
  const due = dueReminders(s, NOW).map((r) => r.title).sort();
  assert.deepEqual(due, ['Diário', 'Uma vez']);
  for (const r of dueReminders(s, NOW)) markFired(s, r.id, NOW);
  assert.deepEqual(dueReminders(s, NOW), [], 'não dispara de novo');
  const daily = s.reminders.find((r) => r.title === 'Diário');
  assert.equal(new Date(daily.dueAt).getDate(), 26, 'diário avança para amanhã');
});

test('lembretes repetitivos antigos avançam sem disparar', () => {
  const s = createEmptyState(NOW);
  addReminder(s, { title: 'Semanal', dueAt: new Date(2026, 8, 1, 9, 0).toISOString(), repeat: 'weekly' });
  rollForwardStale(s, NOW);
  const r = s.reminders[0];
  assert.ok(new Date(r.dueAt).getTime() >= NOW.getTime() - 12 * 3_600_000);
  assert.equal(new Date(r.dueAt).getDay(), new Date(2026, 8, 1).getDay(), 'mantém o dia da semana');
});

test('SOS é registrado como não enviado', () => {
  const s = createEmptyState(NOW);
  const a = logSosActivation(s, { origin: 'botao' });
  assert.equal(a.delivered, false);
  assert.equal(a.mode, 'demonstracao');
  assert.match(a.deliveryNote, /Nenhuma notificação/);
});

test('dispositivos: validação e escopo', () => {
  const s = createEmptyState(NOW);
  assert.equal(addDevice(s, { name: '', room: 'Sala', type: 'onvif' }).ok, false);
  assert.equal(addDevice(s, { name: 'Cam', room: 'Sala', type: 'desconhecido' }).ok, false);
  assert.equal(addDevice(s, { name: 'Cam', room: 'Sala', type: 'onvif' }).ok, true);
  assert.equal(listDevices(s).length, 1);
});

test('migração completa campos ausentes e recusa lixo', () => {
  const old = createInitialState(NOW);
  delete old.settings.voice;
  delete old.devices;
  const m = migrate(old);
  assert.equal(m.settings.voice.enabled, true);
  assert.deepEqual(m.devices, []);
  assert.ok(migrate(null).residents.length > 0);
  assert.ok(migrate({ foo: 1 }).session);
});

test('registro de recursos: todo item tem status e fase válidos', () => {
  for (const f of FEATURES) {
    assert.ok(['real', 'demo', 'planned'].includes(f.status), f.id);
    assert.ok(f.phase >= 1 && f.phase <= 8, f.id);
  }
  assert.equal(FEATURES.find((f) => f.id === 'sos').status, 'demo', 'SOS não pode aparecer como funcional');
  assert.equal(FEATURES.find((f) => f.id === 'face-id').status, 'planned');
});

import { addRoutine, dueRoutines, markRoutineRun, buildRoutineMessage, validateRoutine, describeDays } from '../../src/domain/routines.js';

test('rotinas: exemplo nasce desligado e não dispara', () => {
  const s = createInitialState(NOW);
  assert.ok(s.routines.length >= 1);
  assert.ok(s.routines.every((r) => r.enabled === false));
  assert.deepEqual(dueRoutines(s, new Date(2026, 9, 25, 8, 5)), []);
});

test('rotinas: disparo no horário, uma vez por dia, dentro de 2 h', () => {
  const s = createEmptyState(NOW);
  addRoutine(s, { type: 'bom-dia', time: '08:00', days: [0, 1, 2, 3, 4, 5, 6] });
  assert.equal(dueRoutines(s, new Date(2026, 9, 25, 7, 59)).length, 0, 'antes do horário');
  assert.equal(dueRoutines(s, new Date(2026, 9, 25, 8, 1)).length, 1);
  assert.equal(dueRoutines(s, new Date(2026, 9, 25, 10, 30)).length, 0, 'passou da janela de 2 h');
  markRoutineRun(s, s.routines[0].id, new Date(2026, 9, 25, 8, 1));
  assert.equal(dueRoutines(s, new Date(2026, 9, 25, 8, 30)).length, 0, 'já rodou hoje');
  assert.equal(dueRoutines(s, new Date(2026, 9, 26, 8, 1)).length, 1, 'roda de novo amanhã');
});

test('rotinas: respeita os dias da semana', () => {
  const s = createEmptyState(NOW);
  addRoutine(s, { type: 'boa-noite', time: '21:00', days: [1, 2, 3, 4, 5] });
  assert.equal(dueRoutines(s, new Date(2026, 9, 25, 21, 5)).length, 0, 'domingo fora');
  assert.equal(dueRoutines(s, new Date(2026, 9, 26, 21, 5)).length, 1, 'segunda dentro');
  assert.equal(describeDays([1, 2, 3, 4, 5]), 'Dias úteis');
});

test('rotinas: validação', () => {
  assert.ok(validateRoutine({ type: 'bom-dia', time: '25:00', days: [1] }).time);
  assert.ok(validateRoutine({ type: 'bom-dia', time: '08:00', days: [] }).days);
  assert.ok(validateRoutine({ type: 'mensagem', time: '08:00', days: [1], message: '' }).message);
  assert.deepEqual(validateRoutine({ type: 'mensagem', time: '08:00', days: [1], message: 'Beba água' }), {});
});

test('rotinas: mensagem de bom dia resume lembretes e compras', () => {
  const s = createInitialState(new Date(2026, 9, 25, 7, 0));
  const helena = s.session.activeResidentId;
  const r = addRoutine(s, { type: 'bom-dia', time: '08:00', days: [0], residentId: helena }).routine;
  const text = buildRoutineMessage(s, r, new Date(2026, 9, 25, 8, 0));
  assert.match(text, /^Bom dia, Dona Helena! Hoje é domingo, 25 de outubro\./);
  assert.match(text, /2 lembretes hoje: beber um copo de água às 10h e ligar para o Marcos às 18h/);
  assert.match(text, /3 itens/);
  const night = addRoutine(s, { type: 'boa-noite', time: '21:00', days: [0], residentId: helena }).routine;
  assert.match(buildRoutineMessage(s, night, new Date(2026, 9, 25, 21, 0)), /Amanhã você tem um lembrete: regar as plantas às 8h30/);
});

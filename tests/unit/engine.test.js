import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../src/core/store.js';
import { createMemoryAdapter } from '../../src/core/storage.js';
import { createInitialState, migrate } from '../../src/data/schema.js';
import { respond, matchIntent, handle } from '../../src/services/conversation/engine.js';
import { pendingShopping } from '../../src/domain/shopping.js';
import { listReminders } from '../../src/domain/reminders.js';
import { memoriesFor } from '../../src/domain/memory.js';
import { activeResident } from '../../src/domain/residents.js';

// Domingo, 25/10/2026 às 10h (horário local)
const NOW = new Date(2026, 9, 25, 10, 0, 0);

function makeStore() {
  return createStore({ adapter: createMemoryAdapter(), initialState: () => createInitialState(NOW), migrate });
}

test('reconhece intenções básicas', () => {
  const cases = {
    'Oi, bom dia!': 'greeting',
    'Que horas são?': 'time',
    'que dia é hoje': 'date',
    'O que você sabe fazer?': 'help',
    'Adicione leite e pão na lista': 'shopping.add',
    'preciso comprar arroz': 'shopping.add',
    'Tire o leite da lista': 'shopping.remove',
    'o que tem na lista?': 'shopping.list',
    'Me lembre de tomar remédio às 14h': 'reminder.add',
    'quais são meus lembretes': 'reminder.list',
    'Lembre que eu gosto de chá': 'memory.add',
    'o que você sabe sobre mim?': 'memory.list',
    'Socorro!': 'emergency',
    'eu caí no chão': 'emergency',
    'Ligue para o Marcos': 'call',
    'Eu sou o Marcos': 'identify',
    'qual a capital da França': 'unknown',
  };
  for (const [text, intent] of Object.entries(cases)) {
    assert.equal(matchIntent(text), intent, text);
  }
});

test('adiciona itens à lista sem duplicar', () => {
  const store = makeStore();
  const r1 = respond(store, 'Adicione café, açúcar e leite na lista de compras', NOW);
  const names = pendingShopping(store.getState()).map((i) => i.name);
  assert.ok(names.includes('Café'));
  assert.ok(names.includes('Açúcar'));
  assert.equal(names.filter((n) => n === 'Leite').length, 1, 'leite já existia no seed');
  assert.match(r1.reply, /café e açúcar/);
  assert.match(r1.reply, /Leite já estava/);
});

test('remove item da lista', () => {
  const store = makeStore();
  const r = respond(store, 'tire banana da lista', NOW);
  assert.match(r.reply, /Tirei banana/);
  assert.ok(!pendingShopping(store.getState()).some((i) => i.name === 'Banana'));
});

test('cria lembrete com horário e título limpo', () => {
  const store = makeStore();
  const before = listReminders(store.getState()).length;
  const r = respond(store, 'Me lembre de tomar o remédio da pressão às 14h30', NOW);
  const list = listReminders(store.getState());
  assert.equal(list.length, before + 1);
  const created = list.find((x) => x.title.startsWith('Tomar'));
  assert.equal(created.title, 'Tomar o remédio da pressão');
  const due = new Date(created.dueAt);
  assert.equal(due.getHours(), 14);
  assert.equal(due.getMinutes(), 30);
  assert.equal(due.getDate(), 25);
  assert.match(r.reply, /hoje às 14h30/);
});

test('lembrete sem horário pede o horário e não cria nada', () => {
  const store = makeStore();
  const before = listReminders(store.getState()).length;
  const r = respond(store, 'me lembre de ligar para a farmácia', NOW);
  assert.equal(listReminders(store.getState()).length, before);
  assert.match(r.reply, /Para quando/);
});

test('lembrete diário', () => {
  const store = makeStore();
  respond(store, 'me lembre de caminhar todos os dias às 8h', NOW);
  const created = listReminders(store.getState()).find((x) => x.title === 'Caminhar');
  assert.ok(created, 'título sem "todos os dias"');
  assert.equal(created.repeat, 'daily');
  assert.equal(new Date(created.dueAt).getDate(), 26, '8h já passou hoje, vai para amanhã');
});

test('memória: guardar, listar e esquecer', () => {
  const store = makeStore();
  const resident = activeResident(store.getState());
  const before = memoriesFor(store.getState(), resident.id).length;
  respond(store, 'Lembre que eu gosto de chá de camomila à noite', NOW);
  const mems = memoriesFor(store.getState(), resident.id);
  assert.equal(mems.length, before + 1);
  const created = mems.find((m) => m.text.includes('camomila'));
  assert.equal(created.category, 'preferencias');
  assert.equal(created.source, 'conversa');
  const list = respond(store, 'o que você sabe sobre mim', NOW);
  assert.match(list.reply, /camomila/);
  const forget = respond(store, 'esqueça que eu gosto de chá de camomila', NOW);
  assert.match(forget.reply, /apaguei/);
  assert.equal(memoriesFor(store.getState(), resident.id).length, before);
});

test('emergência abre SOS e registra acionamento como não enviado', () => {
  const store = makeStore();
  const r = respond(store, 'socorro, eu caí', NOW);
  assert.deepEqual(r.ui, { open: 'sos' });
  assert.match(r.reply, /não consigo avisar ninguém/);
  const alert = store.getState().alerts[0];
  assert.equal(alert.delivered, false);
  assert.equal(alert.mode, 'demonstracao');
});

test('identificação manual por voz troca o morador ativo e registra histórico', () => {
  const store = makeStore();
  const r = respond(store, 'Eu sou o Marcos', NOW);
  assert.match(r.reply, /Olá, Marcos/);
  assert.equal(activeResident(store.getState()).nickname, 'Marcos');
  assert.equal(store.getState().identificationLog[0].method, 'manual-voz');
});

test('chamadas aparecem como planejadas, sem fingir que ligou', () => {
  const r = handle(makeStore().getState(), 'ligue para o Marcos', NOW);
  assert.match(r.reply, /Ainda não consigo fazer ligações/);
  assert.match(r.reply, /90000-0001/);
});

test('pergunta desconhecida recebe resposta honesta', () => {
  const r = handle(makeStore().getState(), 'Qual a previsão do tempo?', NOW);
  assert.equal(r.intent, 'unknown');
  assert.match(r.reply, /modo local/);
});

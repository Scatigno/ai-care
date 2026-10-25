import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWhen } from '../../src/services/conversation/timeparse.js';
import { fold } from '../../src/services/conversation/normalize.js';

const NOW = new Date(2026, 9, 25, 10, 0, 0); // domingo 10h

function when(text) {
  const r = parseWhen(fold(text), NOW);
  return r && r.date;
}

function hm(d) {
  return [d.getDate(), d.getHours(), d.getMinutes()];
}

test('horários absolutos', () => {
  assert.deepEqual(hm(when('às 14h')), [25, 14, 0]);
  assert.deepEqual(hm(when('as 14:30')), [25, 14, 30]);
  assert.deepEqual(hm(when('às 8h30')), [26, 8, 30], 'já passou, vai para amanhã');
  assert.deepEqual(hm(when('15 horas')), [25, 15, 0]);
  assert.deepEqual(hm(when('às duas da tarde')), [25, 14, 0]);
  assert.deepEqual(hm(when('às duas e meia da tarde')), [25, 14, 30]);
  assert.deepEqual(hm(when('ao meio-dia')), [25, 12, 0]);
  assert.deepEqual(hm(when('às 8 da noite')), [25, 20, 0]);
});

test('dias relativos', () => {
  assert.deepEqual(hm(when('amanhã às 9h')), [26, 9, 0]);
  assert.deepEqual(hm(when('depois de amanhã às 7h')), [27, 7, 0]);
  assert.deepEqual(hm(when('hoje às 18h')), [25, 18, 0]);
  assert.deepEqual(hm(when('amanhã')), [26, 9, 0], 'sem horário usa 9h');
  assert.deepEqual(hm(when('na segunda-feira às 10h')), [26, 10, 0]);
  assert.deepEqual(hm(when('no sábado às 10h')), [31, 10, 0], 'próximo sábado');
});

test('durações', () => {
  const d = when('daqui a 10 minutos');
  assert.equal(d.getTime() - NOW.getTime(), 10 * 60_000);
  const h = when('em 2 horas');
  assert.equal(h.getTime() - NOW.getTime(), 2 * 3_600_000);
  const half = when('daqui a meia hora');
  assert.equal(half.getTime() - NOW.getTime(), 30 * 60_000);
});

test('números sem marcador de hora não viram horário', () => {
  assert.equal(when('comprar 2 pacotes de arroz'), null);
});

test('fold preserva o comprimento', () => {
  const s = 'Às três e meia, açúcar e pão!';
  assert.equal(fold(s).length, s.length);
  assert.equal(fold(s), 'as tres e meia, acucar e pao!');
});

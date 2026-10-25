import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textToVisemes, buildTimeline, sampleTimeline, timeAtChar, VISEMES } from '../../src/services/lipsync.js';

const seq = (t) => textToVisemes(t).map((s) => s.v).join(' ');

test('palavras simples viram formas de boca', () => {
  assert.equal(seq('mapa'), 'PP aa PP aa');
  assert.equal(seq('bom dia'), 'PP O PP sil CH I aa');
  assert.equal(seq('leite'), 'nn E I CH I');
});

test('regras do português: ç, ch, lh, nh, qu, rr, l final, h mudo', () => {
  assert.equal(seq('maçã'), 'PP aa SS aa');
  assert.equal(seq('chá'), 'CH aa');
  assert.equal(seq('filho'), 'FF I nn I U');
  assert.equal(seq('quero'), 'kk E RR U');
  assert.equal(seq('carro'), 'kk aa kk U');
  assert.equal(seq('Brasil'), 'PP RR aa SS I U');
  assert.equal(seq('hoje'), 'O CH I');
});

test('pontuação vira pausa e só usa visemas conhecidos', () => {
  const segs = textToVisemes('Oi, Helena! Tudo bem? São 14h30.');
  assert.ok(segs.some((s) => s.v === 'sil'));
  assert.ok(segs.every((s) => VISEMES.includes(s.v)));
  assert.notEqual(segs.at(-1).v, 'sil', 'não termina em pausa');
});

test('índices apontam para o texto original', () => {
  const text = 'Ótimo, até já';
  for (const s of textToVisemes(text)) assert.ok(s.ci >= 0 && s.ci < text.length);
  const tl = buildTimeline(text);
  assert.ok(timeAtChar(tl, text.indexOf('até')) > 0);
});

test('fala mais rápida encurta a linha do tempo', () => {
  const slow = buildTimeline('Vou lembrar você às três da tarde.', { rate: 0.8 });
  const fast = buildTimeline('Vou lembrar você às três da tarde.', { rate: 1.5 });
  assert.ok(fast.duration < slow.duration);
  assert.ok(slow.duration > 1000 && slow.duration < 6000, `duração plausível: ${slow.duration}`);
});

test('amostra mistura no máximo dois visemas e fecha fora do tempo', () => {
  const tl = buildTimeline('Olá, tudo bem?');
  assert.deepEqual(sampleTimeline(tl, -5), {});
  assert.deepEqual(sampleTimeline(tl, tl.duration + 1), {});
  for (let t = 0; t < tl.duration; t += 17) {
    const w = sampleTimeline(tl, t);
    assert.ok(Object.keys(w).length <= 2);
    for (const v of Object.values(w)) assert.ok(v > 0 && v <= 1);
  }
});

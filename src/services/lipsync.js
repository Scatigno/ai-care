// Sincronização labial aproximada a partir do texto falado (português do
// Brasil). A voz do navegador não entrega o áudio nem os fonemas, então o
// texto é convertido em uma sequência de visemas (formatos de boca) com
// duração estimada pela velocidade da fala. Quando o navegador avisa o
// início de cada palavra (evento "boundary"), a linha do tempo é
// reajustada para não se adiantar nem se atrasar.
//
// Visemas no padrão usado pelos avatares (Oculus/Meta, 15 formas):
// sil PP FF TH DD kk CH SS nn RR aa E I O U

import { fold } from './conversation/normalize.js';

export const VISEMES = ['sil', 'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR', 'aa', 'E', 'I', 'O', 'U'];

// Intensidade de cada forma (1 = forma completa).
export const VISEME_WEIGHT = {
  sil: 0, PP: 1, FF: 0.9, TH: 0.7, DD: 0.65, kk: 0.6, CH: 0.85, SS: 0.7, nn: 0.6, RR: 0.6,
  aa: 0.85, E: 0.8, I: 0.75, O: 0.9, U: 0.85,
};

// Duração base (ms) em velocidade 1.
const MS = { vowel: 95, consonant: 62, space: 25, comma: 210, stop: 380 };

const VOWEL = { a: 'aa', e: 'E', i: 'I', o: 'O', u: 'U' };
const SIMPLE = {
  p: 'PP', b: 'PP', m: 'PP', f: 'FF', v: 'FF', t: 'DD', d: 'DD', k: 'kk', q: 'kk',
  s: 'SS', z: 'SS', j: 'CH', x: 'CH', r: 'RR', l: 'nn', n: 'nn', w: 'U', y: 'I',
};
const DIGIT_SHAPES = ['DD', 'E', 'SS', 'I']; // aproximação genérica para números

const isVowel = (c) => c in VOWEL;
const isLetter = (c) => /[a-z]/.test(c);

// Converte o texto em segmentos { v, ci, ms }: visema, índice do caractere
// de origem e duração em velocidade 1.
export function textToVisemes(text) {
  const src = String(text || '');
  // "ç" vira "s" antes de tirar os acentos (mesmo comprimento).
  const f = fold(src.replace(/ç/g, 's').replace(/Ç/g, 'S'));
  const out = [];
  const push = (v, ci, ms) => {
    const last = out[out.length - 1];
    // Duas formas iguais seguidas viram uma só, mais longa.
    if (last && last.v === v && v !== 'sil') { last.ms += ms * 0.6; return; }
    out.push({ v, ci, ms });
  };

  for (let i = 0; i < f.length; i++) {
    const c = f[i];
    const next = f[i + 1] || '';
    const after = f[i + 2] || '';
    const prev = f[i - 1] || '';
    const wordEnd = !isLetter(next);

    if (/[0-9]/.test(c)) {
      DIGIT_SHAPES.forEach((v, k) => push(v, i, k % 2 ? MS.vowel : MS.consonant));
      continue;
    }
    if (!isLetter(c)) {
      if (/[.!?;:…]/.test(c)) push('sil', i, MS.stop);
      else if (/[,()\-–—]/.test(c)) push('sil', i, MS.comma);
      else if (/\s/.test(c) && out.length && out[out.length - 1].v !== 'sil') push('sil', i, MS.space);
      continue;
    }
    if (isVowel(c)) {
      let v = VOWEL[c];
      // Final átono: "leite" → "leiti", "carro" → "carru".
      if (wordEnd && c === 'e' && isLetter(prev)) v = 'I';
      if (wordEnd && c === 'o' && isLetter(prev)) v = 'U';
      push(v, i, MS.vowel);
      continue;
    }
    // Dígrafos
    if (c === 'c' && next === 'h') { push('CH', i, MS.consonant); i++; continue; }
    if (c === 'l' && next === 'h') { push('nn', i, MS.consonant); push('I', i, MS.consonant * 0.6); i++; continue; }
    if (c === 'n' && next === 'h') { push('nn', i, MS.consonant); push('I', i, MS.consonant * 0.5); i++; continue; }
    if (c === 'q' && next === 'u' && (after === 'e' || after === 'i')) { push('kk', i, MS.consonant); i++; continue; }
    if (c === 'g' && next === 'u' && (after === 'e' || after === 'i')) { push('kk', i, MS.consonant); i++; continue; }
    if ((c === 's' || c === 'r') && next === c) { push(c === 's' ? 'SS' : 'kk', i, MS.consonant); i++; continue; }
    if (c === 'h') continue; // "h" mudo
    if (c === 'c') { push(next === 'e' || next === 'i' ? 'SS' : 'kk', i, MS.consonant); continue; }
    if (c === 'g') { push(next === 'e' || next === 'i' ? 'CH' : 'kk', i, MS.consonant); continue; }
    // "tia", "dia" soam "tchia", "djia"
    if ((c === 't' || c === 'd') && (next === 'i' || (next === 'e' && !isLetter(after)))) { push('CH', i, MS.consonant); continue; }
    // "l" no fim da sílaba soa "u": "Brasil", "alto"
    if (c === 'l' && (wordEnd || (!isVowel(next) && next !== 'h'))) { push('U', i, MS.consonant); continue; }
    // "m"/"n" nasalizando a vogal anterior: boca quase não muda
    if ((c === 'm' || c === 'n') && isVowel(prev) && (wordEnd || !isVowel(next))) {
      if (c === 'm' && wordEnd) push('PP', i, MS.consonant * 0.5);
      continue;
    }
    // "r" no começo da palavra soa gutural
    if (c === 'r' && !isLetter(prev)) { push('kk', i, MS.consonant); continue; }
    if (SIMPLE[c]) push(SIMPLE[c], i, MS.consonant);
  }
  while (out.length && out[out.length - 1].v === 'sil') out.pop();
  return out;
}

// Linha do tempo com início e fim de cada segmento, em ms, para a
// velocidade de fala dada.
export function buildTimeline(text, { rate = 1 } = {}) {
  const r = Math.max(0.3, Math.min(3, rate || 1));
  let t = 0;
  const segments = textToVisemes(text).map((s) => {
    const seg = { v: s.v, ci: s.ci, t0: t, t1: t + s.ms / r };
    t = seg.t1;
    return seg;
  });
  return { segments, duration: t };
}

// Forma da boca no instante t (ms): pesos de até dois visemas, com
// transição suave entre um segmento e o seguinte.
export function sampleTimeline(timeline, t) {
  const segs = timeline.segments;
  if (!segs.length || t < 0 || t >= timeline.duration) return {};
  let lo = 0;
  let hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segs[mid].t0 <= t) lo = mid; else hi = mid - 1;
  }
  const s = segs[lo];
  const n = segs[lo + 1];
  const k = (t - s.t0) / Math.max(1, s.t1 - s.t0);
  const out = {};
  const add = (v, w) => { if (v !== 'sil' && w > 0.01) out[v] = Math.max(out[v] || 0, w * VISEME_WEIGHT[v]); };
  // Nos últimos 35% do segmento, já começa a formar o próximo.
  const blend = k > 0.65 && n ? (k - 0.65) / 0.35 : 0;
  add(s.v, 1 - blend * 0.6);
  if (n) add(n.v, blend);
  return out;
}

// Instante da linha do tempo em que começa a palavra no caractere ci.
export function timeAtChar(timeline, ci) {
  const seg = timeline.segments.find((s) => s.ci >= ci && s.v !== 'sil');
  return seg ? seg.t0 : timeline.duration;
}

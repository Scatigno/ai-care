import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceLoop, matchWakeWord, isStopPhrase } from '../../src/services/voiceLoop.js';

// Reconhecimento de fala falso: cada listen() fica "aberto" até o teste
// dizer o que a pessoa falou (say), ficar em silêncio (silence) ou o
// loop parar.
function fakeSpeech() {
  const sessions = [];
  return {
    sessions,
    get current() { return sessions.filter((s) => !s.closed).at(-1); },
    listen(opts) {
      const s = { opts, closed: false };
      s.close = () => { if (!s.closed) { s.closed = true; opts.onEnd?.(); } };
      sessions.push(s);
      opts.onStart?.();
      return { stop: () => s.close() };
    },
    stopListening() {},
  };
}

function say(speech, text) {
  const s = speech.current;
  if (s.opts.continuous) s.opts.onResult(text);
  else { s.opts.onFinal(text); s.close(); }
}

function silence(speech) {
  speech.current.opts.onError?.('no-speech', '');
  speech.current.close();
}

function setup(extra = {}) {
  const speech = fakeSpeech();
  const heard = [];
  const errors = [];
  let timers = [];
  const loop = createVoiceLoop({
    speech,
    onUtterance: (t, info) => heard.push({ t, ...info }),
    onError: (code) => errors.push(code),
    schedule: (fn) => { timers.push(fn); return timers.length; },
    cancel: () => {},
    ...extra,
  });
  const flush = () => { const t = timers; timers = []; t.forEach((fn) => fn()); };
  return { speech, loop, heard, errors, flush };
}

test('nome da assistente no começo da frase', () => {
  assert.deepEqual(matchWakeWord('Clara, que horas são?', 'Clara'), { matched: true, rest: 'que horas são?' });
  assert.deepEqual(matchWakeWord('oi clara', 'Clara'), { matched: true, rest: '' });
  assert.deepEqual(matchWakeWord('Bom dia, Rafael! Me lembre de ligar', 'Rafael'), { matched: true, rest: 'Me lembre de ligar' });
  assert.equal(matchWakeWord('a clara do ovo', 'Clara').matched, false, 'nome no meio da frase não conta');
  assert.equal(matchWakeWord('Clarice veio aqui', 'Clara').matched, false);
});

test('frases de despedida', () => {
  assert.ok(isStopPhrase('Pode parar'));
  assert.ok(isStopPhrase('obrigado, é só isso'));
  assert.ok(isStopPhrase('Tchau!'));
  assert.ok(!isStopPhrase('adicione pão na lista'));
});

test('modo conversa: ouve, espera a resposta e volta a ouvir', () => {
  const { speech, loop, heard, flush } = setup();
  loop.startConversation();
  assert.equal(loop.phase, 'listening');
  say(speech, 'que horas são');
  assert.equal(heard[0].t, 'que horas são');
  assert.equal(loop.phase, 'waiting');
  flush();
  assert.equal(speech.sessions.filter((s) => !s.closed).length, 0, 'não ouve enquanto a resposta não termina');
  loop.replyFinished();
  flush();
  assert.equal(loop.phase, 'listening', 'voltou a ouvir sozinho');
  say(speech, 'adicione leite na lista');
  assert.equal(heard.length, 2);
});

test('modo conversa: encerra após silêncio', () => {
  const { speech, loop, flush } = setup({ maxSilentTurns: 2 });
  loop.startConversation();
  silence(speech);
  flush();
  assert.equal(loop.mode, 'conversation');
  silence(speech);
  flush();
  assert.equal(loop.mode, 'off');
  assert.equal(speech.sessions.filter((s) => !s.closed).length, 0);
});

test('modo conversa: despedida encerra depois da resposta', () => {
  const { speech, loop, heard, flush } = setup();
  loop.startConversation();
  say(speech, 'tchau');
  assert.equal(heard.length, 1);
  assert.equal(loop.mode, 'off');
  loop.replyFinished();
  flush();
  assert.equal(speech.sessions.filter((s) => !s.closed).length, 0);
});

test('uma frase só (modo conversa desligado)', () => {
  const { speech, loop, flush } = setup();
  loop.startConversation({ single: true });
  say(speech, 'que dia é hoje');
  loop.replyFinished();
  flush();
  assert.equal(loop.mode, 'off');
});

test('pausa enquanto a assistente fala por outro motivo', () => {
  const { speech, loop, flush } = setup();
  loop.startConversation();
  loop.pause();
  assert.equal(speech.sessions.filter((s) => !s.closed).length, 0);
  flush();
  assert.equal(speech.sessions.filter((s) => !s.closed).length, 0);
  loop.resume();
  flush();
  assert.equal(loop.phase, 'listening');
});

test('escuta pelo nome: ignora conversa alheia, acorda com o nome e volta a aguardar', () => {
  const { speech, loop, heard, flush } = setup();
  loop.startWakeWord('Clara');
  assert.equal(speech.current.opts.continuous, true);
  say(speech, 'vamos almoçar daqui a pouco');
  assert.equal(heard.length, 0, 'frases sem o nome não são entregues');
  say(speech, 'Clara, me lembre de tomar água às 15h');
  assert.deepEqual(heard[0], { t: 'me lembre de tomar água às 15h', wakeOnly: false });
  assert.equal(loop.mode, 'conversation');
  loop.replyFinished();
  flush();
  assert.ok(!speech.current.opts.continuous, 'em conversa, ouve frase a frase');
  silence(speech); flush();
  silence(speech); flush();
  assert.equal(loop.mode, 'wakeword', 'depois do silêncio volta a aguardar o nome');
  assert.equal(speech.current.opts.continuous, true);
});

test('escuta pelo nome: só o nome pede resposta curta', () => {
  const { speech, loop, heard } = setup();
  loop.startWakeWord('Rafael');
  say(speech, 'Oi Rafael');
  assert.deepEqual(heard[0], { t: '', wakeOnly: true });
});

test('escuta pelo nome reinicia quando o navegador encerra', () => {
  const { speech, loop, flush } = setup();
  loop.startWakeWord('Clara');
  speech.current.close();
  flush();
  assert.equal(speech.sessions.length, 2);
  assert.equal(loop.phase, 'listening');
});

test('permissão negada desliga tudo e avisa', () => {
  const { speech, loop, errors, flush } = setup();
  loop.startWakeWord('Clara');
  const s = speech.current;
  s.opts.onError('not-allowed', 'negado');
  s.close();
  flush();
  assert.deepEqual(errors, ['not-allowed']);
  assert.equal(loop.mode, 'off');
  assert.equal(speech.sessions.length, 1, 'não tenta de novo');
});

test('parar fecha o microfone', () => {
  const { speech, loop } = setup();
  loop.startConversation();
  loop.stop();
  assert.equal(loop.mode, 'off');
  assert.equal(speech.sessions.filter((s) => !s.closed).length, 0);
});

test('resposta instantânea (antes de a escuta fechar) também volta a ouvir', () => {
  const { speech, loop, flush } = setup({
    onUtterance: () => loop.replyFinished(),
  });
  loop.startConversation();
  const s = speech.current;
  s.opts.onFinal('que horas são');
  s.close();
  flush();
  assert.equal(loop.phase, 'listening');
});

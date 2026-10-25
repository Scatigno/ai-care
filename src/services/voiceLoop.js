// Conversa por voz sem precisar tocar a cada frase.
//
// Modos:
//   off           microfone desligado
//   conversation  ouve, entrega a frase, espera a resposta terminar e volta
//                 a ouvir; encerra após silêncio ou frase de despedida
//   wakeword      escuta contínua aguardando o nome da assistente; ao ouvir
//                 o nome, entra em conversa e depois volta a aguardar
//
// O microfone nunca fica aberto enquanto a assistente fala (evita que ela
// ouça a própria voz). Toda a escuta passa por speech.listen(), que usa o
// reconhecimento do navegador.

import { fold } from './conversation/normalize.js';

const STOP_RE = /\b(pode parar|parar de ouvir|para de ouvir|chega por hoje|tchau|ate logo|ate mais|e so isso|era so isso|so isso obrigad[oa])\b/;
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'unsupported', 'insecure', 'audio-capture', 'start-failed']);
const GREETING = '(?:oi|ola|ei|hey|e ai|bom dia|boa tarde|boa noite)?[\\s,]*';

export function isStopPhrase(text) {
  return STOP_RE.test(fold(text));
}

// Procura o nome da assistente no começo da frase ("Clara, que horas são?",
// "Oi Clara"). Devolve o resto da frase, sem o nome.
export function matchWakeWord(text, name) {
  const n = fold(name || '').trim();
  if (n.length < 2) return { matched: false, rest: '' };
  const f = fold(text);
  const re = new RegExp(`^\\s*${GREETING}${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[\\s,.!?:;-]*`);
  const m = f.match(re);
  if (!m) return { matched: false, rest: '' };
  return { matched: true, rest: text.slice(m[0].length).trim() };
}

export function createVoiceLoop({
  speech,
  onUtterance, // (text, { wakeOnly }) => void
  onStateChange = () => {},
  onInterim = () => {},
  onError = () => {},
  schedule = (fn, ms) => setTimeout(fn, ms),
  cancel = (t) => clearTimeout(t),
  maxSilentTurns = 2,
} = {}) {
  let mode = 'off';
  let base = 'off'; // modo para onde volta quando a conversa termina
  let phase = 'idle'; // idle | listening | waiting
  let wakeName = '';
  let singleTurn = false;
  let listener = null;
  let timer = null;
  let silent = 0;
  let paused = false;
  let quickEnds = 0;

  function emit() {
    onStateChange({ mode, phase });
  }

  function clearTimer() {
    if (timer) cancel(timer);
    timer = null;
  }

  function stopListener() {
    const l = listener;
    listener = null;
    l?.stop();
  }

  function queue(ms = 300) {
    clearTimer();
    if (mode === 'off' || paused || listener || phase === 'waiting') return;
    timer = schedule(() => { timer = null; listen(); }, ms);
  }

  function endConversation() {
    mode = base;
    silent = 0;
    phase = 'idle';
    emit();
    if (mode === 'wakeword') queue(400);
  }

  function listen() {
    if (mode === 'off' || paused || listener || phase === 'waiting') return;
    if (mode === 'conversation') listenConversation();
    else listenWakeWord();
  }

  function fatal(code, message) {
    if (!FATAL.has(code)) return false;
    onError(code, message);
    stop();
    return true;
  }

  function listenConversation() {
    let heard = false;
    let failed = false;
    let ended = false;
    const handle = speech.listen({
      onStart: () => { phase = 'listening'; emit(); },
      onInterim,
      onFinal: (text) => {
        heard = true;
        silent = 0;
        const ending = singleTurn || isStopPhrase(text);
        phase = 'waiting';
        if (ending) mode = base;
        emit();
        onUtterance(text, { wakeOnly: false });
      },
      onError: (code, message) => { if (fatal(code, message)) failed = true; else if (code !== 'no-speech' && code !== 'aborted' && message) onError(code, message); },
      onEnd: () => {
        ended = true;
        if (listener === handle) listener = null;
        if (failed || mode === 'off') return;
        // Resposta já terminou antes do fim da escuta: volta a ouvir agora.
        if (heard) { if (phase !== 'waiting') queue(350); return; }
        if (phase === 'listening') phase = 'idle';
        silent += 1;
        if (singleTurn || silent >= maxSilentTurns) endConversation();
        else { emit(); queue(250); }
      },
    });
    if (!ended) listener = handle;
  }

  function listenWakeWord() {
    let woke = null;
    let failed = false;
    let ended = false;
    const startedAt = Date.now();
    const handle = speech.listen({
      continuous: true,
      onStart: () => { phase = 'listening'; emit(); },
      onResult: (chunk) => {
        if (woke !== null) return;
        const m = matchWakeWord(chunk, wakeName);
        if (m.matched) {
          woke = m.rest;
          stopListener();
        }
      },
      onError: (code, message) => { if (fatal(code, message)) failed = true; },
      onEnd: () => {
        ended = true;
        if (listener === handle) listener = null;
        if (failed || mode === 'off') return;
        if (woke !== null) {
          mode = 'conversation';
          silent = 0;
          phase = 'waiting';
          emit();
          onUtterance(woke, { wakeOnly: !woke });
          return;
        }
        phase = 'idle';
        // O Safari encerra a escuta contínua de tempos em tempos; reinicia.
        quickEnds = Date.now() - startedAt < 1500 ? quickEnds + 1 : 0;
        emit();
        queue(quickEnds > 4 ? 3000 : 300);
      },
    });
    if (!ended) listener = handle;
  }

  function startConversation({ single = false } = {}) {
    clearTimer();
    stopListener();
    singleTurn = single;
    if (mode !== 'wakeword') base = 'off';
    mode = 'conversation';
    phase = 'idle';
    silent = 0;
    paused = false;
    emit();
    listen();
  }

  function startWakeWord(name) {
    clearTimer();
    stopListener();
    wakeName = name;
    singleTurn = false;
    base = 'wakeword';
    mode = 'wakeword';
    phase = 'idle';
    paused = false;
    emit();
    listen();
  }

  function stop() {
    clearTimer();
    mode = 'off';
    base = 'off';
    phase = 'idle';
    stopListener();
    speech.stopListening?.();
    emit();
  }

  // Volta ao modo base (sai da conversa, mantém a escuta pelo nome).
  function leaveConversation() {
    clearTimer();
    stopListener();
    endConversation();
  }

  // Chamado quando a resposta terminou (falada ou não).
  function replyFinished() {
    if (phase === 'waiting') phase = 'idle';
    emit();
    queue(350);
  }

  // Assistente começou a falar por outro motivo (ex.: lembrete): fecha o microfone.
  function pause() {
    paused = true;
    clearTimer();
    if (listener) {
      stopListener();
      if (phase === 'listening') phase = 'idle';
      emit();
    }
  }

  function resume() {
    paused = false;
    queue(350);
  }

  return {
    get mode() { return mode; },
    get phase() { return phase; },
    get base() { return base; },
    startConversation,
    startWakeWord,
    leaveConversation,
    stop,
    replyFinished,
    pause,
    resume,
  };
}

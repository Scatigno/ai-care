// Voz: reconhecimento (microfone) e síntese (fala da assistente), usando
// as APIs do próprio navegador. No Safari, o reconhecimento de fala é
// processado pelo serviço da Apple; a síntese usa as vozes do aparelho.

const FEMALE_HINTS = ['luciana', 'francisca', 'maria', 'fernanda', 'helena', 'joana', 'raquel', 'vitoria', 'thalita', 'google portugues do brasil', 'female', 'feminina'];
const MALE_HINTS = ['felipe', 'antonio', 'daniel', 'ricardo', 'humberto', 'donato', 'fabio', 'julio', 'male', 'masculin'];

function fold(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export const RECOGNITION_ERRORS = {
  'not-allowed': 'O acesso ao microfone foi negado. Libere o microfone nos ajustes do Safari para este site.',
  'service-not-allowed': 'O reconhecimento de fala não está liberado neste aparelho. No iPad, verifique se o Ditado está ativado em Ajustes > Geral > Teclado.',
  'audio-capture': 'Nenhum microfone foi encontrado.',
  'no-speech': 'Não ouvi nada. Toque no microfone e fale de novo.',
  network: 'O reconhecimento de fala precisa de internet e não conseguiu se conectar.',
  aborted: '',
  unsupported: 'Este navegador não oferece reconhecimento de fala. Use o campo de texto.',
  insecure: 'O microfone só funciona quando o app é aberto por um endereço seguro (https).',
};

export function createSpeech() {
  const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  const synth = globalThis.speechSynthesis;
  let voices = [];
  let currentRecognition = null;
  let micClosedAt = 0; // quando a última escuta terminou
  let unlocked = false;

  function loadVoices() {
    try { voices = synth ? synth.getVoices() : []; } catch { voices = []; }
  }
  if (synth) {
    loadVoices();
    try { synth.addEventListener?.('voiceschanged', loadVoices); } catch { /* Safari antigo */ }
  }

  function ptVoices() {
    return voices.filter((v) => /^pt(-|_)?br/i.test(v.lang)).concat(voices.filter((v) => /^pt/i.test(v.lang) && !/br/i.test(v.lang)));
  }

  function pickVoice(gender) {
    const list = ptVoices();
    if (!list.length) return null;
    const hints = gender === 'male' ? MALE_HINTS : FEMALE_HINTS;
    const other = gender === 'male' ? FEMALE_HINTS : MALE_HINTS;
    return list.find((v) => hints.some((h) => fold(v.name).includes(h)))
      || list.find((v) => !other.some((h) => fold(v.name).includes(h)))
      || list[0];
  }

  function recognitionAvailability() {
    if (!Recognition) return { ok: false, reason: 'unsupported' };
    if (globalThis.isSecureContext === false) return { ok: false, reason: 'insecure' };
    return { ok: true };
  }

  function listen({ onInterim, onFinal, onResult, onStart, onEnd, onError, continuous = false } = {}) {
    const availability = recognitionAvailability();
    if (!availability.ok) {
      onError?.(availability.reason, RECOGNITION_ERRORS[availability.reason]);
      onEnd?.();
      return { stop() {} };
    }
    stopSpeaking();
    const rec = new Recognition();
    currentRecognition = rec;
    rec.lang = 'pt-BR';
    rec.interimResults = true;
    rec.continuous = continuous;
    rec.maxAlternatives = 1;
    let finalText = '';
    rec.onstart = () => onStart?.();
    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          finalText += r[0].transcript;
          onResult?.(r[0].transcript.trim());
        } else interim += r[0].transcript;
      }
      onInterim?.((finalText + ' ' + interim).trim());
    };
    rec.onerror = (event) => {
      const code = event.error || 'unknown';
      onError?.(code, RECOGNITION_ERRORS[code] ?? 'Não foi possível usar o microfone agora.');
    };
    rec.onend = () => {
      currentRecognition = null;
      micClosedAt = Date.now();
      if (finalText.trim()) onFinal?.(finalText.trim());
      onEnd?.();
    };
    try {
      rec.start();
    } catch (err) {
      currentRecognition = null;
      onError?.('start-failed', 'Não foi possível iniciar o microfone.');
      onEnd?.();
    }
    return { stop: () => { try { rec.stop(); } catch { /* já parado */ } } };
  }

  function stopListening() {
    try { currentRecognition?.abort(); } catch { /* ignorado */ }
    currentRecognition = null;
  }

  // Fala o texto. onEnd é chamado também por tempo estimado, porque o
  // Safari às vezes não dispara o evento "end".
  function speak(text, { gender = 'female', rate = 1, onStart, onEnd, onBoundary } = {}) {
    if (!synth || !globalThis.SpeechSynthesisUtterance || !text) {
      onEnd?.();
      return false;
    }
    const cancelled = stopSpeaking();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'pt-BR';
    utter.rate = rate;
    utter.pitch = gender === 'male' ? 0.95 : 1.05;
    const voice = pickVoice(gender);
    if (voice) utter.voice = voice;
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      onEnd?.();
    };
    const estimate = Math.min(60_000, 1500 + (text.length / 13) * (1000 / rate));
    const timer = setTimeout(finish, estimate + 2500);
    let started = false;
    utter.onstart = () => { started = true; onStart?.(); };
    // Início de cada palavra (quando o navegador informa): usado pela boca do avatar.
    utter.onboundary = (e) => { if (e.name !== 'sentence') onBoundary?.(e.charIndex); };
    utter.onend = finish;
    utter.onerror = (e) => { if (e?.error === 'interrupted' && !started) return; finish(); };
    const go = (retry) => {
      if (ended) return;
      try {
        synth.speak(utter);
      } catch {
        finish();
        return;
      }
      // No iPad a fala às vezes não começa (sessão de áudio ainda presa ao
      // microfone). Se não começar, tenta de novo uma vez.
      if (retry) {
        setTimeout(() => {
          if (started || ended) return;
          try { synth.cancel(); } catch { /* ignorado */ }
          setTimeout(() => go(false), 120);
        }, 1800);
      }
    };
    // Logo depois do microfone fechar (ou de cancelar outra fala), o Safari
    // do iPad pode engolir a fala: espera um instante antes de falar.
    const sinceMic = Date.now() - micClosedAt;
    const wait = currentRecognition ? 450 : Math.max(cancelled ? 120 : 0, sinceMic < 450 ? 450 - sinceMic : 0);
    if (currentRecognition) stopListening();
    if (wait) setTimeout(() => go(true), wait);
    else go(true);
    return true;
  }

  function stopSpeaking() {
    try {
      if (synth?.speaking || synth?.pending) { synth.cancel(); return true; }
    } catch { /* ignorado */ }
    return false;
  }

  // No iPad, a voz só funciona depois de um toque na tela: no primeiro
  // toque, fala um texto vazio para liberar a síntese para o resto da sessão.
  function unlock() {
    if (unlocked || !synth || !globalThis.SpeechSynthesisUtterance) return;
    unlocked = true;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      u.lang = 'pt-BR';
      synth.speak(u);
    } catch { /* ignorado */ }
  }

  return {
    get supportsSynthesis() { return Boolean(synth && globalThis.SpeechSynthesisUtterance); },
    recognitionAvailability,
    hasPortugueseVoice: () => { loadVoices(); return ptVoices().length > 0; },
    voiceName: (gender) => { loadVoices(); return pickVoice(gender)?.name || null; },
    listen,
    stopListening,
    speak,
    stopSpeaking,
    unlock,
  };
}

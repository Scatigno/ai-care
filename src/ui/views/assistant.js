// Tela principal: avatar, microfone e conversa.

import { h, clear, icon } from '../../core/dom.js';
import { createAvatar } from '../components/avatar.js';
import { statusTag } from '../components/common.js';
import { respond, ENGINE_EXAMPLES } from '../../services/conversation/engine.js';
import { askClaude, claudeRuntimePresent } from '../../services/conversation/claudeProvider.js';
import { activeResident, displayName } from '../../domain/residents.js';
import { memoriesFor } from '../../domain/memory.js';
import { upcomingReminders } from '../../domain/reminders.js';
import { pendingShopping } from '../../domain/shopping.js';
import { formatDateLong, formatWhen, greetingFor } from '../../core/format.js';
import { ASSISTANT_DEFAULT_NAMES } from '../../data/schema.js';
import { createVoiceLoop } from '../../services/voiceLoop.js';

// A conversa fica só na memória da página (não é salva). Ver D-007.
const transcript = [];
const MAX_MESSAGES = 60;

let refs = null;

function assistantInfo(state) {
  const gender = state.settings.assistant.gender || 'female';
  const name = state.settings.assistant.name || ASSISTANT_DEFAULT_NAMES[gender];
  return { gender, name };
}

const STATUS_TEXT = {
  idle: 'Pronta para conversar',
  listening: 'Ouvindo…',
  thinking: 'Pensando…',
  speaking: 'Falando…',
};

export function render(ctx) {
  const { store, speech, ui } = ctx;
  const state = store.getState();
  const info = assistantInfo(state);
  const avatar = createAvatar({ gender: info.gender, size: 'lg' });
  let mode = 'idle';
  let busy = false;
  let pausedBySpeech = false;
  let wakeKey = '';

  const nameEl = h('h2', { class: 'stage-name' }, info.name);
  const statusEl = h('p', { class: 'stage-status', 'aria-live': 'polite' });
  const micLabel = h('span', { class: 'mic-label' }, 'Toque para falar');
  const micBtn = h('button', { type: 'button', class: 'mic-btn', 'aria-pressed': 'false', onclick: toggleMic }, icon('mic', { size: 40 }));
  const stopVoiceBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', hidden: true, onclick: () => { speech.stopSpeaking(); setMode('idle'); ui.set({ speaking: false }); loop.replyFinished(); } }, icon('stop'), h('span', {}, 'Parar a fala'));
  const micOffBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', hidden: true, onclick: () => loop.stop() }, icon('x'), h('span', {}, 'Desligar microfone'));

  const loop = createVoiceLoop({
    speech,
    onUtterance: (text, { wakeOnly }) => {
      input.value = '';
      if (wakeOnly) reply('Oi! Estou ouvindo.');
      else send(text);
    },
    onInterim: (t) => { input.value = t; },
    onStateChange: () => renderMic(),
    onError: (code, message) => { if (message) ctx.toast(message, { kind: 'warn', timeout: 6500 }); },
  });

  const log = h('ol', { class: 'chat-log', 'aria-live': 'polite', 'aria-label': 'Mensagens da conversa' });
  const input = h('input', { id: 'chat-input', class: 'chat-input', type: 'text', name: 'mensagem', autocomplete: 'off', enterkeyhint: 'send', placeholder: 'Escreva aqui ou toque no microfone', 'aria-label': 'Mensagem para a assistente' });
  const form = h('form', { class: 'composer', onsubmit: (e) => { e.preventDefault(); send(input.value); } },
    input,
    h('button', { type: 'submit', class: 'btn btn-primary composer-send', 'aria-label': 'Enviar' }, icon('send'), h('span', { class: 'composer-send-text' }, 'Enviar')));
  const chips = h('div', { class: 'chips', role: 'list', 'aria-label': 'Sugestões' },
    ENGINE_EXAMPLES.map((text) => h('button', { type: 'button', class: 'chip', role: 'listitem', onclick: () => send(text) }, text)));
  const providerTag = h('span', { class: 'provider-tag' });
  const today = h('div', { class: 'today' });

  const view = h('section', { class: 'assistant' },
    h('div', { class: 'stage-col' },
      h('div', { class: 'stage-card' },
        avatar.el,
        h('div', { class: 'stage-caption' },
          nameEl,
          statusEl,
          h('p', { class: 'stage-note' }, statusTag('demo', 'Avatar ilustrado provisório'))),
        h('div', { class: 'mic-wrap' }, micBtn, micLabel, stopVoiceBtn, micOffBtn)),
      today),
    h('div', { class: 'chat-col' },
      h('div', { class: 'chat-head' }, h('h2', { class: 'chat-title' }, 'Conversa'), providerTag),
      log,
      chips,
      form,
      h('p', { class: 'chat-footnote' }, 'A conversa não é salva. Fica só na tela até você fechar o app.')));

  function setMode(next) {
    mode = next;
    avatar.setState(next === 'thinking' ? 'idle' : next);
    const male = assistantInfo(store.getState()).gender === 'male';
    statusEl.textContent = next === 'idle' && male ? 'Pronto para conversar' : STATUS_TEXT[next];
    view.dataset.mode = next;
    stopVoiceBtn.hidden = next !== 'speaking';
    if (next === 'idle' && loop.mode === 'wakeword') statusEl.textContent = `Aguardando você dizer "${assistantInfo(store.getState()).name}"`;
  }

  // Botão do microfone e indicador conforme o estado da escuta.
  function renderMic() {
    const { mode: lm, phase } = loop;
    const st = store.getState();
    const name = assistantInfo(st).name;
    ui.set({ listening: phase === 'listening' });
    const conversing = lm === 'conversation';
    micBtn.classList.toggle('is-listening', conversing && phase === 'listening');
    micBtn.classList.toggle('is-session', conversing);
    micBtn.classList.toggle('is-waiting-name', lm === 'wakeword');
    micBtn.setAttribute('aria-pressed', String(conversing));
    micBtn.setAttribute('aria-label', conversing ? 'Encerrar a conversa por voz' : 'Conversar por voz');
    if (conversing) micLabel.textContent = phase === 'listening' ? 'Ouvindo… toque para encerrar' : 'Conversando… toque para encerrar';
    else if (lm === 'wakeword') micLabel.textContent = `Diga "${name}" ou toque para falar`;
    else micLabel.textContent = st.settings.voice.conversationMode ? 'Toque para conversar' : 'Toque para falar';
    micOffBtn.hidden = lm !== 'wakeword';
    if (conversing && phase === 'listening') setMode('listening');
    else if (mode === 'listening') setMode(phase === 'waiting' ? 'thinking' : 'idle');
    else if (mode === 'idle') setMode('idle');
  }

  function addMessage(msg) {
    transcript.push({ ...msg, at: Date.now() });
    if (transcript.length > MAX_MESSAGES) transcript.splice(0, transcript.length - MAX_MESSAGES);
    renderLog();
  }

  function renderLog() {
    clear(log);
    for (const m of transcript) {
      log.append(h('li', { class: `msg msg-${m.from}${m.pending ? ' is-pending' : ''}` },
        h('span', { class: 'msg-who' }, m.from === 'user' ? (m.author || 'Você') : assistantInfo(store.getState()).name),
        h('p', { class: 'msg-text' }, m.text),
        m.source === 'claude' ? h('span', { class: 'msg-source' }, 'Resposta gerada por IA (experimental)') : null,
        m.link ? h('button', { type: 'button', class: 'link-btn', onclick: () => ctx.navigate(m.link.view) }, m.link.label) : null));
    }
    log.scrollTop = log.scrollHeight;
  }

  function reply(text, extra = {}) {
    addMessage({ from: 'assistant', text, ...extra });
    if (!store.getState().settings.voice.enabled || !speech.supportsSynthesis) {
      setMode('idle');
      loop.replyFinished();
      return;
    }
    ctx.say(text, {
      onStart: () => setMode('speaking'),
      onEnd: () => {
        if (mode === 'speaking' || mode === 'thinking') setMode('idle');
        loop.replyFinished();
      },
    });
  }

  async function send(raw) {
    const text = String(raw || '').trim();
    if (!text || busy) return;
    input.value = '';
    const r = activeResident(store.getState());
    addMessage({ from: 'user', text, author: r ? displayName(r) : 'Você' });
    const result = respond(store, text);
    if (result.ui?.open === 'sos') {
      loop.stop();
      reply(result.reply);
      ctx.openSos('voz', { alreadyLogged: true });
      return;
    }
    const links = { lembretes: 'Abrir lembretes', compras: 'Abrir lista de compras' };
    const link = result.ui?.open && links[result.ui.open] ? { view: result.ui.open, label: links[result.ui.open] } : null;

    if (result.intent === 'unknown' && useClaude()) {
      busy = true;
      setMode('thinking');
      const pending = { from: 'assistant', text: '…', pending: true };
      addMessage(pending);
      const entry = transcript[transcript.length - 1];
      try {
        const st = store.getState();
        const resident = activeResident(st);
        const answer = await askClaude({
          assistantName: assistantInfo(st).name,
          residentName: resident ? displayName(resident) : '',
          memories: resident ? memoriesFor(st, resident.id) : [],
          history: transcript.filter((m) => !m.pending),
          text,
        }, { onText: ({ text: partial }) => { entry.text = partial || '…'; renderLog(); } });
        transcript.splice(transcript.indexOf(entry), 1);
        reply(answer || result.reply, { source: answer ? 'claude' : 'local' });
      } catch (err) {
        transcript.splice(transcript.indexOf(entry), 1);
        reply(`${result.reply} (A IA experimental não respondeu agora.)`);
      } finally {
        busy = false;
      }
      return;
    }
    reply(result.reply, { link });
  }

  function useClaude() {
    return store.getState().settings.conversationProvider === 'claude' && claudeRuntimePresent();
  }

  function toggleMic() {
    if (loop.mode === 'conversation') {
      loop.leaveConversation();
      return;
    }
    const availability = speech.recognitionAvailability();
    if (!availability.ok) {
      ctx.toast(speechMessage(availability.reason), { kind: 'warn', timeout: 6500 });
      input.focus();
      return;
    }
    speech.stopSpeaking();
    loop.startConversation({ single: !store.getState().settings.voice.conversationMode });
  }

  // Liga ou desliga a escuta pelo nome quando a configuração muda.
  function syncWakeWord(st) {
    const { name } = assistantInfo(st);
    const key = st.settings.voice.wakeWord ? `on|${name}` : 'off';
    if (key === wakeKey) return;
    wakeKey = key;
    if (st.settings.voice.wakeWord) {
      if (speech.recognitionAvailability().ok && loop.mode !== 'conversation') loop.startWakeWord(name);
    } else if (loop.base === 'wakeword' || loop.mode === 'wakeword') {
      loop.stop();
    }
  }

  function speechMessage(reason) {
    if (reason === 'unsupported') return 'O microfone não está disponível neste navegador ou nesta janela. Use o campo de texto. No Safari do iPad, o microfone funciona quando o app é aberto por https.';
    if (reason === 'insecure') return 'O microfone só funciona quando o app é aberto por um endereço seguro (https). Use o campo de texto.';
    return 'Microfone indisponível agora. Use o campo de texto.';
  }

  function renderToday(st) {
    const now = new Date();
    const next = upcomingReminders(st, now, 1)[0];
    const shopping = pendingShopping(st).length;
    clear(today).append(
      h('div', { class: 'today-clock' },
        h('span', { class: 'today-time' }, `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`),
        h('span', { class: 'today-date' }, formatDateLong(now))),
      h('button', { type: 'button', class: 'today-card', onclick: () => ctx.navigate('lembretes') },
        icon('bell'),
        h('span', { class: 'today-card-text' },
          h('small', {}, 'Próximo lembrete'),
          h('span', {}, next ? `${next.title}, ${formatWhen(next.dueAt, now)}` : 'Nenhum lembrete pendente'))),
      h('button', { type: 'button', class: 'today-card', onclick: () => ctx.navigate('compras') },
        icon('cart'),
        h('span', { class: 'today-card-text' },
          h('small', {}, 'Lista de compras'),
          h('span', {}, shopping ? `${shopping} ${shopping === 1 ? 'item' : 'itens'} para comprar` : 'Lista vazia'))));
  }

  function renderProvider(st) {
    clear(providerTag);
    if (st.settings.conversationProvider === 'claude') {
      providerTag.append(claudeRuntimePresent() ? statusTag('demo', 'IA Claude (experimental)') : statusTag('planned', 'IA indisponível aqui · usando motor local'));
    } else {
      providerTag.append(statusTag('real', 'Motor local por regras'));
    }
  }

  if (!transcript.length) {
    const r = activeResident(state);
    transcript.push({
      from: 'assistant',
      at: Date.now(),
      text: `${greetingFor()}${r ? ', ' + displayName(r) : ''}! Eu sou ${info.gender === 'male' ? 'o' : 'a'} ${info.name}. Posso cuidar da lista de compras, criar lembretes e guardar suas preferências. Como posso ajudar?`,
    });
  }
  renderLog();
  renderToday(state);
  renderProvider(state);
  setMode('idle');
  renderMic();
  syncWakeWord(state);

  const clock = setInterval(() => renderToday(store.getState()), 30_000);
  // Microfone fechado enquanto a assistente fala (inclusive lembretes).
  const offUi = ui.on((s) => {
    if (s.speaking && !pausedBySpeech) { pausedBySpeech = true; loop.pause(); }
    else if (!s.speaking && pausedBySpeech) { pausedBySpeech = false; loop.resume(); }
    if (!s.speaking && mode === 'speaking') setMode('idle');
  });

  refs = {
    update(st) {
      const i = assistantInfo(st);
      avatar.setGender(i.gender);
      avatar.setState(mode === 'thinking' ? 'idle' : mode);
      nameEl.textContent = i.name;
      setMode(mode);
      renderToday(st);
      renderProvider(st);
      syncWakeWord(st);
      renderMic();
    },
    destroy() {
      clearInterval(clock);
      offUi();
      loop.stop();
      speech.stopListening();
      speech.stopSpeaking();
      ui.set({ listening: false, speaking: false });
      avatar.destroy();
    },
  };
  return view;
}

export function resetTranscript() {
  transcript.length = 0;
}

export function update(state) {
  refs?.update(state);
}

export function destroy() {
  refs?.destroy();
  refs = null;
}

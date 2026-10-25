// Configurações: assistente, voz, aparência, conversa e privacidade.

import { h } from '../../core/dom.js';
import { button, notice, segmented, statusTag, toggle, viewHeader } from '../components/common.js';
import { confirmDialog, openModal } from '../components/overlay.js';
import { createAvatar } from '../components/avatar.js';
import { PORTRAIT } from '../components/avatar3d/load.js';
import { ASSISTANT_DEFAULT_NAMES } from '../../data/schema.js';
import { claudeRuntimePresent } from '../../services/conversation/claudeProvider.js';
import { activeHousehold } from '../../data/schema.js';
import { wakeLockSupported } from '../../services/wakelock.js';

export const APP_VERSION = '0.2.0';

export function assistantChooser(ctx, { compact = false } = {}) {
  const { assistant, avatarStyle } = ctx.store.getState().settings;
  const option = (gender, label) => {
    // Retrato do personagem 3D (imagem leve) ou a ilustração animada.
    const av = avatarStyle === 'illustrated'
      ? createAvatar({ gender, size: 'sm' })
      : { el: h('img', { class: 'avatar-portrait', src: PORTRAIT[gender], alt: '', width: 150, height: 188 }) };
    const selected = assistant.gender === gender;
    return h('button', {
      type: 'button', class: `assistant-option${selected ? ' is-selected' : ''}`, 'aria-pressed': String(selected),
      onclick: () => ctx.store.update((d) => {
        const wasDefault = !d.settings.assistant.name || Object.values(ASSISTANT_DEFAULT_NAMES).includes(d.settings.assistant.name);
        d.settings.assistant.gender = gender;
        if (wasDefault) d.settings.assistant.name = ASSISTANT_DEFAULT_NAMES[gender];
      }),
    }, av.el, h('span', { class: 'assistant-option-label' }, label), h('span', { class: 'assistant-option-name' }, `Nome sugerido: ${ASSISTANT_DEFAULT_NAMES[gender]}`));
  };
  return h('div', { class: `assistant-chooser${compact ? ' is-compact' : ''}` },
    option('female', 'Assistente feminina'),
    option('male', 'Assistente masculino'));
}

export function render(ctx) {
  const { store, speech } = ctx;
  const state = store.getState();
  const s = state.settings;
  const set = (fn) => store.update((d) => fn(d.settings));

  const nameInput = h('input', {
    id: 'set-name', class: 'input', maxlength: 24, value: s.assistant.name,
    onchange: (e) => set((st) => { st.assistant.name = e.target.value.trim() || ASSISTANT_DEFAULT_NAMES[st.assistant.gender || 'female']; }),
  });
  const rateInput = h('input', {
    id: 'set-rate', type: 'range', min: '0.7', max: '1.3', step: '0.05', value: String(s.voice.rate), class: 'range',
    onchange: (e) => set((st) => { st.voice.rate = Number(e.target.value); }),
  });
  const hasPtVoice = speech.supportsSynthesis && speech.hasPortugueseVoice();
  const voiceName = speech.voiceName(s.assistant.gender || 'female');

  return h('div', { class: 'page' },
    viewHeader('Configurações'),

    h('section', { class: 'panel' },
      h('h2', { class: 'panel-title' }, 'Assistente'),
      assistantChooser(ctx),
      h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'set-name' }, 'Nome da assistente'), nameInput),
      toggle('set-avatar3d', 'Personagem 3D realista', s.avatarStyle !== 'illustrated', (v) => set((st) => { st.avatarStyle = v ? '3d' : 'illustrated'; }),
        { hint: 'Rosto em 3D que pisca e mexe a boca junto com a fala. É um personagem virtual, não uma pessoa real. Desligado, usa a ilustração simples, que gasta menos bateria.' })),

    h('section', { class: 'panel' },
      h('h2', { class: 'panel-title' }, 'Voz'),
      toggle('set-voice', 'Ler as respostas em voz alta', s.voice.enabled, (v) => set((st) => { st.voice.enabled = v; })),
      toggle('set-conv', 'Modo conversa: continuar ouvindo depois de cada resposta', s.voice.conversationMode, (v) => set((st) => { st.voice.conversationMode = v; }),
        { hint: 'Toque no microfone uma vez e converse. Para encerrar, diga "pode parar" ou "tchau", toque de novo ou fique em silêncio.' }),
      toggle('set-wake', `Chamar pelo nome ("${s.assistant.name || 'Clara'}, …")`, s.voice.wakeWord, async (v) => {
        if (v) {
          const ok = await confirmDialog({
            title: 'Ativar a escuta pelo nome?',
            message: `Enquanto a tela principal do AI Care estiver aberta, o microfone fica ligado o tempo todo e a assistente só responde quando ouvir "${s.assistant.name || 'Clara'}". O som é processado pelo reconhecimento de fala da Apple, inclusive quando ninguém chama. Nada é gravado pelo AI Care e o aviso "Microfone ativo" fica aceso. Ative só se todas as pessoas da casa estiverem de acordo.`,
            confirmLabel: 'Ativar',
          });
          if (!ok) { ctx.navigate('configuracoes', { focus: false }); return; }
        }
        set((st) => { st.voice.wakeWord = v; });
      }, { hint: 'Desligado por padrão. Funciona só na tela principal, com o app aberto e em endereço https.' }),
      h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'set-rate' }, 'Velocidade da fala'), rateInput,
        h('div', { class: 'range-labels', 'aria-hidden': 'true' }, h('span', {}, 'Mais devagar'), h('span', {}, 'Mais rápido'))),
      h('p', { class: 'fine' }, speech.supportsSynthesis
        ? (hasPtVoice ? `Voz em uso: ${voiceName}. A voz vem do próprio aparelho; no iPad, vozes melhores podem ser baixadas em Ajustes › Acessibilidade › Conteúdo Falado › Vozes.` : 'Nenhuma voz em português foi encontrada neste aparelho. A fala pode sair com sotaque estrangeiro.')
        : 'Este navegador não oferece síntese de voz.'),
      button('Testar a voz', { iconName: 'speaker', onClick: () => ctx.say(`Olá! Eu sou ${s.assistant.gender === 'male' ? 'o' : 'a'} ${s.assistant.name || 'sua assistente'}. Esta é a minha voz.`) })),

    h('section', { class: 'panel' },
      h('h2', { class: 'panel-title' }, 'Tela'),
      toggle('set-awake', 'Manter a tela ligada com o AI Care aberto', s.keepAwake, (v) => set((st) => { st.keepAwake = v; }),
        { hint: wakeLockSupported() ? 'Útil para deixar o iPad na sala como central. Gasta mais bateria: deixe o iPad no carregador.' : 'Este navegador não permite manter a tela ligada.' })),

    h('section', { class: 'panel' },
      h('h2', { class: 'panel-title' }, 'Aparência'),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Tema'),
        segmented('set-theme', { system: 'Automático', light: 'Claro', dark: 'Escuro' }, s.theme, (v) => set((st) => { st.theme = v; }))),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Tamanho do texto'),
        segmented('set-font', { 1: 'Normal', 1.15: 'Grande', 1.3: 'Muito grande' }, s.fontScale, (v) => set((st) => { st.fontScale = Number(v); })))),

    h('section', { class: 'panel' },
      h('h2', { class: 'panel-title' }, 'Conversa'),
      segmented('set-provider', { local: 'Motor local', claude: 'IA Claude (experimental)' }, s.conversationProvider, (v) => set((st) => { st.conversationProvider = v; })),
      h('p', { class: 'fine' }, 'Motor local: entende comandos de lembretes, compras, memórias, hora e data. Nada sai do aparelho.'),
      h('p', { class: 'fine' }, 'IA Claude: perguntas que o motor local não entende são enviadas ao Claude, junto com as memórias da pessoa ativa. Funciona só quando o app é aberto pelo claude.ai e pede sua permissão no primeiro uso.'),
      s.conversationProvider === 'claude' && !claudeRuntimePresent() ? notice('A IA não está disponível neste endereço. O motor local continua respondendo.', { kind: 'demo' }) : null),

    h('section', { class: 'panel' },
      h('h2', { class: 'panel-title' }, 'Privacidade e dados'),
      h('ul', { class: 'plain-list' },
        h('li', {}, statusTag('real', 'Ativo'), ' Dados salvos somente neste navegador. Nada é enviado a servidores do AI Care.'),
        h('li', {}, statusTag('real', 'Ativo'), ' Conversas não são gravadas; ficam na tela até fechar o app.'),
        h('li', {}, statusTag('planned', 'Desativado'), ' Reconhecimento facial e de voz.'),
        h('li', {}, statusTag('planned', 'Planejado'), ' Login, criptografia no servidor e políticas de retenção (Fase 7).')),
      h('div', { class: 'button-row' },
        button('Ver meus dados', { onClick: () => showData(ctx) }),
        button('Ver registro de auditoria', { onClick: () => showAudit(ctx) }),
        button('Restaurar dados de exemplo', { onClick: async () => {
          if (await confirmDialog({ title: 'Restaurar dados de exemplo?', message: 'Todos os cadastros atuais serão substituídos pelos dados fictícios iniciais.', confirmLabel: 'Restaurar' })) {
            const keep = structuredClone(store.getState().settings);
            store.reset();
            store.update((d) => { d.settings = { ...d.settings, ...keep }; });
            ctx.toast('Dados de exemplo restaurados.', { kind: 'ok' });
          }
        } }),
        button('Apagar todos os dados', { variant: 'danger', onClick: async () => {
          if (await confirmDialog({ title: 'Apagar todos os dados?', message: 'Moradores, memórias, lembretes e configurações deste aparelho serão apagados. Não é possível desfazer.', confirmLabel: 'Apagar tudo', danger: true })) {
            ctx.wipe();
          }
        } }))),

    h('section', { class: 'panel' },
      h('h2', { class: 'panel-title' }, 'Sobre'),
      h('dl', { class: 'facts' },
        h('div', {}, h('dt', {}, 'Versão'), h('dd', {}, `${APP_VERSION} (protótipo de testes)`)),
        h('div', {}, h('dt', {}, 'Residência'), h('dd', {}, activeHousehold(state)?.name || '—')),
        h('div', {}, h('dt', {}, 'Armazenamento'), h('dd', {}, store.storageKind === 'localStorage' ? 'Neste navegador' : 'Temporário (o navegador bloqueou o salvamento)'))),
      h('p', { class: 'fine' }, 'O AI Care não substitui cuidadores, profissionais de saúde nem serviços de emergência.'),
      button('O que já funciona', { variant: 'ghost', onClick: () => ctx.navigate('recursos') })));
}

function showData(ctx) {
  const json = JSON.stringify(ctx.store.getState(), null, 2);
  const area = h('textarea', { class: 'input code', id: 'data-json', rows: 16, readonly: true }, json);
  openModal({
    title: 'Meus dados',
    size: 'lg',
    body: h('div', {},
      h('p', { class: 'fine' }, 'Tudo o que o AI Care guarda neste aparelho, em formato JSON (portabilidade, LGPD art. 18).'),
      area,
      h('div', { class: 'modal-actions' }, button('Copiar', { variant: 'primary', onClick: async () => {
        try { await navigator.clipboard.writeText(json); ctx.toast('Copiado.', { kind: 'ok' }); } catch { area.select(); ctx.toast('Texto selecionado. Use Copiar do sistema.'); }
      } }))),
  });
}

const AUDIT_LABELS = {
  'resident.create': 'Cadastro criado',
  'resident.update': 'Cadastro alterado',
  'resident.delete': 'Cadastro excluído (com memórias e histórico)',
  'memory.create': 'Memória criada',
  'memory.update': 'Memória corrigida',
  'memory.delete': 'Memória apagada',
  'reminder.create': 'Lembrete criado',
  'device.create': 'Dispositivo cadastrado',
  'device.delete': 'Dispositivo removido',
  'sos.activate': 'SOS acionado (teste, nada enviado)',
  'routine.create': 'Rotina criada',
  'routine.enable': 'Rotina ativada',
  'routine.disable': 'Rotina desativada',
};

function showAudit(ctx) {
  const entries = ctx.store.getState().audit.slice(0, 50);
  openModal({
    title: 'Registro de auditoria',
    size: 'lg',
    body: h('div', {},
      h('p', { class: 'fine' }, 'Últimas alterações em cadastros, memórias, dispositivos e acionamentos do SOS.'),
      entries.length ? h('ul', { class: 'log-list' }, entries.map((e) => h('li', { class: 'log-item' },
        h('span', { class: 'log-when' }, new Date(e.at).toLocaleString('pt-BR')),
        h('span', { class: 'log-what' }, AUDIT_LABELS[e.action] || e.action)))) : h('p', {}, 'Nenhum registro.')),
  });
}

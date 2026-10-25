// Configuração inicial: boas-vindas, escolha do assistente e avisos de
// privacidade. Aparece na primeira abertura e depois de apagar os dados.

import { h, clear } from '../../core/dom.js';
import { button, statusTag } from '../components/common.js';
import { assistantChooser } from './settings.js';
import { brandMark } from '../app.js';
import { ASSISTANT_DEFAULT_NAMES } from '../../data/schema.js';
import { resetTranscript } from './assistant.js';

export function openOnboarding(ctx) {
  const { store } = ctx;
  let step = 0;
  const card = h('div', { class: 'onboarding-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ob-title' });
  const overlay = h('div', { class: 'onboarding' }, card);
  document.body.append(overlay);

  const dots = () => h('div', { class: 'steps', 'aria-label': `Passo ${step + 1} de 3` },
    [0, 1, 2].map((i) => h('span', { class: `step-dot${i === step ? ' is-current' : ''}${i < step ? ' is-done' : ''}` })));

  function renderStep() {
    clear(card);
    const s = store.getState().settings;
    if (step === 0) {
      card.append(
        dots(),
        h('div', { class: 'ob-brand' }, brandMark(), h('span', {}, 'AI Care')),
        h('h1', { id: 'ob-title', class: 'ob-title' }, 'Uma assistente para o dia a dia da casa'),
        h('p', { class: 'ob-lead' }, 'Conversa, lembra compromissos, cuida da lista de compras e guarda as preferências de cada morador.'),
        h('div', { class: 'ob-warning' },
          statusTag('demo', 'Versão de teste'),
          h('p', {}, 'Use apenas dados fictícios. Os dados ficam só neste aparelho. O botão SOS não envia alertas reais nesta versão.')),
        h('div', { class: 'ob-actions' }, button('Começar', { variant: 'primary', size: 'lg', onClick: () => { step = 1; renderStep(); } })));
    } else if (step === 1) {
      const nameInput = h('input', {
        id: 'ob-name', class: 'input', maxlength: 24,
        value: s.assistant.name || (s.assistant.gender ? ASSISTANT_DEFAULT_NAMES[s.assistant.gender] : ''),
        placeholder: 'Nome da assistente',
        oninput: (e) => { pendingName = e.target.value; },
      });
      card.append(
        dots(),
        h('h1', { id: 'ob-title', class: 'ob-title' }, 'Escolha sua assistente'),
        h('p', { class: 'ob-lead' }, 'Você pode trocar quando quiser em Configurações.'),
        assistantChooser(ctx),
        h('p', { class: 'fine center' }, statusTag('kind', 'Personagens virtuais'), ' Rostos em 3D criados por computador. Não são pessoas reais.'),
        s.assistant.gender ? h('div', { class: 'field ob-name' }, h('label', { class: 'field-label', for: 'ob-name' }, 'Como quer chamar?'), nameInput) : null,
        h('div', { class: 'ob-actions' },
          button('Voltar', { onClick: () => { step = 0; renderStep(); } }),
          s.assistant.gender
            ? button('Continuar', { variant: 'primary', size: 'lg', onClick: () => { saveName(); step = 2; renderStep(); } })
            : h('p', { class: 'fine' }, 'Toque em uma das opções.')));
    } else {
      const agree = h('input', { type: 'checkbox', id: 'ob-agree' });
      const err = h('p', { class: 'field-error', 'aria-live': 'polite' });
      card.append(
        dots(),
        h('h1', { id: 'ob-title', class: 'ob-title' }, 'Antes de começar'),
        h('ul', { class: 'ob-list' },
          h('li', {}, h('strong', {}, 'Microfone e câmera'), ' só ligam quando você tocar no botão, e um aviso vermelho mostra que estão ativos.'),
          h('li', {}, h('strong', {}, 'Reconhecimento facial e de voz'), ' estão desativados. Quem está usando é escolhido pelo nome, no topo da tela.'),
          h('li', {}, h('strong', {}, 'As conversas não são gravadas.'), ' A assistente guarda só o que você pedir, e tudo pode ser apagado.'),
          h('li', {}, h('strong', {}, 'Em emergência real, ligue 192 (SAMU) ou 193 (Bombeiros).'), ' O AI Care não substitui cuidadores nem serviços de emergência.')),
        h('label', { class: 'check', for: 'ob-agree' }, agree, h('span', {}, 'Entendi como funciona a versão de teste.')),
        err,
        h('div', { class: 'ob-actions' },
          button('Voltar', { onClick: () => { step = 1; renderStep(); } }),
          button('Começar a usar', { variant: 'primary', size: 'lg', onClick: () => {
            if (!agree.checked) { err.textContent = 'Marque a confirmação para continuar.'; agree.focus(); return; }
            finish();
          } })));
    }
    requestAnimationFrame(() => card.querySelector('.btn-primary, .assistant-option')?.focus());
  }

  let pendingName = null;
  function saveName() {
    if (pendingName === null) return;
    const value = pendingName.trim();
    store.update((d) => { d.settings.assistant.name = value || ASSISTANT_DEFAULT_NAMES[d.settings.assistant.gender]; });
    pendingName = null;
  }

  const unsubscribe = store.subscribe(() => { if (step === 1) renderStep(); });

  function finish() {
    unsubscribe();
    store.update((d) => { d.settings.onboardingDone = true; });
    overlay.remove();
    resetTranscript();
    ctx.navigate('inicio');
    document.dispatchEvent(new Event('visibilitychange')); // verifica lembretes pendentes
  }

  renderStep();
}

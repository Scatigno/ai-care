// Menu de funcionalidades: blocos grandes, com o status de cada uma.

import { h, icon } from '../../core/dom.js';
import { statusTag, viewHeader } from '../components/common.js';
import { feature } from '../../data/features.js';

const TILES = [
  { view: 'inicio', icon: 'chat', title: 'Conversar', text: 'Fale ou escreva com a assistente.', feature: 'text-chat' },
  { view: 'lembretes', icon: 'bell', title: 'Lembretes', text: 'Horários, remédios e compromissos.', feature: 'reminders' },
  { view: 'compras', icon: 'cart', title: 'Lista de compras', text: 'Anote o que está faltando.', feature: 'shopping' },
  { view: 'moradores', icon: 'users', title: 'Moradores', text: 'Moradores, familiares e visitantes.', feature: 'residents' },
  { view: 'memorias', icon: 'brain', title: 'Memórias', text: 'Preferências e rotinas de cada pessoa.', feature: 'memory' },
  { view: 'cameras', icon: 'camera', title: 'Câmeras', text: 'Teste da câmera e dispositivos.', feature: 'ipad-camera' },
  { view: 'emergencia', icon: 'sos', title: 'Emergência', text: 'Números, contatos e histórico do SOS.', feature: 'sos', danger: true },
  { view: 'configuracoes', icon: 'gear', title: 'Configurações', text: 'Assistente, voz, tema e privacidade.', feature: 'ui' },
  { view: 'recursos', icon: 'info', title: 'O que já funciona', text: 'Funcional, demonstração e planejado.', feature: null },
];

const PLANNED = [
  { icon: 'phone', title: 'Chamadas para familiares', feature: 'calls' },
  { icon: 'shield', title: 'Detecção de possíveis quedas', feature: 'fall' },
  { icon: 'camera', title: 'Câmeras IP e sensores', feature: 'ip-cameras' },
  { icon: 'users', title: 'Reconhecimento facial e de voz', feature: 'face-id' },
];

export function render(ctx) {
  return h('div', { class: 'page' },
    viewHeader('Funcionalidades', { subtitle: 'Toque em um bloco para abrir.' }),
    h('ul', { class: 'tile-grid' }, TILES.map((t) => {
      const f = t.feature ? feature(t.feature) : null;
      return h('li', {},
        h('button', { type: 'button', class: `tile${t.danger ? ' tile-danger' : ''}`, onclick: () => ctx.navigate(t.view) },
          h('span', { class: 'tile-icon' }, icon(t.icon, { size: 32 })),
          h('span', { class: 'tile-title' }, t.title),
          h('span', { class: 'tile-text' }, t.text),
          f ? statusTag(f.status) : null));
    })),
    h('h2', { class: 'section-title' }, 'Em breve'),
    h('ul', { class: 'tile-grid tile-grid-planned' }, PLANNED.map((t) => h('li', {},
      h('div', { class: 'tile tile-planned', 'aria-disabled': 'true' },
        h('span', { class: 'tile-icon' }, icon(t.icon, { size: 28 })),
        h('span', { class: 'tile-title' }, t.title),
        h('span', { class: 'tile-text' }, `Fase ${feature(t.feature).phase}`),
        statusTag('planned'))))));
}

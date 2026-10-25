// Emergência: painel SOS e tela de contatos/histórico.
// Regra do projeto: nada aqui pode parecer que avisou alguém. O SOS desta
// versão mostra números e contatos e registra o acionamento como "não enviado".

import { h } from '../../core/dom.js';
import { openModal } from '../components/overlay.js';
import { button, emptyState, notice, statusTag, viewHeader } from '../components/common.js';
import { PUBLIC_EMERGENCY_NUMBERS, listAlerts, logSosActivation } from '../../domain/emergency.js';
import { emergencyContacts, getResident, displayName } from '../../domain/residents.js';
import { formatDateTime } from '../../core/format.js';

function numberCard({ number, label }) {
  return h('a', { class: 'emergency-number', href: `tel:${number}` },
    h('span', { class: 'emergency-number-digits' }, number),
    h('span', { class: 'emergency-number-label' }, label));
}

function contactList(state) {
  const contacts = emergencyContacts(state);
  if (!contacts.length) return emptyState('Nenhum contato de emergência cadastrado.', 'Cadastre um familiar em Moradores e marque "Contato de emergência".');
  return h('ul', { class: 'contact-list' }, contacts.map((c) => h('li', { class: 'contact' },
    h('span', { class: `mini-avatar av-${c.color}` }, (c.nickname || c.name)[0]),
    h('span', { class: 'contact-text' }, h('strong', {}, c.nickname || c.name), h('small', {}, c.relation || 'Contato')),
    h('span', { class: 'contact-phone', 'aria-label': `Telefone ${c.phone}` }, c.phone))));
}

export function openSos(ctx, origin = 'botao', { alreadyLogged = false } = {}) {
  if (!alreadyLogged) ctx.store.update((d) => logSosActivation(d, { residentId: d.session.activeResidentId, origin }));
  const state = ctx.store.getState();
  openModal({
    title: 'Emergência',
    size: 'lg',
    className: 'modal-sos',
    body: (close) => h('div', { class: 'sos-body' },
      notice('Nesta versão de teste, nenhum aviso é enviado a familiares nem a serviços de emergência. Se a emergência for real, ligue agora para um dos números abaixo.', { kind: 'danger', title: 'Nenhum alerta foi enviado.' }),
      h('div', { class: 'emergency-numbers' }, PUBLIC_EMERGENCY_NUMBERS.map(numberCard)),
      h('p', { class: 'fine' }, 'Tocar no número abre a ligação somente se este aparelho puder telefonar. No iPad, isso depende de um iPhone conectado.'),
      h('h3', { class: 'section-title' }, 'Contatos de emergência (fictícios)'),
      contactList(state),
      h('p', { class: 'fine' }, 'Este acionamento foi registrado como teste em Emergência › Histórico.'),
      h('div', { class: 'modal-actions' },
        button('Ver histórico', { onClick: () => { close(); ctx.navigate('emergencia'); } }),
        button('Fechar', { variant: 'primary', onClick: close }))),
  });
}

export function render(ctx) {
  const state = ctx.store.getState();
  const alerts = listAlerts(state);
  const planned = [
    'Avisar familiares por notificação, SMS ou WhatsApp',
    'Confirmação de recebimento por quem foi avisado',
    'Escalonamento: se ninguém confirmar, avisar o próximo contato',
    'Aviso automático quando o aparelho perder a conexão',
    'Integração futura com central humana 24 horas',
  ];
  return h('div', { class: 'page' },
    viewHeader('Emergência', { subtitle: 'Números públicos, contatos e histórico de acionamentos.', tag: statusTag('demo'),
      actions: [button('Testar o SOS', { variant: 'danger', iconName: 'sos', onClick: () => ctx.openSos('teste') })] }),
    notice('O AI Care não substitui cuidadores, profissionais de saúde nem serviços de emergência. O botão SOS desta versão não envia alertas.', { kind: 'danger' }),
    h('section', { class: 'panel' },
      h('h2', { class: 'panel-title' }, 'Números de emergência'),
      h('div', { class: 'emergency-numbers' }, PUBLIC_EMERGENCY_NUMBERS.map(numberCard))),
    h('section', { class: 'panel' },
      h('div', { class: 'panel-head' },
        h('h2', { class: 'panel-title' }, 'Contatos de emergência'),
        button('Gerenciar', { variant: 'ghost', onClick: () => ctx.navigate('moradores') })),
      contactList(state)),
    h('section', { class: 'panel' },
      h('h2', { class: 'panel-title' }, 'Como os alertas vão funcionar'),
      h('ul', { class: 'plain-list' }, planned.map((p) => h('li', {}, statusTag('planned'), ' ', p)))),
    h('section', { class: 'panel' },
      h('h2', { class: 'panel-title' }, 'Histórico de acionamentos'),
      alerts.length
        ? h('ul', { class: 'log-list' }, alerts.slice(0, 20).map((a) => {
          const who = getResident(state, a.residentId);
          return h('li', { class: 'log-item' },
            h('span', { class: 'log-when' }, formatDateTime(a.createdAt)),
            h('span', { class: 'log-what' }, `SOS acionado por ${a.origin === 'voz' ? 'voz' : 'botão'}${who ? ' · ' + displayName(who) : ''}`),
            statusTag('demo', 'Teste · não enviado'));
        }))
        : emptyState('Nenhum acionamento registrado.')));
}

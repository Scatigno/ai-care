import { uid } from '../core/ids.js';
import { audit, scoped } from '../data/schema.js';

// Números públicos de emergência no Brasil.
export const PUBLIC_EMERGENCY_NUMBERS = [
  { number: '192', label: 'SAMU (urgência médica)' },
  { number: '193', label: 'Bombeiros' },
  { number: '190', label: 'Polícia Militar' },
];

// Registra um acionamento do SOS. Nesta versão nada é enviado, e o
// registro diz isso explicitamente (delivered: false, mode: 'demonstracao').
export function logSosActivation(draft, { residentId = null, origin = 'botao' } = {}) {
  const entry = {
    id: uid('alr'),
    householdId: draft.session.householdId,
    type: 'sos',
    mode: 'demonstracao',
    origin,
    residentId,
    delivered: false,
    deliveryNote: 'Nenhuma notificação foi enviada: envio de alertas ainda não está implementado.',
    createdAt: new Date().toISOString(),
  };
  draft.alerts.unshift(entry);
  if (draft.alerts.length > 200) draft.alerts.length = 200;
  audit(draft, 'sos.activate', { alertId: entry.id, origin });
  return entry;
}

export function listAlerts(state) {
  return scoped(state, 'alerts');
}

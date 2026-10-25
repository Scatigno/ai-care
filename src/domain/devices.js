import { uid } from '../core/ids.js';
import { audit, scoped } from '../data/schema.js';

// Tipos de dispositivo e o que cada um suporta hoje. Nenhum tipo externo
// é exibido como "online": não existe conexão real com eles ainda.
export const DEVICE_TYPES = {
  'ipad-camera': { label: 'Câmera do iPad', support: 'real', note: 'Teste de pré-visualização local, sem gravação.' },
  'ip-rtsp': { label: 'Câmera IP (RTSP)', support: 'planned', note: 'Conexão planejada para a Fase 6 com central local.' },
  onvif: { label: 'Câmera ONVIF', support: 'planned', note: 'Descoberta e conexão planejadas para a Fase 6.' },
  sensor: { label: 'Sensor (porta, movimento)', support: 'planned', note: 'Integração planejada para a Fase 6.' },
};

export function listDevices(state) {
  return scoped(state, 'devices');
}

export function validateDevice({ name, room, type }) {
  const errors = {};
  if (!name || name.trim().length < 2) errors.name = 'Dê um nome ao dispositivo.';
  if (!room || room.trim().length < 2) errors.room = 'Informe o ambiente (ex.: Sala).';
  if (!DEVICE_TYPES[type]) errors.type = 'Escolha o tipo.';
  return errors;
}

export function addDevice(draft, data) {
  const errors = validateDevice(data);
  if (Object.keys(errors).length) return { ok: false, errors };
  const device = {
    id: uid('dev'),
    householdId: draft.session.householdId,
    name: data.name.trim(),
    room: data.room.trim(),
    type: data.type,
    // Endereço é guardado apenas como anotação; o app não se conecta a ele.
    address: (data.address || '').trim().slice(0, 200),
    createdAt: new Date().toISOString(),
  };
  draft.devices.push(device);
  audit(draft, 'device.create', { deviceId: device.id, type: device.type });
  return { ok: true, device };
}

export function removeDevice(draft, id) {
  const before = draft.devices.length;
  draft.devices = draft.devices.filter((d) => !(d.id === id && d.householdId === draft.session.householdId));
  if (before !== draft.devices.length) audit(draft, 'device.delete', { deviceId: id });
  return before !== draft.devices.length;
}

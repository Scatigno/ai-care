// Câmeras: teste consentido da câmera do iPad e cadastro de dispositivos.
// Nenhum dispositivo externo aparece como "online": a conexão não existe ainda.

import { h, icon } from '../../core/dom.js';
import { openModal, confirmDialog } from '../components/overlay.js';
import { button, emptyState, field, notice, setFieldErrors, statusTag, viewHeader } from '../components/common.js';
import { DEVICE_TYPES, addDevice, listDevices, removeDevice } from '../../domain/devices.js';
import { cameraAvailability, startCamera } from '../../services/camera.js';

let session = null; // { stop } enquanto a câmera estiver ligada

function stopPreview(ctx) {
  session?.stop();
  session = null;
  ctx.ui.set({ camera: false });
}

export function destroy() {
  // A câmera desliga ao sair da tela.
  if (session) {
    session.stop();
    session = null;
  }
  destroyCtx?.ui.set({ camera: false });
}
let destroyCtx = null;

export function render(ctx) {
  destroyCtx = ctx;
  const state = ctx.store.getState();
  const devices = listDevices(state);
  const availability = cameraAvailability();

  const video = h('video', { class: 'camera-video', playsinline: true, muted: true, autoplay: true, 'aria-label': 'Imagem da câmera frontal' });
  const consent = h('input', { type: 'checkbox', id: 'cam-consent' });
  const status = h('p', { class: 'camera-status', 'aria-live': 'polite' });
  const preview = h('div', { class: 'camera-preview', hidden: !session }, video,
    h('span', { class: 'live-pill live-cam camera-badge' }, h('span', { class: 'live-dot' }), 'Câmera ativa · sem gravação'));
  const startBtn = button('Ligar câmera', { variant: 'primary', iconName: 'camera', onClick: start });
  const stopBtn = button('Desligar câmera', { variant: 'danger', iconName: 'stop', onClick: () => { stopPreview(ctx); syncButtons(); } });

  function syncButtons() {
    startBtn.hidden = Boolean(session);
    stopBtn.hidden = !session;
    preview.hidden = !session;
  }

  async function start() {
    if (!consent.checked) {
      status.textContent = 'Marque a confirmação acima para ligar a câmera.';
      consent.focus();
      return;
    }
    status.textContent = 'Pedindo permissão para usar a câmera…';
    const r = await startCamera(video);
    if (!r.ok) {
      status.textContent = r.message;
      return;
    }
    session = { stop: r.stop, stream: r.stream };
    ctx.ui.set({ camera: true });
    status.textContent = 'A imagem aparece só nesta tela. Nada é gravado, enviado ou analisado.';
    syncButtons();
  }
  syncButtons();
  if (session) {
    // Tela redesenhada com a câmera ligada: reaproveita a transmissão.
    video.srcObject = session.stream;
    video.play?.().catch(() => {});
    consent.checked = true;
  }

  const deviceRow = (d) => {
    const type = DEVICE_TYPES[d.type];
    return h('li', { class: 'device' },
      h('span', { class: 'device-icon' }, icon('camera')),
      h('div', { class: 'device-text' },
        h('h3', {}, d.name),
        h('p', {}, `${d.room} · ${type?.label || d.type}`),
        h('small', {}, type?.note)),
      h('div', { class: 'device-status' },
        type?.support === 'real' ? statusTag('real', 'Teste disponível') : statusTag('planned', 'Não conectado'),
        h('button', {
          type: 'button', class: 'icon-btn', 'aria-label': `Remover ${d.name}`,
          onclick: async () => {
            if (await confirmDialog({ title: 'Remover dispositivo?', message: `${d.name} sairá da lista.`, confirmLabel: 'Remover', danger: true })) ctx.store.update((dr) => removeDevice(dr, d.id));
          },
        }, icon('trash'))));
  };

  return h('div', { class: 'page' },
    viewHeader('Câmeras', {
      subtitle: 'Teste da câmera deste iPad e cadastro de dispositivos da residência.',
      actions: [button('Cadastrar dispositivo', { iconName: 'plus', onClick: () => openDeviceForm(ctx) })],
    }),
    h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', { class: 'panel-title' }, 'Câmera frontal deste aparelho'), statusTag('real', 'Teste local')),
      h('p', {}, 'Serve para verificar se a câmera funciona no iPad. Não há monitoramento, gravação nem reconhecimento facial.'),
      !availability.ok ? notice(availability.message, { kind: 'demo' }) : null,
      h('label', { class: 'check', for: 'cam-consent' }, consent,
        h('span', {}, 'Entendo que é só um teste de imagem, sem gravação, e que as pessoas no ambiente estão cientes.')),
      h('div', { class: 'button-row' }, startBtn, stopBtn),
      status,
      preview),
    h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', { class: 'panel-title' }, 'Dispositivos cadastrados'), h('span', { class: 'count' }, String(devices.length))),
      devices.length ? h('ul', { class: 'device-list' }, devices.map(deviceRow)) : emptyState('Nenhum dispositivo cadastrado.')),
    h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', { class: 'panel-title' }, 'Eventos e alertas de câmera'), statusTag('planned')),
      emptyState('Nenhum evento.', 'Detecção de movimento, possíveis quedas e alertas de câmera ainda não existem. Serão módulos validados separadamente (Fase 6).')));
}

function openDeviceForm(ctx) {
  const form = h('form', { class: 'form', novalidate: true },
    field('Nome', h('input', { id: 'dv-name', name: 'name', class: 'input', maxlength: 60, autofocus: true, placeholder: 'Ex.: Câmera da cozinha' })),
    h('div', { class: 'form-grid' },
      field('Ambiente', h('input', { id: 'dv-room', name: 'room', class: 'input', maxlength: 40, placeholder: 'Ex.: Cozinha' })),
      field('Tipo', h('select', { id: 'dv-type', name: 'type', class: 'input' }, Object.entries(DEVICE_TYPES).map(([k, t]) => h('option', { value: k }, t.label))))),
    field('Endereço (opcional)', h('input', { id: 'dv-addr', name: 'address', class: 'input', maxlength: 200, placeholder: 'Ex.: rtsp://192.168.0.20/stream', autocapitalize: 'off' }),
      { hint: 'Fica só anotado. O app ainda não se conecta a câmeras externas. Não coloque senhas aqui.' }));
  const { close } = openModal({
    title: 'Cadastrar dispositivo',
    body: form,
    actions: [button('Cancelar', { onClick: () => close() }), button('Cadastrar', { variant: 'primary', onClick: () => form.requestSubmit() })],
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const address = String(fd.get('address') || '');
    if (/\/\/[^/\s]+:[^/\s]+@/.test(address)) {
      setFieldErrors(form, { address: 'Remova usuário e senha do endereço.' });
      return;
    }
    const result = ctx.store.update((d) => addDevice(d, { name: fd.get('name') || '', room: fd.get('room') || '', type: fd.get('type'), address }));
    if (!result.ok) { setFieldErrors(form, result.errors); return; }
    close();
    ctx.toast('Dispositivo cadastrado. A conexão real ainda não está disponível.', { kind: 'ok' });
  });
}

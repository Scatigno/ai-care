// Pré-visualização da câmera frontal. Só exibe a imagem na tela: não grava,
// não envia e não analisa. A transmissão para assim que o usuário desliga
// ou sai da tela.

const ERRORS = {
  NotAllowedError: 'O acesso à câmera foi negado. Libere a câmera nos ajustes do Safari para este site.',
  SecurityError: 'Este ambiente bloqueia o acesso à câmera.',
  NotFoundError: 'Nenhuma câmera foi encontrada neste aparelho.',
  NotReadableError: 'A câmera está sendo usada por outro aplicativo.',
  OverconstrainedError: 'A câmera frontal não está disponível.',
};

export function cameraAvailability() {
  if (globalThis.isSecureContext === false) return { ok: false, message: 'A câmera só funciona quando o app é aberto por um endereço seguro (https).' };
  if (!globalThis.navigator?.mediaDevices?.getUserMedia) return { ok: false, message: 'Este navegador não permite acesso à câmera aqui.' };
  return { ok: true };
}

export async function startCamera(videoEl) {
  const availability = cameraAvailability();
  if (!availability.ok) return { ok: false, message: availability.message };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } }, audio: false });
    videoEl.srcObject = stream;
    videoEl.setAttribute('playsinline', '');
    videoEl.muted = true;
    await videoEl.play().catch(() => {});
    return { ok: true, stream, stop: () => stopStream(stream, videoEl) };
  } catch (err) {
    return { ok: false, message: ERRORS[err?.name] || 'Não foi possível ligar a câmera neste ambiente.' };
  }
}

function stopStream(stream, videoEl) {
  for (const track of stream.getTracks()) track.stop();
  if (videoEl) videoEl.srcObject = null;
}

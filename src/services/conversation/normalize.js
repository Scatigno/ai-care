// "Dobra" o texto: minúsculas e sem acentos, preservando o comprimento,
// para que os índices de uma busca no texto dobrado valham no original.
export function fold(text = '') {
  let out = '';
  for (const ch of String(text).normalize('NFC')) {
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    // Garante 1 caractere por caractere de entrada (ex.: "ß" viraria "ss").
    out += base.length === ch.length ? base : ch.toLowerCase().slice(0, ch.length).padEnd(ch.length, ' ');
  }
  return out;
}

// Normalização para comparações: dobra, remove pontuação e espaços extras.
export function normalizeText(text = '') {
  return fold(text).replace(/[^\p{L}\p{N}:\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

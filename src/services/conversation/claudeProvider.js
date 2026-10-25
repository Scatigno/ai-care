// Provedor opcional de IA generativa. Só existe quando o app roda como
// Artifact no claude.ai (window.claude.use('sample')). Fica desligado por
// padrão e é ligado pelo usuário em Configurações. Em produção, este
// módulo será substituído por um backend próprio com custo controlado.

let samplePromise = null;

export function claudeRuntimePresent() {
  return typeof globalThis.claude?.use === 'function';
}

export function getSample() {
  if (!claudeRuntimePresent()) return Promise.resolve(null);
  if (!samplePromise) samplePromise = globalThis.claude.use('sample').catch(() => null);
  return samplePromise;
}

export function buildPrompt({ assistantName, residentName, memories = [], history = [], text }) {
  const facts = memories.length ? memories.map((m) => `- ${m.text}`).join('\n') : '- (nenhuma)';
  const instructions = [
    `Você é ${assistantName || 'a assistente'}, assistente residencial do AI Care, em versão de teste com dados fictícios.`,
    `Fale em português do Brasil, com frases curtas e simples, adequadas a uma pessoa idosa. No máximo 3 frases.`,
    residentName ? `Quem está falando: ${residentName}.` : 'Ainda não se sabe quem está falando.',
    'Preferências autorizadas desta pessoa (use só se forem relevantes):',
    facts,
    'Regras: não dê diagnóstico nem orientação médica; sugira procurar um profissional de saúde.',
    'Em sinal de emergência, oriente ligar 192 (SAMU) ou 193 (Bombeiros) e tocar no botão SOS.',
    'Não diga que fez ligações, enviou mensagens, viu câmeras ou avisou alguém: você não consegue fazer isso.',
    'Não tente adivinhar emoções ou humor da pessoa.',
  ].join('\n');
  const recent = history.slice(-6).map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text }));
  while (recent.length && recent[0].role !== 'user') recent.shift();
  const messages = [{ role: 'user', content: `${instructions}\n\n(Início da conversa)` }, { role: 'assistant', content: 'Entendido.' }, ...recent];
  if (!recent.length || recent[recent.length - 1].content !== text) messages.push({ role: 'user', content: text });
  // Garante alternância user/assistant.
  return messages.filter((m, i, arr) => i === 0 || m.role !== arr[i - 1].role);
}

export async function askClaude(params, { onText, signal } = {}) {
  const sample = await getSample();
  if (!sample) throw Object.assign(new Error('IA indisponível neste ambiente.'), { code: 'unavailable' });
  const result = await sample(buildPrompt(params), { modelTier: 'quick', cache: false, onText, signal });
  return (result?.text || '').trim();
}

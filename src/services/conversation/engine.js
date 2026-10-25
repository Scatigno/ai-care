// Motor de conversa local (por regras). Entende um conjunto limitado de
// comandos em português e devolve a resposta e o efeito a aplicar no
// estado. Não usa IA generativa nem envia dados para fora do aparelho.
//
// handle(state, text, now) -> { intent, reply, effect?, ui? }
//   effect(draft): função que altera o estado (aplicada via store.update)
//   ui: pedido de ação de interface (ex.: { open: 'sos' })

import { fold, normalizeText } from './normalize.js';
import { parseWhen } from './timeparse.js';
import { formatTime, formatDateLong, formatWhen, greetingFor, listToText } from '../../core/format.js';
import { activeResident, displayName, listResidents, setActiveResident } from '../../domain/residents.js';
import { addShoppingItems, pendingShopping, removeShoppingByName } from '../../domain/shopping.js';
import { addReminder, upcomingReminders } from '../../domain/reminders.js';
import { addMemory, memoriesFor, removeMemory, MEMORY_CATEGORIES } from '../../domain/memory.js';
import { emergencyContacts } from '../../domain/residents.js';
import { logSosActivation } from '../../domain/emergency.js';

const JOKES = [
  'Por que o livro de matemática ficou triste? Porque tinha muitos problemas.',
  'O que o tomate foi fazer no banco? Tirar extrato.',
  'Qual é o doce preferido do átomo? Pé de molécula.',
  'Por que a vaca foi para o espaço? Para ver a Via Láctea.',
  'O que a impressora falou para a outra? Essa folha é sua ou é impressão minha?',
];

const HELP_TEXT = [
  'Posso anotar itens na lista de compras. Exemplo: "adicione leite e pão na lista".',
  'Posso criar lembretes. Exemplo: "me lembre de tomar água às 15h".',
  'Posso guardar suas preferências. Exemplo: "lembre que eu gosto de chá de camomila".',
  'Também digo a hora e a data, e mostro seus lembretes e a lista de compras.',
];

function cleanTitle(original, folded, spans, prefixRe) {
  // Remove os trechos de data/hora e o comando do início.
  const chars = original.split('');
  for (const [a, b] of spans) for (let i = a; i < b; i++) chars[i] = ' ';
  let title = chars.join('');
  const f = fold(title);
  const m = f.match(prefixRe);
  if (m) title = title.slice(m.index + m[0].length);
  return title
    .replace(/\s+/g, ' ')
    .replace(/^(de|para|pra|que|a|o)\s+/i, '')
    .replace(/[\s,.;!?]+$/g, '')
    .replace(/\s+(as|às|a|à|de|e)$/i, '')
    .trim();
}

function splitItems(text) {
  return text
    .split(/,|\s+e\s+|\s+mais\s+/i)
    .map((s) => s.replace(/^(um|uma|uns|umas|o|a|os|as|de|do|da)\s+/i, '').replace(/[.!?]+$/, '').trim())
    .filter((s) => s.length > 1);
}

function name(state) {
  const r = activeResident(state);
  return r ? displayName(r) : '';
}

const RULES = [
  {
    intent: 'emergency',
    test: (f) => /\b(socorro|emergencia|urgente|passando mal|eu cai|cai no chao|levei um tombo|chama (uma )?ambulancia|chame (uma )?ambulancia|nao consigo levantar)\b/.test(f),
    run: (state) => {
      const contacts = emergencyContacts(state).map((c) => `${c.nickname || c.name} (${c.phone})`);
      const who = contacts.length ? ` Seus contatos cadastrados: ${listToText(contacts)}.` : '';
      return {
        reply: `Abri a tela de emergência. Atenção: nesta versão de teste eu não consigo avisar ninguém automaticamente. Se for uma emergência, ligue agora para o SAMU no 192 ou para os Bombeiros no 193.${who}`,
        effect: (d) => logSosActivation(d, { residentId: d.session.activeResidentId, origin: 'voz' }),
        ui: { open: 'sos' },
      };
    },
  },
  {
    intent: 'identify',
    test: (f) => /\b(eu sou|aqui e|quem fala e|sou eu)\s+(o |a |a dona |o seu |dona |seu )?\p{L}+/u.test(f),
    run: (state, text, f) => {
      const m = f.match(/\b(?:eu sou|aqui e|quem fala e|sou eu)\s+(?:o |a |a dona |o seu |dona |seu )?([\p{L} ]+)/u);
      const spoken = normalizeText(m ? m[1] : '');
      const found = listResidents(state).find((r) => {
        const names = [r.name, r.nickname, r.preferences?.treatment].filter(Boolean).map(normalizeText);
        return names.some((n) => n && (spoken.startsWith(n) || n.split(' ').some((part) => part.length > 2 && spoken.split(' ')[0] === part)));
      });
      if (!found) return { reply: 'Não encontrei esse nome no cadastro. Você pode escolher quem está falando no topo da tela ou cadastrar a pessoa em Moradores.' };
      return {
        reply: `Olá, ${displayName(found)}! A partir de agora vou usar suas preferências e lembretes.`,
        effect: (d) => setActiveResident(d, found.id, 'manual-voz'),
      };
    },
  },
  {
    intent: 'memory.list',
    test: (f) => /\b(o que voce sabe (sobre|de) mim|minhas memorias|do que voce se lembra|o que voce lembra de mim)\b/.test(f),
    run: (state) => {
      const r = activeResident(state);
      if (!r) return { reply: 'Ainda não sei quem está falando. Escolha seu nome no topo da tela.' };
      const items = memoriesFor(state, r.id);
      if (!items.length) return { reply: `Ainda não guardei nada sobre você, ${displayName(r)}. Diga, por exemplo: "lembre que eu gosto de café forte".` };
      const lines = items.slice(0, 6).map((m) => m.text.replace(/\.$/, ''));
      return { reply: `Sobre você, ${displayName(r)}, eu lembro que: ${listToText(lines)}. Você pode corrigir ou apagar qualquer item em Memórias.` };
    },
  },
  {
    intent: 'memory.forget',
    test: (f) => /^(esqueca|esquece|apague a memoria|pode esquecer)\b/.test(f.trim()),
    run: (state, text, f) => {
      const r = activeResident(state);
      if (!r) return { reply: 'Escolha primeiro quem está falando, no topo da tela.' };
      const target = normalizeText(f.replace(/^(esqueca|esquece|apague a memoria|pode esquecer)\s+(que|de|sobre)?\s*/, ''));
      const words = target.split(' ').filter((w) => w.length > 3);
      const match = memoriesFor(state, r.id).find((m) => {
        const t = normalizeText(m.text);
        return words.length && words.filter((w) => t.includes(w)).length >= Math.ceil(words.length / 2);
      });
      if (!match) return { reply: 'Não encontrei essa memória. Você pode ver e apagar suas memórias na tela Memórias.' };
      return { reply: `Pronto, apaguei: "${match.text}".`, effect: (d) => removeMemory(d, match.id) };
    },
  },
  {
    intent: 'memory.add',
    test: (f) => /^(por favor )?(lembre|lembra|guarde|guarda|anote|anota|grave|memorize)( (de|-se de))? que\b/.test(f.trim()),
    run: (state, text, f) => {
      const r = activeResident(state);
      if (!r) return { reply: 'Para guardar uma memória preciso saber quem está falando. Escolha seu nome no topo da tela.' };
      const m = f.match(/\bque\s+/);
      let content = text.slice(m.index + m[0].length).trim().replace(/[.!]+$/, '');
      content = content.replace(/^eu\s+/i, '');
      if (content.length < 3) return { reply: 'O que você quer que eu lembre?' };
      const fc = fold(content);
      const category = /\b(gosto|prefiro|adoro|nao gosto|detesto|odeio|favorit)/.test(fc)
        ? 'preferencias'
        : /\b(toda|todo|sempre|costumo|de manha|a tarde|a noite)\b/.test(fc) ? 'rotinas' : 'contexto';
      const sentence = content.charAt(0).toUpperCase() + content.slice(1) + '.';
      return {
        reply: `Combinado, ${displayName(r)}. Guardei em ${MEMORY_CATEGORIES[category].toLowerCase()}: "${sentence}"`,
        effect: (d) => addMemory(d, { residentId: r.id, category, text: sentence, source: 'conversa' }),
      };
    },
  },
  {
    intent: 'reminder.list',
    test: (f) => /\b(quais (sao )?(os )?(meus )?lembretes|meus lembretes|tenho (algum )?(compromisso|lembrete)|o que tenho (pra|para) hoje|minha agenda)\b/.test(f),
    run: (state, text, f, now) => {
      const items = upcomingReminders(state, now, 5);
      if (!items.length) return { reply: 'Você não tem lembretes pendentes.' };
      const lines = items.map((r) => `${r.title} ${formatWhen(r.dueAt, now)}`);
      return { reply: `Seus próximos lembretes: ${listToText(lines)}.`, ui: { open: 'lembretes', soft: true } };
    },
  },
  {
    intent: 'reminder.add',
    test: (f) => /\b(me lembre|me lembra|lembre-me|lembra-me|me avise|me avisa|crie um lembrete|criar lembrete|novo lembrete|lembrete para|lembrete de)\b/.test(f),
    run: (state, text, f, now) => {
      const when = parseWhen(f, now);
      const title = cleanTitle(text, f, when ? when.spans : [], /^.*?\b(me lembre|me lembra|lembre-me|lembra-me|me avise|me avisa|crie um lembrete|criar lembrete|novo lembrete|lembrete)\b\s*(de |para |pra |que )?/);
      if (!title || title.length < 2) return { reply: 'Do que você quer que eu lembre? Diga, por exemplo: "me lembre de tomar água às 15h".' };
      if (!when) return { reply: `Para quando é o lembrete "${title}"? Diga, por exemplo: "me lembre de ${title} amanhã às 9h".` };
      const nice = title.charAt(0).toUpperCase() + title.slice(1);
      const daily = /\b(todo dia|todos os dias|diariamente)\b/.test(f);
      return {
        reply: `Lembrete criado: "${nice}", ${formatWhen(when.date, now)}${daily ? ', todos os dias' : ''}. Vou avisar aqui na tela enquanto o AI Care estiver aberto.`,
        effect: (d) => addReminder(d, { title: nice.replace(/\s*(todo dia|todos os dias|diariamente)\s*/i, ' ').trim(), dueAt: when.date.toISOString(), repeat: daily ? 'daily' : 'none', residentId: d.session.activeResidentId }),
      };
    },
  },
  {
    intent: 'shopping.remove',
    test: (f) => /\b(tire|tira|remova|remove|retire|retira|apague|apaga)\b.+\bda lista\b/.test(f),
    run: (state, text, f) => {
      const m = f.match(/\b(tire|tira|remova|remove|retire|retira|apague|apaga)\s+(.+?)\s+da lista/);
      const items = splitItems(text.slice(m.index + m[1].length, m.index + m[0].length - ' da lista'.length));
      const found = items.filter((i) => pendingShopping(state).some((p) => normalizeText(p.name) === normalizeText(i)));
      if (!found.length) return { reply: `Não encontrei ${listToText(items)} na lista.` };
      return {
        reply: `Tirei ${listToText(found.map((x) => x.toLowerCase()))} da lista de compras.`,
        effect: (d) => found.forEach((i) => removeShoppingByName(d, i)),
      };
    },
  },
  {
    intent: 'shopping.list',
    test: (f) => /\b(o que (tem|esta) na lista|ver (a )?lista|minha lista de compras|o que (eu )?preciso comprar|qual (e )?a lista)\b/.test(f) || /^lista de compras\??$/.test(f.trim()),
    run: (state) => {
      const items = pendingShopping(state).map((i) => i.name.toLowerCase());
      if (!items.length) return { reply: 'A lista de compras está vazia.' };
      return { reply: `Na lista de compras: ${listToText(items)}.`, ui: { open: 'compras', soft: true } };
    },
  },
  {
    intent: 'shopping.add',
    test: (f) => /\b(adicione|adiciona|adicionar|coloque|coloca|colocar|inclua|inclui|incluir|ponha|poe|bota|anote|anota)\b.+\b(lista|compras)\b/.test(f)
      || /^(preciso|tenho que|temos que) comprar\b/.test(f.trim())
      || /^comprar\b/.test(f.trim())
      || /^acabou (o |a |os |as )?\p{L}+/u.test(f.trim()),
    run: (state, text, f) => {
      let m = f.match(/\b(adicione|adiciona|adicionar|coloque|coloca|colocar|inclua|inclui|incluir|ponha|poe|bota|anote|anota)\s+(.+?)\s+(na|a|à|para a|pra)?\s*(minha )?lista( de compras)?\b/);
      let raw;
      if (m) raw = text.slice(m.index + m[1].length, m.index + m[1].length + 1 + m[2].length);
      else if ((m = f.match(/\b(?:comprar|acabou)\s+/))) raw = text.slice(m.index + m[0].length);
      const items = splitItems((raw || '').replace(/\b(na|da) lista( de compras)?\b/i, ''));
      if (!items.length) return { reply: 'O que devo colocar na lista de compras?' };
      let result = { added: [], existing: [] };
      return {
        get reply() {
          const parts = [];
          if (result.added.length) parts.push(`Coloquei ${listToText(result.added.map((x) => x.toLowerCase()))} na lista de compras.`);
          if (result.existing.length) parts.push(`${listToText(result.existing)} já ${result.existing.length > 1 ? 'estavam' : 'estava'} na lista.`);
          return parts.join(' ') || 'Não entendi quais itens adicionar.';
        },
        effect: (d) => { result = addShoppingItems(d, items, d.session.activeResidentId); },
      };
    },
  },
  {
    intent: 'call',
    test: (f) => /\b(ligue|liga|ligar|telefone|telefonar|chame|chama)\s+(para |pro |pra |a |o )?\p{L}+/u.test(f),
    run: (state, text, f) => {
      const contact = listResidents(state).find((r) => [r.name, r.nickname].filter(Boolean).some((n) => normalizeText(f).includes(normalizeText(n).split(' ')[0]) && normalizeText(n).length > 2));
      const phone = contact?.phone ? ` O telefone de ${contact.nickname || contact.name} é ${contact.phone}.` : '';
      return { reply: `Ainda não consigo fazer ligações: essa função está planejada.${phone}` };
    },
  },
  {
    intent: 'time',
    test: (f) => /\b(que horas sao|que hora e|me diga as horas|horas agora|qual e a hora)\b/.test(f),
    run: (state, text, f, now) => ({ reply: `Agora são ${formatTime(now)}.` }),
  },
  {
    intent: 'date',
    test: (f) => /\b(que dia e hoje|qual (e )?a data|que dia e|data de hoje|dia da semana)\b/.test(f),
    run: (state, text, f, now) => ({ reply: `Hoje é ${formatDateLong(now)} de ${now.getFullYear()}.` }),
  },
  {
    intent: 'help',
    test: (f) => /\b(o que voce (pode|sabe|consegue) fazer|como voce funciona|me ajude a usar|comandos)\b/.test(f) || /^ajuda\??$/.test(f.trim()),
    run: () => ({ reply: `${HELP_TEXT.join(' ')} Se for uma emergência, toque no botão SOS.` }),
  },
  {
    intent: 'assistant.name',
    test: (f) => /\b(qual (e )?(o )?seu nome|como voce se chama|quem e voce)\b/.test(f),
    run: (state) => ({ reply: `Eu sou ${state.settings.assistant.name || 'sua assistente'}, a assistente do AI Care. Estou em versão de teste.` }),
  },
  {
    intent: 'limits',
    test: (f) => /\b(nao (consegue|sabe|pode|quer) (me )?responder|por que (voce )?nao (responde|sabe|entende|consegue)|voce nao (entende|entendeu|sabe nada)|nao entendeu|como assim (voce|ce|cê) nao)\b/.test(f),
    run: () => ({ reply: 'Desculpe! Nesta versão de teste eu funciono com um motor simples, sem inteligência artificial: entendo pedidos de lembretes, lista de compras, horário, data e suas preferências. Para conversar sobre qualquer assunto, preciso de um serviço de IA que ainda está sendo configurado.' }),
  },
  {
    intent: 'hearing',
    test: (f) => /\b(esta me ouvindo|ta me ouvindo|tá me ouvindo|voce me ouve|ce me ouve|me escuta|me ouviu|esta ai|ta ai|voce esta ai)\b/.test(f),
    run: () => ({ reply: 'Estou aqui, ouvindo você. Pode falar.' }),
  },
  {
    intent: 'repeat',
    test: (f) => /\b(repete|repita|repetir|fala de novo|fale de novo|diga de novo|nao ouvi|nao entendi o que voce disse|o que voce disse)\b/.test(f),
    run: () => ({ reply: '', ui: { repeat: true } }),
  },
  {
    intent: 'voice.slower',
    test: (f) => /\b(fal[ae] (mais )?devagar|mais devagar)\b/.test(f),
    run: (state) => ({
      reply: 'Combinado, vou falar mais devagar.',
      effect: (d) => { d.settings.voice.rate = Math.max(0.7, Math.round((d.settings.voice.rate - 0.1) * 100) / 100); },
    }),
  },
  {
    intent: 'voice.faster',
    test: (f) => /\b(fal[ae] (mais )?rapido|mais rapido)\b/.test(f),
    run: () => ({
      reply: 'Combinado, vou falar um pouco mais rápido.',
      effect: (d) => { d.settings.voice.rate = Math.min(1.3, Math.round((d.settings.voice.rate + 0.1) * 100) / 100); },
    }),
  },
  {
    intent: 'weather',
    test: (f) => /\b(como (esta|ta|vai) o tempo|previsao do tempo|vai chover|esta chovendo|clima (hoje|de hoje|agora)|qual (e )?a temperatura|esta (frio|calor) (la )?fora)\b/.test(f),
    run: () => ({ reply: 'Ainda não tenho acesso à previsão do tempo. Por enquanto, o app Tempo do iPad mostra a previsão.' }),
  },
  {
    intent: 'joke',
    test: (f) => /\b(piada|me faca rir|me faz rir|algo engracado)\b/.test(f),
    run: (state, text, f, now) => ({ reply: JOKES[(now.getMinutes() + now.getSeconds()) % JOKES.length] }),
  },
  {
    intent: 'feeling',
    test: (f) => /\b(estou|to|tô|me sinto|ando) (muito |meio |um pouco )?(triste|sozinh[oa]|com saudade|entediad[oa]|desanimad[oa])\b/.test(f),
    run: () => ({ reply: 'Sinto muito que você esteja assim. Quer conversar com alguém da família? Os contatos ficam em Moradores. Se for algo urgente, toque no botão SOS.' }),
  },
  {
    intent: 'creator',
    test: (f) => /\b(quem (te )?(criou|fez|inventou)|quantos anos voce tem|voce e (uma )?(pessoa|gente|robo|humana?|de verdade|real))\b/.test(f),
    run: (state) => ({ reply: `Sou ${state.settings.assistant.gender === 'male' ? 'um personagem virtual' : 'uma personagem virtual'} do AI Care, um projeto em teste. Não sou uma pessoa real, mas estou aqui para ajudar no dia a dia.` }),
  },
  {
    intent: 'compliment',
    test: (f) => /\b(voce e|vc e|ce e) (muito )?(linda|lindo|bonita|bonito|legal|inteligente|otima|otimo|querida|querido|um amor)\b/.test(f),
    run: (state) => ({ reply: `${state.settings.assistant.gender === 'male' ? 'Obrigado' : 'Obrigada'}! Fico feliz em ajudar.` }),
  },
  {
    intent: 'social.howareyou',
    test: (f) => /\b(tudo bem|tudo bom|tudo certo|como (voce )?(esta|vai)|como vai voce|como ce ta|como voce ta)\b/.test(f),
    run: (state, text, f, now) => {
      const hello = /^(oi|ola|bom dia|boa tarde|boa noite|e ai)\b/.test(f.trim()) ? `${greetingFor(now)}${name(state) ? ', ' + name(state) : ''}! ` : '';
      return { reply: `${hello}Estou bem, ${state.settings.assistant.gender === 'male' ? 'obrigado' : 'obrigada'} por perguntar! E você, como está?` };
    },
  },
  {
    intent: 'social.fine',
    test: (f) => /^(estou bem|to bem|tô bem|bem e voce|bem tambem|tudo otimo|estou otim[oa]|tudo tranquilo|mais ou menos)\b/.test(f.trim()),
    run: (state, text, f) => ({ reply: /mais ou menos/.test(f) ? 'Entendo. Se eu puder ajudar com alguma coisa, é só falar.' : 'Que bom! Posso ajudar com alguma coisa?' }),
  },
  {
    intent: 'ack',
    test: (f) => /^(ok|okay|certo|ta bom|tá bom|ta|beleza|entendi|entendido|combinado|perfeito|legal|show)[\s.!]*$/.test(f.trim()),
    run: () => ({ reply: 'Certo! Se precisar de algo, é só falar.' }),
  },
  {
    intent: 'thanks',
    test: (f) => /\b(obrigad[oa]|valeu|agradeco)\b/.test(f),
    run: (state) => ({ reply: `Por nada${name(state) ? ', ' + name(state) : ''}! Estou aqui se precisar.` }),
  },
  {
    intent: 'bye',
    test: (f) => /^(tchau|ate logo|ate mais|ate amanha|boa noite e ate)\b/.test(f.trim()),
    run: (state) => ({ reply: `Até logo${name(state) ? ', ' + name(state) : ''}!` }),
  },
  {
    intent: 'greeting',
    test: (f) => /^(oi|ola|bom dia|boa tarde|boa noite|e ai|hey)\b/.test(f.trim()),
    run: (state, text, f, now) => ({ reply: `${greetingFor(now)}${name(state) ? ', ' + name(state) : ''}! Como posso ajudar?` }),
  },
];

export function matchIntent(text) {
  const f = fold(text).trim();
  const rule = RULES.find((r) => r.test(f));
  return rule ? rule.intent : 'unknown';
}

export function handle(state, text, now = new Date()) {
  const original = String(text || '').trim();
  if (!original) return { intent: 'empty', reply: '' };
  const f = fold(original);
  const rule = RULES.find((r) => r.test(f.trim()));
  if (!rule) {
    return {
      intent: 'unknown',
      reply: 'Desculpe, ainda não sei responder isso. Nesta versão de teste eu ajudo com lembretes, lista de compras, suas preferências, horário e data. Diga "o que você sabe fazer" para ouvir exemplos.',
    };
  }
  const out = rule.run(state, original, f, now);
  return { intent: rule.intent, ...out, reply: out.reply };
}

// Aplica o efeito e só então lê a resposta (algumas respostas dependem
// do resultado, como itens já existentes na lista).
export function respond(store, text, now = new Date()) {
  const state = store.getState();
  const original = String(text || '').trim();
  if (!original) return { intent: 'empty', reply: '' };
  const f = fold(original);
  const rule = RULES.find((r) => r.test(f.trim()));
  if (!rule) return handle(state, original, now);
  const out = rule.run(state, original, f, now);
  if (out.effect) store.update((d) => { out.effect(d); });
  return { intent: rule.intent, reply: out.reply, ui: out.ui };
}

export const ENGINE_EXAMPLES = [
  'O que você sabe fazer?',
  'Adicione leite e café na lista',
  'Me lembre de tomar água às 15h',
  'Lembre que eu gosto de chá de camomila',
  'Quais são meus lembretes?',
  'Que horas são?',
];

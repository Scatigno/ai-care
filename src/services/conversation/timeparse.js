// Interpreta expressões de data/hora em português do Brasil.
// Recebe texto já dobrado (minúsculo, sem acento) e devolve a data
// resultante e os trechos usados, para que sejam removidos do título.

const NUMBER_WORDS = {
  uma: 1, um: 1, duas: 2, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7,
  oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, quinze: 15, vinte: 20, trinta: 30,
};

const WEEKDAYS = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };

const NUM = '(\\d{1,2}|uma|um|duas|dois|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)';

function toNumber(token) {
  if (token === undefined) return undefined;
  if (/^\d+$/.test(token)) return Number(token);
  return NUMBER_WORDS[token];
}

export function parseWhen(folded, now = new Date()) {
  const spans = [];
  let dayOffset = null;
  let weekday = null;
  let hours = null;
  let minutes = 0;

  // Relativo: "daqui a 10 minutos", "em 2 horas", "daqui a meia hora"
  const rel = folded.match(new RegExp(`\\b(?:daqui a|daqui|em|dentro de)\\s+(${NUM.slice(1, -1)}|meia)\\s+(minutos?|horas?|hora)\\b`));
  if (rel) {
    const amount = rel[1] === 'meia' ? 0.5 : toNumber(rel[1]);
    const unit = rel[2].startsWith('min') ? 60_000 : 3_600_000;
    spans.push([rel.index, rel.index + rel[0].length]);
    return { date: new Date(now.getTime() + amount * unit), spans };
  }

  const day = folded.match(/\b(depois de amanha|amanha|hoje)\b/);
  if (day) {
    dayOffset = day[1] === 'hoje' ? 0 : day[1] === 'amanha' ? 1 : 2;
    spans.push([day.index, day.index + day[0].length]);
  } else {
    const wd = folded.match(/\b(?:na |no |nesta |neste |proxima |proximo )?(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira| feira)?\b/);
    if (wd) {
      weekday = WEEKDAYS[wd[1]];
      spans.push([wd.index, wd.index + wd[0].length]);
    }
  }

  // "meio-dia", "meia-noite"
  const special = folded.match(/\b(?:as |ao |a )?(meio[- ]dia|meia[- ]noite)(?: e meia)?\b/);
  if (special) {
    hours = special[1].startsWith('meio') ? 12 : 0;
    if (/e meia$/.test(special[0])) minutes = 30;
    spans.push([special.index, special.index + special[0].length]);
  } else {
    // "as 14h", "as 14:30", "as 8h30", "14 horas", "as duas e meia da tarde"
    const re = new RegExp(`\\b(?:as |a |pelas |por volta das )?${NUM}(?:\\s*(?:h|:|horas?)\\s*(\\d{2})?|\\s+e\\s+(meia|\\d{1,2}|quinze|vinte|trinta))?(?:\\s*(?:h|horas?))?(?:\\s+(da manha|da tarde|da noite|da madrugada))?\\b`, 'g');
    let m;
    while ((m = re.exec(folded))) {
      const rest = m[0].slice(m[0].indexOf(m[1]) + m[1].length);
      const hasMarker = /^(as |a |pelas |por volta das )/.test(m[0]) || /h|:|hora/.test(rest) || m[4];
      if (!hasMarker) continue;
      const h = toNumber(m[1]);
      if (h === undefined || h > 23) continue;
      hours = h;
      if (m[2]) minutes = Number(m[2]);
      else if (m[3]) minutes = m[3] === 'meia' ? 30 : toNumber(m[3]) ?? 0;
      const period = m[4];
      if ((period === 'da tarde' || period === 'da noite') && hours < 12) hours += 12;
      if (period === 'da noite' && hours === 24) hours = 0;
      spans.push([m.index, m.index + m[0].length]);
      break;
    }
  }

  if (hours === null && dayOffset === null && weekday === null) return null;
  if (minutes > 59) minutes = 0;

  const date = new Date(now);
  date.setSeconds(0, 0);
  if (weekday !== null) {
    let diff = (weekday - now.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    date.setDate(date.getDate() + diff);
  } else if (dayOffset !== null) {
    date.setDate(date.getDate() + dayOffset);
  }
  if (hours === null) {
    date.setHours(9, 0, 0, 0);
  } else {
    date.setHours(hours, minutes, 0, 0);
    // Só horário, já passado hoje: vale para amanhã.
    if (dayOffset === null && weekday === null && date <= now) date.setDate(date.getDate() + 1);
  }
  return { date, spans, timeGiven: hours !== null };
}

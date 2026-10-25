// Formatação de datas e horas em pt-BR.

export function formatTime(date) {
  const d = new Date(date);
  const h = d.getHours();
  const m = d.getMinutes();
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export function formatDateLong(date) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(date));
}

export function formatDateTime(date) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date));
}

// "hoje às 14h", "amanhã às 9h30", "sexta-feira, 31 de outubro às 8h"
export function formatWhen(date, now = new Date()) {
  const d = new Date(date);
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const diffDays = Math.round((new Date(d).setHours(0, 0, 0, 0) - startToday.getTime()) / 86_400_000);
  const time = formatTime(d);
  if (diffDays === 0) return `hoje às ${time}`;
  if (diffDays === 1) return `amanhã às ${time}`;
  if (diffDays === -1) return `ontem às ${time}`;
  return `${formatDateLong(d)} às ${time}`;
}

export function greetingFor(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return 'Boa noite';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Valor para <input type="datetime-local"> no fuso local.
export function toLocalInputValue(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function listToText(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

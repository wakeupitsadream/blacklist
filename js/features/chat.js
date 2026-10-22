// Чат стола: быстрые просьбы, пример ответа в демо, номер стола из QR, метка сессии и разбор ответов официанта.
// Чистые функции без DOM и сети: их же использует api/chat.js. В бою вместо Telegram — пульт официанта, формат тот же.

export const QUICK = [
  { id: 'come', label: 'Подойдите, пожалуйста', reply: 'Подхожу через минуту' },
  { id: 'napkins', label: 'Салфетки', reply: 'Несу салфетки' },
  { id: 'ice', label: 'Лёд', reply: 'Несу лёд' },
  { id: 'bill', label: 'Счёт', reply: 'Несу счёт' },
  { id: 'order', label: 'Готовы заказать', reply: 'Иду принять заказ' },
  { id: 'clear', label: 'Убрать со стола', reply: 'Сейчас уберу' },
];

const RULES = [
  [/салфет/i, 'Несу салфетки'],
  [/(^|[^а-яё])л[её]д/i, 'Несу лёд'],
  [/сч[её]т|расч[её]т|оплат/i, 'Несу счёт'],
  [/убер|убрать|посуд/i, 'Сейчас уберу'],
  [/заказ/i, 'Иду принять заказ'],
];

/** Пример ответа официанта в демо: по быстрой кнопке или по словам в тексте. */
export function demoReply(text) {
  const t = String(text ?? '');
  const q = QUICK.find((x) => x.label === t);
  if (q) return q.reply;
  if (/^Заказ:/.test(t)) return 'Принял заказ, подойду подтвердить';
  const r = RULES.find(([re]) => re.test(t));
  return r ? r[1] : 'Принято, подхожу';
}

// Таймлайн демо-ответа в мс от отправки: доставлено → прочитано → ответ. Без Math.random: одинаково на любой встрече.
export const DEMO_STEPS = { delivered: 700, read: 2000, reply: 3800 };

/** Номер стола из QR-ссылки: ?t=7 (или ?table=7), VIP-зона — ?t=vip; вне 1..max — null. */
export function parseTable(search, max = 99) {
  const p = new URLSearchParams(search || '');
  const raw = String(p.get('t') ?? p.get('table') ?? '').trim();
  if (/^vip$/i.test(raw)) return 'VIP';
  if (!/^\d{1,3}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= max ? n : null;
}

/** Стол 1..max или 'VIP' — то, что принимает сервер. */
export const validTable = (t, max = 99) => t === 'VIP' || (Number.isInteger(t) && t >= 1 && t <= max);

export const tableLabel = (t) => (t === 'VIP' ? 'VIP-зона' : `Стол ${t}`);

export const SID_RE = /^[a-z0-9]{8,16}$/;

/** Метка сессии из случайных байтов (crypto.getRandomValues в браузере): 12 символов a–z0–9. */
export const makeSid = (bytes) => Array.from(bytes, (b) => (b % 36).toString(36)).join('').slice(0, 12);

export const cleanText = (s, max = 500) => String(s ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** Сообщение официанту: стол, текст, метка сессии — по ней ответ реплаем находит гостя. */
export const waiterMessage = (table, text, sid) => `${tableLabel(table)}\n${text}\n\n#s${sid}`;

export const sidFromText = (t) => {
  const m = /#s([a-z0-9]{8,16})\b/.exec(String(t ?? ''));
  return m ? m[1] : null;
};

/**
 * События для гостя из апдейтов Telegram: кнопки «Иду»/«Принято» под сообщением и ответы реплаем.
 * [{ id: update_id, type: 'going'|'ack'|'reply', text }], по возрастанию id; гость сам отбрасывает уже показанные.
 */
export function eventsFor(updates, sid) {
  const out = [];
  for (const u of updates || []) {
    const cb = u.callback_query;
    if (cb && typeof cb.data === 'string') {
      const [act, s] = cb.data.split(':');
      if (s === sid && act === 'go') out.push({ id: u.update_id, type: 'going', text: 'Официант идёт' });
      if (s === sid && act === 'ok') out.push({ id: u.update_id, type: 'ack', text: 'Официант принял' });
      continue;
    }
    const m = u.message;
    if (m && m.reply_to_message && sidFromText(m.reply_to_message.text) === sid && m.text) {
      out.push({ id: u.update_id, type: 'reply', text: cleanText(m.text, 300) });
    }
  }
  return out.sort((a, b) => a.id - b.id);
}

/** Нажатия кнопок этой сессии новее seen — их нужно подтвердить в Telegram и убрать кнопки. */
export function callbacksFor(updates, sid, seen = 0) {
  return (updates || [])
    .filter((u) => u.update_id > seen && u.callback_query && String(u.callback_query.data || '').endsWith(`:${sid}`))
    .map((u) => ({
      id: u.callback_query.id,
      chatId: u.callback_query.message?.chat?.id,
      messageId: u.callback_query.message?.message_id,
      going: String(u.callback_query.data).startsWith('go:'),
    }));
}

/** Очередь апдейтов не подтверждаем, пока она короткая; длиннее 80 — оставляем последние 40. */
export function trimOffset(updates) {
  if (!updates || updates.length < 80) return null;
  return updates[updates.length - 40].update_id;
}

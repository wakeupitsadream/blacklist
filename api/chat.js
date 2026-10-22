// Чат стола → Telegram официанта и обратно. Токены ТОЛЬКО в env Vercel (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID).
// Без env — демо: { live: false }, и сайт сам показывает пример ответа (так и подписано в чате).
// С env: POST шлёт сообщение с кнопками «Иду»/«Принято»; GET читает getUpdates (хранилище не нужно — ответ
// находит гостя по метке #s<sid> в тексте). Нужен отдельный бот без вебхука, иначе Telegram отдаёт 409.
// В бою вместо Telegram — пульт официанта на российском сервере, формат сообщений тот же (js/features/chat.js).
import { SID_RE, cleanText, validTable, waiterMessage, eventsFor, callbacksFor, trimOffset } from '../js/features/chat.js';

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map();

function throttled(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.start > WINDOW_MS) {
    hits.set(ip, { start: now, n: 1 });
    return false;
  }
  rec.n += 1;
  return rec.n > MAX_PER_WINDOW;
}

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

async function tg(token, method, payload) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ok: Boolean(j.ok), result: j.result };
}

export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  const live = Boolean(token && chat);

  if (req.method === 'POST') {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'local';
    if (throttled(ip)) return res.status(429).json({ ok: false });
    const b = body(req);
    const sid = String(b.sid || '');
    const table = b.table === 'VIP' ? 'VIP' : Number(b.table);
    const text = cleanText(b.text, 500);
    if (!SID_RE.test(sid) || !validTable(table) || !text) {
      return res.status(400).json({ ok: false });
    }
    if (!live) return res.status(200).json({ ok: true, live: false });
    try {
      const r = await tg(token, 'sendMessage', {
        chat_id: chat,
        text: waiterMessage(table, text, sid),
        reply_markup: { inline_keyboard: [[{ text: 'Иду', callback_data: `go:${sid}` }, { text: 'Принято', callback_data: `ok:${sid}` }]] },
      });
      if (!r.ok) console.warn('chat: sendMessage', r.status);
      return res.status(200).json({ ok: true, live: r.ok });
    } catch (e) {
      console.warn('chat: sendMessage', e.message);
      return res.status(200).json({ ok: true, live: false });
    }
  }

  if (req.method === 'GET') {
    const sid = String(req.query?.sid || '');
    const seen = Number(req.query?.seen) || 0;
    if (!SID_RE.test(sid)) return res.status(400).json({ ok: false });
    if (!live) return res.status(200).json({ ok: true, live: false, events: [] });
    try {
      const r = await tg(token, 'getUpdates', { limit: 100, timeout: 0, allowed_updates: ['message', 'callback_query'] });
      if (!r.ok) {
        console.warn('chat: getUpdates', r.status); // 409 — у бота стоит вебхук
        return res.status(200).json({ ok: true, live: true, events: [] });
      }
      const updates = r.result || [];
      const jobs = callbacksFor(updates, sid, seen).flatMap((c) => [
        tg(token, 'answerCallbackQuery', { callback_query_id: c.id, text: c.going ? 'Гость видит: официант идёт' : 'Гость видит: принято' }),
        c.chatId && c.messageId ? tg(token, 'editMessageReplyMarkup', { chat_id: c.chatId, message_id: c.messageId, reply_markup: { inline_keyboard: [] } }) : null,
      ]);
      const offset = trimOffset(updates);
      if (offset) jobs.push(tg(token, 'getUpdates', { offset, limit: 1, timeout: 0 }));
      await Promise.allSettled(jobs.filter(Boolean));
      return res.status(200).json({ ok: true, live: true, events: eventsFor(updates, sid) });
    } catch (e) {
      console.warn('chat: getUpdates', e.message);
      return res.status(200).json({ ok: true, live: true, events: [] });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

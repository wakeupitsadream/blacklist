// Заявка с сайта → Telegram владельца. Токены ТОЛЬКО в env-переменных Vercel
// (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID). Если env не настроен — заявка всё
// равно «принята»: клиент на встрече не должен увидеть ошибку.
//
// В каждом демо меняется только SITE_LABEL. Поля заявки приходят списком
// пар [подпись, значение] — функция не знает бизнес-логики и не ломается,
// когда в форме появляется новое поле.

const SITE_LABEL = 'Заявка с сайта «Black List»';

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const MAX_FIELDS = 16;
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

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'local';
  if (throttled(ip)) return res.status(429).json({ ok: false });

  const b = body(req);
  const name = clean(b.name, 80);
  const phone = clean(b.phone, 32);
  const kind = clean(b.kind, 80);
  if (b.consent !== true || name.length < 2 || phone.replace(/\D/g, '').length !== 11) {
    return res.status(400).json({ ok: false });
  }

  const rows = (Array.isArray(b.fields) ? b.fields : [])
    .slice(0, MAX_FIELDS)
    .filter((f) => Array.isArray(f) && f.length === 2)
    .map(([k, v]) => [clean(k, 40), clean(v, 400)])
    .filter(([k, v]) => k && v)
    .map(([k, v]) => `${k}: ${v}`);

  const text = [
    kind ? `${SITE_LABEL} — ${kind}` : SITE_LABEL,
    `Имя: ${name}`,
    `Телефон: ${phone}`,
    ...rows,
    'Согласие на обработку данных: да',
  ].join('\n');

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return res.status(200).json({ ok: true, demo: true });

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    });
    if (!r.ok) console.warn('order: telegram', r.status);
  } catch (e) {
    console.warn('order: telegram', e.message);
  }
  return res.status(200).json({ ok: true });
}

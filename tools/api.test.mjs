// Проверка serverless-функций без сети: подменяем fetch и env. Запуск: node --test tools/api.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import order from '../api/order.js';
import chat from '../api/chat.js';

function mockRes() {
  return { code: 0, data: null, status(c) { this.code = c; return this; }, json(d) { this.data = d; return this; } };
}
const req = (method, body, query = {}, ip = '1.1.1.1') => ({ method, body, query, headers: { 'x-forwarded-for': ip } });

test('order: GET — 405, без env — принято в демо, без согласия — 400', async () => {
  delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_CHAT_ID;
  let r = mockRes(); await order(req('GET'), r); assert.equal(r.code, 405);
  r = mockRes(); await order(req('POST', { name: 'Аня', phone: '+7 (912) 345-67-89', consent: true, kind: 'Бронь стола', fields: [['Когда', 'пт, 22:00']] }), r);
  assert.deepEqual([r.code, r.data], [200, { ok: true, demo: true }]);
  r = mockRes(); await order(req('POST', { name: 'Аня', phone: '+7 (912) 345-67-89' }, {}, '2.2.2.2'), r); assert.equal(r.code, 400);
});

test('order: с env текст заявки уходит в Telegram', async () => {
  process.env.TELEGRAM_BOT_TOKEN = 'T'; process.env.TELEGRAM_CHAT_ID = '42';
  let sent = null;
  globalThis.fetch = async (url, o) => { sent = { url, body: JSON.parse(o.body) }; return { ok: true, status: 200, json: async () => ({ ok: true }) }; };
  const r = mockRes();
  await order(req('POST', { name: 'Аня', phone: '+7 (912) 345-67-89', consent: true, kind: 'Бронь стола', fields: [['Когда', 'пт, 22:00'], ['Гостей', '6'], ['bad']] }, {}, '3.3.3.3'), r);
  assert.equal(r.code, 200);
  assert.match(sent.url, /botT\/sendMessage$/);
  assert.equal(sent.body.chat_id, '42');
  assert.equal(sent.body.text, 'Заявка с сайта «Black List» — Бронь стола\nИмя: Аня\nТелефон: +7 (912) 345-67-89\nКогда: пт, 22:00\nГостей: 6\nСогласие на обработку данных: да');
});

test('chat: без env — демо, плохой sid — 400', async () => {
  delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_CHAT_ID;
  let r = mockRes(); await chat(req('POST', { sid: 'abc123xyz0', table: 7, text: 'Салфетки' }, {}, '4.4.4.4'), r);
  assert.deepEqual(r.data, { ok: true, live: false });
  r = mockRes(); await chat(req('POST', { sid: 'BAD', table: 7, text: 'x' }, {}, '4.4.4.5'), r); assert.equal(r.code, 400);
  r = mockRes(); await chat(req('GET', null, { sid: 'abc123xyz0' }), r); assert.deepEqual(r.data, { ok: true, live: false, events: [] });
  r = mockRes(); await chat(req('PUT'), r); assert.equal(r.code, 405);
});

test('chat: с env — кнопки, ответ реплаем, подтверждение нажатия', async () => {
  process.env.TELEGRAM_BOT_TOKEN = 'T'; process.env.TELEGRAM_CHAT_ID = '42';
  const calls = [];
  const updates = [
    { update_id: 10, callback_query: { id: 'cb1', data: 'go:abc123xyz0', message: { message_id: 5, chat: { id: 42 } } } },
    { update_id: 11, message: { text: 'Несу', reply_to_message: { text: 'Стол 7\nСалфетки\n\n#sabc123xyz0' } } },
  ];
  globalThis.fetch = async (url, o) => {
    const method = url.split('/').pop(); const b = JSON.parse(o.body); calls.push([method, b]);
    const result = method === 'getUpdates' ? updates : { message_id: 5 };
    return { ok: true, status: 200, json: async () => ({ ok: true, result }) };
  };
  let r = mockRes(); await chat(req('POST', { sid: 'abc123xyz0', table: 7, text: 'Салфетки' }, {}, '5.5.5.5'), r);
  assert.deepEqual(r.data, { ok: true, live: true });
  assert.equal(calls[0][1].text, 'Стол 7\nСалфетки\n\n#sabc123xyz0');
  assert.deepEqual(calls[0][1].reply_markup.inline_keyboard[0].map((k) => k.callback_data), ['go:abc123xyz0', 'ok:abc123xyz0']);
  calls.length = 0;
  r = mockRes(); await chat(req('GET', null, { sid: 'abc123xyz0', seen: '0' }), r);
  assert.deepEqual(r.data.events.map((e) => e.type), ['going', 'reply']);
  assert.deepEqual(calls.map((c) => c[0]).sort(), ['answerCallbackQuery', 'editMessageReplyMarkup', 'getUpdates']);
  calls.length = 0;
  r = mockRes(); await chat(req('GET', null, { sid: 'abc123xyz0', seen: '11' }), r);
  assert.deepEqual(calls.map((c) => c[0]), ['getUpdates']);
});

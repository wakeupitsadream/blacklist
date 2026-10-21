import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUICK, demoReply, parseTable, makeSid, SID_RE, cleanText, waiterMessage, sidFromText, eventsFor, callbacksFor, trimOffset } from './chat.js';

test('ответ на быструю кнопку и на свободный текст', () => {
  assert.equal(demoReply(QUICK[2].label), 'Несу салфетки');
  assert.equal(demoReply('а можно ещё салфеток?'), 'Несу салфетки');
  assert.equal(demoReply('Принесите счет'), 'Несу счёт');
  assert.equal(demoReply('Заказ: Сет «Микс» ×1. Итого 3 300 ₽, гостей 4'), 'Принял заказ, подойду подтвердить');
  assert.equal(demoReply('микрофон не работает'), 'Принято, подхожу');
});

test('номер стола из QR-ссылки', () => {
  assert.equal(parseTable('?t=7'), 7);
  assert.equal(parseTable('?table=12&utm=qr'), 12);
  assert.equal(parseTable('?t=0'), null);
  assert.equal(parseTable('?t=7a'), null);
  assert.equal(parseTable('?t=25', 20), null);
  assert.equal(parseTable(''), null);
});

test('метка сессии', () => {
  const sid = makeSid(new Uint8Array([1, 35, 36, 200, 7, 9, 10, 11, 12, 13, 14, 15, 16]));
  assert.equal(sid.length, 12);
  assert.match(sid, SID_RE);
});

test('текст чистится от переводов строк и обрезается', () => {
  assert.equal(cleanText('  Салфетки\n\nпожалуйста  '), 'Салфетки пожалуйста');
  assert.equal(cleanText('x'.repeat(600)).length, 500);
});

test('метка сессии переживает круг сообщение → реплай', () => {
  const msg = waiterMessage(7, 'Салфетки', 'abc123xyz0');
  assert.equal(sidFromText(msg), 'abc123xyz0');
  assert.equal(sidFromText('без метки'), null);
});

const UPD = [
  { update_id: 10, callback_query: { id: 'cb1', data: 'go:abc123xyz0', message: { message_id: 5, chat: { id: 99 } } } },
  { update_id: 11, message: { text: 'Несу!', reply_to_message: { text: waiterMessage(7, 'Салфетки', 'abc123xyz0') } } },
  { update_id: 12, message: { text: 'Чужому столу', reply_to_message: { text: waiterMessage(3, 'Счёт', 'zzz999zzz9') } } },
  { update_id: 13, callback_query: { id: 'cb2', data: 'ok:zzz999zzz9', message: { message_id: 6, chat: { id: 99 } } } },
  { update_id: 14, message: { text: 'Просто сообщение в чат' } },
];

test('гость видит только свои события', () => {
  assert.deepEqual(eventsFor(UPD, 'abc123xyz0'), [
    { id: 10, type: 'going', text: 'Официант идёт' },
    { id: 11, type: 'reply', text: 'Несу!' },
  ]);
  assert.deepEqual(eventsFor(UPD, 'zzz999zzz9').map((e) => e.type), ['reply', 'ack']);
});

test('кнопки подтверждаются один раз', () => {
  assert.deepEqual(callbacksFor(UPD, 'abc123xyz0'), [{ id: 'cb1', chatId: 99, messageId: 5, going: true }]);
  assert.deepEqual(callbacksFor(UPD, 'abc123xyz0', 10), []);
});

test('очередь апдейтов подрезается только длинная', () => {
  assert.equal(trimOffset(UPD), null);
  const long = Array.from({ length: 90 }, (_, k) => ({ update_id: 100 + k }));
  assert.equal(trimOffset(long), 150);
});

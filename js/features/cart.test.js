import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setQty, inc, dec, qtyOf, lines, totals, perGuest, waiterText, MAX_QTY, clampGuests } from './cart.js';
import { MENU } from '../data/blacklist.js';

test('добавление сохраняет порядок выбора', () => {
  let c = [];
  c = inc(c, 'set-mix');
  c = inc(c, 'fr-fries');
  c = inc(c, 'set-mix');
  assert.deepEqual(c, [['set-mix', 2], ['fr-fries', 1]]);
});

test('уменьшение до нуля убирает строку', () => {
  let c = [['set-mix', 1], ['fr-fries', 2]];
  c = dec(c, 'set-mix');
  assert.deepEqual(c, [['fr-fries', 2]]);
  assert.equal(qtyOf(c, 'set-mix'), 0);
});

test('количество ограничено и не бывает дробным', () => {
  assert.deepEqual(setQty([], 'set-mix', 99), [['set-mix', MAX_QTY]]);
  assert.deepEqual(setQty([], 'set-mix', 2.7), [['set-mix', 2]]);
  assert.deepEqual(setQty([['set-mix', 3]], 'set-mix', 'abc'), []);
});

test('строки и итог считаются по ценам меню', () => {
  const ls = lines([['set-mix', 1], ['fr-fries', 2], ['нет-такого', 1]], MENU);
  assert.equal(ls.length, 2);
  assert.deepEqual(totals(ls), { count: 3, sum: 3300 + 240 * 2 });
});

test('сумма на гостя округляется вверх', () => {
  assert.equal(perGuest(3450, 4), 863);
  assert.equal(perGuest(3300, 1), 3300);
  assert.equal(perGuest(1000, 0), 1000);
  assert.equal(clampGuests(99), 30);
});

test('текст для официанта без неразрывных пробелов', () => {
  const t = waiterText(lines([['set-mix', 1], ['fr-fries', 2]], MENU), 4);
  assert.equal(t, 'Заказ: Сет «Микс» ×1, Картофель фри ×2. Итого 3 780 ₽, гостей 4');
});

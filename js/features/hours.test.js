import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hhmm, localMinutes, openState } from './hours.js';

const B = { open: 1200, close: 360, tzOffsetMin: 300 };
// Оренбург = UTC+5: 21:30 по Оренбургу = 16:30 UTC.
const at = (utc) => new Date(`2026-10-23T${utc}:00Z`);

test('hhmm заворачивает минуты после полуночи', () => {
  assert.equal(hhmm(1200), '20:00');
  assert.equal(hhmm(1500), '01:00');
  assert.equal(hhmm(360), '06:00');
});

test('время считается по Оренбургу, а не по телефону', () => {
  assert.equal(localMinutes(at('16:30'), 300), 21 * 60 + 30);
  assert.equal(localMinutes(at('20:10'), 300), 70); // 01:10 ночи
});

test('открыто вечером и ночью, закрыто днём', () => {
  assert.equal(openState(at('16:30'), B).open, true); // 21:30
  assert.equal(openState(at('22:00'), B).open, true); // 03:00
  assert.equal(openState(at('01:00'), B).open, false); // 06:00 — уже закрыто
  assert.equal(openState(at('09:00'), B).open, false); // 14:00
  assert.equal(openState(at('15:00'), B).open, true); // ровно 20:00
});

test('подписи статуса', () => {
  assert.equal(openState(at('16:30'), B).label, 'Открыто до\xa006:00');
  assert.equal(openState(at('09:00'), B).label, 'Откроемся в\xa020:00');
  assert.equal(openState(at('00:30'), B).soon, true); // 05:30 — до закрытия полчаса
  assert.equal(openState(at('16:30'), B).soon, false);
});

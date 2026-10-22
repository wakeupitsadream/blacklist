import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slotsFor, keepSlot, defaultSlot, slotLabel, slotTime, clampParty, deposit, BOOK } from './booking.js';
import { localDay, nextDays } from './days.js';

const OFF = 300; // Оренбург UTC+5
const at = (utc) => new Date(utc);

test('слот считается по Оренбургу: 22:00 23 окт = 17:00 UTC', () => {
  assert.equal(new Date(slotTime('2026-10-23', 1320, OFF)).toISOString(), '2026-10-23T17:00:00.000Z');
  assert.equal(new Date(slotTime('2026-10-23', 1500, OFF)).toISOString(), '2026-10-23T20:00:00.000Z'); // 01:00 ночи
});

test('днём доступна вся ночь, вечером — только через час и позже', () => {
  const day = slotsFor('2026-10-23', at('2026-10-23T09:00:00Z'), OFF); // 14:00 по Оренбургу
  assert.equal(day.every((s) => s.ok), true);
  assert.equal(day.length, (BOOK.last - BOOK.first) / BOOK.step + 1);
  const eve = slotsFor('2026-10-23', at('2026-10-23T16:40:00Z'), OFF); // 21:40
  assert.deepEqual(eve.filter((s) => s.ok).map((s) => s.label), ['23:00', '00:00', '01:00']);
});

test('выбранное время сгорело — берём ближайшее в ту же ночь', () => {
  const now = at('2026-10-23T16:40:00Z'); // 21:40
  assert.equal(keepSlot('2026-10-23', 1320, now, OFF), 1380);
  assert.equal(keepSlot('2026-10-23', 1440, now, OFF), 1440);
  assert.equal(keepSlot('2026-10-23', 1320, at('2026-10-23T19:30:00Z'), OFF), null); // 00:30 — ночь закрыта
});

test('по умолчанию — сегодня к 22:00, поздно вечером — ближайшее, ночью — завтра', () => {
  const days = (now) => nextDays(localDay(now, OFF), 7);
  let now = at('2026-10-23T09:00:00Z');
  assert.deepEqual(defaultSlot(days(now), now, OFF), { iso: '2026-10-23', m: 1320 });
  now = at('2026-10-23T17:30:00Z'); // 22:30
  assert.deepEqual(defaultSlot(days(now), now, OFF), { iso: '2026-10-23', m: 1440 });
  now = at('2026-10-23T21:30:00Z'); // 02:30 ночи 24 окт по Оренбургу
  assert.deepEqual(defaultSlot(days(now), now, OFF), { iso: '2026-10-24', m: 1320 });
});

test('подписи для кнопки и заявки', () => {
  const now = at('2026-10-23T09:00:00Z');
  const ds = nextDays(localDay(now, OFF), 7);
  assert.equal(slotLabel(ds[0], ds[1], 1320), 'сегодня, 23\xa0окт, 22:00');
  assert.equal(slotLabel(ds[0], ds[1], 1500), 'сегодня ночью, 01:00');
  assert.equal(slotLabel(ds[1], ds[2], 1440), 'завтра ночью, 00:00');
  assert.equal(slotLabel(ds[3], ds[4], 1500), 'ночь на\xa0вт, 27\xa0окт, 01:00');
  assert.equal(slotLabel(ds[3], ds[4], 1260), 'пн, 26\xa0окт, 21:00');
});

test('гостей от 1 до 40', () => {
  assert.equal(clampParty(0), 1);
  assert.equal(clampParty(55), 40);
  assert.equal(clampParty('7'), 7);
});

test('депозит — с каждого гостя', () => {
  assert.equal(deposit(6, 1000), 6000);
  assert.equal(deposit(0, 1000), 1000);
  assert.equal(deposit(55, 1000), 40000);
});

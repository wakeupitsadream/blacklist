import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderErrors, jobErrors, firstError, bookingPayload, jobPayload, MSG } from './order.js';

test('пустая форма — три ошибки, первая — имя', () => {
  const e = orderErrors({});
  assert.deepEqual(e, { name: MSG.name, phone: MSG.phone, consent: MSG.consent });
  assert.equal(firstError(e, ['name', 'phone', 'consent']), 'name');
});

test('телефон с 8 и с маской проходит, короткий — нет', () => {
  assert.equal(orderErrors({ name: 'Аня', phone: '8 912 345-67-89', consent: true }).phone, '');
  assert.equal(orderErrors({ name: 'Аня', phone: '+7 (912) 345-67-89', consent: true }).phone, '');
  assert.equal(orderErrors({ name: 'Аня', phone: '+7 (912) 345', consent: true }).phone, MSG.phone);
});

test('отклик без «мне есть 18» не уходит', () => {
  const ok = { name: 'Дима', phone: '+7 (912) 345-67-89', consent: true };
  assert.equal(jobErrors(ok).adult, MSG.adult);
  assert.equal(jobErrors({ ...ok, adult: true }).adult, '');
});

test('бронь: поля без неразрывных пробелов, пустые не уходят', () => {
  const p = bookingPayload({ name: ' Аня ', phone: '+7 (912) 345-67-89', when: 'пт, 24\xa0окт, 22:00', guests: 6, zone: 'VIP-зона', deposit: '6\xa0000\xa0₽', occasion: 'День рождения', comment: '' });
  assert.deepEqual(p, {
    name: 'Аня', phone: '+7 (912) 345-67-89', consent: true, kind: 'Бронь стола',
    fields: [['Когда', 'пт, 24 окт, 22:00'], ['Гостей', '6'], ['Зона', 'VIP-зона'], ['Депозит', '6 000 ₽'], ['Повод', 'День рождения']],
  });
});

test('отклик: должность и подтверждение возраста', () => {
  const p = jobPayload({ name: 'Дима', phone: '+7 (912) 345-67-89', role: 'Бармен', adult: true });
  assert.deepEqual(p.fields, [['Должность', 'Бармен'], ['Возраст', '18+ (подтвердил)']]);
  assert.equal(p.kind, 'Отклик на вакансию');
});

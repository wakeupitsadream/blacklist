// Заявки с сайта: бронь стола и отклик на вакансию. Проверка контактов и поля для администратора. Чистые функции без DOM.
// Поля — пары [подпись, значение]; пустые не отправляем (api/order.js не знает бизнес-логики).

export const MSG = {
  name: 'Напишите, как к\xa0вам обращаться',
  phone: 'Проверьте номер: нужно 10\xa0цифр после +7',
  consent: 'Без согласия не\xa0можем принять заявку\xa0— отметьте галочку',
  adult: 'Смены ночные, поэтому берём с\xa018\xa0лет',
};

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const plain = (s) => clean(String(s ?? '').replace(/\xa0/g, ' '));

/** Ошибки по полям; пустая строка — поле в порядке. Телефон — 11 цифр, с 7 или 8. */
export function orderErrors(form) {
  const d = String(form.phone ?? '').replace(/\D/g, '');
  return {
    name: clean(form.name).length >= 2 ? '' : MSG.name,
    phone: d.length === 11 && /^[78]/.test(d) ? '' : MSG.phone,
    consent: form.consent ? '' : MSG.consent,
  };
}

/** Отклик: те же поля плюс «мне есть 18» (ст. 96 ТК: к ночной работе — только совершеннолетних). */
export function jobErrors(form) {
  return { ...orderErrors(form), adult: form.adult ? '' : MSG.adult };
}

export const firstError = (errs, order) => order.find((k) => errs[k]) || '';

/** form: { name, phone, when: «пт, 24 окт, 22:00», guests: 6, occasion, comment }. */
export function bookingPayload(form) {
  const fields = [
    ['Когда', plain(form.when)],
    ['Гостей', plain(form.guests)],
    ['Повод', plain(form.occasion)],
    ['Комментарий', plain(form.comment)],
  ];
  return { name: plain(form.name), phone: plain(form.phone), consent: true, kind: 'Бронь стола', fields: fields.filter(([, v]) => v) };
}

/** form: { name, phone, role: «Официант» }. */
export function jobPayload(form) {
  const fields = [
    ['Должность', plain(form.role)],
    ['Возраст', form.adult ? '18+ (подтвердил)' : ''],
  ];
  return { name: plain(form.name), phone: plain(form.phone), consent: true, kind: 'Отклик на вакансию', fields: fields.filter(([, v]) => v) };
}

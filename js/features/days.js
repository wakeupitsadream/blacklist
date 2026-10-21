// Даты для брони: ближайшая неделя с «сегодня» и «завтра» по Оренбургу, дата выезда, подпись диапазона. Чистые функции без DOM.

const DAY_NAMES = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const DAY_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MON_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const cap = (s) => s.replace(/^./, (c) => c.toUpperCase());

/** Сегодня по Оренбургу: { y, m, d } (часовой пояс телефона не важен). */
export function localDay(now, offsetMin) {
  const t = new Date(now.getTime() + offsetMin * 60000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
}

export const isoOf = (t) => new Date(Date.UTC(t.y, t.m, t.d)).toISOString().slice(0, 10);

/** Карточка дня: iso, день недели (0 — вс), подпись чипа (wd, num), короткая и полная дата. */
export function dayCard(date, today) {
  const wd = date.getUTCDay();
  const diff = Math.round((date - Date.UTC(today.y, today.m, today.d)) / 86400000);
  const num = `${date.getUTCDate()}\xa0${MON_SHORT[date.getUTCMonth()]}`;
  return {
    iso: date.toISOString().slice(0, 10),
    dow: wd,
    day: date.getUTCDate(),
    month: date.getUTCMonth(),
    wd: diff === 0 ? 'Сегодня' : diff === 1 ? 'Завтра' : cap(DAY_SHORT[wd]),
    num,
    short: diff === 0 ? `сегодня, ${num}` : diff === 1 ? `завтра, ${num}` : `${DAY_SHORT[wd]}, ${num}`,
    full: `${DAY_NAMES[wd]}, ${date.getUTCDate()}\xa0${MONTHS[date.getUTCMonth()]}`,
  };
}

/** count дней подряд, начиная с сегодня. */
export function nextDays(today, count = 7) {
  const out = [];
  for (let i = 0; i < count; i += 1) out.push(dayCard(new Date(Date.UTC(today.y, today.m, today.d + i)), today));
  return out;
}

/** Карточка даты ГГГГ-ММ-ДД, сдвинутой на shift дней; null — если строка не дата. */
export function dateCard(iso, today, shift = 0) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return null;
  return dayCard(new Date(Date.UTC(y, m - 1, d + shift)), today);
}

/** Диапазон проживания для кнопки: «9–11 окт», через месяц — «30 окт — 1 ноя». */
export function rangeLabel(a, b) {
  if (a.month === b.month) return `${a.day}–${b.day}\xa0${MON_SHORT[a.month]}`;
  return `${a.num} — ${b.num}`;
}

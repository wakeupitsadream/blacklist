// Бронь стола. Ночь называется датой вечера: приход с BOOK.first до BOOK.last, после полуночи — уже следующий
// календарный день. Прошедшее время недоступно по Оренбургу, а не по часам телефона. Чистые функции без DOM.
// Занятость не выдумываем: это заявка, стол подтверждает администратор (★ сколько столов и до скольки держат).
import { hhmm } from './hours.js';

export const BOOK = { first: 1200, last: 1500, step: 60, prefer: 1320, leadMin: 60 };
export const OCCASIONS = ['Просто отдохнуть', 'День рождения', 'Корпоратив'];
export const MAX_PARTY = 40;

/** Абсолютное время прихода, мс UTC: полночь даты по Оренбургу + m минут. */
export function slotTime(iso, m, offsetMin) {
  const [y, mo, d] = String(iso).split('-').map(Number);
  return Date.UTC(y, mo - 1, d) + (m - offsetMin) * 60000;
}

/** Время прихода на ночь iso: [{ m, label, ok }]; ok=false — прошло или меньше часа до него. */
export function slotsFor(iso, now, offsetMin, b = BOOK) {
  const out = [];
  for (let m = b.first; m <= b.last; m += b.step) {
    const ok = slotTime(iso, m, offsetMin) >= now.getTime() + b.leadMin * 60000;
    out.push({ m, label: hhmm(m), ok });
  }
  return out;
}

/** Выбранное время, если ещё доступно; иначе ближайшее доступное в эту же ночь (при равенстве — раньше); null — ночь закрыта. */
export function keepSlot(iso, m, now, offsetMin, b = BOOK) {
  const ok = slotsFor(iso, now, offsetMin, b).filter((s) => s.ok);
  if (!ok.length) return null;
  if (ok.some((s) => s.m === m)) return m;
  return ok.reduce((best, s) => (Math.abs(s.m - m) < Math.abs(best.m - m) ? s : best)).m;
}

/** По умолчанию — ближайшая ночь, где ещё можно прийти к 22:00 или ближе всего к нему. */
export function defaultSlot(days, now, offsetMin, b = BOOK) {
  for (const d of days) {
    const m = keepSlot(d.iso, b.prefer, now, offsetMin, b);
    if (m != null) return { iso: d.iso, m };
  }
  return null;
}

/** «пт, 24 окт, 22:00»; после полуночи — «сегодня ночью, 01:00» или «ночь на сб, 25 окт, 01:00». */
export function slotLabel(day, next, m) {
  if (m < 1440) return `${day.short}, ${hhmm(m)}`;
  if (day.wd === 'Сегодня') return `сегодня ночью, ${hhmm(m)}`;
  if (day.wd === 'Завтра') return `завтра ночью, ${hhmm(m)}`;
  return `ночь на\xa0${next.short}, ${hhmm(m)}`;
}

export const clampParty = (n) => Math.max(1, Math.min(MAX_PARTY, Math.trunc(Number(n)) || 1));

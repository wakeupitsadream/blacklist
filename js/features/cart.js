// Чек стола: позиции в порядке добавления, итог, сумма на гостя, текст для официанта. Чистые функции без DOM.
// Корзина — массив пар [id, количество]: порядок строк в чеке совпадает с порядком выбора.
import { money } from './plural.js';

export const MAX_QTY = 20;
export const MAX_GUESTS = 30;

export const qtyOf = (cart, id) => (cart.find(([k]) => k === id) || [, 0])[1];

/** Новая корзина с количеством qty для id: 0 — убрать, больше MAX_QTY — обрезать. */
export function setQty(cart, id, qty) {
  const q = Math.max(0, Math.min(MAX_QTY, Math.trunc(Number(qty) || 0)));
  const has = cart.some(([k]) => k === id);
  if (!q) return cart.filter(([k]) => k !== id);
  if (has) return cart.map(([k, v]) => (k === id ? [k, q] : [k, v]));
  return [...cart, [id, q]];
}

export const inc = (cart, id) => setQty(cart, id, qtyOf(cart, id) + 1);
export const dec = (cart, id) => setQty(cart, id, qtyOf(cart, id) - 1);

/** Строки чека: { id, name, price, qty, sum }; неизвестные id (блюдо убрали из меню) пропускаются. */
export function lines(cart, menu) {
  const byId = new Map(menu.map((m) => [m.id, m]));
  return cart
    .filter(([id]) => byId.has(id))
    .map(([id, qty]) => {
      const m = byId.get(id);
      return { id, name: m.name, price: m.price, qty, sum: m.price * qty };
    });
}

export function totals(ls) {
  return { count: ls.reduce((a, l) => a + l.qty, 0), sum: ls.reduce((a, l) => a + l.sum, 0) };
}

/** Сколько с человека: округляем вверх до рубля, чтобы компания не недоплатила. */
export function perGuest(sum, guests) {
  const g = Math.max(1, Math.min(MAX_GUESTS, Math.trunc(guests) || 1));
  return Math.ceil(sum / g);
}

export const clampGuests = (g) => Math.max(1, Math.min(MAX_GUESTS, Math.trunc(Number(g)) || 1));

/** Текст заказа для официанта одной строкой: «Сет «Микс» ×1, Фри ×2. Итого 3 780 ₽, гостей 4». */
export function waiterText(ls, guests) {
  const { sum } = totals(ls);
  const items = ls.map((l) => `${l.name} ×${l.qty}`).join(', ');
  return `Заказ: ${items}. Итого ${money(sum)}, гостей ${clampGuests(guests)}`.replace(/\xa0/g, ' ');
}

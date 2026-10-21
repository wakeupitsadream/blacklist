// Открыто ли сейчас: бар работает с B.open до B.close следующего дня по Оренбургу. Чистые функции без DOM.

/** 1200 → «20:00»; минуты больше суток заворачиваются: 1500 → «01:00». */
export const hhmm = (m) => {
  const v = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};

/** Минуты от полуночи по часовому поясу бара (часовой пояс телефона не важен). */
export function localMinutes(now, offsetMin) {
  const t = new Date(now.getTime() + offsetMin * 60000);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}

/** { open, label, soon }: «Открыто до 06:00» или «Откроемся в 20:00»; soon — до закрытия меньше часа. */
export function openState(now, B) {
  const m = localMinutes(now, B.tzOffsetMin);
  const overnight = B.open > B.close;
  const open = overnight ? m >= B.open || m < B.close : m >= B.open && m < B.close;
  if (!open) return { open, label: `Откроемся в\xa0${hhmm(B.open)}`, soon: false };
  const left = (B.close - m + 1440) % 1440;
  return { open, label: `Открыто до\xa0${hhmm(B.close)}`, soon: left <= 60 };
}

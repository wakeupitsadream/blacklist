// Детерминированный «шум» для демо-данных: никакого Math.random().
// FNV-1a от строки → число 0..1, стабильное для одного и того же ключа.
// Картинка на демо живая, но воспроизводимая: в любую минуту встречи
// она выглядит правдоподобно и одинаково после перезагрузки.

export function hash01(s) {
  let h = 2166136261 >>> 0;
  const str = String(s);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h / 4294967295;
}

// Ключ даты в локальном времени: 2026-10-14.
export function dateKey(date) {
  const d = date instanceof Date ? date : new Date(`${date}T12:00:00`);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// «Ведро» времени: одинаковое значение внутри окна в N минут.
export function timeBucket(date, minutes = 10) {
  const d = date instanceof Date ? date : new Date(date);
  return Math.floor(d.getTime() / (minutes * 60000));
}

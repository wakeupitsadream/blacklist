// Русские склонения: plural(5, 'гость', 'гостя', 'гостей') → «гостей».
export function plural(n, one, few, many) {
  const abs = Math.abs(Math.trunc(n));
  const d10 = abs % 10;
  const d100 = abs % 100;
  if (d10 === 1 && d100 !== 11) return one;
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return few;
  return many;
}

// «5 гостей» одной строкой, число и слово через неразрывный пробел.
export function pluralize(n, one, few, many) {
  return `${n}\xa0${plural(n, one, few, many)}`;
}

// Формат суммы: 187500 → «187 500 ₽». Разряды и знак рубля соединяются
// неразрывным пробелом U+00A0, чтобы сумма не разрывалась при переносе.
export function money(n) {
  return Math.round(n).toLocaleString('ru-RU').replace(/\s/g, '\xa0') + '\xa0₽';
}

// Число с разрядами без знака рубля: 12500 → «12 500».
export function num(n) {
  return Math.round(n).toLocaleString('ru-RU').replace(/\s/g, '\xa0');
}

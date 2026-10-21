// Премиальная полировка интерфейса: нижняя панель после hero, count-up цифр.
// Чистые UX-эффекты без бизнес-логики; уважают prefers-reduced-motion.

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Нижняя панель CTA показывается, когда hero ушёл из кадра. */
export function mobileBar(barSel = '#mobile-cta', heroSel = '.hero') {
  const bar = document.querySelector(barSel);
  const hero = document.querySelector(heroSel);
  if (!bar) return;
  if (!hero || !('IntersectionObserver' in window)) { bar.classList.add('show'); return; }
  const io = new IntersectionObserver(([en]) => {
    bar.classList.toggle('show', !en.isIntersecting);
  }, { threshold: 0.05 });
  io.observe(hero);
}

/**
 * Count-up больших чисел: элемент с data-count="4,9" досчитывает от 0 при появлении.
 * Формат (запятая, неразрывные пробелы) берётся из исходного текста.
 */
export function countUps(sel = '[data-count]') {
  const els = document.querySelectorAll(sel);
  if (!els.length) return;
  if (reduced || !('IntersectionObserver' in window)) return;

  const run = (el) => {
    const raw = el.dataset.count.replace(/\s|\xa0/g, '');
    const target = parseFloat(raw.replace(',', '.'));
    if (!Number.isFinite(target)) return;
    const decimals = (raw.split(',')[1] || '').length;
    const dur = 900;
    const t0 = performance.now();
    const fmt = (v) => v.toFixed(decimals).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '\xa0');
    const tick = (now) => {
      const p = Math.max(0, Math.min(1, (now - t0) / dur));
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * e);
      if (p < 1) requestAnimationFrame(tick); else el.textContent = fmt(target);
    };
    requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } });
  }, { threshold: 0.6 });
  els.forEach((e) => io.observe(e));
}

/** Демо-плашка сверху: закрывается крестиком, состояние живёт до перезагрузки. */
export function demoRibbon(sel = '#demo-ribbon') {
  const el = document.querySelector(sel);
  if (!el) return;
  const btn = el.querySelector('button');
  if (btn) btn.addEventListener('click', () => { el.hidden = true; document.body.classList.remove('has-ribbon'); });
}

/**
 * Маска телефона +7 (XXX) XXX-XX-XX без сторонних библиотек.
 * Позволяет вставку «8 905…», «+7905…», «905…».
 */
export function phoneMask(input) {
  if (!input) return;
  const format = (digits) => {
    let d = digits.replace(/\D/g, '');
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (!d.startsWith('7')) d = '7' + d;
    // В поле уже стоит «+7 (», а человек набирает номер по привычке с 8 или 7: «8 912…».
    // Лишняя цифра видна, когда цифр становится 12, — тогда убираем её, а не последнюю.
    if (d.length > 11 && (d[1] === '8' || d[1] === '7')) d = '7' + d.slice(2);
    d = d.slice(0, 11);
    const p = d.slice(1);
    let out = '+7';
    if (p.length) out += ' (' + p.slice(0, 3);
    if (p.length >= 3) out += ')';
    if (p.length > 3) out += ' ' + p.slice(3, 6);
    if (p.length > 6) out += '-' + p.slice(6, 8);
    if (p.length > 8) out += '-' + p.slice(8, 10);
    return out;
  };
  input.addEventListener('input', () => {
    let v = input.value;
    // Курсор оказался перед «+7 (» (тап у левого края поля, автофокус): набранные цифры переносим за префикс.
    const lead = /^([^+]+)\+7 ?\(?/.exec(v);
    if (lead && /\d/.test(lead[1])) v = '+7 (' + lead[1] + v.slice(lead[0].length);
    if (!v.replace(/\D/g, '')) { input.value = ''; return; }
    input.value = format(v);
  });
  input.addEventListener('focus', () => {
    if (input.value) return;
    input.value = '+7 (';
    requestAnimationFrame(() => { if (document.activeElement === input) input.setSelectionRange(input.value.length, input.value.length); });
  });
  input.addEventListener('blur', () => { if (input.value.replace(/\D/g, '').length <= 1) input.value = ''; });
}

/** Телефон полный: 11 цифр, начинается с 7. */
export function phoneValid(value) {
  const d = String(value || '').replace(/\D/g, '');
  return d.length === 11 && d.startsWith('7');
}

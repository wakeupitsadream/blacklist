// Сценарная проверка демо Black List по страницам: node tools/flow-blacklist.mjs [outdir]
// Сервер с cleanUrls (serve) на BASE. Время фиксировано: пятница 23.10.2026, 21:40 по Оренбургу (16:40 UTC).
// /api/* перехватывается: проверяем payload заявок и сообщений официанту.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';

const out = process.argv[2] || 'shots-flow';
mkdirSync(out, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8766/';
const WIDTHS = [320, 360, 390, 768, 1024, 1440];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const results = [];

async function context(width, time = '2026-10-23T16:40:00Z') {
  const ctx = await browser.newContext({ viewport: { width, height: width < 900 ? 800 : 900 }, locale: 'ru-RU' });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(time) });
  const posts = [];
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => { if (!/fonts\.g|\.mp4/.test(r.url())) errors.push(`failed ${r.method()} ${r.url()} ${r.failure()?.errorText} @ ${page.url()} ${JSON.stringify(r.postData())}`); });
  await page.route('**/api/**', async (r) => {
    if (r.request().method() === 'POST') posts.push({ url: r.request().url(), body: JSON.parse(r.request().postData() || '{}') });
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, live: false, demo: true, events: [] }) });
  });
  const go = async (path) => {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    assert.equal(sw, cw, `${width} /${path}: горизонтальный скролл ${sw} > ${cw}`);
  };
  return { ctx, page, posts, errors, go };
}

const text = (page, sel) => page.locator(sel).first().innerText();
const mobile = (w) => w < 900;
const flat = (s) => s.replace(/\s+/g, ' ').trim();

/** Ждём, пока сообщение уйдёт на сервер, и прокручиваем демо-ответ официанта на фейковых часах. */
async function waitReply(page, posts, before) {
  while (posts.length === before) await page.waitForTimeout(40);
  await page.waitForTimeout(150);
  await page.clock.runFor(4000);
}

for (const width of WIDTHS) {
  const tag = `w${width}`;
  const { ctx, page, posts, errors, go } = await context(width);

  // Главная: статус, бронь первой кнопкой, ролики, правила песен, разделы.
  await go('');
  assert.match(await text(page, '#open-status'), /Открыто до\s06:00/);
  assert.equal(await page.getAttribute('.hero-cta .btn', 'href'), 'bron');
  assert.equal(await page.locator('#reels figure video[poster]').count(), 3);
  assert.equal(await page.locator('#songs-list li').count(), 3);
  assert.equal(await page.locator('.tiles .tile').count(), 4);
  if (width === 390 || width === 1440) await page.screenshot({ path: `${out}/${tag}-home.png` });

  // Меню: «Лёд» прямо со страницы → строка выбора стола → стол 5 → демо-ответ.
  await go('menu');
  let before = posts.length;
  await page.locator('#waiter-chips .chip', { hasText: 'Лёд' }).click();
  await page.waitForSelector('#chat-sheet[open]');
  assert.equal(await page.isVisible('#chat-table'), true, `${tag}: строка выбора стола`);
  assert.equal(await page.locator('#chat-tables button').count(), 11, `${tag}: 10 столов + VIP`);
  await page.click('#chat-tables button:nth-child(5)');
  await waitReply(page, posts, before);
  assert.deepEqual(posts.at(-1).body, { sid: posts.at(-1).body.sid, table: 5, text: 'Лёд' });
  assert.equal(await page.locator('.msg-them').last().innerText(), 'Официант · 21:40\nНесу лёд');
  assert.equal(await page.isVisible('#chat-table'), false);
  // Своё сообщение: стол уже известен — уходит сразу.
  before = posts.length;
  await page.fill('#chat-input', 'Принесите ещё салфеток');
  await page.press('#chat-input', 'Enter');
  await waitReply(page, posts, before);
  assert.equal(await page.locator('.msg-them').last().innerText(), 'Официант · 21:40\nНесу салфетки');
  assert.equal(await page.locator('.msg-note').count(), 1, `${tag}: подпись демо один раз`);
  await page.screenshot({ path: `${out}/${tag}-chat.png` });
  await page.click('#chat-sheet [data-close]');
  assert.equal(await page.isVisible('#top-table'), true, `${tag}: номер стола в шапке`);

  // Чек: сет «Микс» и фри ×2 → итог и на гостя, отправка официанту.
  await page.locator('[data-qty="set-mix"] .add').click();
  await page.locator('[data-qty="fr-fries"] .add').click();
  await page.locator('[data-qty="fr-fries"] button:last-of-type').click();
  if (mobile(width)) {
    assert.equal(await text(page, '#dock-check-label'), 'Чек · 3\xa0780\xa0₽');
    await page.click('#dock-check');
    await page.waitForSelector('#check-sheet[open]');
    await page.screenshot({ path: `${out}/${tag}-check.png` });
  }
  const check = mobile(width) ? '#check-sheet [data-check]' : '.check-col [data-check]';
  assert.equal(await page.locator(`${check} .check-title`).innerText(), 'Стол 5');
  assert.equal(await page.locator(`${check} .check-total b`).innerText(), '3\xa0780\xa0₽');
  assert.match(await page.locator(`${check} .check-split`).innerText(), /по\s945\s₽/);
  assert.equal(flat(await page.locator(`${check} .btn`).innerText()), 'Отправить официанту: 3 позиции, 3 780 ₽');
  before = posts.length;
  await page.locator(`${check} .btn`).click();
  await page.waitForSelector('#chat-sheet[open]');
  await waitReply(page, posts, before);
  assert.equal(posts.at(-1).body.text, 'Заказ: Сет «Микс» ×1, Картофель фри ×2. Итого 3 780 ₽, гостей 4');
  assert.equal(await page.locator('.msg-them').last().innerText(), 'Официант · 21:40\nПринял заказ, подойду подтвердить');
  await page.click('#chat-sheet [data-close]');

  // Бронь: по умолчанию сегодня 23:00, депозит 4 000 ₽; ошибки формы; VIP, завтра ночью, депозит в заявке.
  await go('bron');
  assert.equal(await text(page, '#book-btn'), 'Забронировать: сегодня, 23:00');
  assert.deepEqual(await page.locator('#book-times .time:disabled').allInnerTexts(), ['20:00', '21:00', '22:00']);
  assert.equal(await page.locator('#book-ticket .check-total b').innerText(), '4\xa0000\xa0₽');
  await page.click('[data-party="1"]');
  assert.equal(await page.locator('#book-ticket .check-total b').innerText(), '5\xa0000\xa0₽');
  await page.locator('#book-zone .chip', { hasText: 'VIP-зона' }).click();
  assert.match(await page.locator('#book-ticket .ticket-rows').innerText(), /Зона\s+VIP-зона/);
  await page.click('#book-btn');
  assert.equal(await page.locator('#book-form .err:not(:empty)').count(), 3, `${tag}: три ошибки`);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'b-name');
  await page.fill('#b-name', 'Аня');
  await page.click('#b-phone');
  await page.keyboard.type('89123456789');
  assert.equal(await page.inputValue('#b-phone'), '+7 (912) 345-67-89');
  if (mobile(width)) assert.equal(await page.locator('#dock').evaluate((d) => d.classList.contains('typing')), true, `${tag}: панель прячется при вводе`);
  await page.click('#book-btn');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'b-consent');
  await page.locator('#book-days .day').nth(1).click();
  await page.locator('#book-times .time', { hasText: '01:00' }).click();
  await page.locator('#book-occasion .chip', { hasText: 'День рождения' }).click();
  assert.equal(await text(page, '#book-btn'), 'Забронировать: завтра ночью, 01:00');
  await page.check('#b-consent');
  before = posts.length;
  await page.click('#book-btn');
  await page.waitForSelector('#book-done:not([hidden])');
  assert.deepEqual(posts[before].body.fields, [['Когда', 'завтра ночью, 01:00'], ['Гостей', '5'], ['Зона', 'VIP-зона'], ['Депозит', '5 000 ₽'], ['Повод', 'День рождения']]);
  assert.match(await text(page, '#book-done-what'), /^Завтра ночью, 01:00\s· 5\sгостей\s· VIP-зона\s· депозит 5\s000\s₽\. Аня, \+7 \(912\) 345-67-89$/);
  await page.screenshot({ path: `${out}/${tag}-book-done.png` });
  await page.click('#book-again');
  assert.equal(await page.inputValue('#b-name'), 'Аня', `${tag}: «Изменить бронь» сохраняет имя`);

  // Бронь из чека: гости переходят в форму, депозит считается сразу.
  await go('bron?guests=7');
  assert.equal(await page.locator('#book-ticket .check-total b').innerText(), '7\xa0000\xa0₽');

  // Вакансии: 4 должности, без «18 лет» не уходит.
  await go('vakansii');
  assert.equal(await page.locator('#jobs-list .job').count(), 4);
  await page.locator('#jobs-list .job', { hasText: 'Повар' }).click();
  assert.equal(await text(page, '#job-btn'), 'Откликнуться: повар');
  await page.fill('#j-name', 'Дима');
  await page.click('#j-phone');
  await page.keyboard.type('9123456789');
  await page.check('#j-consent');
  await page.click('#job-btn');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'j-adult');
  await page.check('#j-adult');
  before = posts.length;
  await page.click('#job-btn');
  await page.waitForSelector('#job-done:not([hidden])');
  assert.deepEqual(posts[before].body.fields, [['Должность', 'Повар'], ['Возраст', '18+ (подтвердил)']]);

  // Акции и контакты.
  await go('akcii');
  assert.equal(await page.locator('#promo-list .promo').count(), 2);
  await go('kontakty');
  assert.match(await text(page, '#hours-now'), /открыто, до закрытия 8\sч 20\sмин/);
  assert.match(await page.getAttribute('#route-2gis', 'href'), /2gis\.ru\/orenburg\/firm\/70000001081679491/);

  // «Разделы» на телефоне ведут на страницу.
  if (mobile(width)) {
    await page.click('#dock-nav');
    await page.waitForSelector('#nav-sheet[open]');
    if (width === 390) await page.screenshot({ path: `${out}/${tag}-nav.png` });
    await Promise.all([page.waitForURL(/\/vakansii$/), page.click('#nav-sheet a[href="vakansii"]')]);
  }

  assert.deepEqual(errors, [], `${tag}: ошибки консоли`);
  results.push(`${tag}: ok`);
  await ctx.close();
}

// QR-стол: /menu?t=7 — номер в шапке и в чате, просьба уходит без выбора стола.
{
  const { ctx, page, posts, errors, go } = await context(390);
  await go('menu?t=7');
  assert.equal(await page.isVisible('#top-table'), true);
  const before = posts.length;
  await page.locator('#waiter-chips .chip', { hasText: 'Счёт' }).click();
  await waitReply(page, posts, before);
  assert.equal(await page.isVisible('#chat-table'), false);
  assert.match(await text(page, '#chat-sub'), /Стол 7/);
  assert.equal(posts.at(-1).body.table, 7);
  assert.deepEqual(errors, []);
  results.push('QR /menu?t=7: ok');
  await ctx.close();
}

// VIP-зона по QR: ?t=vip.
{
  const { ctx, page, posts, go } = await context(390);
  await go('menu?t=vip');
  assert.match(await page.locator('#top-table').innerText(), /VIP/);
  const before = posts.length;
  await page.click('#dock-waiter');
  await page.locator('#chat-quick .chip', { hasText: 'Салфетки' }).click();
  await waitReply(page, posts, before);
  assert.equal(posts.at(-1).body.table, 'VIP');
  assert.match(await text(page, '#chat-sub'), /VIP-зона/);
  results.push('QR ?t=vip: ok');
  await ctx.close();
}

// Ночь 02:30: «сегодня» — уже 24 октября, бронь по умолчанию на 22:00.
{
  const { ctx, page, go } = await context(390, '2026-10-23T21:30:00Z');
  await go('bron');
  assert.equal(await text(page, '#book-btn'), 'Забронировать: сегодня, 22:00');
  assert.equal(await text(page, '#book-days .day.on span'), '24\xa0окт');
  results.push('ночь 02:30: ok');
  await ctx.close();
}

// День 14:00: закрыто, откроемся через 6 часов.
{
  const { ctx, page, go } = await context(390, '2026-10-23T09:00:00Z');
  await go('');
  assert.match(await text(page, '#open-status'), /Откроемся в\s20:00/);
  await go('kontakty');
  assert.match(await text(page, '#hours-now'), /откроемся через 6\sч/);
  results.push('день 14:00: ok');
  await ctx.close();
}

await browser.close();
console.log(results.join('\n'));

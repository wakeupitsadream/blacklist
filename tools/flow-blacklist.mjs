// Сценарная проверка демо Black List: node tools/flow-blacklist.mjs [outdir]
// Время фиксировано: пятница 23.10.2026, 21:40 по Оренбургу (16:40 UTC). /api/* перехватывается: проверяем payload.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';

const out = process.argv[2] || 'shots-flow';
mkdirSync(out, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const WIDTHS = [320, 360, 390, 768, 1024, 1440];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const results = [];

async function open(width, query = '', time = '2026-10-23T16:40:00Z') {
  const ctx = await browser.newContext({ viewport: { width, height: width < 900 ? 800 : 900 }, locale: 'ru-RU' });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(time) });
  const posts = [];
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => { if (!/fonts\.g/.test(r.url())) errors.push(`failed ${r.url()}`); });
  await page.route('**/api/**', async (r) => {
    if (r.request().method() === 'POST') posts.push({ url: r.request().url(), body: JSON.parse(r.request().postData() || '{}') });
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, live: false, demo: true, events: [] }) });
  });
  await page.goto(BASE + query, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return { page, ctx, posts, errors };
}

const text = (page, sel) => page.locator(sel).first().innerText();
const mobile = (w) => w < 900;

for (const width of WIDTHS) {
  const { page, ctx, posts, errors } = await open(width);
  const tag = `w${width}`;

  // Ширина: без горизонтального скролла.
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  assert.equal(sw, cw, `${tag}: горизонтальный скролл ${sw} > ${cw}`);

  // Статус и бронь по умолчанию — без единого клика.
  assert.match(await text(page, '#open-status'), /Открыто до\s06:00/);
  assert.equal(await text(page, '#book-btn'), 'Забронировать: сегодня, 23:00');
  const disabled = await page.locator('#book-times .time:disabled').allInnerTexts();
  assert.deepEqual(disabled, ['20:00', '21:00', '22:00'], `${tag}: прошедшие слоты`);

  // Чек: «+» у сета «Микс» и фри ×2 → итог, на гостя, кнопка называет выбор.
  await page.locator('[data-qty="set-mix"] .add').click();
  await page.locator('[data-qty="fr-fries"] .add').click();
  await page.locator('[data-qty="fr-fries"] button:last-of-type').click();
  const sendLabel = 'Отправить официанту: 3\xa0позиции, 3\xa0780\xa0₽';
  if (mobile(width)) {
    assert.equal(await text(page, '#dock-check-label'), 'Чек · 3\xa0780\xa0₽');
    await page.click('#dock-check');
    await page.waitForSelector('#check-sheet[open]');
    await page.screenshot({ path: `${out}/${tag}-check.png` });
  }
  const check = mobile(width) ? '#check-sheet [data-check]' : '.check-col [data-check]';
  assert.equal(await page.locator(`${check} .check-total b`).innerText(), '3\xa0780\xa0₽');
  assert.match(await page.locator(`${check} .check-split`).innerText(), /по\s945\s₽/);
  assert.equal((await page.locator(`${check} .btn`).innerText()).replace(/\s+/g, ' '), sendLabel.replace(/\xa0/g, ' '));

  // Отправить официанту → выбор стола → сообщение-заказ → демо-ответ.
  await page.locator(`${check} .btn`).click();
  await page.waitForSelector('#chat-sheet[open]');
  assert.equal(await page.isVisible('#chat-pick'), true, `${tag}: выбор стола`);
  await page.click('#chat-tables button:nth-child(5)');
  await page.waitForSelector('.msg-me.order');
  await page.waitForTimeout(150);
  assert.match(await text(page, '.msg-me.order'), /^Заказ: Сет «Микс» ×1, Картофель фри ×2\. Итого 3 780 ₽, гостей 4$/);
  assert.deepEqual(posts.at(-1).body, { sid: posts.at(-1).body.sid, table: 5, text: 'Заказ: Сет «Микс» ×1, Картофель фри ×2. Итого 3 780 ₽, гостей 4' });
  await page.clock.runFor(4000);
  assert.equal(await text(page, '.msg-them'), 'Официант · 21:40\nПринял заказ, подойду подтвердить');
  assert.match(await text(page, '.msg-st'), /Прочитано · 21:40/);
  const sent = posts.length;
  await page.locator('#chat-quick .chip', { hasText: 'Салфетки' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.msg-me').length === 2);
  while (posts.length === sent) await page.waitForTimeout(50);
  await page.waitForTimeout(150); // ответ fetch → таймеры демо-ответа уже поставлены на фейковые часы
  await page.clock.runFor(4000);
  assert.equal(await page.locator('.msg-them').last().innerText(), 'Официант · 21:40\nНесу салфетки');
  assert.equal(await page.locator('.msg-note').count(), 1, `${tag}: подпись демо один раз`);
  await page.screenshot({ path: `${out}/${tag}-chat.png` });
  await page.click('#chat-sheet [data-close]');
  assert.equal(await page.isVisible('#top-table'), true, `${tag}: номер стола в шапке`);

  // Бронь: пустая форма → три ошибки и фокус на имени; без галочки не уходит; потом успех.
  await page.locator('#book').scrollIntoViewIfNeeded();
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
  await page.locator('#book-days .day').nth(1).click(); // завтра
  await page.locator('#book-times .time', { hasText: '01:00' }).click();
  await page.locator('#book-occasion .chip', { hasText: 'День рождения' }).click();
  await page.click('[data-party="1"]');
  assert.equal(await text(page, '#book-btn'), 'Забронировать: завтра ночью, 01:00');
  await page.check('#b-consent');
  const before = posts.length;
  await page.click('#book-btn');
  await page.waitForSelector('#book-done:not([hidden])');
  const bp = posts[before].body;
  assert.equal(bp.kind, 'Бронь стола');
  assert.deepEqual(bp.fields, [['Когда', 'завтра ночью, 01:00'], ['Гостей', '5'], ['Повод', 'День рождения']]);
  assert.equal(bp.phone, '+7 (912) 345-67-89');
  assert.match(await text(page, '#book-done-what'), /^Завтра ночью, 01:00 · 5\sгостей · день рождения\. Аня, \+7 \(912\) 345-67-89$/);
  await page.screenshot({ path: `${out}/${tag}-book-done.png` });
  await page.click('#book-again');
  assert.equal(await page.inputValue('#b-name'), 'Аня', `${tag}: «Изменить» сохраняет имя`);

  // Вакансия: без «18 лет» не уходит.
  await page.locator('#jobs-list .job', { hasText: 'Бармен' }).click();
  assert.equal(await text(page, '#job-btn'), 'Откликнуться: бармен');
  await page.fill('#j-name', 'Дима');
  await page.click('#j-phone');
  await page.keyboard.type('9123456789');
  await page.check('#j-consent');
  await page.click('#job-btn');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'j-adult');
  await page.check('#j-adult');
  const jb = posts.length;
  await page.click('#job-btn');
  await page.waitForSelector('#job-done:not([hidden])');
  assert.deepEqual(posts[jb].body.fields, [['Должность', 'Бармен'], ['Возраст', '18+ (подтвердил)']]);

  // Разделы: «полоски» на телефоне ведут к разделу.
  if (mobile(width)) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('#dock-nav');
    await page.waitForSelector('#nav-sheet[open]');
    await page.screenshot({ path: `${out}/${tag}-nav.png` });
    await page.click('#nav-sheet a[href="#find"]');
    await page.clock.runFor(1500);
    await page.waitForTimeout(900);
    const top = await page.locator('#find').evaluate((e) => Math.round(e.getBoundingClientRect().top));
    assert.ok(top >= 0 && top < 120, `${tag}: прокрутка к «Как найти», top=${top}`);
  }

  const [sw2, cw2] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  assert.equal(sw2, cw2, `${tag}: горизонтальный скролл после сценария`);
  assert.deepEqual(errors, [], `${tag}: ошибки консоли`);
  results.push(`${tag}: ok`);
  await ctx.close();
}

// QR-стол: ?t=7 — номер в шапке и в чеке сразу.
{
  const { page, ctx, errors } = await open(390, '?t=7');
  assert.equal(await page.isVisible('#top-table'), true);
  await page.click('#dock-waiter');
  assert.equal(await page.isVisible('#chat-pick'), false);
  assert.match(await text(page, '#chat-sub'), /Стол 7/);
  assert.deepEqual(errors, []);
  results.push('qr ?t=7: ok');
  await ctx.close();
}

// Поздний вечер → ночь: в 02:30 ночи «сегодня» — уже 24 октября, бронь по умолчанию на 22:00.
{
  const { page, ctx } = await open(390, '', '2026-10-23T21:30:00Z');
  assert.match(await text(page, '#open-status'), /Открыто до\s06:00/);
  assert.equal(await text(page, '#book-btn'), 'Забронировать: сегодня, 22:00');
  assert.equal(await text(page, '#book-days .day.on b'), 'Сегодня');
  assert.equal(await text(page, '#book-days .day.on span'), '24\xa0окт');
  results.push('ночь 02:30: ok');
  await ctx.close();
}

// Днём закрыто: статус «Откроемся в 20:00».
{
  const { page, ctx } = await open(390, '', '2026-10-23T09:00:00Z');
  assert.match(await text(page, '#open-status'), /Откроемся в\s20:00/);
  assert.match(await text(page, '#hours-now'), /откроемся через 6\sч/);
  results.push('день 14:00: ok');
  await ctx.close();
}

await browser.close();
console.log(results.join('\n'));

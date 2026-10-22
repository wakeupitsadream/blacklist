// Скриншоты всех страниц сайта: node tools/shots-pages.mjs <outdir> [ширины через запятую]
// Время фиксировано (пт 23.10.2026, 21:40 по Оренбургу), /api/* отвечает как Vercel без env, видео не грузим.
import { mkdirSync } from 'node:fs';
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';

const out = process.argv[2] || 'shots';
const widths = (process.argv[3] || '390,1440').split(',').map(Number);
const BASE = process.env.BASE || 'http://127.0.0.1:8766/';
const PAGES = ['', 'menu', 'bron', 'akcii', 'vakansii', 'kontakty', 'kp', 'privacy', 'consent'];
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const width of widths) {
  for (const path of PAGES) {
    const page = await browser.newPage({ viewport: { width, height: width < 900 ? 844 : 900 }, locale: 'ru-RU' });
    await page.clock.install({ time: new Date('2026-10-23T16:40:00Z') });
    await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"live":false,"events":[]}' }));
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    // serve понимает cleanUrls, как Vercel: /menu → menu.html
    const url = BASE + path;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const name = path || 'home';
    await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true });
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    console.log(`${name.padEnd(9)} ${width}  ${sw === cw ? 'ok' : `HSCROLL ${sw}>${cw}`}  ${errors.length ? errors.join(' | ') : 'без ошибок'}`);
    await page.close();
  }
}
await browser.close();

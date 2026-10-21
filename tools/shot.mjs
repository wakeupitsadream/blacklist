// Скриншоты состояний демо: node tools/shot.mjs <outdir> [width] [query]
// Время фиксировано (пятница 23.10.2026, 21:40 по Оренбургу), /api/* отвечает как Vercel без env.
import { mkdirSync } from 'node:fs';
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';

const [, , out = 'shots', w = '390', query = ''] = process.argv;
const width = Number(w);
mkdirSync(out, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width, height: width < 900 ? 844 : 900 }, deviceScaleFactor: 1, locale: 'ru-RU' });
const page = await ctx.newPage();
await page.clock.install({ time: new Date('2026-10-23T16:40:00Z') });
await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, live: false, demo: true, events: [] }) }));
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE + query, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/full-${width}.png`, fullPage: true });
await page.screenshot({ path: `${out}/first-${width}.png` });
console.log(JSON.stringify({ width, errors, sw: await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]) }));
await browser.close();

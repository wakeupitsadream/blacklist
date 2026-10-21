// Скриншоты и ошибки консоли для /kp, /privacy, /consent: node tools/pages.mjs <outdir>
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const out = process.argv[2];
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const path of ['kp.html', 'privacy.html', 'consent.html']) {
  for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('requestfailed', (r) => errors.push(`failed ${r.url()}`));
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    const name = path.replace('.html', '');
    await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true });
    console.log(name, width, sw === cw ? 'no-hscroll' : `HSCROLL ${sw}>${cw}`, errors.length ? errors : 'no-errors');
    await page.close();
  }
}
await browser.close();

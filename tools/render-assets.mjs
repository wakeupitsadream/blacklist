// PNG-логотипы без фона (белый и чёрный, 2000 px) и OG-картинка 1200×630 из векторного логотипа.
import { readFileSync } from 'node:fs';
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1200, height: 1210 } });
for (const color of (process.env.ONLY_OG ? [] : ['white', 'black'])) {
  const svg = readFileSync(`brand/blacklist-logo-${color}.svg`, 'utf8');
  await page.setContent(`<!doctype html><body style="margin:0;background:transparent">${svg.replace('<svg ', '<svg width="1200" height="1210" ')}</body>`);
  await page.screenshot({ path: `brand/blacklist-logo-${color}.png`, omitBackground: true, clip: { x: 0, y: 0, width: 1200, height: 1210 } });
}
const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
const logo = readFileSync('img/logo.svg', 'utf8');
await og.setContent(`<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Wix+Madefor+Text:wght@500&display=swap">
</head><body style="margin:0;width:1200px;height:630px;background:#0B0B0D;color:#F1ECE4;display:flex;align-items:center;gap:64px;padding:0 80px;box-sizing:border-box">
<div style="width:420px;flex:none">${logo.replace('<svg ', '<svg width="420" height="424" ')}</div>
<div><div style="font:700 72px/1.02 'Playfair Display',serif">Поём до шести утра</div>
<div style="margin-top:24px;font:500 28px/1.4 'Wix Madefor Text',sans-serif;color:#A8A094">Караоке-бар в Оренбурге · 20:00–06:00<br>Меню, бронь и официант — в телефоне</div></div>
</body></html>`, { waitUntil: 'networkidle' });
await og.evaluate(() => document.fonts.ready);
await og.screenshot({ path: 'img/og.png' });
await browser.close();
console.log('ok');

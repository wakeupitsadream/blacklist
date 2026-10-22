// Сборка страниц из одного каркаса: node tools/build.mjs
// Шапка, подвал, нижняя панель и шторки общие; содержимое <main> — src/pages/<id>.html.
// На выходе статические index.html, menu.html, bron.html, akcii.html, vakansii.html, kontakty.html в корне —
// их и деплоим (src/ и tools/ в деплой не попадают). kp, privacy, consent собираются отдельно, руками.
import { readFileSync, writeFileSync } from 'node:fs';

const SITE = 'https://blacklist56-demo.vercel.app';

const PAGES = [
  {
    id: 'home', file: 'index.html', path: '/',
    title: 'Black List — караоке-бар в Оренбурге до 6 утра: бронь, меню, официант',
    description: 'Караоке-бар Black List на Монтажников, 2/1: поём каждый день с 20:00 до 06:00. Бронь стола, меню с ценами и чат с официантом прямо с телефона.',
  },
  {
    id: 'menu', file: 'menu.html', path: '/menu',
    title: 'Меню Black List — сеты, роллы, пицца, Том Ям: цены и чек на компанию',
    description: 'Меню караоке-бара Black List: 67 позиций кухни с ценами. Соберите чек на компанию и отправьте заказ официанту с телефона.',
  },
  {
    id: 'bron', file: 'bron.html', path: '/bron',
    title: 'Бронь стола в Black List — 10 столов и VIP-зона, депозит 1 000 ₽ с гостя',
    description: 'Забронируйте стол в караоке-баре Black List: ночь, время и гости — администратор перезвонит и подтвердит. Депозит 1 000 ₽ с гостя.',
  },
  {
    id: 'akcii', file: 'akcii.html', path: '/akcii',
    title: 'Акции Black List — подарки и скидки компаниям',
    description: 'Акции караоке-бара Black List для компаний: подарок от трёх гостей и скидки большим компаниям.',
  },
  {
    id: 'vakansii', file: 'vakansii.html', path: '/vakansii',
    title: 'Вакансии Black List — бармен, повар, диджей, уборщица',
    description: 'Работа в караоке-баре Black List в Оренбурге: ночные смены 20:00–06:00, с 18 лет. Отклик в два поля.',
  },
  {
    id: 'kontakty', file: 'kontakty.html', path: '/kontakty',
    title: 'Как найти Black List — Оренбург, Монтажников, 2/1 к А, цокольный этаж',
    description: 'Караоке-бар Black List: Оренбург, ул. Монтажников, 2/1 к А, цокольный этаж. Каждый день с 20:00 до 06:00. Маршрут в Яндекс Картах и 2ГИС.',
  },
];

const NAV = [
  ['menu', 'menu', 'Меню'],
  ['bron', 'bron', 'Бронь'],
  ['akcii', 'akcii', 'Акции'],
  ['vakansii', 'vakansii', 'Вакансии'],
  ['kontakty', 'kontakty', 'Контакты'],
];

const SHEET_NAV = [
  ['home', '/', 'Главная', 'статус и атмосфера'],
  ['menu', 'menu', 'Меню', '67 позиций и чек'],
  ['bron', 'bron', 'Бронь стола', 'депозит 1 000 ₽ с гостя'],
  ['akcii', 'akcii', 'Акции', 'для компаний'],
  ['vakansii', 'vakansii', 'Вакансии', 'ищем четверых'],
  ['kontakty', 'kontakty', 'Как нас найти', 'Монтажников, 2/1 к А'],
];

const MARK = '<svg class="mark" viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2"><rect x="10" y="10" width="20" height="20"/><rect x="10" y="10" width="20" height="20" transform="rotate(45 20 20)"/></g></svg>';
const ICON_CHAT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 5h16v11H9l-5 4z"/></svg>';

const LD = {
  '@context': 'https://schema.org',
  '@type': 'BarOrPub',
  name: 'Black List',
  description: 'Караоке-бар',
  address: { '@type': 'PostalAddress', streetAddress: 'ул. Монтажников, 2/1 к А', addressLocality: 'Оренбург', addressCountry: 'RU' },
  openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: '20:00', closes: '06:00' }],
  servesCuisine: ['Роллы', 'Пицца', 'Тайская кухня'],
  hasMenu: `${SITE}/menu`,
};

// В исходнике неразрывные пробелы пишем как  , в HTML они уходят сущностью &nbsp; — литеральный NBSP при переносе портится.
const nb = (s) => s.replace(/ /g, '&nbsp;');

function layout(p, main) {
  const nav = NAV.map(([id, href, label]) => `<a href="${href}"${id === p.id ? ' aria-current="page"' : ''}>${label}</a>`).join('\n   ');
  const sheet = SHEET_NAV.map(([id, href, label, sub]) => `   <li><a href="${href}"${id === p.id ? ' aria-current="page"' : ''}>${label} <span>${nb(sub)}</span></a></li>`).join('\n');
  const ld = p.id === 'home' ? `<script type="application/ld+json">\n${JSON.stringify(LD, null, 1)}\n</script>\n` : '';
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>${p.title}</title>
<meta name="description" content="${p.description}">
<meta name="theme-color" content="#0B0B0D">
<meta property="og:type" content="website">
<meta property="og:locale" content="ru_RU">
<meta property="og:title" content="${p.title}">
<meta property="og:description" content="${p.description}">
<meta property="og:url" content="${SITE}${p.path}">
<meta property="og:image" content="${SITE}/img/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='8' fill='%230B0B0D'/%3E%3Cg fill='none' stroke='%23F1ECE4' stroke-width='2.4'%3E%3Crect x='11' y='11' width='18' height='18'/%3E%3Crect x='11' y='11' width='18' height='18' transform='rotate(45 20 20)'/%3E%3C/g%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&amp;family=Wix+Madefor+Text:wght@400;500;600&amp;display=swap">
<link rel="stylesheet" href="css/style.css">
${ld}</head>
<body data-page="${p.id}">
<div class="ribbon" id="demo-ribbon" role="note">
 <p>Демо-версия сайта для Black List. Подготовил Максим Батутин по&nbsp;материалам бара и&nbsp;открытым данным&nbsp;— цены и&nbsp;детали уточняются.</p>
 <button type="button" aria-label="Скрыть плашку">×</button>
</div>

<header class="top">
 <div class="wrap top-in">
  <a class="brand" href="/" aria-label="Black List — на главную">
   ${MARK}
   <span>Black List</span>
  </a>
  <span class="stamp-top" id="top-table" hidden></span>
  <nav class="top-nav" aria-label="Разделы сайта">
   ${nav}
  </nav>
  ${p.id === 'bron' ? '' : '<a class="btn btn-blue btn-sm top-cta" href="bron"><span class="l-full">Забронировать</span><span class="l-short">Бронь</span></a>'}
 </div>
</header>

<main>
${main.trim()}
</main>

<footer class="foot">
 <div class="wrap foot-grid">
  <div>
   <p class="foot-brand">Black List</p>
   <p>Караоке-бар. Оренбург, ул.&nbsp;Монтажников, 2/1&nbsp;к&nbsp;А, цокольный этаж.</p>
   <p>Каждый день 20:00–06:00 · <a href="bron">Бронь стола</a> · <a href="kontakty">Как добраться</a></p>
  </div>
  <div>
   <p>Реквизиты добавим после согласования. <a href="privacy">Политика конфиденциальности</a> · <a href="consent">Согласие на&nbsp;обработку данных</a></p>
   <p class="fine">Меню и&nbsp;цены&nbsp;— по&nbsp;меню бара от&nbsp;24.09.2026, часы и&nbsp;адрес&nbsp;— по&nbsp;2ГИС и&nbsp;Zoon, видео&nbsp;— съёмка бара. Цены на&nbsp;сайте&nbsp;— ориентир, итог&nbsp;— в&nbsp;чеке бара.</p>
   <p class="fine">Дизайн и разработка — <a href="https://maxim-batutin.ru" target="_blank" rel="noopener">maxim-batutin.ru</a></p>
  </div>
 </div>
</footer>

<nav class="dock" id="dock" aria-label="Быстрые действия">
 <button type="button" class="dock-btn" id="dock-nav" aria-haspopup="dialog" aria-controls="nav-sheet">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16"/></svg>
  <span>Разделы</span>
 </button>
 <button type="button" class="dock-btn dock-check" id="dock-check">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21zM9 8h6M9 12h6M9 16h3"/></svg>
  <span id="dock-check-label">Меню</span>
 </button>
 <button type="button" class="dock-btn dock-waiter" id="dock-waiter" aria-haspopup="dialog" aria-controls="chat-sheet">
  ${ICON_CHAT}
  <span>Официант</span>
  <i class="badge" hidden></i>
 </button>
</nav>
<button type="button" class="fab" id="fab-waiter" aria-haspopup="dialog" aria-controls="chat-sheet">
 ${ICON_CHAT}
 Написать официанту
 <i class="badge" hidden></i>
</button>

<dialog class="sheet" id="nav-sheet" aria-labelledby="nav-h">
 <div class="sheet-head"><div><p class="sheet-title" id="nav-h">Разделы</p></div><button type="button" class="x" data-close aria-label="Закрыть">×</button></div>
 <div class="sheet-body">
  <ul class="nav-list">
${sheet}
  </ul>
  <p class="nav-meta">Каждый день 20:00–06:00 · ул.&nbsp;Монтажников, 2/1&nbsp;к&nbsp;А, цокольный этаж</p>
 </div>
</dialog>

<dialog class="sheet sheet-check" id="check-sheet" aria-labelledby="check-sheet-h">
 <div class="sheet-head"><div><p class="sheet-title" id="check-sheet-h">Чек стола</p></div><button type="button" class="x" data-close aria-label="Закрыть">×</button></div>
 <div class="sheet-body"><div class="check" data-check></div></div>
</dialog>

<dialog class="sheet chat-sheet" id="chat-sheet" aria-labelledby="chat-h">
 <div class="sheet-head">
  <div>
   <p class="sheet-title" id="chat-h">Официант</p>
   <p class="sheet-sub" id="chat-sub"></p>
  </div>
  <button type="button" class="x" data-close aria-label="Закрыть">×</button>
 </div>
 <div class="chat-body" id="chat-body" aria-live="polite"></div>
 <div class="chat-table" id="chat-table" hidden>
  <p>За&nbsp;каким вы&nbsp;столом? Номер&nbsp;— на&nbsp;табличке с&nbsp;QR-кодом.</p>
  <div class="tables" id="chat-tables"></div>
 </div>
 <div class="chat-quick" id="chat-quick"></div>
 <form class="chat-form" id="chat-form" autocomplete="off">
  <label class="sr" for="chat-input">Сообщение официанту</label>
  <input class="in" id="chat-input" maxlength="500" placeholder="Напишите: «принесите лёд»" enterkeyhint="send">
  <button class="send" type="submit" aria-label="Отправить">
   <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 20.5 21 12 3 3.5V10l12 2-12 2z"/></svg>
  </button>
 </form>
</dialog>

<div id="agentus-slot"></div>
<!-- ИИ-ассистент Agentus. Максим вставит data-agent после создания агента (промпт — docs/agentus-prompt.md):
<script src="https://agentus.space/widget.js" data-agent="AGENT_ID" data-base-url="https://agentus.space" async></script> -->
<script type="module" src="js/ui/app.js"></script>
</body>
</html>
`;
}

for (const p of PAGES) {
  const main = readFileSync(`src/pages/${p.id}.html`, 'utf8');
  const html = layout(p, main);
  if (/ /.test(html)) throw new Error(`${p.file}: литеральный неразрывный пробел — пишите &nbsp;`);
  writeFileSync(p.file, html);
  console.log(`${p.file}  ${html.length} байт`);
}

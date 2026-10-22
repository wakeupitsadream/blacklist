// Black List: состояние в одном объекте st, рендер и связывание с DOM. Расчёты и правила — в js/features/*.
// Страницы разные (body[data-page]), а шапка, нижняя панель, чек и чат с официантом — общие для всех.
import { BAR, ZONES, CATEGORIES, MENU, PROMOS, SONGS, JOBS, REELS } from '../data/blacklist.js';
import { money, plural, pluralize } from '../features/plural.js';
import { openState, localMinutes, hhmm } from '../features/hours.js';
import { inc, dec, qtyOf, lines, totals, perGuest, waiterText, clampGuests } from '../features/cart.js';
import { QUICK, demoReply, DEMO_STEPS, parseTable, tableLabel, makeSid, SID_RE, cleanText } from '../features/chat.js';
import { OCCASIONS, slotsFor, keepSlot, defaultSlot, slotLabel, clampParty, deposit } from '../features/booking.js';
import { localDay, nextDays, dateCard } from '../features/days.js';
import { orderErrors, jobErrors, firstError, bookingPayload, jobPayload } from '../features/order.js';
import { demoRibbon, phoneMask, countUps } from './polish.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const PAGE = document.body.dataset.page;
const OFF = BAR.tzOffsetMin;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const now = () => new Date();
const cap = (s) => String(s).replace(/^./, (c) => c.toUpperCase());

// sessionStorage может быть недоступен (приватный режим) — сайт работает и без него.
const store = {
  get(k, d) { try { const v = sessionStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* без памяти */ } },
};

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
}

const SVGNS = 'http://www.w3.org/2000/svg';
/** Знак стола: два квадрата логотипа и номер (или VIP) внутри. */
function stamp(n) {
  const s = document.createElementNS(SVGNS, 'svg');
  s.setAttribute('viewBox', '0 0 40 40');
  s.setAttribute('class', 'stamp');
  s.setAttribute('aria-hidden', 'true');
  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('fill', 'none');
  g.setAttribute('stroke', 'currentColor');
  g.setAttribute('stroke-width', '1.6');
  for (const rot of [0, 45]) {
    const r = document.createElementNS(SVGNS, 'rect');
    for (const [k, v] of Object.entries({ x: 10, y: 10, width: 20, height: 20 })) r.setAttribute(k, v);
    if (rot) r.setAttribute('transform', `rotate(${rot} 20 20)`);
    g.append(r);
  }
  s.append(g);
  if (n != null) {
    const t = document.createElementNS(SVGNS, 'text');
    t.setAttribute('x', '20');
    t.setAttribute('y', n === 'VIP' ? '24' : '25.5');
    t.setAttribute('text-anchor', 'middle');
    if (n === 'VIP') t.setAttribute('class', 'vip');
    t.textContent = String(n);
    s.append(t);
  }
  return s;
}

const st = {
  table: parseTable(location.search, BAR.tables) ?? store.get('bl-table', null),
  cart: store.get('bl-cart', []),
  guests: clampGuests(store.get('bl-guests', 4)),
  sentAt: store.get('bl-sent', null),
  chat: { sid: store.get('bl-sid', null), msgs: store.get('bl-msgs', []), seen: store.get('bl-seen', 0), unread: false, timer: null },
  book: { iso: null, m: null, party: 4, zone: ZONES[0], occasion: OCCASIONS[0] },
  job: { role: JOBS[0].id },
};
if (st.table) store.set('bl-table', st.table);
st.chat.msgs.forEach((m) => { if (m.st === 'sending') m.st = 'delivered'; });

const nowLabel = () => hhmm(localMinutes(now(), OFF));

/* ---------- Шторки ---------- */

function openSheet(d) {
  if (d.open) return;
  d.showModal();
  document.documentElement.style.overflow = 'hidden';
}
function closeSheet(d) { if (d.open) d.close(); }
$$('dialog.sheet').forEach((d) => {
  d.addEventListener('close', () => { if (!$$('dialog.sheet').some((x) => x.open)) document.documentElement.style.overflow = ''; });
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  $$('[data-close]', d).forEach((b) => b.addEventListener('click', () => d.close()));
});

/* ---------- Шапка: стол из QR ---------- */

function renderTable() {
  const top = $('#top-table');
  top.hidden = !st.table;
  if (st.table) top.replaceChildren(stamp(st.table), el('span', { class: 'sr' }, `Вы: ${tableLabel(st.table)}`));
  const sub = $('#menu-sub');
  if (sub) {
    sub.textContent = st.table
      ? `${tableLabel(st.table)}: отмечайте блюда — чек считает сумму на компанию, официанту отправите одной кнопкой.`
      : 'Отмечайте блюда — посчитаю чек на компанию, а официанту отправите одной кнопкой.';
  }
}

/* ---------- Главная и контакты: статус, факты, видео, песни ---------- */

const dur = (min) => [Math.floor(min / 60) ? `${Math.floor(min / 60)}\xa0ч` : '', min % 60 ? `${min % 60}\xa0мин` : ''].filter(Boolean).join(' ') || 'минуту';

function renderStatus() {
  const s = openState(now(), BAR);
  const p = $('#open-status');
  if (p) {
    p.classList.toggle('is-open', s.open);
    $('span', p).textContent = s.label;
  }
  const h = $('#hours-now');
  if (h) {
    const m = localMinutes(now(), OFF);
    const left = s.open ? (BAR.close - m + 1440) % 1440 : (BAR.open - m + 1440) % 1440;
    h.textContent = s.open
      ? `Сейчас в Оренбурге ${hhmm(m)}: открыто, до закрытия ${dur(left)}.`
      : `Сейчас в Оренбурге ${hhmm(m)}: откроемся через ${dur(left)}.`;
  }
}

function renderFacts() {
  const c = $('#fact-count');
  if (!c) return;
  c.textContent = String(MENU.length);
  c.dataset.count = String(MENU.length);
}

function renderSongs() {
  $('#songs-list').replaceChildren(...SONGS.map((r) => el('li', {}, el('b', {}, r.title), el('span', {}, r.text))));
}

/** Ролик стартует, только когда в кадре: в цоколе связь слабая, лишние мегабайты не качаем. */
function setupReels(box) {
  if (box) {
    box.replaceChildren(...REELS.map((r) => el('figure', { class: 'reel' },
      el('video', { muted: true, loop: true, playsinline: true, preload: 'none', poster: r.poster, 'data-src': r.src, width: '540', height: '960', 'aria-label': r.caption.replace(/\xa0/g, ' ') }),
      el('figcaption', {}, r.caption))));
  }
  const videos = $$('video[data-src]');
  if (!videos.length) return;
  const saveData = navigator.connection?.saveData;
  const load = (v) => { if (!v.src) { v.src = v.dataset.src; v.muted = true; } };
  const play = (v) => { load(v); const p = v.play(); if (p) p.catch(() => {}); };
  videos.forEach((v) => {
    v.muted = true;
    v.addEventListener('click', () => (v.paused ? play(v) : v.pause()));
  });
  if (reduced || saveData || !('IntersectionObserver' in window)) return; // заставка остаётся, видео — по тапу
  const io = new IntersectionObserver((ens) => {
    ens.forEach((e) => (e.isIntersecting ? play(e.target) : e.target.pause()));
  }, { threshold: 0.5 });
  videos.forEach((v) => io.observe(v));
}

/* ---------- Меню и чек ---------- */

const chipCat = (catId) => {
  const c = CATEGORIES.find((x) => x.id === catId);
  return c && c.group ? CATEGORIES.find((x) => x.group === c.group && x.chip) : c;
};

function setChip(catId) {
  const target = chipCat(catId);
  const box = $('#cat-chips');
  $$('.chip', box).forEach((b) => {
    const on = b.dataset.cat === target?.id;
    b.classList.toggle('on', on);
    b.setAttribute('aria-current', on ? 'true' : 'false');
    if (on) box.scrollTo({ left: b.offsetLeft - (box.clientWidth - b.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' });
  });
}

function renderChips() {
  $('#cat-chips').replaceChildren(...CATEGORIES.filter((c) => c.chip).map((c) => el('button', {
    type: 'button', class: 'chip', 'data-cat': c.id, 'aria-controls': `cat-${c.id}`,
    onclick: () => { setChip(c.id); document.getElementById(`cat-${c.id}`).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); },
  }, c.chip)));
  setChip(CATEGORIES[0].id);
}

function renderMenu() {
  $('#menu-list').replaceChildren(...CATEGORIES.map((c) => el('section', { class: 'cat', id: `cat-${c.id}`, 'data-cat': c.id, 'aria-labelledby': `h-${c.id}` },
    el('h2', { id: `h-${c.id}` }, c.title),
    c.note ? el('p', { class: 'cat-note' }, c.note) : null,
    el('ul', { class: 'dishes' }, MENU.filter((m) => m.cat === c.id).map((m) => el('li', { class: 'dish', id: `d-${m.id}` },
      el('div', {},
        el('h3', { class: 'dish-name' }, m.name),
        m.desc ? el('p', { class: 'dish-desc' }, m.desc) : null,
        m.weight ? el('p', { class: 'dish-meta' }, m.weight) : null),
      el('div', { class: 'dish-side' },
        el('span', { class: 'dish-price' }, money(m.price)),
        el('div', { class: 'qty', 'data-qty': m.id }))))))));
  MENU.forEach((m) => renderQty(m.id));

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((ens) => {
      const vis = ens.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setChip(vis[0].target.dataset.cat);
    }, { rootMargin: '-140px 0px -60% 0px' });
    $$('.cat').forEach((s) => io.observe(s));
  }
}

/** Просьбы официанту прямо на странице меню — без поиска кнопки чата. */
function renderWaiterChips() {
  const quick = QUICK.filter((q) => ['come', 'napkins', 'ice', 'bill'].includes(q.id));
  $('#waiter-chips').replaceChildren(
    ...quick.map((q) => el('button', { type: 'button', class: 'chip', onclick: () => openChat({ text: q.label }) }, q.label)),
    el('button', { type: 'button', class: 'chip chip-write', onclick: () => { openChat(); $('#chat-input').focus(); } }, 'Написать своё'),
  );
}

function renderQty(id) {
  const box = $(`[data-qty="${id}"]`);
  if (!box) return;
  const m = MENU.find((x) => x.id === id);
  const q = qtyOf(st.cart, id);
  box.classList.toggle('has', q > 0);
  box.closest('.dish').classList.toggle('in', q > 0);
  if (!q) {
    box.replaceChildren(el('button', { type: 'button', class: 'add', 'aria-label': `В чек: ${m.name}`, onclick: () => change(id, 1) }, '+'));
    return;
  }
  box.replaceChildren(
    el('button', { type: 'button', 'aria-label': `Убрать одну: ${m.name}`, onclick: () => change(id, -1) }, '−'),
    el('output', { 'aria-label': `${m.name}: ${q}` }, String(q)),
    el('button', { type: 'button', 'aria-label': `Ещё одну: ${m.name}`, onclick: () => change(id, 1) }, '+'),
  );
}

function change(id, d) {
  const box = $(`[data-qty="${id}"]`);
  const hadFocus = box && box.contains(document.activeElement);
  st.cart = d > 0 ? inc(st.cart, id) : dec(st.cart, id);
  store.set('bl-cart', st.cart);
  renderQty(id);
  renderCheck();
  renderDock();
  if (d > 0) {
    const dc = $('#dock-check');
    dc.classList.remove('bump');
    void dc.offsetWidth;
    dc.classList.add('bump');
  }
  if (hadFocus) $(d > 0 ? 'button:last-of-type' : 'button', box)?.focus();
}

function setGuests(g) {
  st.guests = clampGuests(g);
  store.set('bl-guests', st.guests);
  renderCheck();
}

function renderCheck() {
  const ls = lines(st.cart, MENU);
  const t = totals(ls);
  const g = st.guests;
  for (const box of $$('[data-check]')) {
    box.replaceChildren(
      el('div', { class: 'check-head' },
        stamp(st.table),
        el('div', {},
          el('p', { class: 'check-title' }, st.table ? tableLabel(st.table) : 'Ваш заказ'),
          el('p', { class: 'check-sub' }, st.table ? `Заказ с телефона · ${nowLabel()}` : 'Чек на компанию'))),
      ls.length
        ? el('ol', { class: 'check-lines' }, ls.map((l) => el('li', {},
          el('span', {}, l.name, el('br'), el('span', { class: 'q' }, `${l.qty} × ${money(l.price)}`)),
          el('span', { class: 's' }, money(l.sum)))))
        : el('p', { class: 'check-empty' }, PAGE === 'menu' ? 'Пока пусто. Нажмите «+» у блюда — строка появится здесь.' : 'Пока пусто. Блюда отмечаются в меню.'),
      ls.length ? el('div', { class: 'check-total' }, el('span', {}, 'Итого'), el('b', {}, money(t.sum))) : null,
      ls.length ? el('div', { class: 'check-split' },
        el('span', {}, 'На'),
        el('div', { class: 'step-num' },
          el('button', { type: 'button', 'aria-label': 'Меньше гостей', onclick: () => setGuests(g - 1) }, '−'),
          el('output', { 'aria-label': `Гостей: ${g}` }, String(g)),
          el('button', { type: 'button', 'aria-label': 'Больше гостей', onclick: () => setGuests(g + 1) }, '+')),
        el('span', {}, plural(g, 'гостя', 'гостей', 'гостей')),
        el('span', { class: 'nw' }, '— по\xa0', el('b', {}, money(perGuest(t.sum, g))))) : null,
      ls.length
        ? el('button', { type: 'button', class: 'btn btn-blue btn-block', onclick: sendOrder }, `Отправить официанту: ${pluralize(t.count, 'позиция', 'позиции', 'позиций')}, ${money(t.sum)}`)
        : el('a', { class: 'btn btn-blue btn-block', href: 'menu' }, 'Открыть меню'),
      el('p', { class: 'check-fine' },
        st.sentAt ? `Отправлено официанту в ${st.sentAt}. Добавили ещё — отправьте снова. ` : 'Официант подойдёт и подтвердит заказ, итог — в чеке бара. ',
        st.table ? null : el('a', { href: `bron?guests=${g}` }, `Ещё не в баре? Забронируйте стол на ${pluralize(g, 'гостя', 'гостей', 'гостей')}`)),
    );
  }
}

function sendOrder() {
  const ls = lines(st.cart, MENU);
  if (!ls.length) return;
  closeSheet($('#check-sheet'));
  openChat({ text: waiterText(ls, st.guests), order: true });
}

/* ---------- Нижняя панель и бейджи ---------- */

function renderDock() {
  const t = totals(lines(st.cart, MENU));
  const btn = $('#dock-check');
  btn.classList.toggle('has', t.count > 0);
  $('#dock-check-label').textContent = t.count ? `Чек · ${money(t.sum)}` : 'Меню';
  btn.setAttribute('aria-label', t.count ? `Чек: ${pluralize(t.count, 'позиция', 'позиции', 'позиций')}, ${money(t.sum)}` : 'К меню');
  btn.setAttribute('aria-haspopup', t.count ? 'dialog' : 'false');
}
$('#dock-check').addEventListener('click', () => {
  if (st.cart.length) openSheet($('#check-sheet'));
  else if (PAGE === 'menu') $('#menu').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  else location.href = 'menu';
});
$('#dock-nav').addEventListener('click', () => openSheet($('#nav-sheet')));
$('#dock-waiter').addEventListener('click', () => openChat());
$('#fab-waiter').addEventListener('click', () => openChat());

function renderBadges() {
  $$('.badge').forEach((b) => { b.hidden = !st.chat.unread; });
}

// Клавиатура на телефоне поднимает fixed-панель поверх формы — пока печатают, прячем её.
document.addEventListener('focusin', (e) => { if (e.target.matches('main input, main textarea')) $('#dock').classList.add('typing'); });
// Возвращаем панель с задержкой: иначе она появляется под пальцем в момент тапа по кнопке формы и перехватывает его.
document.addEventListener('focusout', () => setTimeout(() => {
  if (!document.activeElement?.matches('main input, main textarea')) $('#dock').classList.remove('typing');
}, 300));

/* ---------- Чат с официантом ---------- */

const chatSheet = $('#chat-sheet');
let pending = null;

function ensureSid() {
  if (!SID_RE.test(st.chat.sid || '')) {
    const b = new Uint8Array(12);
    crypto.getRandomValues(b);
    st.chat.sid = makeSid(b);
    store.set('bl-sid', st.chat.sid);
  }
  return st.chat.sid;
}

const saveChat = () => { store.set('bl-msgs', st.chat.msgs.slice(-60)); store.set('bl-seen', st.chat.seen); };
const statusOf = (m) => ({ sending: 'Отправляем…', delivered: `Доставлено · ${m.at}`, read: `Прочитано · ${m.at}` })[m.st] || m.at;

function askTable(show) {
  $('#chat-table').hidden = !show;
}

function renderChat() {
  $('#chat-sub').replaceChildren(...(st.table
    ? [`${tableLabel(st.table)} · `, el('button', { type: 'button', onclick: () => askTable(true) }, 'другой стол')]
    : ['Стол подставится из QR-кода на столе']));
  const body = $('#chat-body');
  body.replaceChildren(
    el('p', { class: 'chat-hello' }, 'Напишите или нажмите кнопку — сообщение придёт официанту на телефон. Кричать не нужно.'),
    ...st.chat.msgs.flatMap((m) => {
      if (m.who === 'me') return [el('div', { class: `msg msg-me${m.order ? ' order' : ''}` }, m.text), el('p', { class: 'msg-st' }, statusOf(m))];
      if (m.who === 'them') return [el('div', { class: 'msg msg-them' }, el('span', { class: 'msg-who' }, `Официант · ${m.at}`), m.text)];
      if (m.who === 'sys') return [el('p', { class: 'msg-sys' }, `${m.text} · ${m.at}`)];
      return [el('p', { class: 'msg-note' }, m.text)];
    }),
  );
  body.scrollTop = body.scrollHeight;
}

function renderTables() {
  const ids = [...Array.from({ length: BAR.tables }, (_, k) => k + 1), ...(BAR.vip ? ['VIP'] : [])];
  $('#chat-tables').replaceChildren(...ids.map((t) => el('button', {
    type: 'button', class: t === 'VIP' ? 'vip' : null, 'aria-label': tableLabel(t),
    onclick: () => pickTable(t),
  }, String(t))));
}

function pickTable(t) {
  st.table = t;
  store.set('bl-table', t);
  askTable(false);
  renderTable();
  renderCheck();
  renderChat();
  if (pending) { const p = pending; pending = null; sendMsg(p.text, p.order); return; }
  $('#chat-input').focus();
}

/** Открыть чат; send — сообщение, которое уйдёт сразу (или после выбора стола, если номера ещё нет). */
function openChat(send = null) {
  st.chat.unread = false;
  renderBadges();
  renderChat();
  openSheet(chatSheet);
  if (send) request(send.text, send.order);
}

function request(text, order = false) {
  if (st.table) { sendMsg(text, order); return; }
  pending = { text, order };
  askTable(true);
}

async function sendMsg(text, order = false) {
  const t = cleanText(text, 500);
  if (!t || !st.table) return;
  const msg = { id: Date.now(), who: 'me', text: t, order, st: 'sending', at: nowLabel() };
  st.chat.msgs.push(msg);
  if (order) { st.sentAt = msg.at; store.set('bl-sent', st.sentAt); renderCheck(); }
  saveChat();
  renderChat();
  let live = false;
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid: ensureSid(), table: st.table, text: t }) });
    live = Boolean((await r.json()).live);
  } catch (e) {
    console.warn('chat: сообщение не ушло на сервер, показываю демо-ответ', e.message);
  }
  if (live) {
    msg.st = 'delivered';
    saveChat();
    renderChat();
    startPolling();
    return;
  }
  demoAnswer(msg);
}

/** Без Telegram (демо) — показываем путь сообщения и пример ответа; так и подписано в чате. */
function demoAnswer(msg) {
  const step = (fn, ms) => setTimeout(() => { fn(); saveChat(); renderChat(); }, ms);
  step(() => { msg.st = 'delivered'; }, DEMO_STEPS.delivered);
  step(() => { msg.st = 'read'; }, DEMO_STEPS.read);
  step(() => {
    st.chat.msgs.push({ id: Date.now(), who: 'them', text: demoReply(msg.text), at: nowLabel() });
    if (!st.chat.msgs.some((m) => m.who === 'note')) {
      st.chat.msgs.push({ id: Date.now() + 1, who: 'note', text: 'Это демо: ответ показан для примера. В баре ответит официант на смене — у него на телефоне пульт со звуком.' });
    }
    if (!chatSheet.open) { st.chat.unread = true; renderBadges(); }
  }, DEMO_STEPS.reply);
}

/** Живой режим (env с ботом в Vercel): опрашиваем ответы официанта раз в 3 секунды, 15 минут после сообщения. */
function startPolling() {
  clearInterval(st.chat.timer);
  const until = Date.now() + 15 * 60 * 1000;
  const tick = async () => {
    if (Date.now() > until) { clearInterval(st.chat.timer); return; }
    if (document.hidden) return;
    try {
      const r = await fetch(`/api/chat?sid=${encodeURIComponent(st.chat.sid)}&seen=${st.chat.seen}`);
      const j = await r.json();
      const fresh = (j.events || []).filter((e) => e.id > st.chat.seen);
      if (!fresh.length) return;
      for (const e of fresh) {
        st.chat.seen = Math.max(st.chat.seen, e.id);
        st.chat.msgs.push({ id: e.id, who: e.type === 'reply' ? 'them' : 'sys', text: e.text, at: nowLabel() });
      }
      const mine = st.chat.msgs.filter((m) => m.who === 'me');
      if (mine.length) mine[mine.length - 1].st = 'read';
      if (!chatSheet.open) { st.chat.unread = true; renderBadges(); }
      saveChat();
      renderChat();
    } catch (e) {
      console.warn('chat: опрос не удался', e.message);
    }
  };
  st.chat.timer = setInterval(tick, 3000);
  tick();
}

function renderQuick() {
  $('#chat-quick').replaceChildren(...QUICK.map((q) => el('button', { type: 'button', class: 'chip', onclick: () => request(q.label) }, q.label)));
}

$('#chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#chat-input');
  const t = cleanText(input.value);
  if (!t) return;
  input.value = '';
  request(t);
});

/* ---------- Акции ---------- */

function renderPromos() {
  $('#promo-list').replaceChildren(...PROMOS.map((p) => el('article', { class: 'promo' },
    el('p', { class: 'promo-when' }, p.when),
    el('h2', {}, p.title),
    el('p', {}, p.text))));
}

/* ---------- Бронь ---------- */

const bookDays = () => nextDays(localDay(now(), OFF), 7);

function normalizeBook() {
  const days = bookDays();
  const day = days.find((d) => d.iso === st.book.iso);
  const kept = day ? keepSlot(day.iso, st.book.m ?? 1320, now(), OFF) : null;
  if (kept != null) { st.book.m = kept; return; }
  const d = defaultSlot(days, now(), OFF);
  st.book.iso = d.iso;
  st.book.m = d.m;
}

function bookWhen() {
  const days = bookDays();
  const i = days.findIndex((d) => d.iso === st.book.iso);
  const day = days[i];
  const next = days[i + 1] || dateCard(day.iso, localDay(now(), OFF), 1);
  return slotLabel(day, next, st.book.m);
}

/** Перерисовка по таймеру не должна сбивать фокус: запоминаем, какой чип был в фокусе, и возвращаем его. */
function keepFocus(sel, render) {
  const box = $(sel);
  const i = $$('button', box).indexOf(document.activeElement);
  render();
  if (i >= 0) $$('button', box)[i]?.focus();
}

function renderBook() {
  keepFocus('#book-days', () => keepFocus('#book-times', () => keepFocus('#book-zone', () => keepFocus('#book-occasion', drawBook))));
}

const radios = (box, list, current, pick) => $(box).replaceChildren(...list.map((o) => el('button', {
  type: 'button', class: `chip${o === current ? ' on' : ''}`, role: 'radio', 'aria-checked': String(o === current),
  onclick: () => { pick(o); renderBook(); },
}, o)));

function drawBook() {
  normalizeBook();
  const days = bookDays();
  $('#book-days').replaceChildren(...days.map((d) => {
    const free = slotsFor(d.iso, now(), OFF).some((s) => s.ok);
    return el('button', {
      type: 'button', class: `day${d.iso === st.book.iso ? ' on' : ''}`, disabled: !free, 'aria-pressed': String(d.iso === st.book.iso),
      onclick: () => { st.book.iso = d.iso; renderBook(); },
    }, el('b', {}, d.wd), el('span', {}, d.num));
  }));
  const slots = slotsFor(st.book.iso, now(), OFF);
  $('#book-times').replaceChildren(...slots.map((s) => el('button', {
    type: 'button', class: `time${s.m === st.book.m ? ' on' : ''}`, disabled: !s.ok, 'aria-pressed': String(s.m === st.book.m),
    onclick: () => { st.book.m = s.m; renderBook(); },
  }, s.label)));
  const gone = slots.filter((s) => !s.ok).length;
  $('#book-hint').textContent = gone
    ? 'Прошедшее время недоступно: бронь принимаем минимум за час.'
    : st.book.m >= 1440 ? 'После полуночи — это уже следующий календарный день, администратор так и запишет.' : '';
  const partyInput = $('#party');
  if (document.activeElement !== partyInput) partyInput.value = st.book.party;
  $('#party-word').textContent = plural(st.book.party, 'гость', 'гостя', 'гостей');
  radios('#book-zone', ZONES, st.book.zone, (z) => { st.book.zone = z; });
  radios('#book-occasion', OCCASIONS, st.book.occasion, (o) => { st.book.occasion = o; });
  renderTicket();
}

/** Бумажный «билет» брони: что, когда, сколько и депозит — главный документ страницы. */
function renderTicket() {
  const when = bookWhen();
  const dep = deposit(st.book.party, BAR.depositPerGuest);
  const row = (k, v) => el('li', {}, el('span', {}, k), el('b', {}, v));
  $('#book-ticket').replaceChildren(
    el('div', { class: 'check-head' }, stamp(st.book.zone === 'VIP-зона' ? 'VIP' : null),
      el('div', {}, el('p', { class: 'check-title' }, 'Бронь стола'), el('p', { class: 'check-sub' }, 'Подтвердит администратор'))),
    el('ul', { class: 'ticket-rows' },
      row('Когда', cap(when)),
      row('Гостей', String(st.book.party)),
      row('Зона', st.book.zone),
      row('Повод', st.book.occasion)),
    el('div', { class: 'check-total' }, el('span', {}, 'Депозит'), el('b', {}, money(dep))),
    el('p', { class: 'check-fine' }, `${money(BAR.depositPerGuest)} с гостя.${st.book.party >= 8 ? ' Большой компании сдвинем столы.' : ''}`),
  );
  // На кнопке для «сегодня/завтра» дата лишняя: «Забронировать: сегодня, 23:00».
  $('#book-btn').textContent = `Забронировать: ${when.replace(/^(сегодня|завтра), \d+\xa0\S+, /, '$1, ')}`;
}

/* ---------- Формы ---------- */

function showErrors(prefix, errs) {
  for (const [k, v] of Object.entries(errs)) {
    const box = $(`#e-${prefix}-${k}`);
    const input = $(`#${prefix}-${k}`);
    if (box) box.textContent = v;
    if (input) input.setAttribute('aria-invalid', v ? 'true' : 'false');
  }
}

async function post(url, payload) {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    await r.text(); // дочитываем ответ, иначе уход со страницы сразу после «Принято» обрывает запрос
    if (!r.ok) console.warn(`${url}: ответ ${r.status}`);
  } catch (e) {
    console.warn(`${url}: сеть недоступна, заявка показана как принятая`, e.message);
  }
}

/** Ошибка поля гаснет, как только поле стало верным. */
function clearOnFix(prefix, check, keys) {
  for (const k of keys) {
    const input = $(`#${prefix}-${k}`);
    input.addEventListener(input.type === 'checkbox' ? 'change' : 'input', () => {
      const box = $(`#e-${prefix}-${k}`);
      if (box.textContent && !check()[k]) { box.textContent = ''; input.setAttribute('aria-invalid', 'false'); }
    });
  }
}

function initBook() {
  const g = Number(new URLSearchParams(location.search).get('guests'));
  if (Number.isInteger(g) && g >= 1) st.book.party = clampParty(g);
  phoneMask($('#b-phone'));
  renderBook();

  $$('[data-party]').forEach((b) => b.addEventListener('click', () => {
    st.book.party = clampParty(st.book.party + Number(b.dataset.party));
    $('#party').value = st.book.party;
    renderBook();
  }));
  // Пока печатают — не прыгаем на минимум; ограничиваем на blur.
  $('#party').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    if (Number.isInteger(v) && v >= 1 && v <= 40) { st.book.party = v; $('#party-word').textContent = plural(v, 'гость', 'гостя', 'гостей'); renderTicket(); }
  });
  $('#party').addEventListener('blur', (e) => {
    st.book.party = clampParty(e.target.value);
    e.target.value = st.book.party;
    renderBook();
  });

  const form = () => ({ name: $('#b-name').value, phone: $('#b-phone').value, consent: $('#b-consent').checked });
  $('#book-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form();
    const errs = orderErrors(f);
    showErrors('b', errs);
    const first = firstError(errs, ['name', 'phone', 'consent']);
    if (first) { $(`#b-${first}`).focus(); return; }
    normalizeBook();
    const when = bookWhen();
    const dep = money(deposit(st.book.party, BAR.depositPerGuest));
    const btn = $('#book-btn');
    btn.disabled = true;
    btn.textContent = 'Отправляем…';
    await post('/api/order', bookingPayload({ ...f, when, guests: st.book.party, zone: st.book.zone, deposit: dep, occasion: st.book.occasion }));
    btn.disabled = false;
    const sep = '\xa0· ';
    $('#book-done-what').replaceChildren(`${cap(when)}${sep}${pluralize(st.book.party, 'гость', 'гостя', 'гостей')}${sep}`, el('span', { class: 'nw' }, st.book.zone),
      `${sep}депозит ${dep}. ${f.name.trim()}, `, el('span', { class: 'nw' }, f.phone));
    $('#book-form').hidden = true;
    $('#book-done').hidden = false;
    $('#book-done').focus();
  });
  $('#book-again').addEventListener('click', () => {
    $('#book-done').hidden = true;
    $('#book-form').hidden = false;
    renderBook();
    $('#b-name').focus();
  });
  clearOnFix('b', () => orderErrors(form()), ['name', 'phone', 'consent']);
}

function renderJobs() {
  $('#jobs-list').replaceChildren(...JOBS.map((j) => el('button', {
    type: 'button', class: `job${j.id === st.job.role ? ' on' : ''}`, role: 'radio', 'aria-checked': String(j.id === st.job.role),
    onclick: () => { st.job.role = j.id; renderJobs(); },
  }, el('span', { class: 'job-title' }, j.title), el('span', { class: 'job-text' }, j.text), el('span', { class: 'pick' }, j.id === st.job.role ? 'Выбрано' : 'Выбрать'))));
  const role = JOBS.find((j) => j.id === st.job.role);
  $('#job-btn').textContent = `Откликнуться: ${role.title.toLowerCase()}`;
}

function initJobs() {
  phoneMask($('#j-phone'));
  renderJobs();
  const form = () => ({ name: $('#j-name').value, phone: $('#j-phone').value, adult: $('#j-adult').checked, consent: $('#j-consent').checked });
  $('#job-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form();
    const errs = jobErrors(f);
    showErrors('j', errs);
    const first = firstError(errs, ['name', 'phone', 'adult', 'consent']);
    if (first) { $(`#j-${first}`).focus(); return; }
    const role = JOBS.find((j) => j.id === st.job.role).title.replace(/\xa0/g, ' ');
    const btn = $('#job-btn');
    btn.disabled = true;
    btn.textContent = 'Отправляем…';
    await post('/api/order', jobPayload({ ...f, role }));
    btn.disabled = false;
    $('#job-done-what').replaceChildren(`${role}\xa0· ${f.name.trim()}, `, el('span', { class: 'nw' }, f.phone));
    $('#job-form').hidden = true;
    $('#job-done').hidden = false;
    $('#job-done').focus();
  });
  clearOnFix('j', () => jobErrors(form()), ['name', 'phone', 'adult', 'consent']);
}

/* ---------- Старт ---------- */

demoRibbon();
renderTable();
renderCheck();
renderDock();
renderQuick();
renderTables();
renderBadges();

if (PAGE === 'home') {
  renderStatus();
  renderFacts();
  countUps();
  setupReels($('#reels'));
  renderSongs();
}
if (PAGE === 'menu') {
  renderChips();
  renderMenu();
  renderWaiterChips();
}
if (PAGE === 'bron') initBook();
if (PAGE === 'akcii') renderPromos();
if (PAGE === 'vakansii') initJobs();
if (PAGE === 'kontakty') {
  $('#route-ya').href = BAR.routeYandex;
  $('#route-2gis').href = BAR.route2gis;
  renderStatus();
  setupReels(null);
}

// Время идёт: статус «открыто» и прошедшие слоты брони пересчитываются.
const tickTime = () => { renderStatus(); if (PAGE === 'bron') renderBook(); };
setInterval(tickTime, 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tickTime(); });

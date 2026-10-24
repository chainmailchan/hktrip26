// Phase 1 (APP_SPEC §7): pre-trip home (F9), packing lists read-only (F10),
// greetings (F11), Help (F7), the art engine (§4.2) and a hidden art preview.
// All trip content comes from data/; nothing about the trip is written here.

import { pickArt, paintArt, themeVars, inWindow, findImage } from './art.js';

// Set by QR setup in phase 2 (§5.5). Stays on the phone; never in the repo.
const PROFILE_KEY = 'hktrip.profile';

// Packing and Help screens (spec/wireframes/Packing.dc.html, Help.dc.html).
const PAPER = {
  '--bg': '#F3F0EA', '--ink': '#22211F', '--ink-2': '#5F5C56', '--btn-bg': '#22211F',
  '--btn-ink': '#F3F0EA', '--help': '#A8382C', '--halo': '#F3F0EA', '--rule': 'rgba(34, 33, 31, 0.15)'
};

const json = (path) => fetch(path).then((r) => {
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
});

const [trip, greetings, schedule, manifest, packing, itinerary, emergency] = await Promise.all([
  'data/trip.json', 'data/greetings.json', 'data/art-schedule.json', 'art/art-manifest.json',
  'data/packing.json', 'data/itinerary.json', 'data/emergency.json'
].map(json));

const profile = readProfile();
const ticks = {};     // phase 2: live/packing.json
const board = null;   // phase 2: live/board.json (F1); hidden while empty

const params = new URLSearchParams(location.search);
const preview = params.has('preview') ? params.get('preview') : null;

const screen = document.getElementById('screen');
const artEl = document.getElementById('art');
const dialogEl = document.getElementById('dialog');
let firstHome = true;
let lastGreeting = null;
const openGroup = {};

// ---------- helpers ----------

function readProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)); } catch { return null; }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const hm = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());
const dayMs = 86400000;
const addDays = (date, n) => new Date(Date.parse(date) + n * dayMs).toISOString().slice(0, 10);
const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / dayMs);
const longDate = (date) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  .format(new Date(date + 'T00:00:00Z')).replace(',', '');

function setVars(vars) {
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
  document.querySelector('meta[name="theme-color"]').content = vars['--bg'];
}

const cityOn = (date) => itinerary.days.find((d) => d.date === date)?.city || null;

// The date and time the screens use. Preview links can set both (?date=…&time=…).
function now() {
  const d = new Date();
  let date = ymd(d);
  let time = hm(d);
  if (preview !== null) {
    const slot = schedule.default.find((s) => s.id === preview);
    date = params.get('date') || (preview === 'pretrip' ? date : addDays(trip.start, 1));
    time = params.get('time') || (slot ? slot.from : preview === 'pretrip' ? time : '09:00');
  }
  return { date, time };
}

// F11: special days first, then the time-of-day window; one phrase at random.
function pickGreeting(date, time) {
  const special = greetings.special_days.find((s) => s.date
    ? s.date === date && (!s.from || time >= s.from) && (!s.until || time < s.until)
    : date >= s.from && date <= s.to);
  const pool = special ? special.phrases : greetings.windows.find((w) => inWindow(time, w.from, w.to)).phrases;
  // Same phrase until the window changes, so it doesn't flicker on every return Home.
  if (!pool.includes(lastGreeting)) lastGreeting = pool[Math.floor(Math.random() * pool.length)];
  return lastGreeting;
}

// 54 px up to 3 characters, else 44 px; long phrases break only after ，！？ (F11).
function greetingHtml(phrase) {
  const size = [...phrase].length <= 3 ? 'g-big' : 'g-small';
  const inner = esc(phrase).replace(/([，！？])(?=.)/gu, '$1<wbr>');
  const keep = inner.includes('<wbr>') ? ' keep' : '';
  return `<h1 class="greeting ${size}${keep}" lang="zh-Hant">${inner}</h1>`;
}

// Which packing lists this phone sees, its own first (F10). Unset phones see both.
function lists() {
  if (!profile) return ['mp', 'cb'];
  return profile.admin ? ['cb', 'mp'] : ['mp'];
}

function count(listId, items = packing.lists[listId].groups.flatMap((g) => g.items)) {
  const done = items.filter((i) => ticks[listId]?.[i.id]?.done).length;
  return { done, total: items.length };
}

// ---------- screens ----------

function renderHome() {
  const { date, time } = now();
  const slotPreview = preview !== null && preview !== 'pretrip';
  const pretrip = !slotPreview && date < trip.start;
  const file = slotPreview && !schedule.default.some((s) => s.id === preview) ? preview : undefined;
  const art = pickArt({ schedule, manifest, date, time, pretrip, file });
  // Preview only: &fit=cover shows a bottom-fit image cropped at the sides to fill the screen.
  const cropped = slotPreview && params.get('fit') === 'cover' && art.fit === 'bottom';
  if (cropped) art.fit = 'cover';
  setVars(themeVars(manifest, art));
  paintArt(artEl, art, { animate: firstHome });
  artEl.hidden = false;
  firstHome = false;

  const place = pretrip ? trip.home_city : trip.cities[cityOn(date)] || '';
  const dateLine = longDate(date) + (place ? ' · ' + place : '');

  let lines = '';
  let announcement = board?.text ? announcementHtml(board) : '';
  let bottom = '';
  if (slotPreview) {
    lines = `<div class="line">Preview · ${esc(date)} ${esc(time)}</div>
      <div class="line-bold">${esc(art.file || 'placeholder art')}${cropped ? ', cropped' : ''}</div>`;
    announcement = announcementHtml({ by: 'c', text: 'Example: meet in the lobby at 9:30.' });
    bottom = '<a class="btn-primary" href="./">Close preview</a>';
  } else {
    const days = daysBetween(date, trip.start);
    const dest = trip.cities[itinerary.days[0].city];
    const [mine, other] = lists();
    const a = count(mine);
    if (days > 0) lines += `<div class="line-big">${days} ${days === 1 ? 'day' : 'days'} to ${esc(dest)}</div>`;
    lines += `<div class="line">${esc(packing.lists[mine].title)} have packed ${a.done} of ${a.total} things.</div>`;
    bottom = `<a class="btn-primary" href="#packing/${mine}">Packing list</a>`;
    if (other) {
      const b = count(other);
      bottom += `<a class="quiet-link" href="#packing/${other}">${esc(packing.lists[other].title)} have packed ${b.done} of ${b.total} things</a>`;
    }
  }

  screen.innerHTML = `
    <div class="home halo">
      <header class="top">
        <div class="top-left">
          ${greetingHtml(pickGreeting(date, time))}
          <div class="dateline">${esc(dateLine)}</div>
        </div>
        <a class="help-link" href="#help">Help</a>
      </header>
      <div class="lines">${lines}</div>
      ${announcement}
      <div class="bottom">${bottom}</div>
    </div>`;
}

function announcementHtml(b) {
  const by = b.by === 'b' ? 'Belle' : 'Chan';
  return `<section class="announcement" aria-label="Announcement from ${by}">
    <div class="announcement-label">Announcement · from ${by}</div>
    <div class="announcement-text">${esc(b.text)}</div>
  </section>`;
}

function renderPacking(listId) {
  const order = lists();
  const lid = order.includes(listId) ? listId : order[0];
  const list = packing.lists[lid];
  if (!(lid in openGroup)) openGroup[lid] = list.groups[0].id;
  const total = count(lid);
  setVars(PAPER);
  artEl.hidden = true;

  const tabs = order.length < 2 ? '' : `
    <div class="tabs" role="tablist" aria-label="Which list">
      ${order.map((id) => {
        const k = count(id);
        return `<button type="button" class="tab" role="tab" aria-selected="${id === lid}" data-list="${id}">
          <span>${esc(packing.lists[id].title)}</span><span class="count">${k.done} of ${k.total}</span></button>`;
      }).join('')}
    </div>`;

  const groups = list.groups.map((g) => {
    const open = openGroup[lid] === g.id;
    const k = count(lid, g.items);
    const items = !open ? '' : `<div class="items">${g.items.map((it) => {
      const done = ticks[lid]?.[it.id]?.done;
      return `<div class="item${done ? ' done' : ''}">
        <span class="box" aria-hidden="true"></span>
        <span class="item-text">
          <span class="item-name">${esc(it.name)}</span>
          ${it.note ? `<span class="item-note">${esc(it.note)}</span>` : ''}
        </span>
      </div>`;
    }).join('')}</div>`;
    return `<section class="group">
      <button type="button" class="group-head" aria-expanded="${open}" data-group="${g.id}">
        <span class="group-name">${esc(g.name)}</span><span class="group-count">${k.done} of ${k.total}</span>
      </button>${items}</section>`;
  }).join('');

  screen.innerHTML = `
    <div class="page">
      <div class="bar"><a class="pill" href="#" data-home><span aria-hidden="true">←</span>Home</a><a class="help-link" href="#help">Help</a></div>
      <h1 class="title">Packing</h1>
      ${tabs}
      <div class="progress">
        <div><strong>${esc(list.title)}</strong> · ${total.done} of ${total.total} packed</div>
        <div class="track"><div class="fill" style="width: ${total.total ? Math.round(total.done / total.total * 100) : 0}%"></div></div>
      </div>
      ${profile?.github_token ? '' : '<p class="note">You can tick things off after Chan sets up your phone.</p>'}
      ${groups}
    </div>`;
}

function renderHelp() {
  setVars(PAPER);
  artEl.hidden = true;
  const contacts = (profile?.contacts || []).filter((c) => c.name && c.phone);
  const firstCall = contacts[0]?.name || 'Chan';
  const calls = !contacts.length ? '' : `
    <div class="calls" style="grid-template-columns: repeat(${contacts.length}, minmax(0, 1fr))">
      ${contacts.map((c) => `<a class="btn-outline" href="tel:${esc(c.phone)}">Call ${esc(c.name)}</a>`).join('')}
    </div>`;

  screen.innerHTML = `
    <div class="page">
      <div class="bar"><a class="pill" href="#" data-home><span aria-hidden="true">←</span>Home</a></div>
      <h1 class="title">Help</h1>
      <section class="lost" aria-label="If you are lost">
        <div class="lost-1">Lost?</div>
        <div class="lost-2">Stay where you are.</div>
        <div class="lost-3">Then message the family, or call ${esc(firstCall)}. We will come to you.</div>
      </section>
      <a class="btn-primary btn-tall" href="${esc(trip.telegram_group_url)}">Message the family on Telegram</a>
      <div class="sub">Opens our trip group</div>
      <div class="say">Need a toilet, a rest, or want us to wait? Just say so in the group.</div>
      ${calls}
      <button type="button" class="emg-link" data-emergency>Emergency numbers</button>
    </div>`;
}

// Hidden page listing every preview link (?preview).
function renderPreviewList() {
  setVars(PAPER);
  artEl.hidden = true;
  const day2 = addDays(trip.start, 1);
  const label = (id) => id.charAt(0).toUpperCase() + id.slice(1);
  const slotAt = (time) => schedule.default.find((s) => inWindow(time, s.from, s.to)).id;
  const links = [
    ['Pre-trip home, today', '?preview=pretrip'],
    ...schedule.default.map((s) => [`${label(s.id)}, ${longDate(day2)}`, `?preview=${s.id}&date=${day2}`]),
    ...schedule.overrides.map((o) => [`${longDate(o.date)} from ${o.from}`, `?preview=${slotAt(o.from)}&date=${o.date}&time=${o.from}`]),
    ...manifest.images.filter((i) => i.fit !== 'map').flatMap((i) => {
      const stem = i.file.split('/').pop().replace(/\.[a-z]+$/, '');
      const links = [[i.use, `?preview=${stem}`]];
      if (i.fit === 'bottom') links.push([i.use + ', cropped to fill the screen', `?preview=${stem}&fit=cover`]);
      return links;
    })
  ];
  screen.innerHTML = `
    <div class="page">
      <div class="bar"><a class="pill" href="./"><span aria-hidden="true">←</span>Home</a></div>
      <h1 class="title">Art preview</h1>
      <div class="preview-list">
        ${links.map(([text, href]) => `<a class="btn-outline left" href="${esc(href)}">${esc(text)}</a>`).join('')}
      </div>
    </div>`;
}

// ---------- F7 emergency numbers: list, then three confirmations ----------

let emg = null;

function renderEmergency() {
  if (!emg) {
    dialogEl.replaceChildren();
    return;
  }
  const { date } = now();
  const city = cityOn(date);
  const back = '<button type="button" class="btn-back" data-close>No, go back</button>';
  let body;
  if (emg.step === 0) {
    const cities = city ? [city] : Object.keys(emergency);
    const title = 'Emergency numbers' + (city ? ' · ' + trip.cities[city] : '');
    body = `<div class="dialog-title" id="dialog-title">${esc(title)}</div>
      ${cities.map((c) => `<div class="numbers">
        ${city ? '' : `<div class="city">${esc(trip.cities[c])}</div>`}
        ${emergency[c].map((n) => `<button type="button" class="number" data-number="${esc(n.number)}"><span>${esc(n.label)}</span><span>${esc(n.number)}</span></button>`).join('')}
      </div>`).join('')}
      <div class="actions below">${back}</div>`;
  } else {
    const n = emg.number;
    const titles = [`Call ${n}?`, 'Is this an emergency?', `Last step: tap the red button to call ${n}.`];
    const pos = ['below', 'above', 'beside'][emg.step - 1];
    const confirm = emg.step < 3
      ? '<button type="button" class="btn-confirm" data-yes>Yes</button>'
      : `<a class="btn-confirm red" href="tel:${esc(n)}" data-call>Call ${esc(n)}</a>`;
    body = `<div class="dialog-title" id="dialog-title">${esc(titles[emg.step - 1])}</div>
      <div class="actions ${pos}">${back}${confirm}</div>`;
  }
  dialogEl.innerHTML = `<div class="backdrop" data-close></div>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1">${body}</div>`;
  dialogEl.querySelector('.dialog').focus();
}

dialogEl.addEventListener('click', (e) => {
  const t = e.target.closest('[data-close], [data-number], [data-yes], [data-call]');
  if (!t) return;
  if (t.hasAttribute('data-close')) emg = null;
  else if (t.hasAttribute('data-number')) emg = { step: 1, number: t.dataset.number };
  else if (t.hasAttribute('data-yes')) emg = { ...emg, step: emg.step + 1 };
  else if (t.hasAttribute('data-call')) {
    setTimeout(() => { emg = null; renderEmergency(); }, 300);
    return; // let the tel: link open the phone's dialler
  }
  renderEmergency();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && emg) { emg = null; renderEmergency(); }
});

function knownPreview() {
  return preview === 'pretrip' || schedule.default.some((s) => s.id === preview) || !!findImage(manifest, preview);
}

// ---------- routing ----------
// In-app links push history entries with a depth, so "Home" can return in one step
// and Android's back gesture behaves.

function render() {
  emg = null;
  renderEmergency();
  const [name, arg] = location.hash.slice(1).split('/');
  if (name === 'packing') renderPacking(arg);
  else if (name === 'help') renderHelp();
  else if (preview !== null && !knownPreview()) renderPreviewList();
  else renderHome();
  window.scrollTo(0, 0);
}

screen.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-list]');
  if (tab) {
    history.replaceState(history.state, '', '#packing/' + tab.dataset.list);
    return render();
  }
  const group = e.target.closest('[data-group]');
  if (group) {
    const lid = location.hash.split('/')[1] || lists()[0];
    const order = lists();
    const id = order.includes(lid) ? lid : order[0];
    openGroup[id] = openGroup[id] === group.dataset.group ? '' : group.dataset.group;
    return renderPacking(id);
  }
  if (e.target.closest('[data-emergency]')) {
    emg = { step: 0 };
    return renderEmergency();
  }
  const link = e.target.closest('a[href]');
  if (!link) return;
  if (link.hasAttribute('data-home')) {
    e.preventDefault();
    const depth = history.state?.depth || 0;
    if (depth > 0) history.go(-depth);
    else { history.replaceState(null, '', location.pathname + location.search); render(); }
    return;
  }
  const href = link.getAttribute('href');
  if (href.startsWith('#')) {
    e.preventDefault();
    history.pushState({ depth: (history.state?.depth || 0) + 1 }, '', href);
    render();
  }
});

window.addEventListener('popstate', render);
render();

// Date, countdown and greeting move on when the app comes back to the front.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && screen.querySelector('.home')) renderHome();
});

// ---------- update on next open ----------
// The service worker re-checks files each time the app opens. When something changed,
// the page reloads the next time it comes back to the front.

if ('serviceWorker' in navigator) {
  let updateReady = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data === 'updated') updateReady = true; });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) updateReady = true; });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (updateReady) return location.reload();
      reg.update().catch(() => {});
      navigator.serviceWorker.controller?.postMessage('refresh');
    });
  }).catch(() => {});
}

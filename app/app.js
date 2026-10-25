// Phases 1–2 (APP_SPEC §7): pre-trip home (F9), packing lists with ticks (F10), greetings (F11),
// Help (F7), the announcement (F1) and Admin (F8), phone setup (§5.5), the art engine (§4.2)
// and a hidden art preview. All trip content comes from data/; nothing about the trip is written here.

import { pickArt, paintArt, themeVars, inWindow, findImage } from './art.js';
import { createLive } from './live.js';

// Set by phone setup (§5.5, app/setup.js). Stays on the phone; never in the repo.
const PROFILE_KEY = 'hktrip.profile';
const BOARD_MAX = 100; // F8: announcement length

// Packing and Help screens (spec/wireframes/Packing.dc.html, Help.dc.html).
const PAPER = {
  '--bg': '#F3F0EA', '--ink': '#22211F', '--ink-2': '#5F5C56', '--btn-bg': '#22211F',
  '--btn-ink': '#F3F0EA', '--help': '#A8382C', '--halo': '#F3F0EA', '--rule': 'rgba(34, 33, 31, 0.15)'
};

const json = (path) => fetch(path).then((r) => {
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
});

const [trip, greetings, schedule, manifest, packing, itinerary, emergency, people] = await Promise.all([
  'data/trip.json', 'data/greetings.json', 'data/art-schedule.json', 'art/art-manifest.json',
  'data/packing.json', 'data/itinerary.json', 'data/emergency.json', 'data/people.json'
].map(json));

const profile = readProfile();
const canTick = !!profile?.github_token;
const nameOf = (id) => people.find((p) => p.id === id)?.name || '';
// live.board: the announcement (F1), hidden while empty. live.ticks: packing ticks (F10).
const live = createLive({
  repo: trip.live.repo,
  token: profile?.github_token,
  me: profile?.me,
  name: nameOf(profile?.me),
  pollSeconds: trip.live.poll_seconds,
  onChange: onLive
});

const params = new URLSearchParams(location.search);
const preview = params.has('preview') ? params.get('preview') : null;

const screen = document.getElementById('screen');
const artEl = document.getElementById('art');
const dialogEl = document.getElementById('dialog');
let firstHome = true;
let lastGreeting = null;
let route = 'home';
let home = null;          // what the home screen showing now was drawn from, so live changes redraw only its live parts
let leave = null;         // stops the setup camera when the screen changes
let profileChanged = false;
const openGroup = {};

// ---------- helpers ----------

function readProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)); } catch { return null; }
}

// Called by app/setup.js. The app starts again with the new profile when you leave setup.
function saveProfile(p) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  profileChanged = true;
}

function restart() {
  history.replaceState(null, '', location.pathname);
  location.reload();
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
const shortDate = (d) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);
const when = (ms) => { const d = new Date(ms); return (ymd(d) === ymd(new Date()) ? '' : shortDate(d) + ', ') + hm(d); };

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

function count(listId, items = packing.lists[listId].groups.flatMap((g) => g.items), ticks = live.ticks) {
  const done = items.filter((i) => ticks[listId]?.[i.id]?.done).length;
  return { done, total: items.length };
}

const pct = (k) => (k.total ? Math.round(k.done / k.total * 100) : 0);

// §5.2: when live data can't be reached, say so and when it last came through.
function liveNote() {
  if (live.status === 'denied') return 'Not updating. Ask Chan to set up this phone again.';
  if (live.status === 'offline') return 'No connection' + (live.lastOk ? ' · last updated ' + when(live.lastOk) : '');
  return '';
}

function packingNote() {
  if (live.unsent && live.status === 'denied') return 'Your ticks can’t be sent. Ask Chan to set up this phone again.';
  if (live.unsent && live.status === 'offline') return 'No connection. Your ticks are saved on this phone and will be sent when you’re back online.';
  return liveNote();
}

// Live changes redraw only what shows live data (§5.3: no reload, no scroll jump).
function onLive() {
  if (route === 'home') updateHome();
  else if (route === 'packing') updatePacking();
  else if (route === 'admin') updateAdmin();
}

// Which live files the screen showing now needs; the others aren't checked (saves data).
function liveNeeds() {
  if (route === 'home') return home?.slotPreview ? [] : ['board', 'packing'];
  if (route === 'packing') return ['packing'];
  if (route === 'admin') return ['board'];
  return [];
}

// ---------- screens ----------

function renderHome() {
  const { date, time } = now();
  const slotPreview = preview !== null && preview !== 'pretrip';
  const pretrip = !slotPreview && date < trip.start;
  const file = slotPreview && !schedule.default.some((s) => s.id === preview) ? preview : undefined;
  const art = pickArt({ schedule, manifest, date, time, pretrip, file, cityOn });
  setVars(themeVars(manifest, art));
  paintArt(artEl, art, { animate: firstHome });
  artEl.hidden = false;
  firstHome = false;

  const place = pretrip ? trip.home_city : trip.cities[cityOn(date)] || '';
  const dateLine = longDate(date) + (place ? ' · ' + place : '');
  home = { date, time, art, slotPreview };
  home.parts = homeParts(home);

  screen.innerHTML = `
    <div class="home halo">
      <header class="top">
        <div class="top-left">
          ${greetingHtml(pickGreeting(date, time))}
          <div class="dateline">${esc(dateLine)}</div>
        </div>
        <div class="top-links">
          <a class="help-link" href="#help">Help</a>
          ${profile?.admin ? '<a class="admin-link" href="#admin">Admin</a>' : ''}
        </div>
      </header>
      <div class="lines" data-part="lines">${home.parts.lines}</div>
      <div data-part="news">${home.parts.news}</div>
      <div class="bottom" data-part="bottom">${home.parts.bottom}</div>
    </div>`;
}

// The parts of the home screen that show live data: packing progress and the announcement.
function homeParts({ date, time, art, slotPreview }) {
  if (slotPreview) {
    return {
      lines: `<div class="line">Preview · ${esc(date)} ${esc(time)}</div>
        <div class="line-bold">${esc(art.file || 'placeholder art')}</div>`,
      news: announcementHtml({ by: 'c', text: 'Example: meet in the lobby at 9:30.' }),
      bottom: '<a class="btn-primary" href="./">Close preview</a>'
    };
  }
  let lines = '';
  const days = daysBetween(date, trip.start);
  const dest = trip.cities[itinerary.days[0].city];
  const [mine, other] = lists();
  const a = count(mine);
  if (days > 0) lines += `<div class="line-big">${days} ${days === 1 ? 'day' : 'days'} to ${esc(dest)}</div>`;
  lines += `<div class="line">${esc(packing.lists[mine].title)} have packed ${a.done} of ${a.total} things.</div>`;
  let bottom = `<a class="btn-primary" href="#packing/${mine}">Packing list</a>`;
  if (other) {
    const b = count(other);
    bottom += `<a class="quiet-link" href="#packing/${other}">${esc(packing.lists[other].title)} have packed ${b.done} of ${b.total} things</a>`;
  }
  const note = liveNote();
  const news = (live.board?.text ? announcementHtml(live.board) : '') + (note ? `<div class="live-note">${esc(note)}</div>` : '');
  return { lines, news, bottom };
}

function updateHome() {
  if (!home) return;
  const parts = homeParts(home);
  for (const [key, html] of Object.entries(parts)) {
    if (html === home.parts[key]) continue;
    const el = screen.querySelector(`[data-part="${key}"]`);
    if (el) el.innerHTML = html;
  }
  home.parts = parts;
}

function announcementHtml(b) {
  const by = people.find((p) => p.id === b.by && p.role === 'admin')?.name || 'Chan';
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
  const ticks = live.ticks;
  const total = count(lid, undefined, ticks);
  setVars(PAPER);
  artEl.hidden = true;

  const tabs = order.length < 2 ? '' : `
    <div class="tabs" role="tablist" aria-label="Which list">
      ${order.map((id) => {
        const k = count(id, undefined, ticks);
        return `<button type="button" class="tab" role="tab" aria-selected="${id === lid}" data-list="${id}">
          <span>${esc(packing.lists[id].title)}</span><span class="count" data-count="tab:${id}">${k.done} of ${k.total}</span></button>`;
      }).join('')}
    </div>`;

  const groups = list.groups.map((g) => {
    const open = openGroup[lid] === g.id;
    const k = count(lid, g.items, ticks);
    const items = !open ? '' : `<div class="items">${g.items.map((it) => {
      const done = !!ticks[lid]?.[it.id]?.done;
      const inner = `<span class="box" aria-hidden="true"></span>
        <span class="item-text">
          <span class="item-name">${esc(it.name)}</span>
          ${it.note ? `<span class="item-note">${esc(it.note)}</span>` : ''}
        </span>`;
      // Set-up phones tick by tapping anywhere on the row (F10).
      return canTick
        ? `<button type="button" class="item${done ? ' done' : ''}" role="checkbox" aria-checked="${done}" data-item="${esc(it.id)}">${inner}</button>`
        : `<div class="item${done ? ' done' : ''}" data-item="${esc(it.id)}">${inner}</div>`;
    }).join('')}</div>`;
    return `<section class="group">
      <button type="button" class="group-head" aria-expanded="${open}" data-group="${g.id}">
        <span class="group-name">${esc(g.name)}</span><span class="group-count" data-count="group:${g.id}">${k.done} of ${k.total}</span>
      </button>${items}</section>`;
  }).join('');

  const note = packingNote();
  screen.innerHTML = `
    <div class="page" data-packing="${lid}">
      <div class="bar"><a class="pill" href="#" data-home><span aria-hidden="true">←</span>Home</a><a class="help-link" href="#help">Help</a></div>
      <h1 class="title">Packing</h1>
      ${tabs}
      <div class="progress">
        <div data-progress>${progressHtml(list, total)}</div>
        <div class="track"><div class="fill" style="width: ${pct(total)}%"></div></div>
      </div>
      <p class="note" data-live-note${note ? '' : ' hidden'}>${esc(note)}</p>
      ${canTick ? '' : `<p class="note">You can tick things off after Chan sets up your phone.</p>
        <a class="btn-outline setup-btn" href="#setup">Set up this phone</a>`}
      ${groups}
    </div>`;
}

const progressHtml = (list, k) => `<strong>${esc(list.title)}</strong> · ${k.done} of ${k.total} packed`;

function updatePacking() {
  const page = screen.querySelector('[data-packing]');
  if (!page) return;
  const lid = page.dataset.packing;
  const list = packing.lists[lid];
  const ticks = live.ticks;
  for (const row of page.querySelectorAll('[data-item]')) {
    const done = !!ticks[lid]?.[row.dataset.item]?.done;
    row.classList.toggle('done', done);
    if (row.hasAttribute('aria-checked')) row.setAttribute('aria-checked', String(done));
  }
  for (const el of page.querySelectorAll('[data-count]')) {
    const [kind, id] = el.dataset.count.split(':');
    const k = kind === 'tab' ? count(id, undefined, ticks) : count(lid, list.groups.find((g) => g.id === id).items, ticks);
    el.textContent = `${k.done} of ${k.total}`;
  }
  const total = count(lid, undefined, ticks);
  page.querySelector('[data-progress]').innerHTML = progressHtml(list, total);
  page.querySelector('.fill').style.width = pct(total) + '%';
  const note = page.querySelector('[data-live-note]');
  note.textContent = packingNote();
  note.hidden = !note.textContent;
}

// ---------- F8 Admin: write the announcement (Chan and Belle) ----------

function renderAdmin() {
  setVars(PAPER);
  artEl.hidden = true;
  screen.innerHTML = `
    <div class="page admin">
      <div class="bar"><a class="pill" href="#" data-home><span aria-hidden="true">←</span>Home</a><a class="help-link" href="#help">Help</a></div>
      <h1 class="title">Announcement</h1>
      <section class="admin-now" aria-label="Showing now" data-now>${adminNowHtml()}</section>
      <label class="field-label" for="board-text">New announcement</label>
      <textarea id="board-text" class="field" maxlength="${BOARD_MAX}" rows="3" placeholder="For example: meet in the lobby at 9:30."></textarea>
      <div class="counter" data-counter>0 of ${BOARD_MAX}</div>
      <div data-draft></div>
      <div class="admin-actions">
        <button type="button" class="btn-primary" data-show disabled>Show to everyone</button>
        <button type="button" class="btn-outline" data-clear${live.board?.text ? '' : ' hidden'}>Clear the announcement</button>
      </div>
      <p class="msg" data-msg role="status"></p>
    </div>`;
}

function adminNowHtml() {
  const note = liveNote();
  return `<div class="field-label">Showing now</div>
    ${live.board?.text ? announcementHtml(live.board) : '<div class="say">Nothing at the moment.</div>'}
    ${note ? `<p class="note">${esc(note)}</p>` : ''}`;
}

function updateAdmin() {
  const now = screen.querySelector('[data-now]');
  if (!now) return;
  now.innerHTML = adminNowHtml();
  const clear = screen.querySelector('[data-clear]');
  if (!clear.disabled) clear.hidden = !live.board?.text;
}

const draftText = () => (screen.querySelector('#board-text')?.value || '').replace(/\s+/g, ' ').trim();

function updateDraft() {
  const text = draftText();
  screen.querySelector('[data-counter]').textContent = `${screen.querySelector('#board-text').value.length} of ${BOARD_MAX}`;
  screen.querySelector('[data-draft]').innerHTML = text
    ? `<div class="field-label">Preview</div>${announcementHtml({ by: profile.me, text })}` : '';
  screen.querySelector('[data-show]').disabled = !text;
}

async function postBoard(text) {
  const buttons = screen.querySelectorAll('[data-show], [data-clear]');
  const msg = screen.querySelector('[data-msg]');
  buttons.forEach((b) => { b.disabled = true; });
  msg.textContent = 'Sending…';
  let reply;
  try {
    await live.setBoard(text);
    reply = text ? 'Done. Everyone sees this within 30 seconds.' : 'Done. It disappears from every phone within 30 seconds.';
    if (route === 'admin' && text) screen.querySelector('#board-text').value = '';
  } catch (e) {
    reply = e.denied ? 'Not sent: this phone can’t send. Set it up again.' : 'Not sent: no connection. Try again.';
  }
  if (route !== 'admin') return;
  msg.textContent = reply;
  buttons.forEach((b) => { b.disabled = false; });
  updateDraft();
  updateAdmin();
}

function renderHelp() {
  setVars(PAPER);
  artEl.hidden = true;
  const contacts = (profile?.contacts || []).filter((c) => c.name && c.phone);
  const firstCall = contacts[0]?.name || 'Chan';
  const calls = !contacts.length ? '' : `
    <div class="calls" style="grid-template-columns: repeat(${contacts.length}, minmax(0, 1fr))">
      ${contacts.map((c) => `<a class="btn-outline" href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">Call ${esc(c.name)}</a>`).join('')}
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

// Hidden page (?preview, or five taps on the date line): phone setup and every art preview link.
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
    ...manifest.images.filter((i) => i.fit !== 'map').map((i) => {
      const stem = i.file.split('/').pop().replace(/\.[a-z]+$/, '');
      return [i.use, `?preview=${stem}`];
    })
  ];
  const buttons = (list) => list.map(([text, href]) => `<a class="btn-outline left" href="${esc(href)}">${esc(text)}</a>`).join('');
  screen.innerHTML = `
    <div class="page">
      <div class="bar"><a class="pill" href="./"><span aria-hidden="true">←</span>Home</a></div>
      <h1 class="title">Hidden pages</h1>
      <h2 class="list-head">Phone setup</h2>
      <div class="preview-list">${buttons([['Set up this phone', './#setup'], ['Make setup codes', './#codes']])}</div>
      <h2 class="list-head">Art preview</h2>
      <div class="preview-list">${buttons(links)}</div>
    </div>`;
}

// ---------- §5.5 phone setup (app/setup.js, loaded only when needed) ----------

function renderSetupScreen(name) {
  setVars(PAPER);
  artEl.hidden = true;
  screen.innerHTML = '<div class="page"></div>';
  const visit = { gone: false };
  leave = () => { visit.gone = true; };
  import('./setup.js').then((m) => {
    if (visit.gone) return;
    const show = name === 'codes' ? m.renderCodes : m.renderSetup;
    leave = show({ screen, people, profile, saveProfile, restart, esc });
  }).catch(() => {
    if (visit.gone) return;
    screen.innerHTML = `<div class="page">
      <div class="bar"><a class="pill" href="#" data-home><span aria-hidden="true">←</span>Home</a></div>
      <h1 class="title">Set up this phone</h1>
      <p class="say">This needs a connection. Try again when you’re online.</p>
    </div>`;
  });
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
  leave?.();
  leave = null;
  const [name, arg] = location.hash.slice(1).split('/');
  const setup = name === 'setup' || name === 'codes';
  if (profileChanged && !setup) return restart();
  home = null;
  route = name === 'packing' || name === 'help' || setup ? name
    : name === 'admin' && profile?.admin ? 'admin'
    : preview !== null && !knownPreview() ? 'hidden' : 'home';
  if (route === 'packing') renderPacking(arg);
  else if (route === 'help') renderHelp();
  else if (route === 'admin') renderAdmin();
  else if (setup) renderSetupScreen(name);
  else if (route === 'hidden') renderPreviewList();
  else renderHome();
  live.refresh();
  window.scrollTo(0, 0);
}

// The installed app has no address bar: five quick taps on the date line open the art preview list.
let dateTaps = [];

screen.addEventListener('click', (e) => {
  if (e.target.closest('.dateline')) {
    const t = Date.now();
    dateTaps = dateTaps.filter((x) => t - x < 2000).concat(t);
    if (dateTaps.length >= 5) location.href = './?preview';
    return;
  }
  const row = e.target.closest('button[data-item]');
  if (row) {
    live.tick(screen.querySelector('[data-packing]').dataset.packing, row.dataset.item, row.getAttribute('aria-checked') !== 'true');
    return;
  }
  if (e.target.closest('[data-show]')) return postBoard(draftText());
  if (e.target.closest('[data-clear]')) return postBoard('');
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

screen.addEventListener('input', (e) => {
  if (e.target.id === 'board-text') updateDraft();
});

window.addEventListener('popstate', render);
render();
live.start(liveNeeds);

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

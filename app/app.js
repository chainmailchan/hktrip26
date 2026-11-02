// Phases 1–3 (APP_SPEC §7): pre-trip home (F9), packing lists with ticks (F10), greetings (F11),
// Help (F7), the announcement (F1) and Admin (F8), phone setup (§5.5), the art engine (§4.2),
// a hidden art preview, and trip mode: the trip home (F2) with the weather (F5), and the Schedule,
// Place and Hotel screens (F3, F4, F6, in app/trip.js).
// All trip content comes from data/; nothing about the trip is written here.

import { pickArt, paintArt, themeVars, inWindow, findImage } from './art.js';
import { createLive } from './live.js';
import { createWeather, weatherLines } from './weather.js';
import { createTrip } from './trip.js';
import { esc, ymd, hm, addDays, daysBetween, longDate, weekday } from './util.js';

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

const [trip, greetings, schedule, manifest, packing, itinerary, emergency, people, wx] = await Promise.all([
  'data/trip.json', 'data/greetings.json', 'data/art-schedule.json', 'art/art-manifest.json',
  'data/packing.json', 'data/itinerary.json', 'data/emergency.json', 'data/people.json', 'data/weather.json'
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
// F5: refreshed while a home screen that needs it is open; a new forecast redraws only the weather lines.
const weather = createWeather(wx, () => { if (route === 'home') updateHome(); });
const tripScreens = createTrip({ trip, itinerary, schedule, manifest, credit: wx.credit, screen, artEl, setVars, paper: PAPER, now });
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

const shortDate = (d) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);
const when = (ms) => { const d = new Date(ms); return (ymd(d) === ymd(new Date()) ? '' : shortDate(d) + ', ') + hm(d); };

function setVars(vars) {
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
  document.querySelector('meta[name="theme-color"]').content = vars['--bg'];
}

const cityOn = (date) => itinerary.days.find((d) => d.date === date)?.city || null;

// The date and time the screens use. Preview links can set both (?date=…&time=…).
// ?preview=trip shows the real trip screens at that date and time (default: the second day, now).
function now() {
  const d = new Date();
  let date = ymd(d);
  let time = hm(d);
  if (preview !== null) {
    const slot = schedule.default.find((s) => s.id === preview);
    const clock = preview === 'pretrip' || preview === 'trip';
    date = params.get('date') || (preview === 'pretrip' ? date : addDays(trip.start, 1));
    time = params.get('time') || (slot ? slot.from : clock ? time : '09:00');
  }
  return { date, time };
}

const slotAt = (time) => schedule.default.find((s) => inWindow(time, s.from, s.to))?.id;
// A late-night time after midnight still belongs to the evening before (as the art does).
const eveningOf = (date, time) => (slotAt(time) === 'late' && time < '12:00' ? addDays(date, -1) : date);
// The flight on this date, while the home screen names it (trip.json → flights: home_from, home_until).
const flightNow = (date, time) => trip.flights.find((f) => f.date === date && f.home_from && inWindow(time, f.home_from, f.home_until));
const tripPreview = () => preview === 'trip';

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
  if (route === 'home') return home?.slotPreview ? [] : home?.pretrip ? ['board', 'packing'] : ['board'];
  if (route === 'packing') return ['packing'];
  if (route === 'admin') return ['board'];
  return [];
}

// ---------- screens ----------

// The home screen for a date and time: pre-trip (F9) before the trip, trip mode (F2) from its first day.
function homeFor(date, time) {
  const slotPreview = preview !== null && preview !== 'pretrip' && preview !== 'trip';
  const pretrip = !slotPreview && date < trip.start;
  const file = slotPreview && !schedule.default.some((s) => s.id === preview) ? preview : undefined;
  const art = pickArt({ schedule, manifest, date, time, pretrip, file, cityOn });
  return { date, time, art, slotPreview, pretrip, greeting: pickGreeting(date, time) };
}

function renderHome() {
  const { date, time } = now();
  home = homeFor(date, time);
  const { art } = home;
  setVars(themeVars(manifest, art));
  // Repaint only when the picture changes, so returning Home or a new minute doesn't flash.
  const key = art.src || 'placeholder';
  if (artEl.dataset.key !== key) {
    paintArt(artEl, art, { animate: firstHome });
    artEl.dataset.key = key;
  } else {
    artEl.classList.remove('animate'); // or the rise would play again when the art is shown again
  }
  artEl.hidden = false;
  firstHome = false;
  home.parts = homeParts(home);

  screen.innerHTML = `
    <div class="home halo">
      <header class="top">
        <div class="top-left">
          ${greetingHtml(home.greeting)}
          <div class="dateline">${esc(dateLine(home))}</div>
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
  wantWeather(home);
}

// F2: the date and the day's place; the flight on flight days; the time late at night.
function dateLine({ date, time, pretrip, slotPreview }) {
  if (pretrip) return longDate(date) + ' · ' + trip.home_city;
  const city = trip.cities[cityOn(date)] || '';
  if (slotPreview) return longDate(date) + (city ? ' · ' + city : '');
  const f = flightNow(date, time);
  if (f) return `${longDate(date)} · ${f.code} to ${f.to}`;
  if (slotAt(time) === 'late') return `${weekday(date)} · ${time}`;
  const place = tripScreens.dayOf(date)?.label || city;
  return longDate(date) + (place ? ' · ' + place : '');
}

// F5: today's forecast for the day's city; after 22:00, tomorrow's.
function weatherHtml(date, time) {
  const f = flightNow(date, time);
  const late = !f && slotAt(time) === 'late';
  const evening = eveningOf(date, time);
  const day = late ? addDays(evening, 1) : date;
  const city = cityOn(day);
  if (!city) return '';
  const lead = f ? trip.cities[city] + ' today:'
    : !late ? '' : cityOn(evening) && cityOn(evening) !== city ? trip.cities[city] + ' tomorrow:' : 'Tomorrow';
  let lines = weatherLines(wx, weather.day(city, day), { lead, flight: !!f });
  // A preview date with no forecast yet: example lines, so the layout can still be checked.
  if (!lines && tripPreview()) {
    lines = weatherLines(wx, { high: 23, code: 3, rain: 60 }, { lead, flight: !!f });
    lines[0] = 'Example: ' + lines[0];
  }
  return lines ? `<div class="line">${esc(lines[0])}</div><div class="line-bold">${esc(lines[1])}</div>` : '';
}

// From two days before the trip, so the first morning has a forecast even in airplane mode.
function wantWeather({ date, pretrip, slotPreview }) {
  if (slotPreview || (pretrip && daysBetween(date, trip.start) > 2)) return;
  weather.refresh(ymd(new Date()));
}

// F2 plan button: "Today's plan", "Tonight's plan" (evening), "Tomorrow's plan" (late night).
function planFor(date, time) {
  const slot = slotAt(time);
  const days = itinerary.days;
  const last = days[days.length - 1].date;
  let target = date;
  let label = 'Today’s plan';
  if (slot === 'evening') label = 'Tonight’s plan';
  if (slot === 'late') {
    label = 'Tomorrow’s plan';
    target = addDays(eveningOf(date, time), 1);
  }
  // After the trip, and on its last evening: the whole plan, on the last day.
  if (!tripScreens.dayOf(target) || (target === last && slot === 'evening')) {
    label = 'The trip plan';
    target = target < days[0].date ? days[0].date : last;
  }
  return { label, href: '#schedule/' + target };
}

// The parts of the home screen that change while it is showing: the weather or packing lines,
// the announcement, and the button(s) at the bottom.
function homeParts({ date, time, art, slotPreview, pretrip }) {
  if (slotPreview) {
    return {
      lines: `<div class="line">Preview · ${esc(date)} ${esc(time)}</div>
        <div class="line-bold">${esc(art.file || 'placeholder art')}</div>`,
      news: announcementHtml({ by: 'c', text: 'Example: meet in the lobby at 9:30.' }),
      bottom: '<a class="btn-primary" href="./">Close preview</a>'
    };
  }
  const note = liveNote();
  const news = (live.board?.text ? announcementHtml(live.board) : '') + (note ? `<div class="live-note">${esc(note)}</div>` : '');
  if (!pretrip) {
    const plan = planFor(date, time);
    return {
      lines: weatherHtml(date, time),
      news,
      bottom: `<a class="btn-primary" href="${plan.href}">${esc(plan.label)}</a>`
        + (tripPreview() ? '<a class="quiet-link" href="./">Close preview</a>' : '')
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
  return { lines, news, bottom };
}

// While the home screen stays open: a new date, picture or greeting window redraws it; otherwise
// only the late-night clock and the parts that changed (§5.3: no reload, no jump).
function tickHome() {
  if (route !== 'home' || !home || home.slotPreview || document.visibilityState !== 'visible') return;
  const { date, time } = now();
  const next = homeFor(date, time);
  if (date !== home.date || next.art.src !== home.art.src || next.greeting !== home.greeting || next.pretrip !== home.pretrip) return renderHome();
  home.time = time;
  const line = screen.querySelector('.dateline');
  const text = dateLine(home);
  if (line && line.textContent !== text) line.textContent = text;
  updateHome();
  wantWeather(home);
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
  // Trip mode before the trip: the real trip screens on each day, at the time picked here.
  const times = PREVIEW_TIMES;
  const dayLinks = itinerary.days.map((d) => [longDate(d.date), `?preview=trip&date=${d.date}&time=${times[0]}`]);
  screen.innerHTML = `
    <div class="page">
      <div class="bar"><a class="pill" href="./"><span aria-hidden="true">←</span>Home</a></div>
      <h1 class="title">Hidden pages</h1>
      <h2 class="list-head">Phone setup</h2>
      <div class="preview-list">${buttons([['Set up this phone', './#setup'], ['Make setup codes', './#codes']])}</div>
      <h2 class="list-head">Packing</h2>
      <div class="preview-list">${buttons([['Packing list', './#packing']])}</div>
      <h2 class="list-head">Trip days</h2>
      <p class="note">The trip screens as they will look on that day, at this time:</p>
      <div class="tabs four" role="tablist" aria-label="Time of day">
        ${times.map((t, i) => `<button type="button" class="tab" role="tab" aria-selected="${i === 0}" data-ptime="${t}">${t}</button>`).join('')}
      </div>
      <div class="preview-list" data-trip-days>${buttons(dayLinks)}</div>
      <h2 class="list-head">Art preview</h2>
      <div class="preview-list">${buttons(links)}</div>
    </div>`;
}

// Hidden pages → Trip days: morning, afternoon, evening and late night.
const PREVIEW_TIMES = ['09:00', '15:00', '18:40', '23:00'];

function pickPreviewTime(tab) {
  for (const t of screen.querySelectorAll('[data-ptime]')) t.setAttribute('aria-selected', String(t === tab));
  for (const a of screen.querySelectorAll('[data-trip-days] a')) {
    a.setAttribute('href', a.getAttribute('href').replace(/time=[\d:]+/, 'time=' + tab.dataset.ptime));
  }
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

// ---------- dialogs: F7 emergency numbers (a list, then three confirmations), F6 hotel ----------

let emg = null;      // { step, number }
let hotelId = null;  // the hotel card opened from "Tonight" on the Schedule

function renderDialog() {
  if (!emg && !hotelId) {
    dialogEl.replaceChildren();
    return;
  }
  const { date } = now();
  const city = cityOn(date);
  const back = '<button type="button" class="btn-back" data-close>No, go back</button>';
  let body;
  if (hotelId) {
    body = tripScreens.hotelHtml(hotelId);
  } else if (emg.step === 0) {
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
    <div class="dialog${hotelId ? ' tall' : ''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1">${body}</div>`;
  dialogEl.querySelector('.dialog').focus();
}

function closeDialog() {
  emg = null;
  hotelId = null;
  renderDialog();
}

dialogEl.addEventListener('click', (e) => {
  const copy = e.target.closest('[data-copy]');
  if (copy) return tripScreens.copy(copy);
  const t = e.target.closest('[data-close], [data-number], [data-yes], [data-call]');
  if (!t) return; // "Open in maps" opens on its own
  if (t.hasAttribute('data-close')) return closeDialog();
  if (t.hasAttribute('data-number')) emg = { step: 1, number: t.dataset.number };
  else if (t.hasAttribute('data-yes')) emg = { ...emg, step: emg.step + 1 };
  else if (t.hasAttribute('data-call')) {
    setTimeout(closeDialog, 300);
    return; // let the tel: link open the phone's dialler
  }
  renderDialog();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (emg || hotelId)) closeDialog();
});

function knownPreview() {
  return preview === 'pretrip' || preview === 'trip' || schedule.default.some((s) => s.id === preview) || !!findImage(manifest, preview);
}

// ---------- routing ----------
// In-app links push history entries with a depth, so "Home" can return in one step
// and Android's back gesture behaves.

function render() {
  emg = null;
  hotelId = null;
  renderDialog();
  leave?.();
  leave = null;
  const [name, ...args] = location.hash.slice(1).split('/');
  const arg = args[0];
  const setup = name === 'setup' || name === 'codes';
  if (profileChanged && !setup) return restart();
  home = null;
  route = ['packing', 'help', 'schedule', 'place'].includes(name) || setup ? name
    : name === 'admin' && profile?.admin ? 'admin'
    : preview !== null && !knownPreview() ? 'hidden' : 'home';
  window.scrollTo(0, 0);
  if (route === 'place' && !tripScreens.renderPlace(args)) route = 'schedule';
  if (route === 'schedule') tripScreens.renderSchedule(arg); // a place that isn't found: its day
  else if (route === 'packing') renderPacking(arg);
  else if (route === 'help') renderHelp();
  else if (route === 'admin') renderAdmin();
  else if (setup) renderSetupScreen(name);
  else if (route === 'hidden') renderPreviewList();
  else if (route === 'home') renderHome();
  live.refresh();
}

function openHotel(id) {
  hotelId = id;
  renderDialog();
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
  if (tripScreens.onClick(e, openHotel)) return;
  const ptime = e.target.closest('[data-ptime]');
  if (ptime) return pickPreviewTime(ptime);
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
    return renderDialog();
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
  // "← Wednesday", "← Back": one step back; opened from a link, its own href.
  if (link.hasAttribute('data-back')) {
    e.preventDefault();
    if ((history.state?.depth || 0) > 0) history.back();
    else { history.replaceState(null, '', location.pathname + location.search + link.getAttribute('href')); render(); }
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

// Date, countdown and greeting move on when the app comes back to the front, and while it stays open.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && screen.querySelector('.home')) renderHome();
});
setInterval(tickHome, 20 * 1000);

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

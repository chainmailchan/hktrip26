// Trip mode (APP_SPEC F3, F4, F6): the Schedule, the Place card over Chan's map (everything about
// the place, with "Open in maps" and the copy button), and the hotel card. Everything shown comes from data/itinerary.json,
// data/trip.json, data/art-schedule.json and art/art-manifest.json.

import { esc, weekday, dayOfMonth, dayMonth, copyText, phoneOS } from './util.js';
import { themeVars, rgba, findImage } from './art.js';

const PIN_Y = 0.3; // fallback: the pin 30% down the screen (spec/wireframes/Place.dc.html: 250 of 844)
const FADE = 120;  // px: the map's own fade-out at its bottom edge (app.css .fit-map), kept behind the card
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createTrip({ trip, itinerary, schedule, manifest, credit, screen, artEl, setVars, paper, now }) {
  const days = itinerary.days;
  const dayOf = (date) => days.find((d) => d.date === date);
  const hotelOn = (date) => trip.hotels.find((h) => h.nights.includes(date));
  // Chinese names in Traditional characters in Hong Kong and Simplified in Shenzhen.
  const zhLang = (city) => (city === 'SZ' ? 'zh-CN' : 'zh-HK');
  let layout = null; // re-frames the map when the screen size changes

  // A stop opens a Place card only when there is something to show; travel and rest rows don't.
  const hasCard = (s) => !!(s.search || s.why || s.try || s.note || s.options?.length);

  function timeParts(s) {
    if (!s.time) return [];
    if (s.by) return ['by', s.time];
    if (s.approx) return ['about', s.time];
    if (s.until) return [s.time, 'to ' + s.until];
    return [s.time];
  }
  const timeText = (s) => (!s.time ? '' : s.by ? 'By ' + s.time : s.approx ? 'About ' + s.time
    : s.until ? `${s.time} to ${s.until}` : s.time);

  // The stop under way, by the clock: the last one that has started today (Q31).
  function currentStop(day) {
    const { date, time } = now();
    if (day.date !== date) return null;
    let cur = null;
    for (const s of day.stops) if (s.time && s.time <= time) cur = s;
    return cur?.id || null;
  }

  // ---------- F3 Schedule ----------

  function defaultDay() {
    const { date } = now();
    if (dayOf(date)) return date;
    return date > days[days.length - 1].date ? days[days.length - 1].date : days[0].date;
  }

  // arg: a date, "extras", "none" (all closed) or empty (today).
  function renderSchedule(arg) {
    const open = arg === 'none' ? null : arg === 'extras' || dayOf(arg) ? arg : defaultDay();
    setVars(paper);
    artEl.hidden = true;
    screen.innerHTML = `
      <div class="page schedule">
        <div class="bar sticky"><a class="pill" href="#" data-home><span aria-hidden="true">←</span>Home</a><a class="help-link" href="#help">Help</a></div>
        ${days.map((d) => dayHtml(d, d.date === open)).join('')}
        ${extrasHtml(open === 'extras')}
        <p class="credit">${esc(credit)}</p>
      </div>`;
    revealOpen();
  }

  function head(id, name, meta, open) {
    return `<button type="button" class="day-head" aria-expanded="${open}" data-day="${esc(id)}">
      <span class="day-name">${esc(name)}</span><span class="day-meta">${esc(meta)}</span></button>`;
  }

  function dayHtml(d, open) {
    const top = head(d.date, weekday(d.date), dayOfMonth(d.date) + ' · ' + d.label, open);
    if (!open) return `<section class="day">${top}</section>`;
    const cur = currentStop(d);
    const stops = d.stops.length ? d.stops.map((s) => stopHtml(d.date, s, s.id === cur)).join('')
      : '<div class="stop plain"><span class="stop-time"></span><span class="stop-text"><span class="stop-name">Plans coming soon</span></span></div>';
    const hotel = hotelOn(d.date);
    const tonight = hotel
      ? `<button type="button" class="stop tonight" data-hotel="${esc(hotel.id)}"><span class="stop-time">Tonight</span><span class="stop-text"><span class="stop-name">${esc(hotel.name)}</span></span></button>`
      : d.date === trip.end
        ? `<div class="stop tonight plain"><span class="stop-time">Tonight</span><span class="stop-text"><span class="stop-name">Home to ${esc(trip.home_city)}</span></span></div>`
        : '';
    return `<section class="day open">${top}
      <div class="day-body">
        <div class="day-sub">${esc(dayMonth(d.date))}${d.title ? ' · ' + esc(d.title) : ''}</div>
        ${d.tip ? `<p class="tip"><strong>Tip:</strong> ${esc(d.tip)}</p>` : ''}
        ${stops}${tonight}
      </div></section>`;
  }

  function stopHtml(date, s, isNow) {
    const t = timeParts(s);
    const time = `<span class="stop-time">${isNow ? '<span class="now">Now</span>' : ''}${t.map((x) => `<span>${esc(x)}</span>`).join('')}</span>`;
    const text = `<span class="stop-text"><span class="stop-name">${esc(s.name)}</span>${s.optional ? '<span class="stop-sub">Optional</span>' : ''}</span>`;
    const cur = isNow ? ' aria-current="true"' : '';
    return hasCard(s)
      ? `<a class="stop" href="#place/${date}/${esc(s.id)}"${cur}>${time}${text}</a>`
      : `<div class="stop plain"${cur}>${time}${text}</div>`;
  }

  // The two unscheduled places (itinerary.json → extras), in a last section.
  function extrasHtml(open) {
    const extras = itinerary.extras || [];
    if (!extras.length) return '';
    const top = head('extras', 'If there’s time', 'Optional', open);
    if (!open) return `<section class="day">${top}</section>`;
    return `<section class="day open">${top}<div class="day-body">
      ${extras.map((e) => `<a class="stop no-time" href="#place/extra/${esc(e.id)}"><span class="stop-text">
        <span class="stop-name">${esc(e.name)}</span><span class="stop-sub">${esc(trip.cities[e.city] || '')}</span></span></a>`).join('')}
      </div></section>`;
  }

  // Brings an open day into view under the bar, all of it if it fits.
  function revealOpen() {
    const section = screen.querySelector('.day.open');
    if (!section) return;
    const bar = screen.querySelector('.bar.sticky').getBoundingClientRect().bottom;
    const r = section.getBoundingClientRect();
    if (r.bottom <= innerHeight && r.top >= bar) return;
    window.scrollBy(0, Math.min(r.top - bar - 4, r.bottom - innerHeight + 16));
  }

  function toggleDay(btn) {
    const id = btn.dataset.day;
    const wasOpen = btn.getAttribute('aria-expanded') === 'true';
    const before = btn.getBoundingClientRect().top;
    const next = wasOpen ? 'none' : id;
    history.replaceState(history.state, '', '#schedule/' + next);
    renderSchedule(next);
    // Keep the tapped day where it was, then show what opened.
    const again = screen.querySelector(`[data-day="${CSS.escape(id)}"]`);
    window.scrollBy(0, again.getBoundingClientRect().top - before);
    if (!wasOpen) revealOpen();
  }

  // ---------- F4 Place card: everything about the place on one screen, over the map ----------

  // parts: [date, stopId] or ["extra", id]. (An old ".../more" link opens the same card.)
  function findStop([a, b]) {
    if (a === 'extra') {
      const stop = (itinerary.extras || []).find((e) => e.id === b);
      return stop && { stop, date: null, city: stop.city, back: '#schedule/extras', backLabel: 'Schedule' };
    }
    const day = dayOf(a);
    const stop = day?.stops.find((s) => s.id === b);
    return stop && { stop, date: a, city: day.city, back: '#schedule/' + a, backLabel: weekday(a) };
  }

  function metaText(p) {
    const s = p.stop;
    if (!p.date) return 'If there’s time · ' + (trip.cities[s.city] || '');
    return [timeText(s), s.optional ? 'Optional' : ''].filter(Boolean).join(' · ');
  }

  const zhHtml = (name, city, cls = '') => (name ? `<div class="zh${cls}" lang="${zhLang(city)}">${esc(name)}</div>` : '');
  const linesHtml = (lines) => lines.filter(Boolean).map((l) => `<p class="card-line">${esc(l)}</p>`).join('');

  // Returns false when the stop isn't in the itinerary (the caller shows the Schedule instead).
  function renderPlace(parts) {
    const p = findStop(parts);
    if (!p) return false;
    renderCard(p);
    return true;
  }

  // One screen [stated, 3 Nov]: the map at the top, and a card with the drawing, name, time, why,
  // what to try, notes, Open in maps and the copy button, then the choices. A long card scrolls.
  function renderCard(p) {
    const s = p.stop;
    const city = s.city || p.city; // where the place really is: maps app and Uber or DiDi go by this
    // The map goes by the part of the trip (the day's city), not by where the place is [stated, 24 Oct].
    const img = findImage(manifest, schedule.place_map[p.city] || schedule.place_map.HK);
    setVars(themeVars(manifest, { background: img.background, theme: img.theme }));
    const options = !s.options?.length ? '' : `
      <section class="options" aria-label="${esc(s.options_title || 'Choices')}">
        <h2 class="list-head">${esc(s.options_title || 'Choices')}</h2>
        ${s.options.map((o) => `<div class="option">
          <div class="option-name">${esc(o.name)}</div>
          ${zhHtml(o.name_zh, city)}
          ${linesHtml([o.why, o.try ? 'Try: ' + o.try : ''])}
          ${o.search ? mapsHtml(o.search, city, false) : ''}
        </div>`).join('')}
      </section>`;
    screen.innerHTML = `
      <div class="place">
        <div class="bar halo"><a class="pill on-map" href="${p.back}" data-back><span aria-hidden="true">←</span>${esc(p.backLabel)}</a><a class="help-link" href="#help">Help</a></div>
        <div class="map-gap"></div>
        <section class="card" aria-label="${esc(s.name)}">
          ${CARD_ART[s.card_art] ? `<div class="card-art">${CARD_ART[s.card_art]}</div>` : ''}
          <h1 class="card-name">${esc(s.name)}</h1>
          ${zhHtml(s.name_zh, city)}
          <div class="card-time">${esc(metaText(p))}</div>
          ${linesHtml([s.why, s.try ? 'Try: ' + s.try : '', s.note])}
          ${s.search ? mapsHtml(s.search, city, true) : ''}
          ${options}
        </section>
      </div>`;
    paintMap(img, s.map_area); // after the card, so the map can be framed above it
  }

  // ---------- Open in maps (§5.2) ----------
  // By where the place is, on every phone: Google Maps for Hong Kong addresses, Amap for Shenzhen ones
  // [stated, 3 Nov: Google Maps doesn't work in Shenzhen]. Both search by the place's search line (Chinese
  // name and address), which avoids the GCJ-02 offset of coordinates in mainland China.
  // Amap: straight into its app [proposal, 6 Nov: its web link opened a browser page instead]. iPhones use
  // Amap's own link, so Amap must be installed; Android uses an app link that falls back to Amap's web page
  // when the app isn't there; anything else gets the web page [assumption: link formats and the Android
  // package name are from memory, not checked from the build session; Q46].
  // Returns { href, app }: app links open in place, web pages in a new tab (outside the installed app).
  function mapsLink(search, city) {
    const q = encodeURIComponent(search);
    if (city !== 'SZ') return { href: 'https://www.google.com/maps/search/?api=1&query=' + q, app: false };
    const web = 'https://uri.amap.com/search?keyword=' + q + '&city=' + encodeURIComponent('深圳') + '&callnative=1&src=hktrip';
    const os = phoneOS();
    if (os === 'ios') return { href: 'iosamap://poi?sourceApplication=hktrip&name=' + q + '&dev=0', app: true };
    if (os === 'android') {
      return { href: 'intent://poi?sourceApplication=hktrip&keywords=' + q + '&dev=0#Intent;scheme=androidamap;package=com.autonavi.minimap;S.browser_fallback_url='
        + encodeURIComponent(web) + ';end', app: true };
    }
    return { href: web, app: false };
  }

  // Uber for every Hong Kong address, DiDi only for Shenzhen ones [stated, 3 Nov].
  const rideApp = (city) => (city === 'SZ' ? 'DiDi' : 'Uber');

  // The filled button and "Copy the address for Uber" (DiDi in Shenzhen); outlined pair for choices.
  function mapsHtml(search, city, main) {
    const app = rideApp(city);
    const link = mapsLink(search, city);
    const copy = `<button type="button" class="btn-outline" data-copy="${esc(search)}" data-app="${app}">${main ? 'Copy the address for ' : 'Copy for '}${app}</button>`;
    return `<div class="maps${main ? '' : ' pair'}">
      <a class="${main ? 'btn-primary' : 'btn-outline'}" href="${esc(link.href)}"${link.app ? '' : ' target="_blank" rel="noopener"'}>Open in maps</a>${copy}
      </div><p class="msg" role="status" data-copied></p>`;
  }

  async function copy(btn) {
    const msg = btn.closest('.maps').nextElementSibling;
    const ok = await copyText(btn.dataset.copy);
    msg.textContent = ok ? `Copied. Paste it into ${btn.dataset.app}.` : 'Couldn’t copy on this phone.';
  }

  // ---------- F6 Hotel (a dialog over the Schedule) ----------

  function hotelHtml(id) {
    const h = trip.hotels.find((x) => x.id === id);
    if (!h) return '';
    return `<div class="dialog-title" id="dialog-title">${esc(h.name)}</div>
      ${zhHtml(h.name_zh, h.city, ' zh-big')}
      ${h.full_name ? `<div class="hotel-line muted">${esc(h.full_name)}</div>` : ''}
      <div class="hotel-line">${esc(h.address)}</div>
      <div class="hotel-line">Check in from ${esc(h.check_in)} · check out by ${esc(h.check_out)}</div>
      ${mapsHtml(h.search || h.address, h.city, true)}
      <button type="button" class="btn-outline" data-close>Close</button>`;
  }

  // ---------- the map behind the Place card ----------

  function paintMap(img, areaId) {
    const focus = img.areas?.[areaId] || img.focus || { x: 0.5, y: 0.5 };
    artEl.hidden = false;
    artEl.dataset.key = `map:${img.file}:${focus.x},${focus.y}`;
    artEl.className = 'art map-fade';
    artEl.style.background = img.background;
    const pic = document.createElement('img');
    pic.src = img.file;
    pic.alt = '';
    pic.decoding = 'async';
    pic.className = 'art-img fit-map';
    const wash = document.createElement('div');
    wash.className = 'art-wash';
    wash.style.background = rgba(img.background, (img.soften_pct || 0) / 100);
    const pin = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    pin.setAttribute('class', 'map-pin');
    pin.setAttribute('aria-hidden', 'true');
    artEl.replaceChildren(pic, wash, pin);

    layout = () => {
      const W = artEl.clientWidth;
      const H = artEl.clientHeight;
      const view = Math.min(innerHeight, H);
      // The map shows between the bar and the card; the pin goes in the middle of that.
      const barEnd = screen.querySelector('.place .bar')?.getBoundingClientRect().bottom || 80;
      const cardTop = screen.querySelector('.place .card')?.offsetTop || view * 0.6;
      const pinY = cardTop > barEnd ? clamp((barEnd + cardTop) / 2 + 20, barEnd + 50, cardTop - 10) : view * PIN_Y;
      // Cover the screen (not the whole page: a long card scrolls), then zoom; the area sits under the
      // pin as far as the map's edges allow. The map may end behind the card (it fades out there), so
      // low-lying areas can still sit under the pin.
      const scale = Math.max(W / img.width, view / img.height) * (img.zoom || 1);
      const w = img.width * scale;
      const h = img.height * scale;
      const left = clamp(W / 2 - focus.x * w, W - w, 0);
      const top = clamp(pinY - focus.y * h, Math.min(H, cardTop + FADE) - h, 0);
      pic.style.cssText = `left: ${left}px; top: ${top}px; width: ${w}px; height: ${h}px`;
      // Pin and dotted line, for mood only [stated]: over the area, wherever the edges left it.
      const x = clamp(left + focus.x * w, 40, W - 40);
      const y = clamp(top + focus.y * h, barEnd + 50, cardTop - 10);
      const dx = x + 67 > W - 24 ? -67 : 67;
      const dy = clamp(cardTop - 24 - y, 40, 134);
      const ink = img.theme === 'navy' ? '#F4ECDC' : '#22211F';
      const red = img.theme === 'navy' ? '#F4A28C' : '#9A4A12';
      pin.setAttribute('width', W);
      pin.setAttribute('height', H);
      pin.innerHTML = `<g transform="translate(${x} ${y})" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M${dx} ${dy}L0 0" stroke="${ink}" stroke-width="2" stroke-dasharray="2 9"></path>
        <circle cx="${dx}" cy="${dy}" r="6" fill="${img.background}" stroke="${ink}" stroke-width="1.8"></circle>
        <path d="M0 0C0 0 -15 -17 -15 -28A15 15 0 0 1 15 -28C15 -17 0 0 0 0Z" fill="${img.background}" stroke="${red}" stroke-width="1.8"></path>
        <circle cx="0" cy="-28" r="4.5" stroke="${red}" stroke-width="1.6"></circle></g>`;
    };
    layout();
  }

  addEventListener('resize', () => {
    if (layout && !artEl.hidden && artEl.dataset.key?.startsWith('map:')) layout();
  });

  // Taps the trip screens handle themselves. Returns true when handled.
  function onClick(e, openHotel) {
    const day = e.target.closest('[data-day]');
    if (day) { toggleDay(day); return true; }
    const hotel = e.target.closest('[data-hotel]');
    if (hotel) { openHotel(hotel.dataset.hotel); return true; }
    const btn = e.target.closest('[data-copy]');
    if (btn) { copy(btn); return true; }
    return false;
  }

  return { renderSchedule, renderPlace, hotelHtml, onClick, copy, dayOf };
}

// Line drawings for the place card (spec/wireframes/Place.dc.html), named by card_art in the itinerary.
const svg = (label, body) => `<svg width="200" height="130" viewBox="0 0 200 130" fill="none" stroke="#2B2A27" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${label}">${body}</svg>`;
const CARD_ART = {
  dimsum: svg('Line drawing of bamboo dim sum steamer baskets', `
    <ellipse cx="80" cy="96" rx="58" ry="14"></ellipse>
    <path d="M22 96V112A58 14 0 0 0 138 112V96"></path>
    <path d="M22 104A58 14 0 0 0 138 104" stroke="#A6A198"></path>
    <ellipse cx="80" cy="62" rx="58" ry="14"></ellipse>
    <path d="M22 62V82A58 14 0 0 0 138 82V62"></path>
    <path d="M22 72A58 14 0 0 0 138 72" stroke="#A6A198"></path>
    <path d="M50 60q8 -14 18 -2q6 -10 14 0M84 58q8 -14 18 -2q6 -10 14 0"></path>
    <g class="steam" stroke="#A6A198"><path d="M62 38q-6 -8 0 -16q6 -8 0 -16M98 36q-6 -8 0 -16q6 -8 0 -16"></path></g>
    <path d="M150 30L192 96M158 26L198 90"></path>`),
  noodles: svg('Line drawing of a bowl of noodles with chopsticks', `
    <path d="M30 70H170Q164 118 100 122Q36 118 30 70Z"></path>
    <path d="M70 122V128H130V122"></path>
    <path d="M44 70q10 -10 20 0q10 -10 20 0q10 -10 20 0q10 -10 20 0q10 -10 20 0" stroke="#A6A198"></path>
    <path d="M108 70C112 50 118 40 124 30M116 70C122 52 128 44 132 34" stroke="#A6A198"></path>
    <path d="M112 4L134 46M124 2L144 44"></path>
    <g class="steam" stroke="#A6A198"><path d="M70 56q-6 -8 0 -16q6 -8 0 -16"></path></g>`),
  dessert: svg('Line drawing of two ice cream cones', `
    <path d="M62 62L80 124L98 62"></path>
    <path d="M66 74L92 84M70 88L88 96M64 66L94 100M96 70L76 112" stroke="#A6A198"></path>
    <path d="M58 62Q58 30 80 30Q102 30 102 62Q92 56 80 62Q68 56 58 62Z"></path>
    <path d="M112 66L128 124L144 66"></path>
    <path d="M116 78L140 88M118 92L136 100M114 70L142 104M142 74L124 114" stroke="#A6A198"></path>
    <path d="M108 66Q108 38 128 38Q148 38 148 66Q138 60 128 66Q118 60 108 66Z"></path>
    <path d="M128 38Q126 30 132 26"></path>`),
  charsiu: svg('Line drawing of a plate of char siu rice', `
    <ellipse cx="100" cy="98" rx="82" ry="22"></ellipse>
    <ellipse cx="100" cy="96" rx="64" ry="15" stroke="#A6A198"></ellipse>
    <path d="M48 92Q60 60 100 58Q140 60 152 92" stroke="#A6A198"></path>
    <path d="M66 86l6 -6m10 4l5 -6m10 4l6 -6m12 4l5 -6m12 4l5 -6" stroke="#A6A198"></path>
    <path d="M58 74L84 58L96 66L70 82Z M88 66L114 52L126 60L100 74Z M118 62L142 50L152 58L128 70Z"></path>
    <path d="M66 74L84 64M96 66L114 56M126 62L142 54" stroke="#A6A198"></path>`)
};

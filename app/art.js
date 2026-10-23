// Home-screen art engine (APP_SPEC §4.2, §4.5).
// pickArt() chooses the image for a date and time from data/art-schedule.json and
// art/art-manifest.json. paintArt() draws it: "bottom" = full width, natural height,
// pinned to the bottom and raised by a share of screen height; "cover" = fills the
// screen, trimmed equally from both sides. Images are never stretched.

// Shown while art-schedule.json → pretrip.image is empty (spec F9, Q37).
const PLACEHOLDER = { placeholder: true, fit: 'placeholder', background: '#F3F0EA', theme: 'paper', soften: 0 };

// "HH:MM" inside [from, to). Windows may wrap past midnight; "23:59" means end of day.
export function inWindow(time, from, to) {
  const end = to === '23:59' ? '24:00' : to;
  return from <= end ? time >= from && time < end : time >= from || time < end;
}

export function pickArt({ schedule, manifest, date, time, pretrip, file }) {
  if (!file) {
    if (pretrip) {
      file = schedule.pretrip.image;
    } else {
      const override = schedule.overrides.find((o) => o.date === date && inWindow(time, o.from, o.to));
      const slot = schedule.default.find((s) => inWindow(time, s.from, s.to));
      file = override ? override.image
        : slot.image === 'per_day' ? schedule.afternoon_by_day[date] || slot.fallback
        : slot.image;
    }
  }
  const img = file && findImage(manifest, file);
  if (!img) return PLACEHOLDER;
  return {
    src: img.file,
    file: img.file.split('/').pop(),
    fit: img.fit,
    width: img.width,
    height: img.height,
    background: img.background,
    theme: img.theme,
    soften: img.soften_pct || 0,
    raise: img.raise_pct_of_screen_height || 0
  };
}

// Matches "home-flight.jpg", "art/home-flight.jpg" or "home-flight".
export function findImage(manifest, file) {
  const name = (f) => f.split('/').pop();
  const stem = (f) => name(f).replace(/\.[^.]+$/, '');
  return manifest.images.find((i) => name(i.file) === name(file) || stem(i.file) === file);
}

export function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Theme colours come from art-manifest.json → themes; "background colour" means the image's own.
export function themeVars(manifest, art) {
  const t = manifest.themes[art.theme] || manifest.themes.paper;
  const bg = art.background;
  const val = (v) => (v === 'background colour' ? bg : v);
  return {
    '--bg': bg,
    '--rule': rgba(val(t.text), art.theme === 'navy' ? 0.25 : 0.15),
    '--ink': val(t.text),
    '--ink-2': val(t.secondary),
    '--btn-bg': val(t.button_bg),
    '--btn-ink': val(t.button_text),
    '--help': val(t.help),
    '--halo': val(t.halo)
  };
}

export function paintArt(el, art, { animate } = {}) {
  el.className = 'art' + (animate ? ' animate' : '');
  el.style.background = art.background;
  let layer;
  if (art.placeholder) {
    layer = suitcase();
  } else {
    layer = document.createElement('img');
    layer.src = art.src;
    layer.alt = '';
    layer.decoding = 'async';
    layer.className = 'art-img fit-' + art.fit;
    if (art.fit === 'bottom') layer.style.bottom = art.raise + '%';
  }
  const wash = document.createElement('div');
  wash.className = 'art-wash';
  wash.style.background = rgba(art.background, art.soften / 100);
  el.replaceChildren(layer, wash);
}

// Placeholder suitcase line art from spec/wireframes/PreTrip.dc.html.
function suitcase() {
  const wrap = document.createElement('div');
  wrap.className = 'art-placeholder';
  wrap.innerHTML = `
<svg viewBox="0 0 390 340" fill="none" stroke="#2B2A27" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
  <path class="dash" d="M24 118Q120 10 250 40T380 60" stroke="#A6A198" stroke-dasharray="3 9"></path>
  <rect x="120" y="110" width="150" height="180" rx="18"></rect>
  <path d="M170 110V88Q170 78 180 78H210Q220 78 220 88V110"></path>
  <path d="M150 118V282M240 118V282" stroke="#A6A198"></path>
  <path d="M120 200H270" stroke="#A6A198"></path>
  <circle cx="142" cy="300" r="8"></circle>
  <circle cx="248" cy="300" r="8"></circle>
  <g class="sway">
    <path d="M222 96Q246 104 258 128"></path>
    <path d="M254 126L286 138L276 172L244 160Z" fill="#F3F0EA"></path>
    <circle cx="260" cy="138" r="3"></circle>
    <path d="M256 150L274 157M253 158L268 164" stroke="#A6A198"></path>
  </g>
  <path d="M50 320H340" stroke="#A6A198"></path>
</svg>`;
  return wrap;
}

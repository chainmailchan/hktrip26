// F5 Weather and what to wear (APP_SPEC F5). One small request to Open-Meteo for both cities
// (no key), forecast_days ahead, at most once every refresh_minutes (both in data/weather.json)
// while a home screen that needs it is open. The last forecast stays on the phone for offline use.

const STORE = 'hktrip.weather';
const RETRY_MS = 5 * 60 * 1000; // after a failed try, wait before trying again
const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max';

export function createWeather(cfg, onChange = () => {}) {
  let saved = load();   // { at: ms, days: { HK: { "2026-11-18": { high, low, code, rain } }, SZ: {…} } }
  let lastTry = 0;
  let busy = false;

  async function refresh(today) {
    if (busy || navigator.onLine === false) return;
    if (Date.now() - (saved.at || 0) < cfg.refresh_minutes * 60 * 1000) return;
    if (Date.now() - lastTry < RETRY_MS) return;
    lastTry = Date.now();
    busy = true;
    try {
      const cities = Object.keys(cfg.places);
      const q = new URLSearchParams({
        latitude: cities.map((c) => cfg.places[c].lat).join(','),
        longitude: cities.map((c) => cfg.places[c].lon).join(','),
        daily: DAILY,
        timezone: cfg.timezone,
        forecast_days: String(cfg.forecast_days || 3)
      });
      const res = await fetch(cfg.source + '?' + q, { cache: 'no-store' });
      if (!res.ok) throw new Error('weather ' + res.status);
      const body = await res.json();
      // Several places come back as a list, in the order asked; one place as a single object.
      const list = Array.isArray(body) ? body : [body];
      const days = {};
      cities.forEach((city, i) => {
        const d = list[i]?.daily;
        if (!d?.time) return;
        const codes = d.weather_code || d.weathercode || [];
        days[city] = recent(saved.days?.[city], today);
        d.time.forEach((date, k) => {
          const high = d.temperature_2m_max?.[k];
          if (typeof high !== 'number') return;
          days[city][date] = { high, low: d.temperature_2m_min?.[k], code: codes[k], rain: d.precipitation_probability_max?.[k] ?? 0 };
        });
      });
      if (!Object.keys(days).length) throw new Error('weather: nothing usable');
      saved = { at: Date.now(), days: { ...saved.days, ...days } };
      try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch {}
      onChange();
    } catch {
      // Offline or the service is down: keep the last forecast and try again later.
    } finally {
      busy = false;
    }
  }

  return {
    day: (city, date) => saved.days?.[city]?.[date] || null,
    refresh
  };
}

// Two lines, e.g. ["23°, cloudy, rain likely", "Light layers. Bring the umbrella."].
// lead goes in front of the first line ("Tomorrow", "Hong Kong today:"); flight swaps the advice
// for the plane line.
export function weatherLines(cfg, f, { lead = '', flight = false } = {}) {
  if (!f || typeof f.high !== 'number') return null;
  const sky = cfg.sky.find((s) => s.codes.includes(f.code)) || {};
  const rainy = (f.rain ?? 0) >= cfg.rain_chance_pct;
  const wet = rainy || !!sky.wet;
  const first = (lead ? lead + ' ' : '') + Math.round(f.high) + '°'
    + (sky.words ? ', ' + sky.words : '') + (rainy && !sky.wet ? ', ' + cfg.rain_words : '');
  const band = cfg.wear.find((w) => f.high >= w.from) || cfg.wear[cfg.wear.length - 1];
  const second = (flight ? cfg.flight_wear : band.text) + (wet ? ' ' + cfg.umbrella : '');
  return [first, second];
}

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}

// Keep the last couple of days only.
function recent(days = {}, today) {
  const from = new Date(Date.parse(today) - 2 * 86400000).toISOString().slice(0, 10);
  return Object.fromEntries(Object.entries(days).filter(([date]) => date >= from));
}

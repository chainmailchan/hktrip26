// Small helpers shared by the screens. Dates are "YYYY-MM-DD" and times "HH:MM", in the phone's own
// time. Singapore, Hong Kong and Shenzhen are all UTC+8, so the phone's clock is local time everywhere.

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const hm = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());
export const dayMs = 86400000;
export const addDays = (date, n) => new Date(Date.parse(date) + n * dayMs).toISOString().slice(0, 10);
export const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / dayMs);

const fmt = (opts) => new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' });
const utc = (date) => new Date(date + 'T00:00:00Z');
export const longDate = (date) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(utc(date)).replace(',', '');
export const weekday = (date) => fmt({ weekday: 'long' }).format(utc(date));
export const dayMonth = (date) => fmt({ day: 'numeric', month: 'long' }).format(utc(date));
export const dayOfMonth = (date) => String(utc(date).getUTCDate());

// Copies text for pasting into Uber or DiDi. Resolves true when it worked.
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position: fixed; top: 0; left: 0; opacity: 0; font-size: 18px';
    document.body.append(area);
    area.select();
    area.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    area.remove();
    return ok;
  }
}

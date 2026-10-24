// Live data (APP_SPEC §5.3): the announcement (live/board.json) and the packing ticks
// (live/packing.json), kept in the small live-data repo named in data/trip.json → live.repo.
// - Set-up phones read and write through the GitHub API with their own token. Reads are
//   conditional (If-None-Match): an unchanged file comes back as 304 with no body, and
//   GitHub doesn't count it against the hourly limit.
// - Phones not set up read the public copy on raw.githubusercontent.com (cached there for up
//   to 5 minutes) and never write.
// The last copy of each file, and any ticks not sent yet, stay on the phone, so the screens
// work offline and ticks go out when the connection comes back.

const STORE = 'hktrip.live';
const PATHS = { board: 'live/board.json', packing: 'live/packing.json' };
const SEND_AFTER_MS = 1500; // quick taps go out together as one save

export function createLive({ repo, token, me, name, pollSeconds = 30, onChange = () => {} }) {
  const saved = load();
  const files = {
    board: { data: {}, sha: null, etag: null, ...saved.files?.board },
    packing: { data: {}, sha: null, etag: null, ...saved.files?.packing }
  };
  let pending = saved.pending || {};   // { listId: { itemId: { done, by, at } } } not sent yet
  let lastOk = saved.lastOk || 0;
  let status = 'ok';                    // 'ok' | 'offline' | 'denied'
  const checked = { board: 0, packing: 0 };
  const replaced = new Set();           // shas we wrote over; a read that returns one is out of date
  let chain = Promise.resolve();
  let sendTimer = null;
  let wanted = () => [];

  // One network job at a time, so a poll never crosses a save.
  function run(job) {
    const p = chain.then(job);
    chain = p.catch(() => {});
    return p;
  }

  function persist() {
    try { localStorage.setItem(STORE, JSON.stringify({ files, pending, lastOk })); } catch {}
  }

  function setStatus(next) {
    if (next === 'ok') lastOk = Date.now();
    if (next !== status) {
      status = next;
      onChange('status');
    }
    persist();
  }

  const failed = (e) => setStatus(e && e.denied ? 'denied' : 'offline');

  function store(key, patch) {
    const before = JSON.stringify(files[key].data);
    Object.assign(files[key], patch);
    persist();
    if (JSON.stringify(files[key].data) !== before) onChange(key);
  }

  const auth = () => ({ Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' });
  const apiUrl = (key) => `https://api.github.com/repos/${repo}/contents/${PATHS[key]}`;

  async function read(key, { fresh = false } = {}) {
    const f = files[key];
    if (!token) {
      const res = await fetch(`https://raw.githubusercontent.com/${repo}/HEAD/${PATHS[key]}`, { cache: 'no-cache' });
      if (res.status === 404) store(key, { data: {} });
      else if (!res.ok) throw new HttpError(res.status);
      else store(key, { data: parse(await res.text()) });
    } else {
      const headers = auth();
      if (f.etag && !fresh) headers['If-None-Match'] = f.etag;
      const res = await fetch(apiUrl(key), { headers, cache: 'no-store' });
      if (res.status === 404) store(key, { data: {}, sha: null, etag: null });
      else if (res.status !== 304) {
        if (!res.ok) throw new HttpError(res.status, res.status === 401);
        const body = await res.json();
        if (!replaced.has(body.sha)) store(key, { data: parse(fromBase64(body.content)), sha: body.sha, etag: res.headers.get('ETag') });
      }
    }
    checked[key] = Date.now();
    return files[key];
  }

  async function write(key, data, sha, message) {
    const body = { message, content: toBase64(JSON.stringify(data, null, 2) + '\n') };
    if (sha) body.sha = sha;
    const res = await fetch(apiUrl(key), {
      method: 'PUT',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store'
    });
    if (res.ok) {
      const out = await res.json();
      if (sha) replaced.add(sha);
      store(key, { data, sha: out.content.sha, etag: null });
      return true;
    }
    // 409: someone saved since we read it. 422: the file appeared since we read it.
    if (res.status === 409 || res.status === 422) return false;
    throw new HttpError(res.status, [401, 403, 404].includes(res.status));
  }

  // Read, change, save; if another phone saved in between, read again and redo the change.
  async function save(key, change, message) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const f = await read(key, { fresh: attempt > 0 });
      if (await write(key, change(f.data), f.sha, message)) return;
    }
    throw new HttpError(409);
  }

  async function send() {
    const sending = JSON.parse(JSON.stringify(pending));
    const n = Object.values(sending).reduce((sum, items) => sum + Object.keys(items).length, 0);
    if (!n) return;
    await save('packing', (data) => merge(data, sending), `Packing: ${name} updated ${n} ${n === 1 ? 'item' : 'items'}`);
    // Keep anything tapped again while this was being sent.
    for (const [list, items] of Object.entries(sending)) {
      for (const [id, t] of Object.entries(items)) {
        if (pending[list]?.[id]?.at === t.at) delete pending[list][id];
      }
      if (pending[list] && !Object.keys(pending[list]).length) delete pending[list];
    }
    persist();
    onChange('packing');
  }

  const unsent = () => Object.values(pending).reduce((sum, items) => sum + Object.keys(items).length, 0);

  function sendSoon(delay = SEND_AFTER_MS) {
    clearTimeout(sendTimer);
    sendTimer = setTimeout(() => run(send).then(() => setStatus('ok'), failed), delay);
  }

  // Checks the files the current screen shows, unless they were checked moments ago.
  function refresh() {
    if (document.visibilityState !== 'visible') return;
    const due = wanted().filter((key) => Date.now() - checked[key] > (pollSeconds - 5) * 1000);
    if (due.length) {
      run(async () => { for (const key of due) await read(key); }).then(() => setStatus('ok'), failed);
    }
    if (token && unsent()) sendSoon(0);
  }

  return {
    get board() { return files.board.data; },
    get ticks() { return merge(files.packing.data, pending); },
    get status() { return status; },
    get lastOk() { return lastOk; },
    get unsent() { return unsent(); },

    // needs: () => the files the current screen shows, e.g. ['board', 'packing'].
    start(needs) {
      wanted = needs;
      setInterval(refresh, pollSeconds * 1000);
      document.addEventListener('visibilitychange', refresh);
      window.addEventListener('online', refresh);
      refresh();
    },
    refresh,

    tick(list, item, done) {
      if (!token) return;
      pending[list] = pending[list] || {};
      pending[list][item] = { done, by: me, at: new Date().toISOString() };
      persist();
      onChange('packing');
      sendSoon();
    },

    // Admins: text '' hides the announcement. Resolves when saved; rejects with .denied
    // when this phone's token can't write.
    setBoard(text) {
      const message = text ? `Announcement from ${name}` : `${name} cleared the announcement`;
      return run(() => save('board', () => ({ text, by: me, set_at: new Date().toISOString() }), message))
        .then(() => setStatus('ok'), (e) => { failed(e); throw e; });
    }
  };
}

class HttpError extends Error {
  constructor(status, denied = false) {
    super('HTTP ' + status);
    this.status = status;
    this.denied = denied;
  }
}

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}

// A file someone broke by hand counts as empty rather than stopping the app.
function parse(text) {
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch { return {}; }
}

// Ticks not sent yet sit on top of the last copy from the repo.
function merge(data, changes) {
  const out = {};
  for (const [list, items] of Object.entries(data)) {
    if (items && typeof items === 'object') out[list] = { ...items };
  }
  for (const [list, items] of Object.entries(changes)) out[list] = { ...out[list], ...items };
  return out;
}

function toBase64(text) {
  let bin = '';
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64) {
  return new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
}

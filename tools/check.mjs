// Layout check at the four family phones (CLAUDE.md). Serves the repo like GitHub Pages
// (ETag + 304), opens each screen in Chromium and fails on: text under 17 px, primary
// buttons outside 60–64 px, tap targets under 48 px, sideways scrolling, a home screen
// that needs scrolling, a greeting that overflows, or stretched art. Screens are checked
// as a phone that isn't set up, as Mama's phone and as Chan's (admin).
// Then, against a fake GitHub for the live-data repo: ticking (with another phone saving at
// the same time), ticks waiting offline, writing and clearing the announcement, and making a
// setup code and setting up a phone from it (photo and camera).
//
//   NODE_PATH="$(npm root -g)" node tools/check.mjs [screenshot-folder]

import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, stat, mkdir, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(new URL('..', import.meta.url).pathname);
const shots = process.argv[2];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = join(root, path);
  try {
    const s = await stat(file);
    const etag = `"${s.mtimeMs.toString(16)}-${s.size.toString(16)}"`;
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', ETag: etag, 'Cache-Control': 'max-age=600' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const phones = [
  { name: 'mama-iphone14pro', width: 393, height: 852 },
  { name: 'papa-galaxy-s24plus', width: 384, height: 832 },
  { name: 'belle-iphone16pro', width: 402, height: 874 },
  { name: 'chan-iphone16promax', width: 440, height: 956 }
];

// Test phones. Made-up tokens and numbers, never real ones.
const TOKEN = (who) => `github_pat_TESTONLY_not_a_real_token_${who}`;
const profiles = {
  viewer: null,
  mama: { me: 'm', admin: false, github_token: TOKEN('m'), contacts: [{ name: 'Chan', phone: '+6500000001' }, { name: 'Belle', phone: '+6500000002' }] },
  chan: { me: 'c', admin: true, github_token: TOKEN('c'),
    contacts: [{ name: 'Belle', phone: '+6500000002' }, { name: 'Mama', phone: '+6500000003' }, { name: 'Papa', phone: '+6500000004' }] }
};
// What the live-data repo holds at the start of each test. The announcement is near the 100-character limit.
const seed = () => ({
  'live/board.json': { text: 'Meet in the lobby at 9:30 tomorrow. Bring your passport and a light jacket, please. Thank you!', by: 'b', set_at: '' },
  'live/packing.json': { mp: { passports: { done: true, by: 'm', at: '' } }, cb: { phones: { done: true, by: 'c', at: '' } } }
});

const greetings = JSON.parse(await readFile(join(root, 'data/greetings.json'), 'utf8'));
const phrases = [...new Set([...greetings.special_days, ...greetings.windows].flatMap((g) => g.phrases))];
const schedule = JSON.parse(await readFile(join(root, 'data/art-schedule.json'), 'utf8'));
const manifest = JSON.parse(await readFile(join(root, 'art/art-manifest.json'), 'utf8'));

const pages = [
  ['home', '?preview=pretrip&date=2026-10-31', { noScroll: true }],
  ...schedule.default.map((s) => [`home-${s.id}`, `?preview=${s.id}&date=2026-11-18`, { noScroll: true }]),
  ['home-flight', '?preview=morning&date=2026-11-17', { noScroll: true }],
  ...manifest.images.filter((i) => i.fit !== 'map').map((i) => {
    const stem = i.file.split('/').pop().replace(/\.jpg$/, '');
    return [`art-${stem}`, `?preview=${stem}`, { noScroll: true }];
  }),
  ['packing-mp', '#packing/mp'],
  ['packing-cb', '#packing/cb'],
  ['help', '#help'],
  ['preview-list', '?preview'],
  ['setup', '#setup'],
  ['codes', '#codes'],
  ['codes-made', '#codes', { prepare: makeCodes }],
  ['mama-home', '?preview=pretrip&date=2026-10-31', { who: 'mama', noScroll: true }],
  ['mama-packing', '#packing/mp', { who: 'mama' }],
  ['mama-help', '#help', { who: 'mama' }],
  ['mama-setup', '#setup', { who: 'mama' }],
  ['chan-home', '?preview=pretrip&date=2026-10-31', { who: 'chan', noScroll: true }],
  ['chan-packing', '#packing/cb', { who: 'chan' }],
  ['chan-help', '#help', { who: 'chan' }],
  ['chan-admin', '#admin', { who: 'chan', prepare: (page) => page.fill('#board-text', 'Taxi to the station at 10:15. Meet in the lobby.') }]
];

const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);
const until = async (check, ms = 8000) => {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 100))) {
    if (await check()) return true;
  }
  return false;
};

// A fake GitHub: the contents API (ETag/304, sha checks on save) and raw.githubusercontent.com.
async function fakeGitHub(ctx, files = seed()) {
  const store = new Map(Object.entries(files).map(([k, v]) => [k, JSON.stringify(v)]));
  const sha = (text) => createHash('sha1').update(text).digest('hex');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-None-Match',
    'Access-Control-Allow-Methods': 'GET, PUT', 'Access-Control-Expose-Headers': 'ETag' };
  const gh = { store, log: [], offline: false, beforePut: null, read: (path) => JSON.parse(store.get(path) || '{}') };
  const json = (status, body, headers = {}) => ({ status, headers: { ...cors, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  await ctx.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    if (gh.offline) return route.abort('internetdisconnected');
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (!/^Bearer github_pat_/.test(req.headers().authorization || '')) return route.fulfill(json(401, {}));
    const path = new URL(req.url()).pathname.replace(/^\/repos\/[^/]+\/[^/]+\/contents\//, '');
    const cur = store.get(path);
    if (req.method() === 'GET') {
      const conditional = req.headers()['if-none-match'];
      gh.log.push(`GET ${path}${conditional ? ' if-none-match' : ''}`);
      if (cur === undefined) return route.fulfill(json(404, { message: 'Not Found' }));
      const etag = `W/"${sha(cur)}"`;
      if (conditional === etag) return route.fulfill({ status: 304, headers: { ...cors, ETag: etag } });
      return route.fulfill(json(200, { sha: sha(cur), encoding: 'base64', content: Buffer.from(cur).toString('base64') }, { ETag: etag }));
    }
    if (gh.beforePut) { const f = gh.beforePut; gh.beforePut = null; f(gh); }
    const body = req.postDataJSON();
    const now = store.get(path);
    if (now !== undefined && body.sha !== sha(now)) {
      gh.log.push(`PUT ${path} rejected`);
      return route.fulfill(json(body.sha ? 409 : 422, { message: 'sha mismatch' }));
    }
    const text = Buffer.from(body.content, 'base64').toString('utf8');
    store.set(path, text);
    gh.log.push(`PUT ${path} ${body.message}`);
    return route.fulfill(json(now === undefined ? 201 : 200, { content: { sha: sha(text) } }));
  });
  await ctx.route('https://raw.githubusercontent.com/**', (route) => {
    if (gh.offline) return route.abort('internetdisconnected');
    const path = new URL(route.request().url()).pathname.split('/').slice(4).join('/');
    const cur = store.get(path);
    return cur === undefined ? route.fulfill({ status: 404, headers: cors, body: '' })
      : route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'text/plain' }, body: cur });
  });
  return gh;
}

async function phoneContext(browser, phone, who, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: phone.width, height: phone.height }, deviceScaleFactor: 2, isMobile: true,
    hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce', ...opts });
  if (profiles[who]) {
    await ctx.addInitScript((p) => { try { localStorage.setItem('hktrip.profile', p); } catch {} }, JSON.stringify(profiles[who]));
  }
  ctx.gh = await fakeGitHub(ctx);
  return ctx;
}

const open = async (page, url) => {
  await page.goto(base + url.replace(/^#/, '?x#'));
  await page.waitForSelector('#screen > .page > *, #screen > .home');
};

// Codes screen: fill in Mama's token and everyone's numbers, then make the codes.
async function makeCodes(page) {
  await page.fill('#token-m', TOKEN('m'));
  for (const [id, n] of [['c', '+65 0000 0001'], ['b', '+65 0000 0002'], ['m', '+65 0000 0003'], ['p', '+65 0000 0004']]) await page.fill(`#phone-${id}`, n);
  await page.click('[data-make]');
  await page.waitForSelector('.qr');
}

// Runs in the page: returns a list of problems.
function audit(noScroll) {
  const out = [];
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (ownText && parseFloat(getComputedStyle(el).fontSize) < 17) out.push(`text under 17px: "${el.textContent.trim().slice(0, 30)}"`);
  }
  for (const el of document.querySelectorAll('a, button, input:not([type=file]), textarea')) {
    if (!visible(el)) continue;
    const h = el.getBoundingClientRect().height;
    if (h < 48) out.push(`tap target ${h}px: "${el.textContent.trim() || el.id}"`);
    if (el.matches('.btn-primary, .btn-back') && (h < 60 || h > 64)) out.push(`primary button ${h}px: "${el.textContent.trim()}"`);
    if (el.matches('input, textarea') && parseFloat(getComputedStyle(el).fontSize) < 17) out.push(`input text under 17px: ${el.id}`);
  }
  for (const el of document.querySelectorAll('.btn-outline, .btn-primary, .tab')) {
    if (visible(el) && el.scrollWidth > el.clientWidth + 1) out.push(`button text cut off: "${el.textContent.trim()}"`);
  }
  const d = document.documentElement;
  if (d.scrollWidth > innerWidth) out.push(`sideways scroll ${d.scrollWidth} > ${innerWidth}`);
  if (noScroll && d.scrollHeight > innerHeight) out.push(`home needs scrolling ${d.scrollHeight} > ${innerHeight}`);
  const g = document.querySelector('.greeting');
  if (g && g.scrollWidth > g.clientWidth + 1) out.push('greeting overflows');
  const img = document.querySelector('#art:not([hidden]) .art-img');
  if (img) {
    if (!img.complete || !img.naturalWidth) out.push('art did not load');
    const r = img.getBoundingClientRect();
    const fit = getComputedStyle(img).objectFit;
    if (fit !== 'cover' && Math.abs(r.width / r.height - img.naturalWidth / img.naturalHeight) > 0.01) out.push('art stretched');
  }
  return out;
}

const browser = await chromium.launch();
if (shots) await mkdir(shots, { recursive: true });
for (const phone of phones) {
  const ctxs = {};
  for (const who of Object.keys(profiles)) {
    ctxs[who] = await phoneContext(browser, phone, who);
    ctxs[who].page = await ctxs[who].newPage();
    ctxs[who].page.on('pageerror', (e) => fail(`${phone.name} ${who}`, 'script error ' + e.message));
  }
  for (const [name, url, opts = {}] of pages) {
    const page = ctxs[opts.who || 'viewer'].page;
    await open(page, url);
    if (opts.prepare) await opts.prepare(page);
    // Live data arrives just after the screen is drawn.
    if (url.includes('preview=pretrip')) await page.waitForSelector('.announcement', { timeout: 3000 }).catch(() => fail(`${phone.name} ${name}`, 'announcement did not show'));
    await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))]));
    for (const p of await page.evaluate(audit, !!opts.noScroll)) fail(`${phone.name} ${name}`, p);
    if (shots) await page.screenshot({ path: `${shots}/${phone.name}-${name}.png` });
    await page.goto('about:blank');
  }

  // Every greeting phrase must fit the home screen next to "Help" (and "Admin" on admin phones).
  for (const who of ['viewer', 'chan']) {
    const page = ctxs[who].page;
    await page.goto(base + '?preview=pretrip&date=2026-10-31');
    await page.waitForSelector('.greeting');
    const bad = await page.evaluate((list) => list.filter((phrase) => {
      const h = document.querySelector('.greeting');
      h.className = 'greeting ' + ([...phrase].length <= 3 ? 'g-big' : 'g-small');
      h.innerHTML = phrase.replace(/([，！？])(?=.)/gu, '$1<wbr>');
      if (h.innerHTML.includes('<wbr>')) h.classList.add('keep');
      return h.scrollWidth > h.clientWidth + 1 || h.getBoundingClientRect().height > 2.3 * parseFloat(getComputedStyle(h).fontSize) * 1.1;
    }), phrases);
    for (const p of bad) fail(`${phone.name} ${who}`, `greeting does not fit: ${p}`);
  }

  // Emergency flow: three confirmations, the confirm button moves, tapping outside closes.
  const page = ctxs.viewer.page;
  await page.goto(base + '?x#help');
  await page.click('[data-emergency]');
  await page.click('.number');
  const spots = [];
  for (let step = 1; step <= 3; step++) {
    const confirm = page.locator('.btn-confirm');
    spots.push(await confirm.boundingBox());
    if (step < 3) await confirm.click();
  }
  if ((await page.getAttribute('.btn-confirm', 'href')) !== 'tel:999') fail(phone.name, 'last step is not tel:999');
  for (let i = 1; i < 3; i++) {
    const a = spots[i - 1], b = spots[i];
    const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    if (overlap) fail(phone.name, `confirm button did not move between step ${i} and ${i + 1}`);
  }
  await page.mouse.click(phone.width / 2, 20);
  if (await page.locator('.dialog').count()) fail(phone.name, 'tapping outside did not close the dialog');
  for (const c of Object.values(ctxs)) await c.close();
}

// ---------- live data and setup, on Mama's phone size ----------
const phone = phones[0];
const flow = async (name, who, test, opts) => {
  const ctx = await phoneContext(browser, phone, who, opts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fail(name, 'script error ' + e.message));
  try { await test(page, ctx.gh, ctx); } catch (e) { fail(name, e.message.split('\n')[0]); }
  await ctx.close();
};

await flow('view-only phone', 'viewer', async (page) => {
  await open(page, '#packing/mp');
  if (await page.locator('button.item').count()) fail('view-only phone', 'packing rows can be ticked before setup');
  if (!(await page.locator('a[href="#setup"]').count())) fail('view-only phone', 'no "Set up this phone" button');
  if (!(await until(() => page.locator('[data-item="passports"].done').count()))) fail('view-only phone', 'ticks from the public copy did not show');
});

await flow('ticking', 'mama', async (page, gh) => {
  await open(page, '#packing/mp');
  const rows = page.locator('button.item[aria-checked="false"]');
  const mine = await rows.nth(0).getAttribute('data-item');
  const papas = await rows.nth(1).getAttribute('data-item');
  // Papa's phone saves between Mama's read and Mama's save, so her first save is rejected.
  gh.beforePut = (g) => {
    const data = g.read('live/packing.json');
    data.mp[papas] = { done: true, by: 'p', at: '' };
    g.store.set('live/packing.json', JSON.stringify(data));
  };
  await rows.nth(0).click();
  if ((await page.getAttribute(`[data-item="${mine}"]`, 'aria-checked')) !== 'true') fail('ticking', 'row did not tick at once');
  const saved = await until(() => gh.read('live/packing.json').mp?.[mine]?.by === 'm');
  if (!saved) return fail('ticking', 'tick was not saved: ' + gh.log.join(', '));
  const data = gh.read('live/packing.json');
  if (!data.mp[papas]?.done) fail('ticking', "Papa's tick was lost in the merge");
  if (!data.mp.passports?.done) fail('ticking', 'an earlier tick was lost');
  if (!gh.log.includes('PUT live/packing.json rejected')) fail('ticking', 'the clash was not exercised: ' + gh.log.join(', '));
  if (!(await until(() => page.locator(`[data-item="${papas}"][aria-checked="true"]`).count()))) fail('ticking', "Papa's tick did not show");
  // Once the phone has a copy, re-checking an unchanged file is conditional (304, no download).
  for (let visit = 0; visit < 2; visit++) {
    gh.log.length = 0;
    await page.reload();
    await until(() => gh.log.some((l) => l.startsWith('GET live/packing.json')));
  }
  if (!gh.log.includes('GET live/packing.json if-none-match')) fail('ticking', 'poll was not conditional: ' + gh.log.join(', '));
});

await flow('offline ticks', 'mama', async (page, gh) => {
  gh.offline = true;
  await open(page, '?preview=pretrip&date=2026-10-31');
  if (!(await until(() => page.locator('.live-note', { hasText: 'No connection' }).count()))) fail('offline ticks', 'home did not say "No connection"');
  await page.click('a[href="#packing/mp"]');
  const row = page.locator('button.item[aria-checked="false"]').first();
  const id = await row.getAttribute('data-item');
  await row.click();
  if (!(await until(() => page.locator('[data-live-note]', { hasText: 'saved on this phone' }).count()))) fail('offline ticks', 'no "saved on this phone" note');
  gh.offline = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  if (!(await until(() => gh.read('live/packing.json').mp?.[id]?.done))) fail('offline ticks', 'tick was not sent when back online');
  if (!(await until(() => page.locator('[data-live-note]').evaluate((el) => el.hidden)))) fail('offline ticks', 'note did not clear');
});

await flow('announcement', 'chan', async (page, gh) => {
  await open(page, '?preview=pretrip&date=2026-10-31');
  await page.click('a[href="#admin"]');
  await page.fill('#board-text', 'Taxi at 10.');
  if ((await page.textContent('[data-draft] .announcement-text')) !== 'Taxi at 10.') fail('announcement', 'preview did not show the text');
  await page.click('[data-show]');
  if (!(await until(() => gh.read('live/board.json').text === 'Taxi at 10.'))) return fail('announcement', 'not saved: ' + gh.log.join(', '));
  if (gh.read('live/board.json').by !== 'c') fail('announcement', 'not marked as from Chan');
  if (!(await until(() => page.locator('[data-msg]', { hasText: 'Everyone sees this within 30 seconds' }).count()))) fail('announcement', 'no "Done" message');
  if ((await page.textContent('[data-now] .announcement-text')) !== 'Taxi at 10.') fail('announcement', '"Showing now" did not update');
  await page.click('[data-clear]');
  if (!(await until(() => gh.read('live/board.json').text === ''))) fail('announcement', 'not cleared');
  await page.click('[data-home]');
  await page.waitForSelector('.home');
  if (await page.locator('.announcement').count()) fail('announcement', 'home still shows a cleared announcement');
});

// Make Mama's code, then set up a phone that isn't set up from a photo of it, and from the camera.
let code;
await flow('setup codes', 'viewer', async (page) => {
  await open(page, '#codes');
  await makeCodes(page);
  code = await page.locator('.qr').screenshot();
});
if (code) {
  const expect = profiles.mama;
  const checkSetUp = async (name, page) => {
    if (!(await until(() => page.locator('.setup-done', { hasText: 'This phone is set up for Mama.' }).count(), 10000))) {
      return fail(name, 'not set up: ' + await page.textContent('[data-msg]').catch(() => ''));
    }
    const p = await page.evaluate(() => JSON.parse(localStorage.getItem('hktrip.profile')));
    if (JSON.stringify(p) !== JSON.stringify(expect)) fail(name, 'wrong profile ' + JSON.stringify(p));
    await page.click('[data-done]');
    await page.waitForSelector('.home');
    await page.click('.help-link');
    const calls = await page.locator('.calls a').allTextContents();
    if (calls.join() !== 'Call Chan,Call Belle') fail(name, 'Call buttons: ' + calls.join());
  };
  await flow('setup from a photo', 'viewer', async (page) => {
    await open(page, '#setup');
    await page.setInputFiles('[data-file]', { name: 'code.png', mimeType: 'image/png', buffer: code });
    await checkSetUp('setup from a photo', page);
  });
  // Chromium's stand-in camera plays a still of the code.
  const dir = join(tmpdir(), 'hktrip-check');
  await mkdir(dir, { recursive: true });
  const still = join(dir, 'code.mjpeg');
  {
    const ctx = await browser.newContext({ viewport: { width: 640, height: 640 } });
    const page = await ctx.newPage();
    await page.setContent(`<body style="margin:0;background:#fff;display:grid;place-items:center;height:100vh"><img src="data:image/png;base64,${code.toString('base64')}" style="width:420px"></body>`);
    await writeFile(still, await page.screenshot({ type: 'jpeg', quality: 92 }));
    await ctx.close();
  }
  const camera = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${still}`] });
  const ctx = await phoneContext(camera, phone, 'viewer', { permissions: ['camera'] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fail('setup from the camera', 'script error ' + e.message));
  try {
    await open(page, '#setup');
    await page.click('[data-camera]');
    await checkSetUp('setup from the camera', page);
  } catch (e) { fail('setup from the camera', e.message.split('\n')[0]); }
  await camera.close();
  await rm(dir, { recursive: true, force: true });
}

await browser.close();
server.close();

if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
console.log(`OK: ${pages.length} screens, ${phrases.length} greetings and the emergency flow at ${phones.length} phone sizes; `
  + 'ticking, offline ticks, the announcement and phone setup (photo and camera).');

// Layout check at the four family phones (CLAUDE.md). Serves the repo like GitHub Pages
// (ETag + 304), opens each screen in Chromium and fails on: text under 17 px, primary
// buttons outside 60–64 px, tap targets under 48 px, sideways scrolling, a home screen
// that needs scrolling, a greeting that overflows, or stretched art.
//
//   NODE_PATH="$(npm root -g)" node tools/check.mjs [screenshot-folder]

import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
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

const greetings = JSON.parse(await readFile(join(root, 'data/greetings.json'), 'utf8'));
const phrases = [...new Set([...greetings.special_days, ...greetings.windows].flatMap((g) => g.phrases))];
const schedule = JSON.parse(await readFile(join(root, 'data/art-schedule.json'), 'utf8'));
const manifest = JSON.parse(await readFile(join(root, 'art/art-manifest.json'), 'utf8'));

const pages = [
  ['home', '?preview=pretrip&date=2026-10-31', { noScroll: true }],
  ...schedule.default.map((s) => [`home-${s.id}`, `?preview=${s.id}&date=2026-11-18`, { noScroll: true }]),
  ['home-flight', '?preview=morning&date=2026-11-17', { noScroll: true }],
  ...manifest.images.filter((i) => i.fit !== 'map').flatMap((i) => {
    const stem = i.file.split('/').pop().replace(/\.jpg$/, '');
    const out = [[`art-${stem}`, `?preview=${stem}`, { noScroll: true }]];
    if (i.fit === 'bottom') out.push([`crop-${stem}`, `?preview=${stem}&fit=cover`, { noScroll: true }]);
    return out;
  }),
  ['packing-mp', '#packing/mp'],
  ['packing-cb', '#packing/cb'],
  ['help', '#help'],
  ['preview-list', '?preview']
];

const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

// Runs in the page: returns a list of problems.
function audit(noScroll) {
  const out = [];
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (ownText && parseFloat(getComputedStyle(el).fontSize) < 17) out.push(`text under 17px: "${el.textContent.trim().slice(0, 30)}"`);
  }
  for (const el of document.querySelectorAll('a, button')) {
    if (!visible(el)) continue;
    const h = el.getBoundingClientRect().height;
    if (h < 48) out.push(`tap target ${h}px: "${el.textContent.trim()}"`);
    if (el.matches('.btn-primary, .btn-back') && (h < 60 || h > 64)) out.push(`primary button ${h}px: "${el.textContent.trim()}"`);
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
  const ctx = await browser.newContext({ viewport: phone, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fail(phone.name, 'script error ' + e.message));
  for (const [name, url, opts = {}] of pages) {
    await page.goto(base + url.replace(/^#/, '?x#'));
    await page.waitForSelector('#screen > *');
    await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))]));
    for (const p of await page.evaluate(audit, !!opts.noScroll)) fail(`${phone.name} ${name}`, p);
    if (shots) await page.screenshot({ path: `${shots}/${phone.name}-${name}.png` });
    await page.goto('about:blank');
  }

  // Every greeting phrase must fit the home screen next to "Help".
  await page.goto(base + '?preview=pretrip&date=2026-10-31');
  await page.waitForSelector('.greeting');
  const bad = await page.evaluate((list) => list.filter((phrase) => {
    const h = document.querySelector('.greeting');
    h.className = 'greeting ' + ([...phrase].length <= 3 ? 'g-big' : 'g-small');
    h.innerHTML = phrase.replace(/([，！？])(?=.)/gu, '$1<wbr>');
    if (h.innerHTML.includes('<wbr>')) h.classList.add('keep');
    return h.scrollWidth > h.clientWidth + 1 || h.getBoundingClientRect().height > 2.3 * parseFloat(getComputedStyle(h).fontSize) * 1.1;
  }), phrases);
  for (const p of bad) fail(phone.name, `greeting does not fit: ${p}`);

  // Emergency flow: three confirmations, the confirm button moves, tapping outside closes.
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
  await ctx.close();
}
await browser.close();
server.close();

if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
console.log(`OK: ${pages.length} screens, ${phrases.length} greetings and the emergency flow at ${phones.length} phone sizes.`);

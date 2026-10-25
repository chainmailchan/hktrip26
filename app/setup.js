// Phone setup (APP_SPEC §5.5). Loaded only when one of these two screens opens.
// - renderSetup, "Set up this phone": reads a setup code with the camera inside the app, so it
//   sets up the installed app rather than Safari (Q40), or from a photo of the code. What the
//   code holds stays on this phone (localStorage), never in the repo.
// - renderCodes, "Make setup codes": for Chan at the setup visit. He pastes each person's token
//   and phone number and the screen draws their code. Nothing typed there is sent anywhere or
//   saved; it is gone when he leaves the screen.
// A code is compact JSON: {"hktrip":1,"me":"m","admin":0,"t":"<token>","c":[["Chan","+65…"],…]}.

const BAR = '<div class="bar"><a class="pill" href="#" data-home><span aria-hidden="true">←</span>Home</a></div>';
const TOKEN = /^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/;
const PHONE = /^\+?\d{6,15}$/;
const cleanPhone = (s) => s.replace(/[\s().-]/g, '');

// The setup code → the on-device profile (§6). Anything else → null.
export function readCode(text, people) {
  let c;
  try { c = JSON.parse(text); } catch { return null; }
  if (!c || c.hktrip !== 1 || typeof c.t !== 'string' || !TOKEN.test(c.t)) return null;
  if (!people.some((p) => p.id === c.me)) return null;
  const contacts = (Array.isArray(c.c) ? c.c : [])
    .filter((x) => Array.isArray(x) && typeof x[0] === 'string' && typeof x[1] === 'string' && PHONE.test(x[1]))
    .map(([name, phone]) => ({ name, phone }));
  return { me: c.me, admin: !!c.admin, github_token: c.t, contacts };
}

// Mama and Papa get Call buttons for Chan and Belle; Chan and Belle for the other three (F7).
function codeFor(person, token, phones, people) {
  const contacts = people
    .filter((p) => p.id !== person.id && (person.role === 'admin' || p.role === 'admin') && phones[p.id])
    .map((p) => [p.name, phones[p.id]]);
  const json = JSON.stringify({ hktrip: 1, me: person.id, admin: person.role === 'admin' ? 1 : 0, t: token, c: contacts });
  // Plain ASCII, so every reader decodes it the same way.
  return json.replace(/[\u007f-￿]/g, (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
}

// ---------- reading codes ----------

// Chrome on Android has a built-in QR reader; iPhones use jsQR (app/vendor, Apache-2.0).
let decoderReady = null;
function decoder() {
  decoderReady = decoderReady || (async () => {
    if ('BarcodeDetector' in window) {
      try {
        if ((await BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
          const detector = new BarcodeDetector({ formats: ['qr_code'] });
          return async (canvas) => (await detector.detect(canvas))[0]?.rawValue || null;
        }
      } catch {}
    }
    await import('./vendor/jsQR.js');
    const jsQR = self.jsQR;
    return async (canvas) => {
      const img = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(img.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' })?.data || null;
    };
  })().catch((e) => { decoderReady = null; throw e; });
  return decoderReady;
}

const canvas = document.createElement('canvas');
function frame(source, width, height, max) {
  const k = Math.min(1, max / Math.max(width, height));
  canvas.width = Math.round(width * k);
  canvas.height = Math.round(height * k);
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}

// Returns a function that stops the camera; the app calls it when the screen changes.
export function renderSetup({ screen, people, profile, saveProfile, restart, esc }) {
  const nameOf = (id) => people.find((p) => p.id === id)?.name || '';
  const current = profile?.github_token ? nameOf(profile.me) : '';
  let stream = null;
  let timer = null;
  let gone = false;

  screen.innerHTML = `
    <div class="page">
      ${BAR}
      <h1 class="title">Set up this phone</h1>
      ${current ? `<p class="lead"><strong>This phone is set up for ${esc(current)}.</strong> To change it, scan a new code.</p>` : ''}
      <p class="lead">Open the camera and point it at the code on Chan’s phone.</p>
      <video class="viewfinder" playsinline muted hidden></video>
      <p class="msg" role="status" data-msg></p>
      <div class="admin-actions">
        <button type="button" class="btn-primary" data-camera>Open the camera</button>
        <button type="button" class="btn-outline" data-photo>Take a photo of the code instead</button>
      </div>
      <input type="file" accept="image/*" capture="environment" hidden data-file>
    </div>`;
  const $ = (sel) => screen.querySelector(sel);
  const say = (text) => { const m = $('[data-msg]'); if (m) m.textContent = text; };

  function stopCamera() {
    clearTimeout(timer);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    const video = $('video');
    if (video) { video.srcObject = null; video.hidden = true; }
    const open = $('[data-camera]');
    if (open) open.hidden = false;
  }

  function found(text) {
    const p = readCode(text, people);
    if (!p) {
      say('That isn’t a setup code for this app.');
      return false;
    }
    stopCamera();
    saveProfile(p);
    const what = p.admin
      ? 'You can tick off both packing lists and write the announcement (Admin, under Help on the home screen).'
      : 'You can tick things off the packing list now.';
    $('.page').innerHTML = `${BAR}
      <h1 class="title">Set up this phone</h1>
      <p class="setup-done">This phone is set up for ${esc(nameOf(p.me))}.</p>
      <p class="lead">${what}${p.contacts.length ? ' The Call buttons are on the Help screen.' : ''}</p>
      <div class="bottom"><button type="button" class="btn-primary" data-done>Done</button></div>`;
    return true;
  }

  async function startCamera() {
    if (stream) return;
    say('Starting the camera…');
    try {
      const decode = await decoder();
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (gone) return stopCamera();
      const video = $('video');
      video.srcObject = stream;
      video.hidden = false;
      await video.play();
      $('[data-camera]').hidden = true;
      say('Looking for the code…');
      const scan = async () => {
        if (!stream) return;
        if (video.videoWidth) {
          const text = await decode(frame(video, video.videoWidth, video.videoHeight, 720));
          if (text && found(text)) return;
        }
        if (stream) timer = setTimeout(scan, 200);
      };
      scan();
    } catch {
      stopCamera();
      say('The camera didn’t open. Allow the camera for this app in the phone’s Settings, or take a photo of the code instead.');
    }
  }

  async function readPhoto(file) {
    stopCamera();
    say('Reading the photo…');
    try {
      const decode = await decoder();
      const img = await loadImage(file);
      const text = await decode(frame(img, img.naturalWidth, img.naturalHeight, 1200));
      if (!text) say('No code found in that photo. Try again, a little closer and straight on.');
      else found(text);
    } catch {
      say('That photo couldn’t be read. Try again.');
    }
  }

  const onClick = (e) => {
    if (e.target.closest('[data-camera]')) startCamera();
    else if (e.target.closest('[data-photo]')) $('[data-file]').click();
    else if (e.target.closest('[data-done]')) restart();
  };
  const onChange = (e) => {
    if (!e.target.matches('[data-file]')) return;
    const file = e.target.files[0];
    e.target.value = '';
    if (file) readPhoto(file);
  };
  screen.addEventListener('click', onClick);
  screen.addEventListener('change', onChange);
  return () => {
    gone = true;
    stopCamera();
    screen.removeEventListener('click', onClick);
    screen.removeEventListener('change', onChange);
  };
}

// ---------- making codes ----------

// qrcode-generator (app/vendor, MIT), drawn as SVG with the standard 4-module quiet zone.
function qrSvg(qrcode, text, label) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const q = 4;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + q} ${r + q}h1v1h-1z`;
  }
  return `<svg class="qr" viewBox="0 0 ${n + 2 * q} ${n + 2 * q}" role="img" aria-label="${label}" shape-rendering="crispEdges">
    <rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

export function renderCodes({ screen, people, saveProfile, esc }) {
  const encoder = import('./vendor/qrcode-generator.js').then((m) => m.qrcode);
  const tokens = {};   // in memory only, gone when the screen closes
  const phones = {};
  let codes = null;
  let showing = null;
  const $ = (sel) => screen.querySelector(sel);
  const say = (text) => { const m = $('[data-msg]'); if (m) m.textContent = text; };

  function drawForm() {
    screen.innerHTML = `
      <div class="page">
        ${BAR}
        <h1 class="title">Setup codes</h1>
        <p class="lead">For the setup visit. Paste each person’s token and type their phone number. Nothing here is sent or saved: the codes are gone when you leave this screen. Don’t take screenshots of them.</p>
        ${people.map((p) => `
          <section class="person">
            <h2 class="person-name">${esc(p.name)}</h2>
            <label class="field-label" for="phone-${p.id}">${esc(p.name)}’s phone number</label>
            <input class="field" id="phone-${p.id}" data-phone="${p.id}" type="tel" inputmode="tel" autocomplete="off" value="${esc(phones[p.id] || '')}">
            <label class="field-label" for="token-${p.id}">${esc(p.name)}’s token</label>
            <input class="field" id="token-${p.id}" data-token="${p.id}" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(tokens[p.id] || '')}">
          </section>`).join('')}
        <p class="msg" role="status" data-msg></p>
        <div class="admin-actions"><button type="button" class="btn-primary" data-make>Make the codes</button></div>
      </div>`;
  }

  async function drawCode() {
    const qrcode = await encoder;
    const c = codes.find((x) => x.person.id === showing);
    const name = esc(c.person.name);
    screen.innerHTML = `
      <div class="page">
        ${BAR}
        <h1 class="title">Setup codes</h1>
        <div class="tabs" role="tablist" aria-label="Whose code" style="grid-template-columns: repeat(${codes.length}, minmax(0, 1fr))">
          ${codes.map((x) => `<button type="button" class="tab" role="tab" aria-selected="${x.person.id === showing}" data-person="${x.person.id}">${esc(x.person.name)}</button>`).join('')}
        </div>
        ${qrSvg(qrcode, c.text, `Setup code for ${name}`)}
        <p class="lead"><strong>${name}’s code.</strong> On ${name}’s phone, open the trip app from its home-screen icon, then Packing → Set up this phone → Open the camera.</p>
        <p class="msg" role="status" data-msg></p>
        <div class="admin-actions">
          <button type="button" class="btn-outline" data-use>Use ${name}’s code on this phone</button>
          <button type="button" class="btn-outline" data-edit>Change the details</button>
        </div>
      </div>`;
  }

  async function make() {
    const clean = {};
    for (const p of people) {
      const t = tokens[p.id] || '';
      if (t && !TOKEN.test(t)) return say(`${p.name}’s token doesn’t look right. It starts with github_pat_.`);
      const ph = cleanPhone(phones[p.id] || '');
      if (ph && !PHONE.test(ph)) return say(`Check ${p.name}’s phone number.`);
      if (ph) clean[p.id] = ph;
    }
    const ready = people.filter((p) => tokens[p.id]);
    if (!ready.length) return say('Paste at least one token.');
    try {
      await encoder;
    } catch {
      return say('This needs a connection. Try again when you’re online.');
    }
    codes = ready.map((p) => ({ person: p, text: codeFor(p, tokens[p.id], clean, people) }));
    showing = codes[0].person.id;
    drawCode();
  }

  const onClick = (e) => {
    const tab = e.target.closest('[data-person]');
    if (e.target.closest('[data-make]')) make();
    else if (tab) { showing = tab.dataset.person; drawCode(); }
    else if (e.target.closest('[data-edit]')) drawForm();
    else if (e.target.closest('[data-use]')) {
      const c = codes.find((x) => x.person.id === showing);
      saveProfile(readCode(c.text, people));
      say(`Done. This phone is set up for ${c.person.name}. It takes effect when you go back Home.`);
    }
  };
  const onInput = (e) => {
    const t = e.target;
    if (t.dataset.token) tokens[t.dataset.token] = t.value.trim();
    if (t.dataset.phone) phones[t.dataset.phone] = t.value;
  };
  screen.addEventListener('click', onClick);
  screen.addEventListener('input', onInput);
  drawForm();
  return () => {
    screen.removeEventListener('click', onClick);
    screen.removeEventListener('input', onInput);
  };
}

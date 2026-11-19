// End-to-end: the Python launcher as two people (Nick, Wes) on one shared folder; safety checks.
// Run after `npm run build`: node tests/e2e/launcher.cjs
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const check = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) process.exitCode = 1; };

const root = path.resolve(__dirname, '../..');
const hub = fs.mkdtempSync(path.join(os.tmpdir(), 'cwh-hub-'));
fs.copyFileSync(path.join(root, 'dist/index.html'), path.join(hub, 'index.html'));
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'deploy/hub-config.json'), 'utf8'));
cfg.autoImport = { settleSeconds: 0 }; // tests: import as soon as the file appears
cfg.ticketUrls = { ...cfg.ticketUrls, SD: 'https://sd.example.test/app/itdesk/ui/requests#cwhcopy={id}' };
fs.writeFileSync(path.join(hub, 'hub-config.json'), JSON.stringify(cfg));
const now = new Date().toISOString();
fs.writeFileSync(path.join(hub, 'tickets.json'), JSON.stringify({ generatedAt: now, generatedBy: 'test', mode: 'csv', items: [
  { source: 'SD', source_id: 'INC-1', title: 'Launcher test ticket', source_status: 'Open', created: now },
] }));

// A tiny solid-colour PNG, standing in for a Windows account picture.
function png(w, h, [r, g, b]) {
  const zlib = require('zlib');
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([r, g, b], y * (w * 3 + 1) + 1 + x * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const picDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cwh-pic-'));
fs.writeFileSync(path.join(picDir, '{ABC}-Image192.png'), png(240, 180, [230, 120, 20]));

function start(user, port, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ...extraEnv, LOCALAPPDATA: fs.mkdtempSync(path.join(os.tmpdir(), `cwh-${user}-`)) };
    const p = spawn('python3', [path.join(root, 'launcher/hub_server.py'), '--folder', hub, '--browser', 'none', '--port', String(port), '--user', user], { env });
    p.stdout.on('data', (d) => { const m = String(d).match(/CWH_READY (\S+)/); if (m) resolve({ p, url: m[1] }); });
    p.stderr.on('data', (d) => process.stderr.write(d));
    setTimeout(() => reject(new Error('launcher did not start')), 8000);
  });
}

(async () => {
  const P = 48000 + Math.floor(Math.random() * 1000) * 2;
  const nick = await start('nick', P, { CWH_PICTURE_DIR: picDir });
  const wes = await start('wes', P + 1);
  const key = (u) => u.split('#key=')[1];
  const api = async (port, p, opts = {}) => fetch(`http://127.0.0.1:${port}${p}`, opts);

  // Safety
  check((await api(P, '/api/whoami')).status === 403, 'API refuses calls without the session key');
  check((await api(P, '/api/whoami', { headers: { 'X-Hub-Key': key(nick.url), Origin: 'https://evil.example' } })).status === 403, 'API refuses calls from another website');
  check((await api(P, '/api/file?name=../../etc/passwd', { headers: { 'X-Hub-Key': key(nick.url) } })).status === 400, 'only hub-config.json and tickets.json can be read whole');
  check((await api(P, '/api/changes/read?user=..%2Fhub-config', { headers: { 'X-Hub-Key': key(nick.url) } })).status === 400, 'no path tricks in change-file names');
  check((await api(P, '/api/changes/append', { method: 'POST', headers: { 'X-Hub-Key': key(nick.url) }, body: 'not json\n' })).status === 500, 'rejects lines that are not JSON');

  // Lesson videos from <hub>\training (byte ranges for seeking); nothing else
  fs.mkdirSync(path.join(hub, 'training'), { recursive: true });
  fs.writeFileSync(path.join(hub, 'training', 'basics.mp4'), Buffer.alloc(1000, 7));
  const v = await api(P, '/training/basics.mp4', { headers: { Range: 'bytes=100-199' } });
  check(v.status === 206 && (await v.arrayBuffer()).byteLength === 100 && v.headers.get('content-range') === 'bytes 100-199/1000', 'lesson videos are served with byte ranges');
  check((await api(P, '/training/..%2Fhub-config.json')).status === 404 && (await api(P, '/training/x.exe')).status === 404, 'only lesson videos can be fetched from training');

  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  // These tests drag between swimlane cells ("To Do, Support"); the default board is one row with bucket badges.
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('t')) { localStorage.setItem('cwh.lanes2', '1'); sessionStorage.setItem('t', '1'); } } catch {} });
  const errs = [];
  const pn = await ctx.newPage(); pn.on('pageerror', (e) => errs.push(e.message));
  await pn.goto(nick.url); await pn.waitForSelector('.sidebar');
  check(!/key=/.test(pn.url()), 'session key is taken out of the address bar');
  check(/Nick/.test(await pn.locator('.sidebar-foot').innerText()) && (await pn.getByText('Not you?').count()) === 0, 'signed in as the Windows user (Nick), no name to pick');
  await pn.goto(nick.url.split('#')[0] + '#/triage'); await pn.reload(); await pn.waitForSelector('.q-item.sel');
  const sel = pn.locator('.q-item.sel');
  await sel.getByRole('radio', { name: 'Support' }).click();
  for (const g of ['Impact', 'Urgency', 'Effort']) await sel.getByRole('radiogroup', { name: `${g}, 1 to 5` }).getByRole('radio', { name: '2', exact: true }).click();
  await sel.getByRole('button', { name: /Send to To Do/ }).click();
  await pn.waitForTimeout(400);
  check(fs.existsSync(path.join(hub, 'changes/nick.jsonl')), 'Nick’s change is written to changes/nick.jsonl in the shared folder');
  const hasPic = () => /"type":"profile.set","data":\{"photo":"data:image\/jpeg/.test(fs.readFileSync(path.join(hub, 'changes/nick.jsonl'), 'utf8'));
  for (let i = 0; i < 75 && !hasPic(); i++) await pn.waitForTimeout(200); // saved just after the first sync
  check(hasPic(), 'first open: Nick’s Windows picture becomes his avatar automatically');

  const pw = await ctx.newPage(); pw.on('pageerror', (e) => errs.push(e.message));
  await pw.goto(wes.url); await pw.waitForSelector('.sidebar');
  await pw.goto(wes.url.split('#')[0] + '#/board'); await pw.reload(); await pw.waitForSelector('.card');
  check((await pw.locator('.cell[aria-label="To Do, Support"] .card', { hasText: 'Launcher test ticket' }).count()) === 1, 'Wes (other PC, own launcher) sees Nick’s change');
  check(/Wes/.test(await pw.locator('.sidebar-foot').innerText()), 'Wes is signed in as Wes');
  // Wes's browser can't write as Nick: the launcher always uses its own user
  const r = await api(P + 1, '/api/changes/append', { method: 'POST', headers: { 'X-Hub-Key': key(wes.url) }, body: JSON.stringify({ id: 'x', ts: now, user: 'nick', type: 'item.comment', item: 'SD:INC-1', data: { text: 'hi' } }) + '\n' });
  check(r.ok && (await r.json()).file === 'changes/wes.jsonl', 'each launcher writes only its own person’s file');
  // A new tab without the key is refused
  const pt = await ctx.newPage();
  await pt.goto(wes.url.split('#')[0]); await pt.waitForTimeout(800);
  check(!(await pt.locator('.sidebar').count()), 'a tab opened without the key does not get in');
  // Auto-import: the hourly export lands in import\Core - All.csv; an open hub imports it, then re-imports when it's overwritten.
  const csv = (rows) => ['IT Service Desk', 'Total records : ' + rows.length, '', 'Request ID,Subject,Requester,Status,Priority,Technician,Group,Created Time',
    ...rows.map((r) => `${r[0]},${r[1]},Pat Q,${r[2]},High,Wes,Core Team,${new Date().toLocaleDateString('en-US')} 09:00 AM`)].join('\r\n');
  fs.mkdirSync(path.join(hub, 'import'), { recursive: true });
  const drop = (rows) => { fs.writeFileSync(path.join(hub, 'import', 'Core - All.csv.copying'), csv(rows)); fs.renameSync(path.join(hub, 'import', 'Core - All.csv.copying'), path.join(hub, 'import', 'Core - All.csv')); };
  drop([['90001', 'Printer queue stuck', 'Open'], ['90002', 'VPN token reset', 'Open']]);
  await pn.bringToFront();
  await pn.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await pn.waitForTimeout(1200);
  let tj = JSON.parse(fs.readFileSync(path.join(hub, 'tickets.json'), 'utf8'));
  check(tj.mode === 'csv-auto' && tj.importedFrom?.file === 'Core - All.csv' && tj.items.some((t) => t.source_id === '90001'), 'export dropped in import\\ is imported automatically');
  check(!tj.items.some((t) => t.source_id === 'INC-1'), 'the export replaces the previous Service Desk tickets');
  await new Promise((r) => setTimeout(r, 1100)); // new file time
  drop([['90001', 'Printer queue stuck', 'Closed'], ['90002', 'VPN token reset', 'Open'], ['90003', 'New laptop image', 'Open']]);
  await pw.bringToFront();
  await pw.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await pw.waitForTimeout(1200);
  tj = JSON.parse(fs.readFileSync(path.join(hub, 'tickets.json'), 'utf8'));
  check(tj.items.some((t) => t.source_id === '90003'), 'an overwritten export is imported again (by whoever has the hub open)');
  await pw.goto(wes.url.split('#')[0] + '#/settings'); await pw.waitForTimeout(800);
  check(/imported .*\(2 tickets, 2 open\)/.test(await pw.getByTestId('autoimport-status').innerText()), 'Settings shows when the export was imported');
  // Cloud links from a CSV can't point at the exact ticket: the link copies the number and opens Service Desk.
  await ctx.route('https://sd.example.test/**', (r) => r.fulfill({ contentType: 'text/html', body: 'Service Desk' }));
  await pw.goto(wes.url.split('#')[0] + '#/triage'); await pw.waitForTimeout(800);
  const [popup] = await Promise.all([
    pw.waitForEvent('popup'),
    pw.locator('a[href*="cwhcopy"]').first().click(),
  ]);
  await popup.waitForLoadState();
  check(popup.url() === 'https://sd.example.test/app/itdesk/ui/requests', 'ticket link opens Service Desk without the marker');
  await popup.close();
  check(/copied\. Paste it into Service Desk search/.test(await pw.locator('.toast').innerText()), 'and says the ticket number was copied');
  const st = await api(P, '/api/import?name=..%5Chub-config.json', { headers: { 'X-Hub-Key': key(nick.url) } });
  check(st.status === 400, 'import\\ can’t be used to read other files');

  // Avatars: Nick uses his Windows picture; Wes picks a colour and an emoji. Each sees the other's.
  await pn.bringToFront();
  await pn.getByRole('button', { name: /change my avatar/ }).click();
  await pn.getByRole('button', { name: 'Use my Windows picture' }).click();
  await pn.locator('dialog[open] .profile-preview img.avatar.xl').waitFor();
  await pn.getByRole('button', { name: 'Save' }).click();
  await pn.waitForTimeout(300);
  check(/"type":"profile.set"/.test(fs.readFileSync(path.join(hub, 'changes/nick.jsonl'), 'utf8')), 'Nick’s avatar is saved to his own change file');
  await pw.bringToFront();
  await pw.getByRole('button', { name: /change my avatar/ }).click();
  await pw.getByRole('radio', { name: 'Red' }).click();
  await pw.getByRole('radio', { name: 'Emoji' }).click();
  await pw.getByRole('button', { name: 'Emoji 🦊' }).click();
  if (process.env.SHOT) await pw.locator('dialog[open]').screenshot({ path: process.env.SHOT });
  await pw.getByRole('button', { name: 'Save' }).click();
  await pw.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await pw.waitForTimeout(600);
  await pw.goto(wes.url.split('#')[0] + '#/team'); await pw.waitForTimeout(800);
  check(await pw.locator('img.avatar[alt="Nick"]').count() > 0, 'Wes sees Nick’s photo (Team page)');
  const wesSelf = pw.locator('.sidebar-foot .avatar');
  check((await wesSelf.innerText()) === '🦊' && (await wesSelf.evaluate((e) => getComputedStyle(e).backgroundColor)) === 'rgb(180, 35, 24)', 'Wes’s own avatar shows the fox on red');
  await pn.bringToFront();
  await pn.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await pn.goto(nick.url.split('#')[0] + '#/team'); await pn.waitForTimeout(800);
  check(await pn.locator('.avatar.emoji', { hasText: '🦊' }).count() > 0, 'Nick sees Wes’s fox avatar on the Team page');
  // Windows has no picture: a clear message instead
  fs.rmSync(path.join(picDir, '{ABC}-Image192.png'));
  await pn.getByRole('button', { name: /change my avatar/ }).click();
  await pn.getByRole('button', { name: 'Use my Windows picture' }).click();
  await pn.waitForTimeout(500);
  check(await pn.getByRole('alert').filter({ hasText: 'Upload one instead' }).count() === 1, 'no Windows picture → “upload one instead”');
  await pn.getByRole('button', { name: 'Cancel' }).click();

  // Helper stopped while the tab is open (e.g. it was closed): the page says how to start it again
  wes.p.kill(); await new Promise((r) => setTimeout(r, 300));
  await pw.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await pw.waitForTimeout(800);
  check(/Double-click the Core Work Hub icon/.test(await pw.locator('body').innerText()), 'a stopped helper shows “double-click the icon”, not a silent stale board');
  console.log('errors', errs);
  if (errs.length) process.exitCode = 1;
  await b.close();
  nick.p.kill(); wes.p.kill();
})().catch((e) => { console.error(e); process.exit(1); });

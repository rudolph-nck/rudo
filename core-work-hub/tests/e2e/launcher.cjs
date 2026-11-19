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
fs.copyFileSync(path.join(root, 'deploy/hub-config.json'), path.join(hub, 'hub-config.json'));
const now = new Date().toISOString();
fs.writeFileSync(path.join(hub, 'tickets.json'), JSON.stringify({ generatedAt: now, generatedBy: 'test', mode: 'csv', items: [
  { source: 'SD', source_id: 'INC-1', title: 'Launcher test ticket', source_status: 'Open', created: now },
] }));

function start(user, port) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, LOCALAPPDATA: fs.mkdtempSync(path.join(os.tmpdir(), `cwh-${user}-`)) };
    const p = spawn('python3', [path.join(root, 'launcher/hub_server.py'), '--folder', hub, '--browser', 'none', '--port', String(port), '--user', user], { env });
    p.stdout.on('data', (d) => { const m = String(d).match(/CWH_READY (\S+)/); if (m) resolve({ p, url: m[1] }); });
    p.stderr.on('data', (d) => process.stderr.write(d));
    setTimeout(() => reject(new Error('launcher did not start')), 8000);
  });
}

(async () => {
  const P = 48000 + Math.floor(Math.random() * 1000) * 2;
  const nick = await start('nick', P);
  const wes = await start('wes', P + 1);
  const key = (u) => u.split('#key=')[1];
  const api = async (port, p, opts = {}) => fetch(`http://127.0.0.1:${port}${p}`, opts);

  // Safety
  check((await api(P, '/api/whoami')).status === 403, 'API refuses calls without the session key');
  check((await api(P, '/api/whoami', { headers: { 'X-Hub-Key': key(nick.url), Origin: 'https://evil.example' } })).status === 403, 'API refuses calls from another website');
  check((await api(P, '/api/file?name=../../etc/passwd', { headers: { 'X-Hub-Key': key(nick.url) } })).status === 400, 'only hub-config.json and tickets.json can be read whole');
  check((await api(P, '/api/changes/read?user=..%2Fhub-config', { headers: { 'X-Hub-Key': key(nick.url) } })).status === 400, 'no path tricks in change-file names');
  check((await api(P, '/api/changes/append', { method: 'POST', headers: { 'X-Hub-Key': key(nick.url) }, body: 'not json\n' })).status === 500, 'rejects lines that are not JSON');

  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
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

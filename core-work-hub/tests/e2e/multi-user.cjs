// End-to-end: three people (manager, analyst, viewer) on one hub folder, using the browser's private
// file system (same File System Access API as the shared folder). Serve dist/ first:
//   npm run build && (cd dist && python3 -m http.server 4173) & node tests/e2e/multi-user.cjs
const { chromium } = require('playwright');
const BASE = process.env.HUB_URL || 'http://localhost:4173/index.html';
const URL = BASE + '?store=opfs';
const now = Date.now();
const iso = (d) => new Date(now - d * 864e5).toISOString();
const tickets = { generatedAt: iso(0), generatedBy: 'test', mode: 'csv', items: [
  { source: 'SD', source_id: '1001', title: 'Alpha outage', source_status: 'Open', source_priority: 'High', created: iso(2) },
  { source: 'SD', source_id: '1002', title: 'Bravo request', source_status: 'Open', source_priority: 'Low', created: iso(1) },
  { source: 'SD', source_id: '1003', title: 'Charlie request', source_status: 'Open', created: iso(1) },
  { source: 'SD', source_id: '1004', title: 'Delta closed', source_status: 'Closed', created: iso(5), closed: iso(1) },
]};
const cfg = { teamName: 'IT Core', people: [
  { username: 'nick', name: 'Nick', role: 'manager' }, { username: 'wes', name: 'Wes', role: 'analyst', wipLimit: 1 },
  { username: 'cathy', name: 'Cathy', role: 'analyst' }, { username: 'matt', name: 'Matt', role: 'viewer' } ],
  systems: [{ id: 'ad', name: 'AD', primary: 'cathy', secondary: 'wes' }] };
const check = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const nick = await ctx.newPage();
  const errs = [];
  nick.on('pageerror', e => errs.push(e.message));
  await nick.goto(BASE + '?demo');  // same origin; just to get a page to seed OPFS
  await nick.evaluate(async ({ cfg, tickets }) => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('hub', { create: true });
    for (const [n, t] of [['hub-config.json', cfg], ['tickets.json', tickets]]) {
      const w = await (await root.getFileHandle(n, { create: true })).createWritable(); await w.write(JSON.stringify(t)); await w.close();
    }
    try { await root.removeEntry('changes', { recursive: true }); } catch {}
  }, { cfg, tickets });
  await nick.goto(URL + '&as=nick#/triage');
  await nick.waitForSelector('.q-item');
  check((await nick.locator('.q-item').count()) === 3, 'intake has 3 open tickets (closed one auto-Done)');

  // Grade first item with clicks + keyboard: bucket Support, I5 U5 E1, owner suggested
  const sel = nick.locator('.q-item.sel');
  await sel.getByRole('radio', { name: 'Support' }).click();
  await sel.getByRole('radiogroup', { name: 'Impact, 1 to 5' }).getByRole('radio', { name: '5' }).click();
  await sel.getByRole('radiogroup', { name: 'Urgency, 1 to 5' }).getByRole('radio', { name: '5' }).click();
  await sel.getByRole('radiogroup', { name: 'Effort, 1 to 5' }).getByRole('radio', { name: '1' }).click();
  await sel.getByLabel('System').selectOption('ad');
  const sugg = await sel.locator('.suggest').innerText();
  check(/Next in rotation: Cathy/.test(sugg), 'owner suggestion from ownership map: Cathy');
  check((await sel.getByRole('radio', { name: 'P1' }).getAttribute('aria-checked')) === 'true', 'score 25 suggests P1');
  await nick.locator('body').click({ position: { x: 5, y: 995 } });
  await nick.keyboard.press('2');
  check((await sel.getByRole('radio', { name: 'P2' }).getAttribute('aria-checked')) === 'true', 'key 2 sets P2');
  await nick.keyboard.press('Enter');
  await nick.waitForTimeout(400);
  check((await nick.locator('.q-item').count()) === 2, 'Enter sends to To Do');
  // grade the next one to Support too, owner wes
  const s2 = nick.locator('.q-item.sel');
  await s2.getByRole('radio', { name: 'Support' }).click();
  for (const [g, v] of [['Impact', '2'], ['Urgency', '2'], ['Effort', '2']]) await s2.getByRole('radiogroup', { name: `${g}, 1 to 5` }).getByRole('radio', { name: v }).click();
  await s2.getByLabel('Owner').selectOption('wes');
  await s2.getByRole('button', { name: /Send to To Do/ }).click();
  await nick.waitForTimeout(300);
  // J/K
  await nick.locator('body').click({ position: { x: 5, y: 995 } });
  const before = await nick.locator('.q-item.sel').innerText();
  await nick.keyboard.press('k');
  check((await nick.locator('.q-item.sel').innerText()) === before, 'K at top stays (1 left)');
  const ranked = await nick.locator('.ranked .r-item .num').allInnerTexts();
  check(JSON.stringify(ranked) === '["1","2"]', 'ranked list has unique ranks 1,2: ' + ranked);

  // Wes opens the board in another tab
  const wes = await ctx.newPage();
  await wes.goto(URL + '&as=wes#/board');
  await wes.waitForSelector('.card');
  // Nick grades/moves Charlie -> To Do via drawer, then Wes should see it within 30s
  const t0 = Date.now();
  await nick.goto(URL + '&as=nick#/board');
  await nick.waitForSelector('.card');
  // Nick moves "Bravo" (owned by wes? second graded = Bravo) to Doing via card menu
  const bravo = nick.locator('article.card', { hasText: 'Bravo' });
  await bravo.getByRole('button', { name: /Actions for/ }).click();
  await nick.getByRole('menuitem', { name: 'Doing' }).click();
  await nick.waitForTimeout(300);
  check(await nick.locator('.cell[aria-label="Doing, Support"] .card', { hasText: 'Bravo' }).count() === 1, 'Nick moved Bravo to Doing (Support lane)');
  await wes.waitForFunction(() => [...document.querySelectorAll('.cell[aria-label="Doing, Support"] .card')].some(c => c.textContent.includes('Bravo')), null, { timeout: 30000 });
  console.log('ok   Wes saw the move after', ((Date.now() - t0) / 1000).toFixed(1), 's');

  // WIP: Wes limit 1, Alpha owned by cathy... Nick assigns Alpha to wes then drags into Doing -> override dialog
  await nick.locator('article.card', { hasText: 'Alpha' }).getByRole('button', { name: 'Alpha outage', exact: true }).click();
  await nick.getByLabel('Owner', { exact: true }).selectOption('wes');
  await nick.waitForTimeout(200);
  await nick.getByRole('group', { name: 'Move to column' }).getByRole('button', { name: 'Doing' }).click();
  await nick.getByRole('heading', { name: 'WIP limit exceeded' }).waitFor();
  check(true, 'WIP limit warning shown');
  check(await nick.getByRole('button', { name: 'Override and move' }).isDisabled(), 'override requires a reason');
  await nick.getByLabel(/Reason for the override/).fill('P1 outage');
  await nick.getByRole('button', { name: 'Override and move' }).click();
  await nick.waitForTimeout(300);
  await nick.keyboard.press('Escape');

  // Drag-and-drop with the mouse. Waiting is driven by Service Desk status for tickets, so that drop is refused.
  await wes.locator('button[aria-label="Refresh now"]').click();
  await wes.waitForTimeout(500);
  const drag = async (cellLabel) => {
    const card = wes.locator('article.card', { hasText: 'Bravo' });
    const target = wes.locator(`.cell[aria-label="${cellLabel}"]`);
    const cb = await card.boundingBox(), tb = await target.boundingBox();
    await wes.mouse.move(cb.x + 40, cb.y + 20); await wes.mouse.down();
    await wes.mouse.move(cb.x + 60, cb.y + 40, { steps: 5 });
    await wes.mouse.move(tb.x + tb.width / 2, tb.y + 40, { steps: 15 });
    await wes.mouse.up();
  };
  await drag('Waiting, Support');
  await wes.getByRole('heading', { name: 'Service Desk controls this one' }).waitFor();
  check(await wes.getByRole('link', { name: /Open #1002 in Service Desk/ }).count() === 1, 'drop on Waiting -> "Service Desk controls this one" with a link to #1002');
  await wes.getByRole('button', { name: 'Cancel' }).click();
  await drag('On Hold, Support');
  await wes.waitForTimeout(400);
  await wes.getByLabel(/Why is it coming off the plate/).fill('Waiting on change window');
  await wes.getByRole('button', { name: 'Move to On Hold' }).click();
  await wes.waitForTimeout(500);
  check(await wes.locator('.cell[aria-label="On Hold, Support"] .card', { hasText: 'Bravo' }).count() === 1, 'Wes dragged Bravo to On Hold with a reason');

  // Wes cannot move Alpha? Alpha owned by wes now. Try Cathy-owned? Check analyst can't move someone else's card: Charlie (ungraded) drag blocked.
  // Read change files
  const files = await nick.evaluate(async () => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('hub');
    const ch = await root.getDirectoryHandle('changes');
    const out = {};
    for await (const [n, h] of ch.entries()) out[n] = (await (await h.getFile()).text()).trim().split('\n').map(l => JSON.parse(l));
    return out;
  });
  check(Object.keys(files).sort().join() === 'nick.jsonl,wes.jsonl', 'one change file per person: ' + Object.keys(files));
  const ov = files['nick.jsonl'].find(e => e.type === 'item.move' && e.data.override);
  check(ov && ov.data.override === 'P1 outage' && ov.before && ov.before.column === 'To Do', 'override logged with reason and before value');
  check(files['wes.jsonl'].some(e => e.type === 'item.move' && e.data.column === 'On Hold' && e.data.reason && e.before.column === 'Doing'), 'Wes move recorded with reason and before/after');

  // Audit page lists everything
  await nick.goto(URL + '&as=nick#/audit');
  await nick.waitForSelector('table');
  await nick.locator('button[aria-label="Refresh now"]').click();
  await nick.waitForTimeout(800);
  const auditRows = await nick.locator('section.panel table tbody tr').count();
  const total = Object.values(files).reduce((s, l) => s + l.length, 0);
  check(auditRows === total, `audit shows every change (${auditRows}/${total})`);
  if (auditRows !== total) { console.log(Object.entries(files).map(([f,l])=>f+': '+l.map(e=>e.type+(e.item?'@'+e.item:'')).join(', ')).join('\n')); console.log((await nick.locator('section.panel table tbody tr').allInnerTexts()).join('\n')); }

  // Viewer: Matt is read-only
  const matt = await ctx.newPage();
  await matt.goto(URL + '&as=matt#/board');
  await matt.waitForSelector('.card');
  check(await matt.getByText('Read-only').count() > 0 && await matt.getByRole('button', { name: 'New work' }).count() === 0, 'Matt sees read-only board');
  await matt.screenshot({ path: (process.env.SHOTS || '.') + '/matt.png' });
  await nick.goto(URL + '&as=nick#/board');
  await nick.waitForSelector('.card');
  await nick.screenshot({ path: (process.env.SHOTS || '.') + '/e2e-board.png', fullPage: true });
  console.log('page errors:', errs);
  await b.close();
})();

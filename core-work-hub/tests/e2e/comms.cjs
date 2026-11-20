// Browser test: communication-standard notifications and logging an update (demo data).
const { chromium } = require('playwright');
const file = 'file://' + require('path').resolve(__dirname, '../../dist/index.html');
const check = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  // These tests drag between swimlane cells ("To Do, Support"); the default board is one row with bucket badges.
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('t')) { localStorage.setItem('cwh.lanes2', '1'); sessionStorage.setItem('t', '1'); } } catch {} });
  const errs = [];
  const open = async (who, hash) => { const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); await p.goto(file + `?demo&as=${who}#/${hash}`); await p.waitForSelector('h1'); await p.waitForTimeout(200); return p; };
  const first = await ctx.newPage(); await first.goto(file + '?demo&as=nick');
  await first.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cwh.demo.')).forEach((k) => localStorage.removeItem(k)));
  const nick = await open('nick', 'notifications');
  const nickCount = await nick.locator('.notice').count();
  check(nickCount >= 2, `Nick sees escalations (${nickCount})`);
  check(!(await nick.locator('.notice').allInnerTexts()).some((t) => /You’re on support/.test(t)), 'Nick is never labelled as support');
  check(await nick.locator('.topbar .bell .count.alert').count() === 1, 'the bell badge turns red when something is late');
  const trey = await open('trey', 'notifications');
  const before = await trey.locator('.notice').count();
  const firstTitle = (await trey.locator('.notice').first().innerText()).split('\n').find((l) => /SD #\d+/.test(l)) ?? '';
  const lateFor = async (t) => (await trey.locator('.notice').allInnerTexts()).filter((x) => x.includes(t) && /Escalated|Overdue|late/.test(x)).length;
  await trey.locator('.notice').first().getByRole('button', { name: /Log update|Follow up/ }).click();
  check(/IT Core/.test(await trey.locator('dialog[open] textarea').inputValue()), 'log dialog offers a ready-to-paste note');
  await trey.getByRole('button', { name: 'I posted it in Service Desk' }).click();
  await trey.waitForTimeout(300);
  // The late notice goes; a P1 may come straight back as "Due soon" for its next 2-hour update, depending on the time of day.
  check((await trey.locator('.notice').count()) <= before && (await lateFor(firstTitle)) === 0, 'logging the update clears the late notification');
  const board = await open('nick', 'board');
  check((await board.locator('.card .chip', { hasText: /Escalated|late|due/ }).count()) >= 1, 'cards show communication status');
  const ov = await open('nick', 'overview');
  check(/% on time/.test(await ov.locator('.stat2', { hasText: 'Communication standard' }).innerText()), 'Overview shows the communication standard');
  console.log('errors', errs);
  if (errs.length) process.exitCode = 1;
  await b.close();
})();

// Browser test: Priorities page (demo data). Run after `npm run build`.
const { chromium } = require('playwright');
const file = 'file://' + require('path').resolve(__dirname, '../../dist/index.html');
const check = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  // These tests drag between swimlane cells ("To Do, Support"); the default board is one row with bucket badges.
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('t')) { localStorage.setItem('cwh.lanes2', '1'); sessionStorage.setItem('t', '1'); } } catch {} });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(file + '?demo&as=nick');
  await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cwh.demo.')).forEach((k) => localStorage.removeItem(k)));
  await p.goto(file + '?demo&as=nick#/priorities'); await p.reload(); await p.waitForSelector('.pri-summary');
  if (process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/priorities.png', fullPage: false });
  const p1 = p.locator('section#pri-P1 tbody tr');
  check((await p1.count()) >= 1, 'P1 group lists open P1 work first');
  const conf = await p.locator('.conflicts li').count();
  check(conf >= 1, `conflicts found (${conf})`);
  const rr = p.getByRole('button', { name: 'Re-rank by priority' });
  if (await rr.count()) {
    const n = await rr.count();
    await rr.first().click(); await p.waitForTimeout(300);
    check((await p.getByRole('button', { name: 'Re-rank by priority' }).count()) === n - 1, 're-rank by priority clears that conflict');
  }
  // Raise a P3 to P1 with a reason
  const row = p.locator('section#pri-P3 tbody tr').first();
  const title = (await row.locator('button.linkish').innerText()).trim();
  await row.getByRole('radio', { name: 'P1' }).click();
  await p.getByLabel(/Why\?/).fill('Exam finding due Friday');
  await p.getByRole('button', { name: 'Change to P1' }).click();
  await p.waitForTimeout(300);
  check((await p.locator('section#pri-P1 tbody tr', { hasText: title }).count()) === 1, `raised "${title}" to P1`);
  await p.locator('section#pri-P1 button.linkish', { hasText: title }).first().click();
  await p.waitForSelector('dialog[open]');
  check(/P3 → P1 by Nick: Exam finding due Friday/.test(await p.locator('dialog[open]').innerText()), 'priority history on the item shows before → after with the reason');
  check(/changed priority to P1: Exam finding due Friday/.test(await p.locator('dialog[open]').innerText()), 'item history (audit) records the change');
  if (process.env.SHOTS) { await p.keyboard.press('Escape'); await p.locator('.conflicts').scrollIntoViewIfNeeded(); await p.screenshot({ path: process.env.SHOTS + '/priorities-conflicts.png' }); }
  // Analysts see it read-only
  const w = await ctx.newPage(); await w.goto(file + '?demo&as=wes#/priorities'); await w.waitForSelector('.pri-summary');
  check((await w.locator('.pri-pick').count()) === 0, 'analysts (not on support) see priorities read-only');
  console.log('errors', errs);
  if (errs.length) process.exitCode = 1;
  await b.close();
})();

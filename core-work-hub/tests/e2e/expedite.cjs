// Browser test: forced priority, one-time identity pick, Teams links (demo data).
const { chromium } = require('playwright');
const file = 'file://' + require('path').resolve(__dirname, '../../dist/index.html');
const check = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(file + '?demo&as=nick');
  await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cwh.demo.')).forEach((k) => localStorage.removeItem(k)));
  await p.goto(file + '?demo&as=nick#/priorities'); await p.reload(); await p.waitForSelector('.pri-summary');
  // Force "Write runbook" (P3, To Do) and hold Michael's Patch Tuesday
  await p.getByRole('button', { name: /^Force Write runbook/ }).click();
  await p.getByLabel(/Why \(required/).fill('Exam finding: restore runbook due before the board meeting');
  await p.getByLabel('Who works it').selectOption('michael');
  await p.locator('fieldset.holds label', { hasText: 'Patch Tuesday' }).locator('input').check();
  await p.getByRole('button', { name: 'Force to the top' }).click();
  await p.waitForTimeout(400);
  check(/Write runbook/.test(await p.locator('.forced-panel').innerText()), 'forced item listed under Forced priorities');
  check(/FORCED P1/.test(await p.locator('section#pri-P1 tbody tr').first().innerText()), 'it is the first P1');
  await p.goto(file + '?demo&as=nick#/board'); await p.waitForSelector('.card');
  const card = p.locator('.cell[aria-label="Doing, Project"] article.card', { hasText: 'Write runbook' });
  check(await card.locator('.chip.forced').count() === 1, 'it started in Doing (past WIP) with a FORCED tag');
  check(await p.locator('.cell[aria-label="On Hold, Maintenance"] article.card', { hasText: 'Patch Tuesday' }).count() === 1, 'the held item went to On Hold');
  await card.getByRole('button', { name: 'Write runbook: Veeam restore for core file server', exact: true }).click();
  check(/Requested by Executive team, holds approved by Matt/.test(await p.locator('dialog[open]').innerText()), 'details show who asked and who approved');
  await p.keyboard.press('Escape');
  // Teams links
  await p.goto(file + '?demo&as=nick#/notifications'); await p.waitForSelector('h1');
  const nudge = p.getByRole('link', { name: /^Nudge/ }).first();
  check(/teams\.microsoft\.com\/l\/chat\/0\/0\?users=.*%40example\.com&message=.*P1%20update/.test(await nudge.getAttribute('href')), 'Nudge opens a Teams chat with the message filled in');
  // One-time identity: pick once, survives clearing localStorage (kept in IndexedDB too)
  const q = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await q.goto(file + '?demo'); await q.evaluate(() => localStorage.removeItem('cwh.me'));
  await q.reload(); await q.locator('.people button', { hasText: 'Analyst · wes' }).click(); await q.waitForSelector('.sidebar');
  await q.evaluate(() => localStorage.removeItem('cwh.me'));
  await q.reload(); await q.waitForSelector('.sidebar');
  check((await q.locator('.sidebar .row', { hasText: 'Not you?' }).innerText()).includes('Wes'), 'name pick is remembered after reload, even with localStorage cleared');
  console.log('errors', errs);
  if (errs.length) process.exitCode = 1;
  await b.close();
})();

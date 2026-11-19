// Browser test: time off, handing off work, rotation overrides and support-shift tracking (demo data).
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
  await p.goto(file + '?demo&as=nick#/timeoff'); await p.reload(); await p.waitForSelector('table.cal');
  check(/Noelle/.test(await p.locator('.out-list').first().innerText()), 'Noelle shows as out today');
  check((await p.getByText('No cover').count()) === 2, 'two support shifts clash with time off');

  // Add time off for Michael
  await p.getByRole('button', { name: 'Add time off' }).click();
  await p.locator('dialog[open] select').first().selectOption('michael');
  await p.getByRole('button', { name: 'Save' }).click();
  await p.waitForTimeout(300);
  check(/Michael/.test(await p.locator('.out-list').first().innerText()), 'added time off appears under Out today');
  // the dialog for Michael's work opens automatically
  await p.waitForSelector('.handoff');
  await p.keyboard.press('Escape');

  // Hand Noelle's hub-owned work to Michael
  await p.locator('.out-list li', { hasText: 'Noelle' }).getByRole('button', { name: 'Their work' }).click();
  await p.waitForSelector('.handoff');
  await p.getByRole('checkbox', { name: /Select Write runbook/ }).check();
  await p.getByRole('button', { name: /Hand 1 to Michael/ }).click();
  await p.waitForTimeout(300);
  check((await p.locator('.handoff li', { hasText: 'Write runbook' }).count()) === 0, 'handed-off item leaves Noelle\'s list');
  await p.keyboard.press('Escape');

  // Rotation: set a cover for a clash, then swap two shifts
  await p.goto(file + '?demo&as=nick#/rotation'); await p.waitForSelector('.timeline-shifts');
  const before = await p.getByRole('button', { name: 'Set a cover' }).count();
  await p.getByRole('button', { name: 'Set a cover' }).first().click();
  await p.getByRole('button', { name: 'Save cover' }).click();
  await p.waitForTimeout(300);
  check((await p.getByRole('button', { name: 'Set a cover' }).count()) === before - 1, 'cover clears the clash warning');
  check((await p.locator('.timeline-shifts .chip.warn', { hasText: 'Covering for' }).count()) === 1, 'cover shows in the schedule');
  await p.locator('.timeline-shifts li').nth(4).getByRole('button', { name: /^Change/ }).click();
  await p.getByRole('radio', { name: 'Swap with another shift' }).click();
  await p.getByRole('button', { name: 'Swap shifts' }).click();
  await p.waitForTimeout(300);
  check((await p.locator('.timeline-shifts .chip.warn', { hasText: 'Covering for' }).count()) >= 3, 'swap creates two covers');
  const hist = p.locator('section[aria-labelledby=hist-h] tbody tr').first();
  check(/Trey/.test(await hist.innerText()) && (await hist.locator('td').nth(3).innerText()).startsWith('2'), 'shift tracking: Trey triaged 2 this shift');
  console.log('errors', errs);
  if (errs.length) process.exitCode = 1;
  await b.close();
})();

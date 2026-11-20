// Browser test: Panda HQ (dumpster, goals, fire show, leaderboard, awards) and the new Overview analytics.
const { chromium } = require('playwright');
const file = 'file://' + require('path').resolve(__dirname, '../../dist/index.html');
const check = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(file + '?demo&as=nick');
  await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cwh.demo.') || k.startsWith('cwh.fire.') || k.startsWith('cwh.panda')).forEach((k) => localStorage.removeItem(k)));
  await p.goto(file + '?demo&as=nick#/pandahq'); await p.reload(); await p.waitForSelector('.dumpster-scene');
  check((await p.locator('h1').first().innerText()) === 'Panda HQ', 'Panda HQ opens');
  check((await p.locator('.goal-row').count()) === 4, 'four team goals: week, month, year, all time');
  check(/🎁/.test(await p.locator('.panda-goals').innerText()), 'goals show their prizes');
  check((await p.locator('.lb li').count()) >= 6, 'the leaderboard lists the team');
  check((await p.locator('.awards li').count()) >= 5, 'monthly award categories are listed');
  check(!(await p.locator('.fire-show').count()), 'no fire show while no goal is reached');

  // Nick sets the monthly goal to 1: the dumpster catches fire and the show plays once
  await p.getByRole('button', { name: 'Goals and prizes' }).click();
  const dlg = p.locator('dialog[open]');
  await dlg.getByLabel('Monthly goal', { exact: true }).fill('1');
  await dlg.getByLabel('Monthly goal prize').fill('Pizza Friday');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await p.waitForSelector('.fire-show', { timeout: 5000 }).catch(() => {});
  check((await p.locator('.fire-show').count()) === 1 && /DUMPSTER FIRE!/.test(await p.locator('.fire-show').innerText()), 'reaching a goal plays the dumpster-fire show');
  check(/Pizza Friday/.test(await p.locator('.fire-show').innerText()), 'the show announces the prize');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  check(!(await p.locator('.fire-show').count()), 'Esc closes the show');
  check((await p.locator('.dumpster-scene.on-fire').count()) === 1, 'the dumpster stays on fire for the month');
  await p.reload(); await p.waitForSelector('.dumpster-scene'); await p.waitForTimeout(500);
  check(!(await p.locator('.fire-show').count()), 'the show plays only once per achievement on this PC');
  await p.getByRole('button', { name: 'Replay the show' }).click();
  check((await p.locator('.fire-show').count()) === 1, 'Replay the show plays it again');
  await p.keyboard.press('Escape');

  // Team-only mode: analysts don't see rankings
  await p.getByRole('button', { name: 'Goals and prizes' }).click();
  await p.locator('dialog[open]').getByLabel(/Show individual rankings/).uncheck();
  await p.locator('dialog[open]').getByRole('button', { name: 'Save' }).click(); await p.waitForTimeout(300);
  const w = await ctx.newPage(); w.on('pageerror', (e) => errs.push(e.message));
  await w.goto(file + '?demo&as=wes#/pandahq'); await w.waitForSelector('.dumpster-scene');
  check(!(await w.locator('#lb-h').count()) && (await w.locator('.awards').count()) > 0, 'with rankings off, analysts see team goals and awards but no leaderboard');
  check((await p.locator('#lb-h').innerText()).includes('Only you can see this'), 'Nick still sees the leaderboard, marked private');

  // Overview analytics
  await p.goto(file + '?demo&as=nick#/overview'); await p.waitForSelector('#unassigned-h');
  check((await p.locator('#ranks-h').count()) === 1, 'Overview has closed tickets by person');
  await p.locator('section', { has: p.locator('#ranks-h') }).getByRole('radio', { name: 'All time' }).click();
  check((await p.locator('section', { has: p.locator('#ranks-h') }).locator('tbody tr').count()) >= 6, 'rankings switch period');
  check(/Time to assign/.test(await p.locator('main').innerText()), 'Overview shows time to assign');
  console.log('errors', errs);
  if (errs.length) process.exitCode = 1;
  await b.close();
})();

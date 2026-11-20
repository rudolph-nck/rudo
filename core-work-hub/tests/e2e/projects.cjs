// Browser test: the Projects list (Board → Projects) and opening an Intake ticket's details.
const { chromium } = require('playwright');
const file = 'file://' + require('path').resolve(__dirname, '../../dist/index.html');
const check = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(file + '?demo&as=wes');
  await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cwh.demo.')).forEach((k) => localStorage.removeItem(k)));
  await p.goto(file + '?demo&as=wes#/board'); await p.reload(); await p.waitForSelector('.card');
  await p.locator('.section-tabs').getByRole('button', { name: 'Projects' }).click();
  await p.waitForSelector('.pj-table');
  check(/#\/projects$/.test(p.url()) && (await p.locator('h1').first().innerText()) === 'Projects', 'Board has a Projects tab (the team can open it too)');
  const open = await p.locator('.pj-table tbody tr').count();
  check(open > 0, `open projects are listed (${open})`);
  check(/Migrate department file shares/.test(await p.locator('.pj-table').innerText()), 'with each project’s title');
  check((await p.locator('.pj-table tbody tr').first().locator('.pj-col').innerText()) === 'Doing', 'projects in progress are listed first');
  check(await p.locator('.pj-prog').count() > 0, 'projects with tasks show progress');
  await p.getByRole('button', { name: /All projects/ }).click();
  check((await p.locator('.pj-table tbody tr').count()) >= open, 'All projects includes done ones');
  await p.getByLabel('Search projects').fill('runbook');
  check((await p.locator('.pj-table tbody tr').count()) === 1, 'search narrows the list');
  await p.getByLabel('Search projects').fill('');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /Export CSV/ }).click()]);
  check(/^projects-\d{4}-\d{2}-\d{2}\.csv$/.test(dl.suggestedFilename()), 'projects export to CSV');
  await p.locator('.pj-table .linkish').first().click();
  await p.waitForSelector('dialog[open]');
  check(await p.locator('dialog[open]').count() === 1, 'clicking a project opens its details');
  await p.keyboard.press('Escape');

  // Intake: status at a glance, and the full details
  await p.goto(file + '?demo&as=nick#/triage'); await p.waitForSelector('.q-facts');
  check(/Status/.test(await p.locator('.q-facts').innerText()) && (await p.locator('.q-item .q-status').count()) > 0, 'Intake shows each ticket’s status');
  await p.getByRole('button', { name: 'Open details' }).click();
  await p.waitForSelector('dialog[open]');
  check(/Source status/.test(await p.locator('dialog[open]').innerText()), 'Open details shows the full ticket details from Intake');
  console.log('errors', errs);
  if (errs.length) process.exitCode = 1;
  await b.close();
})();

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

  // All tickets: open and closed, sortable
  await p.locator('.section-tabs').getByRole('button', { name: 'All tickets' }).click();
  await p.waitForSelector('.tk-table');
  check(/#\/tickets$/.test(p.url()) && (await p.locator('h1').first().innerText()) === 'All tickets', 'Board has an All tickets tab');
  const segText = await p.locator('.tk-bar .seg').innerText();
  const [o, c, a] = [/Open\s*([\d,]+)/, /Closed\s*([\d,]+)/, /All\s*([\d,]+)/].map((r) => Number(r.exec(segText)[1].replace(/,/g, '')));
  check(o > 0 && c > 0 && o + c === a, `open + closed = all (${o} + ${c} = ${a})`);
  check(Number((await p.locator('.tk-count').innerText()).replace(/\D/g, '')) === o, 'it starts on open tickets');
  await p.getByRole('radio', { name: /^Closed/ }).click();
  check(Number((await p.locator('.tk-count').innerText()).replace(/\D/g, '')) === c && (await p.locator('.tk-table tbody .chip.ok').count()) === Math.min(c, 100), 'Closed shows only closed tickets');
  await p.getByRole('radio', { name: /^All/ }).click();
  await p.getByRole('button', { name: /^Priority/ }).click();
  const pris = (await p.locator('.tk-table tbody tr td:nth-child(4)').allInnerTexts()).map((t) => t.trim()).filter((t) => /^P\d$/.test(t));
  check(pris.length > 1 && pris.every((x, k) => k === 0 || pris[k - 1] <= x), 'clicking a column sorts by it');
  check(/^priority/i.test(await p.locator('th[aria-sort="ascending"]').innerText()), 'the sorted column is marked');
  await p.getByRole('button', { name: /^Priority/ }).click();
  check((await p.locator('th[aria-sort="descending"]').count()) === 1, 'clicking again reverses it');
  const st = p.getByLabel('Status');
  const opt = (await st.locator('option').allInnerTexts())[1];
  await st.selectOption({ index: 1 });
  check(Number((await p.locator('.tk-count').innerText()).replace(/\D/g, '')) === Number(/\((\d+)\)/.exec(opt)[1]), `filter by source status (${opt})`);
  await p.getByRole('button', { name: 'Clear filters' }).click();
  const [tdl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /Export CSV/ }).click()]);
  check(/^tickets-all-\d{4}-\d{2}-\d{2}\.csv$/.test(tdl.suggestedFilename()), 'tickets export to CSV');

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

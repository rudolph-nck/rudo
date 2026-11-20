// Browser test: Overview tabs for managers: Trends (forecast), Ask (question builder + drill-down), Off-path, All tickets.
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
  await p.goto(file + '?demo&as=nick#/overview'); await p.reload(); await p.waitForSelector('.section-tabs');
  check((await p.locator('.section-tabs button').allInnerTexts()).join('|') === 'Dashboard|Trends|Ask|Off-path|All tickets|Stand-up|Panda HQ', 'Overview tabs: Dashboard, Trends, Ask, Off-path, All tickets, Stand-up, Panda HQ');

  // Trends
  await p.locator('.section-tabs').getByRole('button', { name: 'Trends' }).click();
  await p.waitForSelector('h1:text("Trends")');
  check((await p.locator('section[aria-label="Tickets per week"] svg path[stroke]').count()) >= 2, 'Trends draws tickets opened and closed per week');
  const hasForecast = await p.locator('.tr-tiles').count();
  check(hasForecast ? /Expected next week/.test(await p.locator('.tr-tiles').innerText()) : /12 weeks/.test(await p.locator('.banner').innerText()), hasForecast ? 'with a forecast' : 'and says a forecast needs 12 weeks of history');
  check(await p.locator('.heat-cell').count() > 30, 'and when tickets arrive (weekday by hour)');
  await p.locator('section[aria-label="Tickets per week"]').getByRole('button', { name: 'Table' }).click();
  check(await p.locator('section[aria-label="Tickets per week"] table tbody tr').count() > 20, 'every chart has a table view');

  // Ask
  await p.locator('.section-tabs').getByRole('button', { name: 'Ask' }).click();
  await p.waitForSelector('.ask-builder');
  await p.getByRole('button', { name: 'What is open right now, by status?' }).click();
  check(/open right now by status/.test(await p.locator('.ask-total').innerText()), 'a ready-made question fills the sentence');
  const total = Number((await p.locator('.ask-total .n').innerText()).replace(/\D/g, ''));
  const first = p.locator('.ask-bar').first();
  const firstN = Number((await first.locator('.val').innerText()).replace(/\D/g, ''));
  await first.click();
  check((await p.locator('section[aria-labelledby="drill-h"] tbody tr').count()) === firstN, `clicking a bar lists its tickets (${firstN})`);
  await p.getByLabel('Group by').selectOption('owner');
  check(/by person/.test(await p.locator('.ask-total').innerText()) && Number((await p.locator('.ask-total .n').innerText()).replace(/\D/g, '')) === total, 'changing the sentence regroups the same tickets');
  await p.getByLabel('Which tickets').selectOption('opened');
  await p.getByLabel('Group by').selectOption('month');
  check((await p.locator('section .viz-wrap svg path').count()) > 0, 'time questions draw columns');

  // Off-path
  await p.locator('.section-tabs').getByRole('button', { name: 'Off-path' }).click();
  await p.waitForSelector('h1:text("Off-path work")');
  check(/Off-path/.test(await p.locator('.tr-tiles').innerText()) && (await p.locator('section[aria-label="By person"]').count()) === 1, 'Off-path shows the share and a by-person chart');
  for (const s of ['Closed, last 90 days', 'Closed this year', 'Open now']) await p.getByRole('radio', { name: s }).click();
  check(/%/.test(await p.locator('.tr-tiles .n').first().innerText()), 'and switches between open and closed work');

  // All tickets lives in Overview too, without jumping the menu
  await p.locator('.section-tabs').getByRole('button', { name: 'All tickets' }).click();
  await p.waitForSelector('h1:text("All tickets")');
  check((await p.locator('.nav button[aria-current="page"]').innerText()).startsWith('Overview') && (await p.locator('.section-tabs button[aria-current="page"]').innerText()) === 'All tickets', 'All tickets opens under Overview (menu stays on Overview)');
  await p.locator('.nav button[data-section="board"]').click();
  await p.waitForSelector('h1:text("Board")');
  await p.locator('.section-tabs').getByRole('button', { name: 'All tickets' }).click();
  await p.waitForSelector('h1:text("All tickets")');
  check((await p.locator('.nav button[aria-current="page"]').innerText()).startsWith('Board'), 'and under Board from the Board');

  // The team doesn't see these
  const w = await ctx.newPage(); w.on('pageerror', (e) => errs.push(e.message));
  await w.goto(file + '?demo&as=wes#/trends'); await w.waitForSelector('h1');
  check(/#\/mine$/.test(w.url()), 'analysts are sent to My work from Trends');
  console.log('errors', errs);
  if (errs.length) process.exitCode = 1;
  await b.close();
})();

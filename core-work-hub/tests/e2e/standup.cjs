// Browser test: Stand-up page, re-prioritize with a reason, commit dates, the priority standard settings.
// Run after `npm run build`.
const { chromium } = require('playwright');
const file = 'file://' + require('path').resolve(__dirname, '../../dist/index.html');
const check = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errs = [];
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(file + '?demo&as=nick');
  await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cwh.demo.')).forEach((k) => localStorage.removeItem(k)));
  await p.goto(file + '?demo&as=nick#/standup'); await p.reload(); await p.waitForSelector('h1');
  check((await p.locator('h1').first().innerText()) === 'Stand-up', 'Stand-up page opens');
  check((await p.locator('.section-tabs button[aria-current="page"]').innerText()) === 'Stand-up' && (await p.locator('.section-tabs button').allInnerTexts()).join('|') === 'Dashboard|Trends|Ask|Off-path|All tickets|Stand-up|Panda HQ', 'Stand-up is a tab under Overview, with the Dashboard, Trends, Ask, Off-path, All tickets and Panda HQ');
  const navCount = Number(await p.locator('.nav button[data-section="overview"] .count').innerText());
  check(navCount > 0, `sidebar shows how many items must be discussed (${navCount})`);
  const past = p.locator('section', { has: p.locator('h2#su-past') });
  const pastBefore = await past.locator('li.su-row').count();
  check(pastBefore > 0, `past-target items listed (${pastBefore})`);
  check((await p.locator('section', { has: p.locator('h2#su-p1') }).locator('li.su-row').count()) > 0, 'open P1s listed');

  // Check-ins: On track / At risk / Blocked with a note; the progress counter moves
  const progress = async () => Number((await p.locator('.su-progress .su-big').innerText()).trim());
  const before = await progress();
  const ck = past.locator('li.su-row').nth(1);
  await ck.getByRole('button', { name: 'Note' }).click();
  await ck.getByRole('textbox').fill('Vendor patch due Friday');
  await ck.getByRole('radio', { name: 'At risk' }).click();
  await p.waitForTimeout(300);
  check((await progress()) === before + 1, 'a check-in counts toward "discussed today"');
  check(/At risk[\s\S]*Vendor patch due Friday/.test(await ck.innerText()), 'the row shows the check-in and note');
  await p.getByRole('button', { name: 'Copy for Teams' }).click();
  check(/\[At risk: Vendor patch due Friday\]/.test(await p.evaluate(() => navigator.clipboard.readText())), 'the Teams summary includes check-ins');

  // Commit a date: it leaves "past target"
  const first = past.locator('li.su-row').first();
  const title1 = (await first.locator('.su-title').innerText()).trim();
  await first.getByRole('button', { name: 'Date', exact: true }).click();
  const future = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
  await p.locator('dialog[open] input[type=date]').fill(future);
  await p.locator('dialog[open]').getByRole('button', { name: 'Commit' }).click();
  await p.waitForTimeout(300);
  check(!(await past.locator('li.su-row').allInnerTexts()).some((t) => t.includes(title1)), 'committing a date takes it off "past target"');

  // Re-prioritize down: reason required, logged with requester told / manager aware
  // A P2 a few days past its 3-day target: as a P4 (20-day target, counted from when it opened) it's back on track.
  const row = past.locator('li.su-row').filter({ hasText: /Day [4-9] of 3/ }).first();
  const title2 = (await row.locator('.su-title').innerText()).trim();
  await row.getByRole('button', { name: 'Priority', exact: true }).click();
  const dlg = p.locator('dialog[open]');
  await dlg.getByRole('radio', { name: 'P4' }).click();
  await dlg.getByRole('button', { name: 'Change to P4' }).click();
  await p.waitForTimeout(200);
  check((await p.locator('dialog[open]').count()) === 1, 'lowering without a reason is refused');
  await dlg.locator('textarea').fill('P1 outage this week; requester agreed it can wait');
  await dlg.getByLabel('Requester told').check();
  await dlg.getByLabel('Discussed with my manager').check();
  await dlg.getByRole('button', { name: 'Change to P4' }).click();
  await p.waitForTimeout(400);
  check(!(await past.locator('li.su-row').allInnerTexts()).some((t) => t.includes(title2)), 'downgraded item drops off "past target"');
  await p.goto(file + '?demo&as=nick#/audit'); await p.waitForTimeout(400);
  check(/changed priority to P4: P1 outage this week; requester agreed it can wait \(requester told\) \(discussed with Matt\)/.test(await p.locator('main').innerText()), 'audit log records the change, reason, requester told and manager aware');

  // Copy for Teams
  await p.goto(file + '?demo&as=nick#/standup'); await p.waitForSelector('h1');
  await p.getByRole('button', { name: 'Copy for Teams' }).click();
  const text = await p.evaluate(() => navigator.clipboard.readText());
  check(/IT Core stand-up/.test(text) && /Open P1s/.test(text), 'Copy for Teams puts a stand-up summary on the clipboard');

  // Priority standard: set the start date -> backlog appears, old tickets stop being "past target"
  await p.goto(file + '?demo&as=nick#/settings'); await p.waitForSelector('#ps-h');
  const ps = p.locator('section', { has: p.locator('#ps-h') });
  check((await ps.getByLabel('P1 respond').inputValue()) === '1' && (await ps.getByLabel('P4 resolveDays').inputValue()) === '20', 'standard defaults: P1 1h response, P4 20 days');
  await ps.getByLabel(/Start date/).fill(new Date().toISOString().slice(0, 10));
  await ps.getByRole('button', { name: 'Save' }).click();
  await p.waitForTimeout(300);
  await p.goto(file + '?demo&as=nick#/standup'); await p.waitForSelector('h1');
  const backlogN = Number(await p.locator('h2#su-backlog .chip').innerText());
  check(backlogN > 0, `with a start date, older tickets become the backlog (${backlogN})`);
  check((await past.locator('li.su-row').count()) === 0, 'and nothing from the backlog is "past target" on day one');

  // Levels: set Wes to Senior; the Team page measures him against the senior split
  await p.goto(file + '?demo&as=nick#/settings'); await p.waitForSelector('#cap-h');
  await p.getByLabel('Wes level').selectOption('senior');
  await p.waitForTimeout(300);
  check(/Wes/.test(await p.locator('section', { has: p.locator('#cap-h') }).locator('tr', { hasText: 'Senior' }).innerText()), 'Settings shows Wes under the senior time split');
  await p.goto(file + '?demo&as=nick#/team'); await p.waitForSelector('.team-row');
  check(/Hours vs senior split/.test(await p.locator('.team-row', { hasText: 'Wes' }).innerText()), 'Team page measures Wes against the senior split');
  const onSupport = (await p.locator('.dispatch-card .who').innerText()).trim().split('\n').pop().trim();
  check(/Hours vs support week split/.test(await p.locator('.team-row', { hasText: onSupport }).innerText()), `whoever is on support (${onSupport}) is measured against the support-week split`);

  // Analysts see the page but can't re-prioritize
  const w = await ctx.newPage(); w.on('pageerror', (e) => errs.push(e.message));
  await w.goto(file + '?demo&as=wes#/standup'); await w.waitForSelector('h1');
  check((await w.getByRole('button', { name: 'Priority', exact: true }).count()) === 0 && (await w.getByRole('radio', { name: 'At risk' }).count()) === 0, 'analysts see stand-up but cannot re-prioritize or check in');
  check((await w.locator('.su-status.at-risk').count()) > 0, 'analysts see today\'s check-ins');

  console.log('errors', errs);
  if (errs.length) process.exitCode = 1;
  await b.close();
})();

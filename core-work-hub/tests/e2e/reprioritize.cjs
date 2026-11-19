// Browser test: Ready to pick up, On Hold, release and pick up. Runs on demo data from dist/:
//   npm run build && node tests/e2e/reprioritize.cjs
const { chromium } = require('playwright');
const file = 'file://' + require('path').resolve(__dirname, '../../dist/index.html');
const check = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(file + '?demo&as=nick#/board');
  await p.evaluate(() => { Object.keys(localStorage).filter(k => k.startsWith('cwh.demo.')).forEach(k => localStorage.removeItem(k)); });
  await p.reload(); await p.waitForSelector('.card');
  check(await p.locator('.col-head', { hasText: 'Ready to pick up' }).count() === 1 && await p.locator('.col-head', { hasText: 'On Hold' }).count() === 1, 'board has Ready to pick up and On Hold columns');
  check(await p.locator('.cell[aria-label="On Hold, Project"] .card .hold').innerText().then(t => /Paused for the TLS/.test(t)), 'demo on-hold card shows its reason');
  await p.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/board-v2.png' });

  // Nick takes Patch Tuesday (Michael, Doing) off the plate -> On Hold
  const card = p.locator('article.card').filter({ has: p.getByRole('button', { name: 'Patch Tuesday: server group B', exact: true }) });
  await card.getByRole('button', { name: /Actions for/ }).click();
  await p.getByRole('menuitem', { name: 'On Hold' }).click();
  await p.getByRole('heading', { name: 'Take it off the plate' }).waitFor();
  check(await p.getByRole('button', { name: 'Move to On Hold' }).isDisabled(), 'reason required');
  await p.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/offplate.png' });
  await p.getByLabel(/Why is it coming off the plate/).fill('Core upgrade takes priority this week');
  await p.getByRole('button', { name: 'Move to On Hold' }).click();
  await p.waitForTimeout(300);
  const held = p.locator('.cell[aria-label="On Hold, Maintenance"] article.card').filter({ has: p.getByRole('button', { name: 'Patch Tuesday: server group B', exact: true }) });
  check(await held.count() === 1 && /Core upgrade/.test(await held.innerText()), 'card in On Hold with reason; owner kept: ' + (await held.locator('.avatar').getAttribute('aria-label')));

  // Then release it back to Ready for anyone (On Hold -> Ready is a normal move)
  await held.getByRole('button', { name: /Actions for/ }).click();
  await p.getByRole('menuitem', { name: 'Ready to pick up' }).click();
  await p.waitForTimeout(300);
  check(await p.locator('.cell[aria-label="Ready, Maintenance"] article.card').filter({ has: p.getByRole('button', { name: 'Patch Tuesday: server group B', exact: true }) }).count() === 1, 'On Hold -> Ready');

  // An SD-assigned ticket can't be released from the hub: the dialog points to Service Desk instead.
  const t = p.locator('article.card', { hasText: 'Intune compliance' });
  await t.getByRole('button', { name: /Actions for/ }).click();
  await p.getByRole('menuitem', { name: 'Ready to pick up' }).click();
  await p.getByLabel(/Why is it coming off the plate/).waitFor();
  check(await p.getByText('Assigned in Service Desk. To free it').count() === 1 && await p.getByLabel(/Release Tabitha/).count() === 0, 'SD-assigned ticket: no release option, points to Service Desk');
  await p.getByRole('button', { name: 'Cancel' }).click();

  // Doing -> Ready with release on a Wrike item (Wes's SharePoint migration); Cathy picks it up.
  const m = p.locator('article.card').filter({ has: p.getByRole('button', { name: 'Migrate department file shares to SharePoint', exact: true }) });
  await m.getByRole('button', { name: /Actions for/ }).click();
  await p.getByRole('menuitem', { name: 'Ready to pick up' }).click();
  await p.getByLabel(/Why is it coming off the plate/).fill('Wes is on the core upgrade; anyone can take it');
  check(await p.getByLabel(/Release Wes/).isChecked(), 'release defaults on for Ready');
  await p.getByRole('button', { name: 'Move to Ready to pick up' }).click();
  await p.waitForTimeout(300);
  const rc = p.locator('.cell[aria-label="Ready, Project"] article.card').filter({ has: p.getByRole('button', { name: 'Migrate department file shares to SharePoint', exact: true }) });
  check(await rc.count() === 1 && /#1/.test(await rc.innerText()), 'released to top of Projects Ready (#1)');
  check(await rc.locator('.avatar').first().getAttribute('aria-label') === 'No owner', 'owner cleared');

  const w = await ctx.newPage(); w.on('pageerror', e => errs.push(e.message));
  await w.goto(file + '?demo&as=cathy'); await w.waitForSelector('.card');
  const wc = w.locator('article.card').filter({ has: w.getByRole('button', { name: 'Migrate department file shares to SharePoint', exact: true }) });
  await wc.getByRole('button', { name: /Pick up/ }).click();
  await w.waitForTimeout(400);
  const dc = w.locator('.cell[aria-label="Doing, Project"] article.card').filter({ has: w.getByRole('button', { name: 'Migrate department file shares to SharePoint', exact: true }) });
  check(await dc.count() === 1 && await dc.locator('.avatar').first().getAttribute('aria-label') === 'Cathy', 'Cathy picked it up: Doing, owner Cathy');
  await w.goto(file + '?demo&as=cathy#/audit'); await w.waitForSelector('table');
  const txt = await w.locator('section.panel table').last().innerText();
  check(/released the owner — reason: “Wes is on the core upgrade/.test(txt), 'audit shows release with reason');
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.reload(); await p.waitForSelector('.card');
  await p.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/board-v2-dark.png' });
  console.log('errors', errs);
  await b.close();
})();

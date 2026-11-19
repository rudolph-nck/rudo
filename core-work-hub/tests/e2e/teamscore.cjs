// Browser test: Team score (demo data). Run after `npm run build`.
const { chromium } = require('playwright');
const file = 'file://' + require('path').resolve(__dirname, '../../dist/index.html');
const check = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(file + '?demo&as=nick');
  await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cwh.demo.')).forEach((k) => localStorage.removeItem(k)));
  await p.goto(file + '?demo&as=nick#/teamscore'); await p.reload(); await p.waitForSelector('.ts-list');
  if (process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/teamscore.png' });
  check((await p.locator('.banner.tie').count()) === 1, 'demo tie is flagged');
  await p.locator('.ts-row').first().locator('.ts-score').hover();
  check(/department-wide priority/.test(await p.locator('.tip.open').innerText()), 'hovering the score explains it');
  await p.locator('.ts-row').first().locator('.ts-c').first().hover();
  check(/Business value · 30% of the score[\s\S]*Team average/.test(await p.locator('.tip.open').innerText()), 'hovering a criterion explains it and the team average');
  await p.mouse.move(5, 995);
  await p.locator('.ts-row').first().locator('.ts-raters').focus();
  check((await p.locator('.tip.open').count()) === 1, 'tooltips open on keyboard focus too');
  await p.keyboard.press('Escape');
  check(!(await p.getByRole('button', { name: /Rank the Projects board/ }).isEnabled()), 'board ranking waits until ties are broken');
  // Break the tie: Wi-Fi first
  await p.locator('.banner.tie').getByRole('button', { name: /Branch Wi-Fi.*first/ }).click();
  await p.waitForTimeout(300);
  check((await p.locator('.banner.tie').count()) === 0, 'tie broken');
  const scores = await p.locator('.ts-score > strong').allInnerTexts();
  const nums = scores.filter((s) => s !== '—');
  check(new Set(nums).size === nums.length, `every scored project is unique: ${nums.join(', ')}`);
  // Rate the migration project as Nick (update my rating)
  const row = p.locator('.ts-row', { hasText: 'Migrate department file shares' });
  await row.getByRole('button', { name: /^Update my rating: Migrate/ }).click();
  await row.getByRole('radiogroup', { name: 'Urgency, 1 to 5' }).getByRole('radio', { name: '5' }).click();
  await row.getByRole('button', { name: 'Save my rating' }).click();
  await p.waitForTimeout(300);
  check(/team score/.test(await row.locator('.ts-score').innerText()), 'rating saved and score recomputed');
  // A set score that clashes is refused in the dialog
  const taken = (await p.locator('.ts-row').filter({ has: p.getByRole('button', { name: 'Branch Wi-Fi refresh: survey 3 branches', exact: true }) }).locator('.ts-score > strong').innerText()).trim();
  await p.getByRole('button', { name: /^Set score: Write runbook/ }).click();
  await p.getByLabel('Team score (one decimal)').fill(taken);
  await p.getByLabel(/Why \(required/).fill('test');
  check(await p.getByRole('alert').filter({ hasText: 'Scores must be unique' }).count() === 1 && !(await p.getByRole('button', { name: new RegExp('^Set ' + taken.replace('.', '\\.')) }).isEnabled()), `clashing score ${taken} is refused`);
  await p.getByRole('button', { name: 'Cancel' }).click();
  // Apply the order to the Projects board
  await p.getByRole('button', { name: /Rank the Projects board/ }).click();
  await p.waitForTimeout(300);
  await p.goto(file + '?demo&as=nick#/board'); await p.waitForSelector('.card');
  check((await p.locator('.chip.ts-chip').count()) >= 3, 'project cards show their team score');
  // Viewer: read-only
  const m = await ctx.newPage(); await m.goto(file + '?demo&as=matt#/teamscore'); await m.waitForSelector('.ts-list');
  check((await m.getByRole('button', { name: /^(Rate|Update my rating|Set score)/ }).count()) === 0, 'Matt sees team scores read-only');
  console.log('errors', errs);
  if (errs.length) process.exitCode = 1;
  await b.close();
})();

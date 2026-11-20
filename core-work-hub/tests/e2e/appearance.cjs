// Browser test: per-person colour themes, and managers previewing the hub as someone else ("View as").
const { chromium } = require('playwright');
const file = 'file://' + require('path').resolve(__dirname, '../../dist/index.html');
const check = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  const w = await ctx.newPage(); w.on('pageerror', (e) => errs.push(e.message));
  await w.goto(file + '?demo&as=wes');
  await w.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cwh.') && k !== 'cwh.me').forEach((k) => localStorage.removeItem(k)));
  await w.goto(file + '?demo&as=wes#/mine'); await w.reload(); await w.waitForSelector('.topbar');
  const accent = (p) => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase());
  check((await accent(w)) === '#3346d3', 'everyone starts on the Indigo theme');

  // Quick pick from the profile menu
  await w.locator('.profile-wrap .me-btn').click();
  await w.locator('.ap-quick').getByRole('radio', { name: 'Forest' }).click();
  await w.waitForTimeout(400);
  check((await accent(w)) !== '#3346d3' && (await w.evaluate(() => document.documentElement.dataset.palette)) === 'forest', 'picking Forest recolours the hub');
  await w.keyboard.press('Escape');

  // Custom theme from the Appearance dialog
  await w.locator('.profile-wrap .me-btn').click();
  await w.getByRole('menuitem', { name: /Appearance/ }).click();
  await w.locator('.ap-custom .ap-opt').click();
  await w.locator('input.ap-color').fill('#8a2be2');
  await w.locator('.ap-custom-fields').getByRole('radio', { name: 'Warm' }).click();
  await w.getByRole('radio', { name: 'Dark' }).click();
  await w.getByRole('button', { name: 'Save', exact: true }).click();
  await w.waitForTimeout(500);
  check((await w.evaluate(() => document.documentElement.dataset.palette)) === 'custom' && (await w.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'a custom accent, warm background and dark mode are saved');
  const bg = await w.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().toLowerCase());
  check(bg === '#13110f', 'warm dark background applied');

  // Saved to the person, not the PC: clear local copies and reload
  await w.evaluate(() => { localStorage.removeItem('cwh.appearance'); localStorage.removeItem('cwh.theme'); });
  await w.reload(); await w.waitForSelector('.topbar'); await w.waitForTimeout(600);
  check((await w.evaluate(() => document.documentElement.dataset.palette)) === 'custom' && (await w.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'the theme comes back from the profile after local data is cleared');

  // Someone else keeps their own theme
  const n = await ctx.newPage(); n.on('pageerror', (e) => errs.push(e.message));
  await n.goto(file + '?demo&as=nick'); await n.waitForSelector('.topbar'); await n.waitForTimeout(600);
  check((await n.evaluate(() => document.documentElement.dataset.palette)) === 'indigo', 'Nick still has his own theme (themes are per person)');

  // View as: Nick previews Wes's hub
  await n.locator('.profile-wrap .me-btn').click();
  await n.getByRole('menuitem', { name: /View as/ }).click();
  await n.getByRole('menuitemradio', { name: /Wes/ }).click();
  await n.waitForSelector('.preview-bar');
  check(/#\/mine$/.test(n.url()) && /Wes/.test(await n.locator('h1').first().innerText()), 'View as Wes opens Wes’s first page (My work)');
  check((await n.locator('.nav button').allInnerTexts()).map((t) => t.replace(/\d+/g, '').trim()).join('|') === 'My work|Board|Team', 'with Wes’s menu');
  check((await n.evaluate(() => document.documentElement.dataset.palette)) === 'custom', 'and Wes’s colours');
  const before = await n.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('cwh.demo.')).map(([, v]) => v).join('').length);
  await n.locator('.mw-row .btn', { hasText: /Acknowledge|Start|Log update/ }).first().click();
  await n.waitForTimeout(400);
  check(/Preview: nothing was saved/.test(await n.locator('.toast').first().innerText()), 'actions in the preview say nothing was saved');
  const after = await n.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('cwh.demo.')).map(([, v]) => v).join('').length);
  check(before === after, 'and nothing was written');
  await n.goto(file + '?demo&as=nick#/settings'); await n.waitForSelector('.preview-bar');
  check(/#\/mine$/.test(n.url()), 'the preview follows Wes’s access (Settings sends you to My work)');
  await n.getByRole('button', { name: 'Exit preview' }).click();
  await n.waitForTimeout(500);
  check(/#\/overview$/.test(n.url()) && (await n.locator('.preview-bar').count()) === 0 && (await n.evaluate(() => document.documentElement.dataset.palette)) === 'indigo', 'Exit preview returns Nick to his own Overview and colours');

  // Analysts don't get View as
  await w.locator('.profile-wrap .me-btn').click();
  check((await w.getByRole('menuitem', { name: /View as/ }).count()) === 0, 'analysts have no View as option');

  console.log('errors', errs);
  if (errs.length) process.exitCode = 1;
  await b.close();
})();

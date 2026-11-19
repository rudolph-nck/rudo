// Browser test: Training page, guided tours, completion tracking. Run after `npm run build`.
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
  await p.goto(file + '?demo&as=wes#/training'); await p.reload(); await p.waitForSelector('.learn-list');
  const lessons = await p.locator('.learn-item').count();
  check(lessons >= 8, `analysts see their lessons (${lessons})`);
  check(!(await p.locator('.learn-item', { hasText: 'Settings (Nick)' }).count()), 'manager-only lessons are hidden from analysts');
  const left = Number(await p.locator('.nav button', { hasText: 'Training' }).locator('.count').innerText());
  check(left === lessons, 'sidebar shows how many lessons are left');
  check(/No video installed/.test(await p.locator('.learn-detail').innerText()), 'without the video files, the lesson says so and offers the tour');
  check((await p.locator('.learn-how ol li').count()) >= 3, 'how-to steps are listed');

  // Guided tour of the Board lesson, through to Done
  await p.locator('.learn-item', { hasText: 'The Board' }).click();
  await p.getByRole('button', { name: 'Show me' }).click();
  await p.waitForSelector('.tour-card');
  check(/step 1 of/.test(await p.locator('.tour-card').innerText()), 'the tour starts at step 1');
  let steps = 0, spotted = 0;
  for (let i = 0; i < 12; i++) {
    await p.waitForTimeout(450);
    if (await p.locator('.tour-spot').count()) spotted++;
    steps++;
    const btn = p.locator('.tour-card .btn.primary');
    const last = (await btn.innerText()).trim() === 'Done';
    await btn.click();
    if (last) break;
  }
  check(steps >= 5 && spotted >= steps - 1, `each step spotlights the real element (${spotted}/${steps})`);
  check((await p.locator('h1').first().innerText()) === 'Board', 'the tour takes you to the page it is teaching');
  await p.waitForTimeout(300);
  check(!(await p.locator('.tour-card').count()), 'Done closes the tour');
  await p.goto(file + '?demo&as=wes#/training'); await p.waitForSelector('.learn-list');
  check((await p.locator('.learn-item', { hasText: 'The Board' }).locator('.learn-num.done').count()) === 1, 'finishing the tour marks the lesson done');

  // Esc leaves a tour; Mark as done works without one
  await p.locator('.learn-item', { hasText: 'Getting around' }).click();
  await p.getByRole('button', { name: 'Show me' }).click(); await p.waitForSelector('.tour-card');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  check(!(await p.locator('.tour-card').count()), 'Esc closes the tour');
  await p.getByRole('button', { name: 'Mark as done' }).click(); await p.waitForTimeout(300);
  check(/2/.test(await p.locator('.su-progress .su-big').innerText()), 'progress counts finished lessons');

  // Nick sees the team's progress
  const n = await ctx.newPage(); n.on('pageerror', (e) => errs.push(e.message));
  await n.goto(file + '?demo&as=nick#/training'); await n.waitForSelector('#tp-h');
  const wesRow = n.locator('section', { has: n.locator('#tp-h') }).locator('tr', { hasText: 'Wes' });
  check(/2 \/ /.test(await wesRow.innerText()), 'Nick sees Wes has finished 2 lessons');
  console.log('errors', errs);
  if (errs.length) process.exitCode = 1;
  await b.close();
})();

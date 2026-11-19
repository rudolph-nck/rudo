// Records each training lesson's guided tour, on demo data, as an MP4 for the Training page.
// Run after `npm run build`:  node scripts/record-training.cjs [lessonId ...]
// Output: build/training/<lesson>.mp4 (ship them in the hub folder's training\ folder).
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'build', 'training');
const raw = path.join(root, 'build', 'training-raw');
const file = 'file://' + path.join(root, 'dist', 'index.html');
const W = 1280, H = 720;

(async () => {
  fs.mkdirSync(out, { recursive: true });
  fs.rmSync(raw, { recursive: true, force: true });
  fs.mkdirSync(raw, { recursive: true });
  // Lesson list straight from the source, so videos always match the app.
  const src = fs.readFileSync(path.join(root, 'src/training/lessons.ts'), 'utf8');
  const all = [...src.matchAll(/\n    id: '([a-z-]+)',\n    title: '([^']+)'/g)].map((m) => ({ id: m[1], title: m[2] }));
  const want = process.argv.slice(2);
  const lessons = want.length ? all.filter((l) => want.includes(l.id)) : all;
  const b = await chromium.launch();
  for (const l of lessons) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: raw, size: { width: W, height: H } } });
    const p = await ctx.newPage();
    await p.goto(file + '?demo&as=nick');
    await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('cwh.demo.')).forEach((k) => localStorage.removeItem(k)));
    await p.goto(file + '?demo&as=nick#/board'); await p.reload(); await p.waitForSelector('.sidebar');
    // Title card
    await p.evaluate((t) => {
      const d = document.createElement('div');
      d.id = 'rec-title';
      d.style.cssText = 'position:fixed;inset:0;z-index:2000;display:grid;place-items:center;background:var(--bg);font:800 34px/1.3 "Plus Jakarta Sans",sans-serif;color:var(--text);text-align:center';
      d.innerHTML = `<div><div style="font-size:15px;font-weight:700;color:var(--text-3);letter-spacing:.06em;text-transform:uppercase">Core Work Hub training</div>${t}</div>`;
      document.body.appendChild(d);
    }, l.title);
    await p.waitForTimeout(2200);
    await p.evaluate(() => document.getElementById('rec-title')?.remove());
    await p.evaluate((id) => window.cwhStartTour(id), l.id);
    // Step through: time on each step depends on how much there is to read.
    for (let i = 0; i < 20; i++) {
      await p.waitForSelector('.tour-card', { timeout: 5000 }).catch(() => null);
      if (!(await p.locator('.tour-card').count())) break;
      const text = await p.locator('.tour-card').innerText();
      await p.waitForTimeout(Math.min(7000, 2200 + text.length * 32));
      const btn = p.locator('.tour-card .btn.primary');
      const last = (await btn.innerText()).trim() === 'Done';
      await btn.click();
      if (last) break;
    }
    await p.waitForTimeout(900);
    const video = p.video();
    await ctx.close();
    const webm = await video.path();
    const mp4 = path.join(out, `${l.id}.mp4`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4]);
    console.log(`${l.id}.mp4  ${(fs.statSync(mp4).size / 1024).toFixed(0)} KB`);
  }
  await b.close();
  fs.rmSync(raw, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });

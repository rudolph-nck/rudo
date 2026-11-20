// Ticket trends and a simple, explainable forecast of incoming tickets.
// Model: recent level (exponentially weighted, last ~12 weeks) x a damped recent trend x a month-of-year seasonal
// index learned from past years (shrunk toward 1). It is back-tested on the last 12 weeks so the page can say how
// accurate it has actually been. Everything is local time, weeks start Monday.
import type { WorkItem } from './types';

const DAY = 864e5;
export const isClosedItem = (i: WorkItem) => i.column === 'Done' || !!i.sourceClosed;
export const closedAtOf = (i: WorkItem) => (isClosedItem(i) && i.done ? new Date(i.done) : undefined);

export function weekStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const addWeeks = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + 7 * n); return x; };

export interface Week {
  start: Date;
  opened: number;
  closed: number;
  /** Open at the end of the week. */
  open: number;
}

/** Weekly opened / closed / open counts for the last `weeks` full weeks plus the current partial week. */
export function weekly(items: WorkItem[], weeks: number, now = new Date()): Week[] {
  const cur = weekStart(now);
  const first = addWeeks(cur, -weeks);
  const out: Week[] = Array.from({ length: weeks + 1 }, (_, k) => ({ start: addWeeks(first, k), opened: 0, closed: 0, open: 0 }));
  const idx = (d: Date) => Math.floor((weekStart(d).getTime() - first.getTime()) / (7 * DAY) + 0.01);
  const opens: number[] = [];
  const closes: number[] = [];
  for (const i of items) {
    const c = new Date(i.created);
    const k = idx(c);
    if (k >= 0 && k < out.length) out[k].opened++;
    const done = closedAtOf(i);
    if (done) { const j = idx(done); if (j >= 0 && j < out.length) out[j].closed++; }
    opens.push(c.getTime());
    closes.push(done ? done.getTime() : Infinity);
  }
  for (const w of out) {
    const end = Math.min(addWeeks(w.start, 1).getTime(), now.getTime());
    let n = 0;
    for (let k = 0; k < opens.length; k++) if (opens[k] < end && closes[k] >= end) n++;
    w.open = n;
  }
  return out;
}

/** Full-week opened counts from the first ticket to last week (for fitting). */
function history(items: WorkItem[], now: Date) {
  if (!items.length) return [] as { start: Date; n: number }[];
  const cur = weekStart(now);
  const firstT = Math.min(...items.map((i) => new Date(i.created).getTime()));
  const first = weekStart(new Date(firstT));
  const n = Math.max(0, Math.round((cur.getTime() - first.getTime()) / (7 * DAY)));
  const counts = new Array(n).fill(0);
  for (const i of items) {
    const k = Math.round((weekStart(new Date(i.created)).getTime() - first.getTime()) / (7 * DAY));
    if (k >= 0 && k < n) counts[k]++;
  }
  // Skip the thin start of the history (before the export really begins).
  let s = 0;
  const mean = counts.reduce((a, b) => a + b, 0) / Math.max(1, n);
  while (s < n - 8 && counts[s] < mean * 0.25) s++;
  return counts.slice(s).map((c, k) => ({ start: addWeeks(first, s + k), n: c }));
}

const midMonth = (d: Date) => new Date(d.getTime() + 3 * DAY).getMonth();

/** Month-of-year index (1 = average) from years of history, shrunk toward 1; flat when there's under ~1.5 years. */
function seasonal(h: { start: Date; n: number }[]) {
  const idx = new Array(12).fill(1);
  if (h.length < 78) return idx;
  const mean = h.reduce((a, b) => a + b.n, 0) / h.length;
  if (!mean) return idx;
  const sum = new Array(12).fill(0), cnt = new Array(12).fill(0);
  for (const w of h) { const m = midMonth(w.start); sum[m] += w.n; cnt[m]++; }
  for (let m = 0; m < 12; m++) if (cnt[m] >= 6) idx[m] = 1 + 0.5 * (sum[m] / cnt[m] / mean - 1);
  return idx;
}

function fit(h: { start: Date; n: number }[]) {
  const season = seasonal(h);
  const recent = h.slice(-12);
  // Deseasonalised exponentially weighted level.
  let level = recent.length ? recent[0].n / season[midMonth(recent[0].start)] : 0;
  for (const w of recent) level = 0.25 * (w.n / season[midMonth(w.start)]) + 0.75 * level;
  // Damped trend from the last 26 weeks (least squares), capped at ±3% of the level per week.
  const t = h.slice(-26).map((w) => w.n / season[midMonth(w.start)]);
  let slope = 0;
  if (t.length >= 8) {
    const n = t.length, mx = (n - 1) / 2, my = t.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    t.forEach((y, x) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; });
    slope = den ? (num / den) * 0.5 : 0;
    const cap = Math.abs(level) * 0.03;
    slope = Math.max(-cap, Math.min(cap, slope));
  }
  return { level, slope, season };
}
const predict = (m: ReturnType<typeof fit>, start: Date, h: number) => Math.max(0, (m.level + m.slope * h) * m.season[midMonth(start)]);

export interface ForecastWeek { start: Date; expected: number; low: number; high: number }
export interface Forecast {
  weeks: ForecastWeek[];
  /** Typical miss per week in the back-test (mean absolute error), and as a % of the weekly average. */
  mae: number;
  maePct: number;
  /** How much better than "same as the last 4 weeks' average" (positive = better). */
  vsNaivePct: number;
  /** Weeks of history used, and whether seasonality was learned. */
  historyWeeks: number;
  seasonal: boolean;
  trendPerWeek: number;
  /** Average opened per week over the last 12 weeks. */
  recentAvg: number;
  /** Season effect for the next 4 weeks vs average (e.g. +12%). */
  seasonPct: number;
}

export function forecast(items: WorkItem[], ahead = 8, now = new Date()): Forecast | undefined {
  const h = history(items, now);
  if (h.length < 12) return undefined;
  // Back-test: one-step-ahead predictions for the last 12 weeks, fitted only on what came before each.
  let err = 0, errNaive = 0, k = 0;
  const errs: number[] = [];
  for (let i = Math.max(12, h.length - 12); i < h.length; i++) {
    const m = fit(h.slice(0, i));
    const p = predict(m, h[i].start, 1);
    const naive = h.slice(i - 4, i).reduce((a, b) => a + b.n, 0) / 4;
    errs.push(h[i].n - p);
    err += Math.abs(h[i].n - p);
    errNaive += Math.abs(h[i].n - naive);
    k++;
  }
  const mae = k ? err / k : 0;
  const rmse = k ? Math.sqrt(errs.reduce((a, b) => a + b * b, 0) / k) : 0;
  const m = fit(h);
  const recentAvg = h.slice(-12).reduce((a, b) => a + b.n, 0) / Math.min(12, h.length);
  const cur = weekStart(now);
  const weeks: ForecastWeek[] = [];
  for (let j = 0; j < ahead; j++) {
    const start = addWeeks(cur, j);
    const e = predict(m, start, j + 1);
    // 80% band: back-test error, widening with the horizon, never narrower than Poisson noise.
    const sd = Math.max(rmse, Math.sqrt(Math.max(1, e))) * Math.sqrt(1 + j * 0.15);
    weeks.push({ start, expected: e, low: Math.max(0, e - 1.28 * sd), high: e + 1.28 * sd });
  }
  const next4 = weeks.slice(0, 4).map((w) => m.season[midMonth(w.start)]);
  return {
    weeks,
    mae,
    maePct: recentAvg ? (mae / recentAvg) * 100 : 0,
    vsNaivePct: errNaive ? ((errNaive - err) / errNaive) * 100 : 0,
    historyWeeks: h.length,
    seasonal: m.season.some((x) => Math.abs(x - 1) > 1e-9),
    trendPerWeek: m.slope * (m.season[midMonth(cur)] ?? 1),
    recentAvg,
    seasonPct: (next4.reduce((a, b) => a + b, 0) / next4.length - 1) * 100,
  };
}

/** Tickets opened by weekday (Mon..Sun) x hour (0..23) over the last `weeks` weeks, as weekly averages. */
export function whenTheyArrive(items: WorkItem[], weeks = 26, now = new Date()) {
  const from = addWeeks(weekStart(now), -weeks);
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
  let n = 0;
  for (const i of items) {
    const d = new Date(i.created);
    if (d < from || d > now) continue;
    grid[(d.getDay() + 6) % 7][d.getHours()]++;
    n++;
  }
  return { grid: grid.map((r) => r.map((v) => v / weeks)), total: n, weeks };
}

export interface Riser { label: string; recent: number; usual: number; ratio: number }
/** Categories (sub-category, department ...) arriving faster in the last 4 weeks than their usual 4-week pace. */
export function risers(items: WorkItem[], key: (i: WorkItem) => string | undefined, now = new Date(), min = 3): Riser[] {
  const end = now.getTime();
  const r0 = end - 28 * DAY, b0 = r0 - 26 * 7 * DAY;
  const recent = new Map<string, number>(), base = new Map<string, number>();
  for (const i of items) {
    const k = key(i);
    if (!k) continue;
    const t = new Date(i.created).getTime();
    if (t >= r0 && t <= end) recent.set(k, (recent.get(k) ?? 0) + 1);
    else if (t >= b0 && t < r0) base.set(k, (base.get(k) ?? 0) + 1);
  }
  const out: Riser[] = [];
  for (const [label, n] of recent) {
    const usual = ((base.get(label) ?? 0) / 26) * 4;
    const ratio = n / Math.max(0.5, usual);
    if (n >= min && ratio >= 1.5) out.push({ label, recent: n, usual, ratio });
  }
  return out.sort((a, b) => b.ratio * b.recent - a.ratio * a.recent).slice(0, 8);
}

/** Where the open count is heading: expected arrivals vs the recent closing pace. */
export function outlook(items: WorkItem[], f: Forecast | undefined, now = new Date()) {
  const w = weekly(items, 8, now).slice(0, -1);
  const closePace = w.reduce((a, b) => a + b.closed, 0) / Math.max(1, w.length);
  const openNow = items.filter((i) => !isClosedItem(i)).length;
  const in4 = f ? f.weeks.slice(0, 4).reduce((a, b) => a + b.expected, 0) : 0;
  return { closePace, openNow, expectedIn4: in4, openIn4: Math.max(0, Math.round(openNow + in4 - closePace * 4)) };
}

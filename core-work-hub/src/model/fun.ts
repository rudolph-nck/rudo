// Panda HQ: team goals (the dumpster), a points leaderboard that rewards hard, on-time and backlog work over raw
// volume, badges and monthly awards; plus the time-to-assign and closed-ticket ranking analytics for Overview.
import { businessMinutesBetween, standardOf, workdayMinutes } from './comms';
import { analysts, findPerson } from './logic';
import { priorityStandardOf } from './priority';
import type { HubConfig, HubState, Priority, WorkItem } from './types';

export type Period = 'week' | 'month' | 'quarter' | 'year' | 'all';
export const PERIOD_LABEL: Record<Period, string> = { week: 'This week', month: 'This month', quarter: 'This quarter', year: 'This year', all: 'All time' };

export interface FunConfig {
  /** Team goals: tickets closed (all of Core). All-time is a ladder of tiers. */
  goals: { week: number; month: number; year: number; allTime: number[] };
  /** What the team gets when a goal is hit, and for the monthly awards. Plain text, set by Nick. */
  prizes: { week: string; month: string; year: string; allTime: string; awards: string };
  /** Show individual rankings (off = team goals only). */
  leaderboard: boolean;
}

export const DEFAULT_FUN: FunConfig = {
  goals: { week: 25, month: 100, year: 1200, allTime: [2500, 5000, 10000] },
  prizes: {
    week: 'Shout-out in the Teams channel',
    month: 'Team treat (coffee or donuts)',
    year: 'Team lunch + a half day off for everyone',
    allTime: 'Trophy for the team space + bragging rights',
    awards: '$10 gift card for each monthly award winner',
  },
  leaderboard: true,
};
export const funOf = (c: HubConfig): FunConfig => {
  const f = (c.fun ?? {}) as Partial<FunConfig>;
  return { ...DEFAULT_FUN, ...f, goals: { ...DEFAULT_FUN.goals, ...(f.goals ?? {}) }, prizes: { ...DEFAULT_FUN.prizes, ...(f.prizes ?? {}) } };
};

export const POINTS: Record<Priority, number> = { P1: 8, P2: 5, P3: 3, P4: 2 };
export const ON_TIME_BONUS = 2;
export const BACKLOG_BONUS = 3;

// ---------------------------------------------------------------- periods (local time, weeks start Monday)
export function periodStart(p: Period, now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (p === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  else if (p === 'month') d.setDate(1);
  else if (p === 'quarter') { d.setDate(1); d.setMonth(d.getMonth() - (d.getMonth() % 3)); }
  else if (p === 'year') { d.setMonth(0, 1); }
  else return new Date(0);
  return d;
}
const monthStart = (y: number, m: number) => new Date(y, m, 1);

// ---------------------------------------------------------------- closes
export interface Close {
  item: WorkItem;
  at: Date;
  /** Hub person credited (the owner when it closed), if they're on the hub. */
  user?: string;
  priority: Priority;
  onTime: boolean;
  backlog: boolean;
  points: number;
}

export function closes(state: HubState): Close[] {
  const cfg = state.config;
  const std = standardOf(cfg);
  const ps = priorityStandardOf(cfg);
  const day = workdayMinutes(std);
  const start = ps.startFrom ? new Date(ps.startFrom + 'T00:00:00') : undefined;
  const out: Close[] = [];
  for (const i of state.items.values()) {
    if (!i.done || (i.column !== 'Done' && !i.sourceClosed)) continue;
    const at = new Date(i.done);
    const created = new Date(i.created);
    if (Number.isNaN(at.getTime())) continue;
    const pri: Priority = i.priority ?? 'P4';
    const took = Math.max(0, businessMinutesBetween(std, created, at)) / day;
    const onTime = took <= ps[pri].resolveDays + 1e-9;
    const backlog = start ? created < start : took > 60;
    const user = i.owner && findPerson(cfg, i.owner) ? i.owner : undefined;
    out.push({ item: i, at, user, priority: pri, onTime, backlog, points: POINTS[pri] + (onTime ? ON_TIME_BONUS : 0) + (backlog ? BACKLOG_BONUS : 0) });
  }
  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
}

const inRange = (c: Close, from: Date, to?: Date) => c.at >= from && (!to || c.at < to);

// ---------------------------------------------------------------- team goals (the dumpster)
export interface GoalProgress {
  period: 'week' | 'month' | 'year' | 'all';
  count: number;
  goal: number;
  pct: number;
  reached: boolean;
  /** All time: the tier reached (0 = none yet) and the next tier. */
  tier?: number;
  /** Play the fire show (once per viewer per key): goal reached, or a new all-time tier. */
  celebrate?: boolean;
  /** Stable id of this achievement (e.g. "month-2026-11"), so the fire show plays once per viewer. */
  key: string;
  prize: string;
}

export function goals(state: HubState, now = new Date()): GoalProgress[] {
  const f = funOf(state.config);
  const all = closes(state);
  const n = (p: Period) => all.filter((c) => inRange(c, periodStart(p, now))).length;
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const mk = (period: GoalProgress['period'], count: number, goal: number, key: string, prize: string, tier?: number): GoalProgress => ({ period, count, goal, pct: goal ? count / goal : 0, reached: count >= goal, key, prize, tier });
  const total = all.length;
  const tiers = [...f.goals.allTime].sort((a, b) => a - b);
  const reachedTiers = tiers.filter((t) => total >= t).length;
  const nextTier = tiers[reachedTiers] ?? tiers[tiers.length - 1] ?? 1000;
  return [
    mk('week', n('week'), f.goals.week, `week-${ymd(periodStart('week', now))}`, f.prizes.week),
    mk('month', n('month'), f.goals.month, `month-${ymd(periodStart('month', now)).slice(0, 7)}`, f.prizes.month),
    mk('year', n('year'), f.goals.year, `year-${now.getFullYear()}`, f.prizes.year),
    // All time: fill toward the next tier; celebrate once per tier reached; stay on fire once every tier is done.
    { ...mk('all', total, nextTier, `all-${reachedTiers}`, f.prizes.allTime, reachedTiers), reached: reachedTiers === tiers.length, celebrate: reachedTiers > 0 },
  ].map((g) => ({ ...g, celebrate: g.period === 'all' ? (g as GoalProgress).celebrate : g.reached }));
}

// ---------------------------------------------------------------- leaderboard, badges, awards
export type BadgeId = 'firefighter' | 'backlog-buster' | 'on-time-ace' | 'streak' | 'centurion';
export const BADGES: Record<BadgeId, { label: string; icon: string; how: string }> = {
  firefighter: { label: 'Firefighter', icon: '🔥', how: 'Closed a P1' },
  'backlog-buster': { label: 'Backlog Buster', icon: '🦝', how: 'Closed 3+ backlog tickets' },
  'on-time-ace': { label: 'On-time Ace', icon: '⏱️', how: '90%+ closed within target (5+ closes)' },
  streak: { label: 'Streak', icon: '⚡', how: 'Closed something 5 business days in a row' },
  centurion: { label: 'Heavy Lifter', icon: '🏋️', how: '25+ closes in the period' },
};

export interface Standing {
  user: string;
  closes: number;
  points: number;
  onTimePct: number;
  p1: number;
  backlog: number;
  badges: BadgeId[];
}

function badgesFor(list: Close[]): BadgeId[] {
  const b: BadgeId[] = [];
  if (list.some((c) => c.priority === 'P1')) b.push('firefighter');
  if (list.filter((c) => c.backlog).length >= 3) b.push('backlog-buster');
  if (list.length >= 5 && list.filter((c) => c.onTime).length / list.length >= 0.9) b.push('on-time-ace');
  // 5 business days in a row with a close
  const days = [...new Set(list.map((c) => { const d = new Date(c.at); d.setHours(0, 0, 0, 0); return d.getTime(); }))].sort((a, b) => a - b);
  let run = 1;
  let best = days.length ? 1 : 0;
  for (let k = 1; k < days.length; k++) {
    const prev = new Date(days[k - 1]);
    const next = new Date(prev);
    do next.setDate(next.getDate() + 1); while (next.getDay() === 0 || next.getDay() === 6);
    run = next.getTime() === days[k] ? run + 1 : 1;
    best = Math.max(best, run);
  }
  if (best >= 5) b.push('streak');
  if (list.length >= 25) b.push('centurion');
  return b;
}

export function leaderboard(state: HubState, period: Period, now = new Date(), from?: Date, to?: Date): Standing[] {
  const start = from ?? periodStart(period, now);
  const all = closes(state).filter((c) => c.user && inRange(c, start, to));
  return analysts(state.config)
    .map((p) => {
      const mine = all.filter((c) => c.user === p.username);
      return {
        user: p.username,
        closes: mine.length,
        points: mine.reduce((s, c) => s + c.points, 0),
        onTimePct: mine.length ? Math.round((mine.filter((c) => c.onTime).length / mine.length) * 100) : 0,
        p1: mine.filter((c) => c.priority === 'P1').length,
        backlog: mine.filter((c) => c.backlog).length,
        badges: badgesFor(mine),
      };
    })
    .sort((a, b) => b.points - a.points || b.closes - a.closes || a.user.localeCompare(b.user));
}

export interface Award {
  id: 'top' | 'backlog' | 'ontime' | 'improved' | 'rookie';
  label: string;
  how: string;
  winner?: string;
  value?: string;
}

/** Monthly awards: several categories, so different people can win (juniors have their own). */
export function monthlyAwards(state: HubState, year: number, month: number): Award[] {
  const from = monthStart(year, month);
  const to = monthStart(year, month + 1);
  const cur = leaderboard(state, 'month', from, from, to).filter((s) => s.closes > 0);
  const prev = leaderboard(state, 'month', from, monthStart(year, month - 1), from);
  const cfg = state.config;
  const top = cur[0];
  const backlog = [...cur].sort((a, b) => b.backlog - a.backlog || b.points - a.points)[0];
  const ontime = cur.filter((s) => s.closes >= 5).sort((a, b) => b.onTimePct - a.onTimePct || b.closes - a.closes)[0];
  const improved = cur
    .map((s) => ({ s, d: s.points - (prev.find((x) => x.user === s.user)?.points ?? 0) }))
    .filter((x) => x.d > 0)
    .sort((a, b) => b.d - a.d)[0];
  const rookie = cur.filter((s) => findPerson(cfg, s.user)?.level === 'junior')[0];
  return [
    { id: 'top', label: 'Top Points', how: 'Most points this month', winner: top?.user, value: top ? `${top.points} pts` : undefined },
    { id: 'backlog', label: 'Backlog Buster', how: 'Most backlog tickets closed', winner: backlog?.backlog ? backlog.user : undefined, value: backlog?.backlog ? `${backlog.backlog} closed` : undefined },
    { id: 'ontime', label: 'On-time Ace', how: 'Best on-time rate (5+ closes)', winner: ontime?.user, value: ontime ? `${ontime.onTimePct}%` : undefined },
    { id: 'improved', label: 'Most Improved', how: 'Biggest jump in points vs last month', winner: improved?.s.user, value: improved ? `+${improved.d} pts` : undefined },
    { id: 'rookie', label: 'Rookie of the Month', how: 'Top points among junior analysts', winner: rookie?.user, value: rookie ? `${rookie.points} pts` : undefined },
  ];
}

// ---------------------------------------------------------------- Overview analytics
export interface AssignStats {
  /** Median business hours from opened to assigned, per week (oldest first). */
  weekly: { week: string; median?: number; n: number }[];
  thisMonthMedian?: number;
  lastMonthMedian?: number;
  /** Share assigned within one business hour (last 90 days). */
  within1h: number;
  /** Open tickets with nobody assigned, longest first. */
  waiting: { item: WorkItem; hours: number }[];
}

const median = (xs: number[]) => {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 10) / 10;
};

export function assignStats(state: HubState, weeks = 12, now = new Date()): AssignStats {
  const std = standardOf(state.config);
  const sd = [...state.items.values()].filter((i) => i.source === 'SD');
  const timed = sd
    .filter((i) => i.sd_assigned && i.sd_assigned >= i.created)
    .map((i) => ({ i, h: businessMinutesBetween(std, new Date(i.created), new Date(i.sd_assigned!)) / 60, created: new Date(i.created) }));
  const wk0 = periodStart('week', now);
  const weekly = Array.from({ length: weeks }, (_, k) => {
    const from = new Date(wk0);
    from.setDate(from.getDate() - (weeks - 1 - k) * 7);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    const xs = timed.filter((t) => t.created >= from && t.created < to).map((t) => t.h);
    return { week: `${from.getMonth() + 1}/${from.getDate()}`, median: median(xs), n: xs.length };
  });
  const m0 = periodStart('month', now);
  const m1 = new Date(m0.getFullYear(), m0.getMonth() - 1, 1);
  const since90 = new Date(now.getTime() - 90 * 864e5);
  const recent = timed.filter((t) => t.created >= since90);
  const waiting = sd
    .filter((i) => i.column !== 'Done' && !i.sourceClosed && !i.owner && !i.source_owner && !i.stale)
    .map((i) => ({ item: i, hours: Math.round(businessMinutesBetween(std, new Date(i.created), now) / 6) / 10 }))
    .sort((a, b) => b.hours - a.hours);
  return {
    weekly,
    thisMonthMedian: median(timed.filter((t) => t.created >= m0).map((t) => t.h)),
    lastMonthMedian: median(timed.filter((t) => t.created >= m1 && t.created < m0).map((t) => t.h)),
    within1h: recent.length ? Math.round((recent.filter((t) => t.h <= 1).length / recent.length) * 100) : 0,
    waiting,
  };
}

/** Closed tickets per person per month, last `months` months (oldest first), plus the period ranking. */
export function closedHistory(state: HubState, months = 6, now = new Date()) {
  const all = closes(state).filter((c) => c.user);
  const cols = Array.from({ length: months }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - k), 1);
    return { label: d.toLocaleDateString(undefined, { month: 'short' }), from: d, to: new Date(d.getFullYear(), d.getMonth() + 1, 1) };
  });
  const rows = analysts(state.config).map((p) => ({
    user: p.username,
    counts: cols.map((c) => all.filter((x) => x.user === p.username && inRange(x, c.from, c.to)).length),
  }));
  return { cols: cols.map((c) => c.label), rows };
}

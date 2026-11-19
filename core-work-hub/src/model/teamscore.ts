import type { HubConfig, HubState, TeamCriterion, WorkItem } from './types';

/**
 * Team score: every open project gets one department-wide score, unique across projects, so there is always a
 * bigger priority when a decision has to be made.
 *
 *  - Each team member rates a project 1–5 on the criteria; the latest rating per person counts.
 *  - Base score (0–100) = weighted average of the team's ratings (effort is inverted: less effort scores higher).
 *  - Ties are flagged for the daily meeting; the team decides which goes first and that decision is recorded as a
 *    set score. A set score must be unique (the hub refuses one already in use).
 */

export const DEFAULT_CRITERIA: TeamCriterion[] = [
  {
    key: 'value',
    label: 'Business value',
    hint: 'How much it helps members, staff or the business',
    weight: 30,
    levels: [
      'Nice to have. Little measurable benefit.',
      'Helps one team or one process a little.',
      'Clear benefit to a department or a key process.',
      'Major benefit to several departments, or directly to members.',
      'Strategic: organization-wide or a leadership priority.',
    ],
  },
  {
    key: 'risk',
    label: 'Risk & compliance',
    hint: 'Exam findings, security, audit, outage risk if we don’t do it',
    weight: 25,
    levels: [
      'No real risk if it waits.',
      'Minor risk; a workaround exists.',
      'Moderate: security or audit improvement, or an aging system.',
      'High: open audit finding, security gap, or a likely outage.',
      'Critical: exam or regulatory deadline, active exposure, or end of vendor support.',
    ],
  },
  {
    key: 'urgency',
    label: 'Urgency',
    hint: 'When it’s needed',
    weight: 20,
    levels: [
      'No date. Any time this year.',
      'Wanted within 6 months.',
      'Needed this quarter (within 3 months).',
      'Needed within a month.',
      'Hard deadline within 2 weeks, or already late.',
    ],
    short: ['this yr', '≤6 mo', '≤3 mo', '≤1 mo', '≤2 wk'],
  },
  {
    key: 'reach',
    label: 'Reach',
    hint: 'How many people or systems it touches',
    weight: 15,
    levels: [
      'One person or a single system.',
      'One team (under 10 people).',
      'One department, or several systems.',
      'Several departments or the branch network.',
      'The whole organization, or members directly.',
    ],
  },
  {
    key: 'effort',
    label: 'Effort',
    hint: 'Total hands-on work for the team, not calendar time. Less effort scores higher.',
    weight: 10,
    invert: true,
    levels: [
      'XS · up to 2 days of work (≤16 hours).',
      'S · about a week of work (2–5 days, 16–40 hours).',
      'M · 1–3 weeks of work (40–120 hours).',
      'L · 1–2 months of work (120–320 hours).',
      'XL · more than 2 months (320+ hours). Split it into smaller projects.',
    ],
    short: ['≤2 days', '~1 week', '1–3 wks', '1–2 mos', '2+ mos'],
    points: [1, 2, 3, 5, 8],
    hours: [[0, 16], [16, 40], [40, 120], [120, 320], [320, null]],
  },
];

/** Built-in scale text, used when a config's criterion has none of its own. */
const BUILTIN = new Map(DEFAULT_CRITERIA.map((c) => [c.key, c]));
const withDefaults = (c: TeamCriterion): TeamCriterion => ({ ...BUILTIN.get(c.key), ...c, levels: c.levels ?? BUILTIN.get(c.key)?.levels, short: c.short ?? BUILTIN.get(c.key)?.short, points: c.points ?? BUILTIN.get(c.key)?.points, hours: c.hours ?? BUILTIN.get(c.key)?.hours });

/** Effort criterion (the one with points), if configured. */
export const effortCriterion = (criteria: TeamCriterion[]) => criteria.find((c) => c.points?.length === 5);

/** Effort points for a team-average effort rating (rounded to the nearest level). */
export function effortPoints(c: TeamCriterion, avg: number) {
  return c.points![Math.min(4, Math.max(0, Math.round(avg) - 1))];
}

/** Plain-language time for a team-average effort rating, e.g. "1–3 weeks of work". */
export function effortLabel(c: TeamCriterion, avg: number) {
  const lvl = Math.min(4, Math.max(0, Math.round(avg) - 1));
  return c.levels?.[lvl]?.replace(/^\w+ · /, '').replace(/\.$/, '') ?? '';
}

export const criteriaOf = (config: HubConfig) => (config.teamCriteria?.length ? config.teamCriteria.map(withDefaults) : DEFAULT_CRITERIA);

/** Open, top-level work in the Projects bucket (tasks under a project share its score). */
export const isProject = (i: WorkItem) => i.bucket === 'Project' && !i.parent_id && i.column !== 'Done' && !i.stale;

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface TeamScore {
  /** Team average per criterion (1–5), for criteria anyone rated. */
  avg: Record<string, number>;
  /** Max − min rating per criterion: 2+ means the team disagrees. */
  spread: Record<string, number>;
  raters: string[];
  /** Weighted score from the ratings (0–100, 1 decimal); undefined until someone rates every criterion. */
  base?: number;
  /** Score the team set (tie-break or decision). Wins over base. */
  set?: { score: number; by: string; ts: string; reason?: string };
  /** The score that counts. */
  score?: number;
}

export function computeTeamScore(item: WorkItem, criteria: TeamCriterion[]): TeamScore {
  const ratings = item.team?.ratings ?? {};
  const raters = Object.keys(ratings).filter((u) => Object.keys(ratings[u] ?? {}).length);
  const avg: Record<string, number> = {};
  const spread: Record<string, number> = {};
  for (const c of criteria) {
    const vals = raters.map((u) => ratings[u][c.key]).filter((v): v is number => typeof v === 'number');
    if (!vals.length) continue;
    avg[c.key] = vals.reduce((a, b) => a + b, 0) / vals.length;
    spread[c.key] = Math.max(...vals) - Math.min(...vals);
  }
  let base: number | undefined;
  if (criteria.every((c) => avg[c.key] !== undefined)) {
    const wsum = criteria.reduce((s, c) => s + c.weight, 0) || 1;
    const total = criteria.reduce((s, c) => {
      const n = (avg[c.key] - 1) / 4;
      return s + c.weight * (c.invert ? 1 - n : n);
    }, 0);
    base = round1((100 * total) / wsum);
  }
  const set = item.team?.set;
  return { avg, spread, raters, base, set, score: set ? set.score : base };
}

export interface TeamRow {
  item: WorkItem;
  ts: TeamScore;
  /** 1 = highest team score. Undefined while unscored. */
  position?: number;
  /** Other projects with exactly the same score. */
  tiedWith: WorkItem[];
}

/** All open projects, highest team score first, with ties and unscored projects called out. */
export function teamBoard(state: HubState) {
  const criteria = criteriaOf(state.config);
  const rows: TeamRow[] = [...state.items.values()].filter(isProject).map((item) => ({ item, ts: computeTeamScore(item, criteria), tiedWith: [] }));
  const scored = rows.filter((r) => r.ts.score !== undefined).sort((a, b) => b.ts.score! - a.ts.score! || a.item.created.localeCompare(b.item.created));
  scored.forEach((r, i) => {
    r.position = i + 1;
    r.tiedWith = scored.filter((o) => o !== r && o.ts.score === r.ts.score).map((o) => o.item);
  });
  const ties: TeamRow[][] = [];
  const seen = new Set<number>();
  for (const r of scored) {
    if (!r.tiedWith.length || seen.has(r.ts.score!)) continue;
    seen.add(r.ts.score!);
    ties.push(scored.filter((o) => o.ts.score === r.ts.score));
  }
  const unscored = rows.filter((r) => r.ts.score === undefined).sort((a, b) => a.item.created.localeCompare(b.item.created));
  return { criteria, rows: [...scored, ...unscored], scored, unscored, ties };
}

/** Lowest free score strictly above `score` (0.1 steps), avoiding every score in use. */
export function nextFreeAbove(score: number, used: number[]) {
  let s = round1(score + 0.1);
  while (used.includes(s)) s = round1(s + 0.1);
  return s;
}

/** Scores currently in use by other open projects (for uniqueness checks). */
export function usedScores(state: HubState, exceptId?: string) {
  const criteria = criteriaOf(state.config);
  return [...state.items.values()]
    .filter((i) => isProject(i) && i.id !== exceptId)
    .map((i) => computeTeamScore(i, criteria).score)
    .filter((s): s is number => s !== undefined);
}

// ---------------------------------------------------------------- velocity

export interface Velocity {
  /** Two-week periods, oldest first: effort points of projects finished in each. */
  periods: { from: string; to: string; points: number; projects: number }[];
  /** Average points per two weeks over the periods. */
  average: number;
  /** Points of projects in Doing right now. */
  inProgress: number;
  /** Points of projects in To Do and Ready. */
  queued: number;
}

/**
 * Project velocity in effort points per two weeks (the rotation cadence). Uses the team's effort rating; a
 * finished project with no effort rating counts as unknown and is left out.
 */
export function velocity(state: HubState, periods = 6, now = new Date()): Velocity | undefined {
  const criteria = criteriaOf(state.config);
  const ec = effortCriterion(criteria);
  if (!ec) return undefined;
  const all = [...state.items.values()].filter((i) => i.bucket === 'Project' && !i.parent_id && !i.stale);
  const pts = (i: WorkItem) => {
    const a = computeTeamScore(i, criteria).avg[ec.key];
    return a === undefined ? undefined : effortPoints(ec, a);
  };
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date(now);
  const out: Velocity['periods'] = [];
  for (let k = periods - 1; k >= 0; k--) {
    const to = new Date(end.getTime() - k * 14 * 864e5);
    const from = new Date(to.getTime() - 13 * 864e5);
    const done = all.filter((i) => i.column === 'Done' && i.done && i.done.slice(0, 10) >= day(from) && i.done.slice(0, 10) <= day(to));
    const known = done.map(pts).filter((p): p is number => p !== undefined);
    out.push({ from: day(from), to: day(to), points: known.reduce((a, b) => a + b, 0), projects: done.length });
  }
  const sum = (xs: WorkItem[]) => xs.map(pts).filter((p): p is number => p !== undefined).reduce((a, b) => a + b, 0);
  return {
    periods: out,
    average: Math.round((out.reduce((s, p) => s + p.points, 0) / out.length) * 10) / 10,
    inProgress: sum(all.filter((i) => i.column === 'Doing')),
    queued: sum(all.filter((i) => i.column === 'To Do' || i.column === 'Ready')),
  };
}

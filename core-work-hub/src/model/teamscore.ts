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
  { key: 'value', label: 'Business value', hint: 'How much it helps members, staff or the business', weight: 30 },
  { key: 'risk', label: 'Risk & compliance', hint: 'Exam findings, security, audit, outage risk', weight: 25 },
  { key: 'urgency', label: 'Urgency', hint: 'Deadlines, contracts, end-of-life dates', weight: 20 },
  { key: 'reach', label: 'Reach', hint: 'How many people or systems it touches', weight: 15 },
  { key: 'effort', label: 'Effort', hint: '1 = small, 5 = very large (less effort scores higher)', weight: 10, invert: true },
];

export const criteriaOf = (config: HubConfig) => (config.teamCriteria?.length ? config.teamCriteria : DEFAULT_CRITERIA);

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

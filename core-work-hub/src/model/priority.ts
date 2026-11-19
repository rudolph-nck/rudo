// The IT Core priority standard: per-priority targets, aging (so small work isn't starved), bump tracking,
// and the daily stand-up list. All clocks are business time (Mon/Tue/Wed/Fri 8:30-5:30, Thu 10:00-5:30).
import { addBusinessDays, addBusinessMinutes, businessMinutesBetween, commStatus, endOfBusinessDay, standardOf, workdayMinutes } from './comms';
import { currentDispatch, findPerson, ownerList, todayISO } from './logic';
import { isStatus } from './replay';
import type { CommStandard, HubConfig, HubState, Priority, PriorityStandard, PriorityTarget, WorkItem } from './types';
import { STANDUP_LABEL } from './types';

export const PRIORITIES: Priority[] = ['P1', 'P2', 'P3', 'P4'];

export const DEFAULT_PRIORITY_STANDARD: PriorityStandard = {
  P1: { respond: 1, respondUnit: 'h', update: 1, updateUnit: 'h', resolveDays: 1 },
  P2: { respond: 4, respondUnit: 'h', update: 1, updateUnit: 'd', resolveDays: 3 },
  P3: { respond: 1, respondUnit: 'd', update: 2.5, updateUnit: 'd', resolveDays: 10 },
  P4: { respond: 1, respondUnit: 'd', update: 5, updateUnit: 'd', resolveDays: 20 },
  atRiskPct: 0.5,
  bumpFlag: 3,
  deptIdleDays: 10,
  backlogWeeklyGoal: 10,
  backlogDaily: 5,
};

export const PRIORITY_MEANING: Record<Priority, string> = {
  P1: 'Critical: a core or member-facing system is down or badly impaired with no workaround, or regulatory / money-movement risk. All hands until fixed; on-call covers after hours.',
  P2: 'High: one department or process significantly affected, member-facing problem with a workaround, or a hard deadline.',
  P3: 'Medium: one team or user affected, workaround exists; non-urgent fix or change.',
  P4: 'Low: requests, questions, minor changes, small improvements.',
};

export function priorityStandardOf(c: HubConfig): PriorityStandard {
  const p = c.priorityStandard ?? {};
  const merged = { ...DEFAULT_PRIORITY_STANDARD, ...p } as PriorityStandard;
  for (const k of PRIORITIES) merged[k] = { ...DEFAULT_PRIORITY_STANDARD[k], ...(p[k] ?? {}) };
  return merged;
}

/** Add an amount of business hours or (possibly fractional) business days. */
export function addBusiness(std: CommStandard, from: Date, n: number, unit: 'h' | 'd'): Date {
  if (unit === 'h') return addBusinessMinutes(std, from, n * 60);
  if (Number.isInteger(n)) return addBusinessDays(std, from, n);
  return addBusinessMinutes(std, from, n * workdayMinutes(std));
}

export const fmtTarget = (n: number, unit: 'h' | 'd') =>
  unit === 'h' ? `${n} business hour${n === 1 ? '' : 's'}` : n === 1 ? '1 business day' : n === 2.5 ? 'twice a week' : n === 5 ? 'weekly' : `${n} business days`;
export const fmtResolve = (t: PriorityTarget, p: Priority) => (p === 'P1' && t.resolveDays === 1 ? 'same business day' : `${t.resolveDays} business day${t.resolveDays === 1 ? '' : 's'}`);

// ---------------------------------------------------------------- aging

export type AgeStage = 'ok' | 'risk' | 'past' | 'double' | 'waiting';
const RANK: Record<Priority, number> = { P1: 1, P2: 2, P3: 3, P4: 4 };
const byRank = (n: number) => PRIORITIES[Math.max(0, Math.min(3, n - 1))];

export interface Age {
  priority: Priority;
  /** No priority yet (not graded, none in Service Desk): treated as P4 until graded. */
  ungraded: boolean;
  /** Priority after aging: past target raises one level, twice the target raises two (never to P1). */
  effective: Priority;
  raised: number;
  stage: AgeStage;
  /** When the resolution clock started (created, or the standard's start date for older tickets). */
  clockStart: Date;
  due: Date;
  /** Business days on the clock so far, and the target. */
  dayOf: number;
  target: number;
  pct: number;
  /** Created before the standard started. */
  backlog: boolean;
  /** Calendar days since the ticket was opened. */
  trueAgeDays: number;
  /** Ordering weight: priority, true age against target, and bumps. Higher = more pressing. */
  score: number;
  commitment?: { date: string; missed: boolean };
}

const WEIGHT: Record<Priority, number> = { P1: 1000, P2: 300, P3: 100, P4: 40 };

export const isOpen = (cfg: HubConfig, i: WorkItem) => i.column !== 'Done' && !i.stale && !i.sourceClosed && !isStatus(cfg.closedStatuses, i.source_status ?? '');

export function ageOf(state: HubState, i: WorkItem, now = new Date()): Age | undefined {
  const cfg = state.config;
  if (!isOpen(cfg, i)) return undefined;
  const pri: Priority = i.priority ?? 'P4';
  const std = standardOf(cfg);
  const ps = priorityStandardOf(cfg);
  const t = ps[pri];
  const created = new Date(i.created);
  const start = ps.startFrom ? new Date(ps.startFrom + 'T00:00:00') : undefined;
  const backlog = !!start && created < start;
  const clockStart = backlog ? start! : created;
  const due = pri === 'P1' && t.resolveDays <= 1 ? endOfBusinessDay(std, clockStart) : addBusinessDays(std, clockStart, t.resolveDays);
  const total = Math.max(1, businessMinutesBetween(std, clockStart, due));
  const spent = now > clockStart ? businessMinutesBetween(std, clockStart, now) : 0;
  const pct = spent / total;
  const day = workdayMinutes(std);
  const waiting = i.column === 'Waiting';
  let stage: AgeStage = pct >= 2 ? 'double' : pct >= 1 ? 'past' : pct >= ps.atRiskPct ? 'risk' : 'ok';
  if (waiting && stage !== 'ok') stage = 'waiting';
  // Aging raises one level past target and two at twice the target, but never to P1 (only a person does that).
  const steps = waiting ? 0 : stage === 'double' ? 2 : stage === 'past' ? 1 : 0;
  const effective = pri === 'P1' ? 'P1' : byRank(Math.max(2, RANK[pri] - steps));
  const trueAgeDays = Math.max(0, Math.floor((now.getTime() - created.getTime()) / 864e5));
  // True age counts for ordering even before the standard started, so old P4s still rise above new ones.
  const trueBizDays = Math.max(0, businessMinutesBetween(std, created, now) / day);
  const score = Math.round(WEIGHT[pri] * (1 + trueBizDays / Math.max(1, t.resolveDays)) * (1 + 0.1 * (i.bumps ?? 0)));
  const commitment = i.commitment ? { date: i.commitment.date, missed: todayISO(now) > i.commitment.date } : undefined;
  return {
    priority: pri,
    ungraded: !i.priority,
    effective,
    raised: RANK[pri] - RANK[effective],
    stage,
    clockStart,
    due,
    dayOf: Math.round((spent / day) * 10) / 10,
    target: t.resolveDays,
    pct,
    backlog,
    trueAgeDays,
    score,
    commitment,
  };
}

/** "Day N" as people count it: the Nth business day on the clock (at least day 1). */
export const dayNo = (a: Pick<Age, 'dayOf'>) => Math.max(1, Math.ceil(a.dayOf - 1e-9));

// ---------------------------------------------------------------- stand-up list

export interface StandupRow {
  item: WorkItem;
  age: Age;
  why: string;
}
export interface OwnerMismatch {
  item: WorkItem;
  suggested?: string;
  owners: string[];
}
export interface Standup {
  p1: StandupRow[];
  past: StandupRow[];
  dueToday: StandupRow[];
  comingUp: StandupRow[];
  /** Must-discuss items with a check-in today. */
  discussed: number;
  bumped: StandupRow[];
  missedCommitments: StandupRow[];
  departments: { department: string; idleDays: number; open: number; oldest: StandupRow }[];
  waiting: StandupRow[];
  comm: { late: number; escalated: number };
  backlog: { total: number; byPriority: Record<Priority, number>; next: StandupRow[]; closedThisWeek: number; closedLastWeek: number; goal: number; weeksLeft?: number };
  mismatches: OwnerMismatch[];
  /** Everything that must be discussed, de-duplicated (P1s, past target, missed commitments, bumped, departments). */
  mustDiscuss: number;
}

const startOfWeek = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

export function standup(state: HubState, now = new Date()): Standup {
  const cfg = state.config;
  const std = standardOf(cfg);
  const ps = priorityStandardOf(cfg);
  const open: StandupRow[] = [];
  for (const i of state.items.values()) {
    const age = ageOf(state, i, now);
    if (age) open.push({ item: i, age, why: '' });
  }
  const byScore = (a: StandupRow, b: StandupRow) => b.age.score - a.age.score;
  const committed = (r: StandupRow) => r.age.commitment && !r.age.commitment.missed;
  const label = (r: StandupRow) => {
    const a = r.age;
    if (a.priority === 'P1') return `P1 open, business day ${dayNo(a)}`;
    if (a.stage === 'double' || a.stage === 'past') return `Day ${Math.max(dayNo(a), a.target + 1)} of ${a.target}${a.raised ? `: raised to ${a.effective}` : ''}`;
    return `Day ${dayNo(a)} of ${a.target}`;
  };
  // Backlog tickets (opened before the start date) are worked down against a weekly goal instead of all going
  // "past target" on the same day; the most pressing few join the daily list.
  const fresh = open.filter((r) => !r.age.backlog);
  const p1 = open.filter((r) => r.age.priority === 'P1').map((r) => ({ ...r, why: label(r) })).sort(byScore);
  const past = fresh
    .filter((r) => r.age.priority !== 'P1' && (r.age.stage === 'past' || r.age.stage === 'double') && !committed(r))
    .map((r) => ({ ...r, why: label(r) }))
    .sort((a, b) => RANK[a.age.effective] - RANK[b.age.effective] || byScore(a, b));
  // Last day of its target today (e.g. a P2 on day 3 of 3): address it at today's stand-up or re-prioritize.
  const eod = endOfBusinessDay(std, now);
  const dueToday = fresh
    .filter((r) => r.age.priority !== 'P1' && r.age.stage !== 'past' && r.age.stage !== 'double' && r.age.stage !== 'waiting' && r.age.due <= eod && !committed(r))
    .map((r) => ({ ...r, why: `Last day: day ${r.age.target} of ${r.age.target}, due ${r.age.due.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` }))
    .sort(byScore);
  // Coming up: reaches its target in the next two business days. A quick touch base.
  const soonLimit = endOfBusinessDay(std, addBusinessDays(std, eod, 2));
  const comingUp = fresh
    .filter((r) => r.age.priority !== 'P1' && r.age.stage !== 'past' && r.age.stage !== 'double' && r.age.stage !== 'waiting' && r.age.due > eod && r.age.due <= soonLimit && !committed(r))
    .map((r) => ({ ...r, why: `Target ${r.age.due.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} (day ${dayNo(r.age)} of ${r.age.target})` }))
    .sort((a, b) => a.age.due.getTime() - b.age.due.getTime());
  const bumped = open.filter((r) => (r.item.bumps ?? 0) >= ps.bumpFlag).map((r) => ({ ...r, why: `Passed over ${r.item.bumps} times` })).sort(byScore);
  const missedCommitments = open.filter((r) => r.age.commitment?.missed).map((r) => ({ ...r, why: `Committed for ${r.age.commitment!.date}` })).sort(byScore);
  const waiting = open.filter((r) => r.age.stage === 'waiting').map((r) => ({ ...r, why: `${r.item.source_status ?? 'Waiting'} · day ${dayNo(r.age)} of ${r.age.target}` })).sort(byScore);

  // Departments whose work hasn't been touched lately (e.g. ones that only ever send P3/P4).
  const touched = new Map<string, number>();
  const openBy = new Map<string, StandupRow[]>();
  for (const i of state.items.values()) {
    const d = i.department?.trim();
    if (!d) continue;
    const last = Math.max(...[i.started, i.done].filter(Boolean).map((x) => new Date(x!).getTime()), 0);
    touched.set(d, Math.max(touched.get(d) ?? 0, last));
  }
  for (const r of open) {
    const d = r.item.department?.trim();
    if (d && r.item.column !== 'Waiting') openBy.set(d, [...(openBy.get(d) ?? []), r]);
  }
  const day = workdayMinutes(std);
  const departments: Standup['departments'] = [];
  for (const [department, rows] of openBy) {
    const last = touched.get(department) ?? 0;
    const idleDays = last ? Math.floor(businessMinutesBetween(std, new Date(last), now) / day) : Infinity;
    // Waiting counts from each ticket's clock (the start date for backlog), so day one doesn't flag everyone.
    const oldest = [...rows].sort((a, b) => a.age.clockStart.getTime() - b.age.clockStart.getTime() || b.age.score - a.age.score)[0];
    const oldestDays = Math.floor(businessMinutesBetween(std, oldest.age.clockStart, now) / day);
    if (idleDays >= ps.deptIdleDays && oldestDays >= ps.deptIdleDays && !rows.some((r) => r.item.column === 'Doing'))
      departments.push({ department, idleDays: Number.isFinite(idleDays) ? idleDays : oldestDays, open: rows.length, oldest: { ...oldest, why: `${department}: nothing worked in ${Number.isFinite(idleDays) ? idleDays : oldestDays}+ business days` } });
  }
  departments.sort((a, b) => b.idleDays - a.idleDays);

  let late = 0;
  let escalated = 0;
  for (const i of state.items.values()) {
    const c = commStatus(state, i, now);
    if (!c) continue;
    if (c.level === 'overdue' || c.level === 'support' || c.level === 'manager') late++;
    if (c.level === 'support' || c.level === 'manager') escalated++;
  }

  const backlogRows = open.filter((r) => r.age.backlog);
  const byPriority = { P1: 0, P2: 0, P3: 0, P4: 0 } as Record<Priority, number>;
  backlogRows.forEach((r) => byPriority[r.age.priority]++);
  const start = ps.startFrom ? new Date(ps.startFrom + 'T00:00:00') : undefined;
  const wk = startOfWeek(now);
  const prevWk = new Date(wk.getTime() - 7 * 864e5);
  let closedThisWeek = 0;
  let closedLastWeek = 0;
  if (start)
    for (const i of state.items.values()) {
      if (new Date(i.created) >= start || !i.done) continue;
      const d = new Date(i.done);
      if (d >= wk) closedThisWeek++;
      else if (d >= prevWk) closedLastWeek++;
    }

  // Platform owners: open tickets whose owner isn't on that system's map.
  const mismatches: OwnerMismatch[] = [];
  for (const r of open) {
    const i = r.item;
    const sys = cfg.systems.find((s) => s.id === i.system);
    if (!sys) continue;
    const owners = [sys.primary, ...ownerList(sys.secondary), ...ownerList(sys.third)].filter(Boolean) as string[];
    if (!owners.length) continue;
    if (!i.owner || !owners.includes(i.owner)) mismatches.push({ item: i, suggested: owners[0], owners });
  }
  mismatches.sort((a, b) => (a.item.owner ? 1 : 0) - (b.item.owner ? 1 : 0) || RANK[a.item.priority ?? 'P4'] - RANK[b.item.priority ?? 'P4']);

  const next = [...backlogRows].sort(byScore).map((r) => ({ ...r, why: `${r.age.trueAgeDays} days old${r.age.ungraded ? ' · ungraded' : ''}` }));
  const pace = (closedThisWeek + closedLastWeek) / 2 || closedLastWeek || closedThisWeek;
  const must = [...p1, ...dueToday, ...past, ...missedCommitments, ...bumped, ...departments.slice(0, 5).map((d) => d.oldest), ...next.slice(0, ps.backlogDaily)];
  const ids = new Set(must.map((r) => r.item.id));
  const today = todayISO(now);
  const discussed = [...ids].filter((id) => state.items.get(id)?.standupLog?.some((c) => todayISO(new Date(c.ts)) === today)).length;
  return {
    p1,
    past,
    dueToday,
    comingUp,
    discussed,
    bumped,
    missedCommitments,
    departments,
    waiting,
    comm: { late, escalated },
    backlog: { total: backlogRows.length, byPriority, next: next.slice(0, Math.max(10, ps.backlogDaily)), closedThisWeek, closedLastWeek, goal: ps.backlogWeeklyGoal, weeksLeft: pace ? Math.ceil(backlogRows.length / pace) : undefined },
    mismatches,
    mustDiscuss: ids.size,
  };
}

/** Plain-text stand-up summary to paste into Teams. */
export function standupText(state: HubState, s: Standup, now = new Date()): string {
  const cfg = state.config;
  const name = (u?: string) => (u ? findPerson(cfg, u)?.name ?? u : 'no owner');
  const today = todayISO(now);
  const check = (r: StandupRow) => {
    const c = [...(r.item.standupLog ?? [])].reverse().find((x) => todayISO(new Date(x.ts)) === today);
    return c ? ` [${STANDUP_LABEL[c.status]}${c.note ? `: ${c.note}` : ''}]` : '';
  };
  const line = (r: StandupRow) => `• ${r.age.priority}${r.age.raised ? `→${r.age.effective}` : ''} ${r.item.source_id ? `#${r.item.source_id} ` : ''}${r.item.title} (${name(r.item.owner)}) - ${r.why}${check(r)}`;
  const support = currentDispatch(cfg, todayISO(now))?.analyst;
  const out = [`IT Core stand-up, ${now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}${support ? ` · on support: ${name(support)}` : ''}`, ''];
  const sec = (title: string, rows: StandupRow[]) => {
    if (!rows.length) return;
    out.push(`${title} (${rows.length})`, ...rows.slice(0, 15).map(line), '');
  };
  sec('Open P1s', s.p1);
  sec('Past target', s.past);
  sec('Missed commitments', s.missedCommitments);
  sec('Due today (last day of target)', s.dueToday);
  sec('Coming up', s.comingUp);
  sec('Repeatedly bumped', s.bumped);
  sec('Departments waiting', s.departments.slice(0, 5).map((d) => d.oldest));
  const ps = priorityStandardOf(cfg);
  sec('Backlog: clear next', s.backlog.next.slice(0, ps.backlogDaily));
  if (s.comm.late) out.push(`Communication standard: ${s.comm.late} update${s.comm.late === 1 ? '' : 's'} late (${s.comm.escalated} escalated).`, '');
  if (s.backlog.total) out.push(`Backlog: ${s.backlog.total} open from before the standard (${PRIORITIES.map((p) => `${s.backlog.byPriority[p]} ${p}`).join(', ')}); ${s.backlog.closedThisWeek} of ${s.backlog.goal} cleared this week.`);
  return out.join('\n').trim();
}

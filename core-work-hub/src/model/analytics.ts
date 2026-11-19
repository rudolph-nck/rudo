import { addDays, analysts, daysBetween, isOverdue, personWipLimit, todayISO } from './logic';
import { BUCKETS, type Bucket, type Column, type HubState, type WorkItem } from './types';

/** Doing items untouched this long count as held up. */
export const STALE_DAYS = 5;
export const OPEN_COLUMNS: Column[] = ['Intake', 'To Do', 'Ready', 'Doing', 'On Hold', 'Waiting'];
export const AGE_BANDS = [
  { key: '0–7 days', max: 7 },
  { key: '8–30 days', max: 30 },
  { key: '31–90 days', max: 90 },
  { key: '90+ days', max: Infinity },
] as const;

export interface Filter {
  bucket?: Bucket;
  owner?: string;
}

const mondayOf = (iso: string) => addDays(iso, -((new Date(iso + 'T12:00:00').getDay() + 6) % 7));
const median = (xs: number[]) => {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const days = (from?: string, to?: string) => (from && to ? (new Date(to).getTime() - new Date(from).getTime()) / 864e5 : undefined);

export interface HeldItem {
  item: WorkItem;
  /** Days in the current state. */
  days: number;
  why: string;
  kind: 'waiting' | 'hold' | 'stale';
}

/** Why an open item is held up, or undefined if it's moving. */
export function heldUp(i: WorkItem, now = new Date()): HeldItem | undefined {
  const since = i.columnSince ?? i.touched;
  if (i.column === 'Waiting')
    return { item: i, days: daysBetween(since, now), why: i.statusDriven ? i.source_status : 'Waiting', kind: 'waiting' };
  if (i.column === 'On Hold') return { item: i, days: daysBetween(i.hold?.since ?? since, now), why: i.hold?.reason || 'On hold', kind: 'hold' };
  if (i.column === 'Doing') {
    const idle = daysBetween(i.touched, now);
    if (idle >= STALE_DAYS) return { item: i, days: idle, why: `No updates for ${idle} days`, kind: 'stale' };
  }
  return undefined;
}

export interface PersonRow {
  username: string;
  name: string;
  doing: number;
  limit: number;
  queue: number;
  waiting: number;
  onHold: number;
  stale: number;
  overdue: number;
  unacked: number;
  oldestDays?: number;
  done14: number;
  medianCycle?: number;
  /** Simple attention score for sorting: things a manager should look at first. */
  attention: number;
}

export function overview(state: HubState, f: Filter = {}, weeks = 12, now = new Date()) {
  const today = todayISO(now);
  const all = [...state.items.values()].filter((i) => !i.stale && (!f.bucket || i.bucket === f.bucket) && (!f.owner || i.owner === f.owner));
  const open = all.filter((i) => i.column !== 'Done');
  const doneIn = (fromIso: string, toIso: string) => all.filter((i) => i.column === 'Done' && i.done && i.done.slice(0, 10) >= fromIso && i.done.slice(0, 10) <= toIso);

  const thisMon = mondayOf(today);
  const lastMon = addDays(thisMon, -7);
  const doneThisWeek = doneIn(thisMon, today).length;
  const doneLastWeek = doneIn(lastMon, addDays(thisMon, -1)).length;
  const openedThisWeek = all.filter((i) => i.created.slice(0, 10) >= thisMon).length;

  const since30 = addDays(today, -30);
  const cycles = doneIn(since30, today).map((i) => days(i.started, i.done)).filter((x): x is number => x !== undefined && x >= 0);
  const leads = doneIn(since30, today).map((i) => days(i.created, i.done)).filter((x): x is number => x !== undefined && x >= 0);

  const held = open.map((i) => heldUp(i, now)).filter((h): h is HeldItem => !!h).sort((a, b) => b.days - a.days);
  const slaOverdue = open.filter((i) => i.due_by && i.due_by < now.toISOString() && i.column !== 'Intake');
  const people = analysts(state.config).filter((p) => !f.owner || p.username === f.owner);
  const doingTotal = open.filter((i) => i.column === 'Doing').length;
  const slots = people.reduce((s, p) => s + personWipLimit(state.config, p.username), 0);

  // Weekly flow
  const weekStarts = Array.from({ length: weeks }, (_, n) => addDays(thisMon, -(weeks - 1 - n) * 7));
  const flow = weekStarts.map((w) => {
    const end = addDays(w, 6);
    return {
      week: w,
      opened: all.filter((i) => i.created.slice(0, 10) >= w && i.created.slice(0, 10) <= end).length,
      closed: doneIn(w, end).length,
    };
  });

  // Where the work is: open columns x bucket (ungraded counted separately)
  const byColumn = OPEN_COLUMNS.map((c) => {
    const inCol = open.filter((i) => i.column === c);
    return { column: c, total: inCol.length, parts: [...BUCKETS.map((b) => ({ key: b as string, value: inCol.filter((i) => i.bucket === b).length })), { key: 'Not graded', value: inCol.filter((i) => !i.bucket).length }] };
  });

  // Age of open work
  const aging = AGE_BANDS.map((band, n) => {
    const lo = n ? AGE_BANDS[n - 1].max : -1;
    const inBand = open.filter((i) => {
      const a = daysBetween(i.created, now);
      return a > lo && a <= band.max;
    });
    return { band: band.key, total: inBand.length, parts: [...BUCKETS.map((b) => ({ key: b as string, value: inBand.filter((i) => i.bucket === b).length })), { key: 'Not graded', value: inBand.filter((i) => !i.bucket).length }] };
  });

  // What the held-up work is waiting on
  const waitingOnMap = new Map<string, number>();
  held.forEach((h) => {
    const k = h.kind === 'hold' ? 'On hold (reprioritized)' : h.kind === 'stale' ? 'Doing, no recent updates' : h.why.replace(/^waiting for /i, '').replace(/^\w/, (c) => c.toUpperCase());
    waitingOnMap.set(k, (waitingOnMap.get(k) ?? 0) + 1);
  });
  const waitingOn = [...waitingOnMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  // Open work by system (top 8 + Other)
  const sysMap = new Map<string, number>();
  open.forEach((i) => {
    const name = state.config.systems.find((s) => s.id === i.system)?.name ?? (i.subcategory || 'No system');
    sysMap.set(name, (sysMap.get(name) ?? 0) + 1);
  });
  const sysSorted = [...sysMap.entries()].sort((a, b) => b[1] - a[1]);
  const bySystem = sysSorted.slice(0, 8).map(([label, value]) => ({ label, value }));
  const rest = sysSorted.slice(8).reduce((s, [, v]) => s + v, 0);
  if (rest) bySystem.push({ label: `Other (${sysSorted.length - 8})`, value: rest });

  // Per person
  const since14 = addDays(today, -14);
  const rows: PersonRow[] = people.map((p) => {
    const mine = open.filter((i) => i.owner === p.username);
    const doing = mine.filter((i) => i.column === 'Doing').length;
    const limit = personWipLimit(state.config, p.username);
    const stale = mine.filter((i) => heldUp(i, now)?.kind === 'stale').length;
    const overdue = mine.filter((i) => isOverdue(i, today)).length;
    const myDone = all.filter((i) => i.owner === p.username && i.column === 'Done');
    const row: PersonRow = {
      username: p.username,
      name: p.name,
      doing,
      limit,
      queue: mine.filter((i) => i.column === 'To Do' || i.column === 'Ready').length,
      waiting: mine.filter((i) => i.column === 'Waiting').length,
      onHold: mine.filter((i) => i.column === 'On Hold').length,
      stale,
      overdue,
      unacked: mine.filter((i) => !i.acked && i.column !== 'Intake').length,
      oldestDays: mine.length ? Math.max(...mine.map((i) => daysBetween(i.created, now))) : undefined,
      done14: myDone.filter((i) => (i.done ?? '').slice(0, 10) >= since14).length,
      medianCycle: median(myDone.filter((i) => (i.done ?? '').slice(0, 10) >= since30).map((i) => days(i.started, i.done)).filter((x): x is number => x !== undefined && x >= 0)),
      attention: 0,
    };
    row.attention = (doing > limit ? 3 : 0) + overdue * 2 + stale * 2 + row.waiting + row.unacked;
    return row;
  });

  return {
    kpis: {
      open: open.length,
      intake: open.filter((i) => i.column === 'Intake').length,
      doing: doingTotal,
      slots,
      held: held.length,
      overdue: open.filter((i) => isOverdue(i, today)).length,
      slaOverdue: slaOverdue.length,
      doneThisWeek,
      doneLastWeek,
      openedThisWeek,
      medianCycle: median(cycles),
      medianLead: median(leads),
      medianAgeOpen: median(open.map((i) => daysBetween(i.created, now))),
    },
    flow,
    byColumn,
    aging,
    held,
    waitingOn,
    bySystem,
    rows,
  };
}

export type Overview = ReturnType<typeof overview>;

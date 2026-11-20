// My work: what someone owns, what needs their attention first, and when things are due. Pure, so it's unit-tested.
import type { HubState, WorkItem } from './types';
import { ageOf, dayNo, isOpen, priorityStandardOf, type Age } from './priority';
import { commStatus, type CommStatus } from './comms';
import { addDays, doingFor, isOverdue, personWipLimit, todayISO } from './logic';

export type Tone = 'bad' | 'warn' | 'info' | 'good';
export interface Reason {
  key: 'ack' | 'p1' | 'comm' | 'commSoon' | 'past' | 'risk' | 'dueToday' | 'promised' | 'missed' | 'bumped' | 'close' | 'expedite';
  label: string;
  tone: Tone;
}
export interface MyItem {
  item: WorkItem;
  age?: Age;
  comm?: CommStatus;
  reasons: Reason[];
  /** Needs attention today (any red or amber reason). */
  focus: boolean;
  /** Higher = do it first. */
  urgency: number;
  /** The date that matters most: a commitment, the source due date, or the priority target. */
  due?: Date;
  dueKind?: 'promised' | 'due' | 'target';
}

const W: Record<Reason['key'], number> = { expedite: 9000, p1: 6000, missed: 4000, comm: 3500, ack: 3000, past: 2500, dueToday: 2000, promised: 1800, commSoon: 1200, bumped: 900, risk: 700, close: 500 };

const dateOnly = (iso: string) => new Date(iso.length <= 10 ? iso + 'T17:00:00' : iso);

export function describeItem(state: HubState, i: WorkItem, now = new Date()): MyItem {
  const age = ageOf(state, i, now);
  const comm = commStatus(state, i, now);
  const ps = priorityStandardOf(state.config);
  const today = todayISO(now);
  const r: Reason[] = [];
  if (i.expedite) r.push({ key: 'expedite', label: 'Drop everything', tone: 'bad' });
  if (i.priority === 'P1') r.push({ key: 'p1', label: 'P1', tone: 'bad' });
  if (i.owner && !i.acked && i.column !== 'Done') r.push({ key: 'ack', label: 'Acknowledge', tone: 'warn' });
  if (comm && comm.level !== 'ok' && comm.level !== 'soon') r.push({ key: 'comm', label: `${comm.label} late`, tone: 'bad' });
  else if (comm?.level === 'soon') r.push({ key: 'commSoon', label: `${comm.label} due soon`, tone: 'warn' });
  else if (!comm && isOverdue(i, today)) r.push({ key: 'comm', label: 'Update overdue', tone: 'bad' });
  if (age?.commitment?.missed) r.push({ key: 'missed', label: 'Missed commitment', tone: 'bad' });
  else if (age?.commitment && age.commitment.date === today) r.push({ key: 'promised', label: 'Promised today', tone: 'warn' });
  if (age && !age.backlog && (age.stage === 'past' || age.stage === 'double')) r.push({ key: 'past', label: `Past target · day ${dayNo(age)} of ${age.target}`, tone: 'bad' });
  else if (age && !age.backlog && age.stage !== 'waiting' && todayISO(age.due) === today) r.push({ key: 'dueToday', label: `Due today · day ${dayNo(age)} of ${age.target}`, tone: 'warn' });
  else if (age && !age.backlog && age.stage === 'risk') r.push({ key: 'risk', label: `At risk · day ${dayNo(age)} of ${age.target}`, tone: 'warn' });
  if ((i.bumps ?? 0) >= ps.bumpFlag) r.push({ key: 'bumped', label: `Bumped ${i.bumps}×`, tone: 'warn' });
  if (i.sourceResolved && i.column !== 'Done') r.push({ key: 'close', label: 'Ready to close', tone: 'info' });

  const focus = r.some((x) => x.tone === 'bad' || x.tone === 'warn');
  const urgency = r.reduce((s, x) => s + W[x.key], 0) + (age?.score ?? 0);
  let due: Date | undefined;
  let dueKind: MyItem['dueKind'];
  if (i.commitment) [due, dueKind] = [dateOnly(i.commitment.date), 'promised'];
  else if (i.due_by) [due, dueKind] = [dateOnly(i.due_by), 'due'];
  else if (age && !age.backlog) [due, dueKind] = [age.due, 'target'];
  return { item: i, age, comm, reasons: r, focus, urgency, due, dueKind };
}

export interface MyWorkSummary {
  open: MyItem[];
  focus: MyItem[];
  doneRecently: WorkItem[];
  doing: number;
  wipLimit: number;
  toAck: number;
  dueThisWeek: number;
  overdue: number;
}

/** Everything `me` owns that's still open, most urgent first; plus what they closed in the last 7 days. */
export function myWork(state: HubState, me: string, now = new Date()): MyWorkSummary {
  const all = [...state.items.values()].filter((i) => i.owner === me && !i.stale);
  const open = all
    .filter((i) => isOpen(state.config, i) && i.column !== 'Done')
    .map((i) => describeItem(state, i, now))
    .sort((a, b) => b.urgency - a.urgency);
  const weekAgo = new Date(now.getTime() - 7 * 864e5).toISOString();
  const doneRecently = all.filter((i) => (i.column === 'Done' || i.sourceClosed) && (i.done ?? i.touched) >= weekAgo).sort((a, b) => (b.done ?? '').localeCompare(a.done ?? ''));
  const weekEnd = dateOnly(addDays(todayISO(now), 7 - ((now.getDay() + 6) % 7) - 1));
  return {
    open,
    focus: open.filter((x) => x.focus),
    doneRecently,
    doing: doingFor(state, me).length,
    wipLimit: personWipLimit(state.config, me),
    toAck: open.filter((x) => x.reasons.some((r) => r.key === 'ack')).length,
    dueThisWeek: open.filter((x) => x.due && x.due <= weekEnd).length,
    overdue: open.filter((x) => x.due && x.due < now).length,
  };
}

export type DueGroup = 'Overdue' | 'Today' | 'Tomorrow' | 'This week' | 'Next week' | 'Later' | 'No date';
export const DUE_GROUPS: DueGroup[] = ['Overdue', 'Today', 'Tomorrow', 'This week', 'Next week', 'Later', 'No date'];

export function dueGroup(x: MyItem, now = new Date()): DueGroup {
  if (!x.due) return 'No date';
  const today = todayISO(now);
  const d = todayISO(x.due);
  if (x.due < now && d !== today) return 'Overdue';
  if (d === today) return x.due < now ? 'Overdue' : 'Today';
  if (d === addDays(today, 1)) return 'Tomorrow';
  const monday = addDays(today, -((now.getDay() + 6) % 7));
  if (d < addDays(monday, 7)) return 'This week';
  if (d < addDays(monday, 14)) return 'Next week';
  return 'Later';
}

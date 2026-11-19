import { currentDispatch, findPerson, offOn, todayISO } from './logic';
import { isStatus } from './replay';
import type { CommStandard, HubConfig, HubState, WorkItem } from './types';

/*
 * IT Core Team Communication Standards (rev. Nov 18 2026), as rules the hub can check.
 *
 *  First response: P1 within 2 business hours, others within 1 business day, from when the ticket reaches Core.
 *                  A first response names the owner, the ticket number and the date of the next update.
 *  Updates:        P1 until resolved (here: every 2 business hours, configurable); others at least weekly.
 *  Requester unresponsive: follow up every 48 h (P1: 2 h); escalate to their manager after two attempts and
 *                  close as "Requester Unresponsive" after the third.
 *  Hours:          Mon, Tue, Wed, Fri 8:30–5:30; Thu 10:00–5:30 (Eastern, the PCs' local time). Nights, weekends and
 *                  holidays pause the clock.
 *
 * When a deadline passes: the owner is reminded, then it escalates to whoever is on support, then to Nick.
 */

export const DEFAULT_STANDARD: CommStandard = {
  hours: { 1: [510, 1050], 2: [510, 1050], 3: [510, 1050], 4: [600, 1050], 5: [510, 1050] },
  holidays: [],
  p1FirstResponseHours: 2,
  firstResponseBusinessDays: 1,
  p1UpdateHours: 2,
  updateBusinessDays: 5,
  followUpHours: 48,
  p1FollowUpHours: 2,
  followUpAttempts: 3,
  dueSoonHours: 4,
  p1DueSoonMinutes: 30,
  escalateToSupportAfterHours: 9,
  escalateToManagerAfterHours: 18,
  p1EscalateToSupportAfterMinutes: 15,
  p1EscalateToManagerAfterMinutes: 30,
  sdLastUpdatedCountsAsUpdate: true,
};

export const standardOf = (c: HubConfig): CommStandard => ({ ...DEFAULT_STANDARD, ...(c.commStandard ?? {}), hours: { ...DEFAULT_STANDARD.hours, ...(c.commStandard?.hours ?? {}) } });

// ---------------------------------------------------------------- business time (local clock)

const dayKey = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
function window(std: CommStandard, d: Date): [number, number] | undefined {
  if (std.holidays.includes(dayKey(d))) return undefined;
  return std.hours[d.getDay()];
}
const minsOf = (d: Date) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
const at = (d: Date, mins: number) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return new Date(x.getTime() + mins * 60000);
};

/** `start` plus `minutes` of business time. */
export function addBusinessMinutes(std: CommStandard, start: Date, minutes: number): Date {
  let cur = new Date(start);
  let left = minutes;
  for (let guard = 0; guard < 800; guard++) {
    const w = window(std, cur);
    if (w) {
      const m = Math.max(minsOf(cur), w[0]);
      if (m < w[1]) {
        const avail = w[1] - m;
        if (left <= avail) return at(cur, m + left);
        left -= avail;
      }
    }
    cur = at(new Date(cur.getTime() + 864e5), 0);
  }
  return cur;
}

/** Business minutes between two moments (0 if b <= a). */
export function businessMinutesBetween(std: CommStandard, a: Date, b: Date): number {
  if (b <= a) return 0;
  let total = 0;
  let cur = new Date(a);
  for (let guard = 0; guard < 800 && cur < b; guard++) {
    const w = window(std, cur);
    if (w) {
      const from = Math.max(minsOf(cur), w[0]);
      const sameDay = dayKey(cur) === dayKey(b);
      const to = Math.min(w[1], sameDay ? minsOf(b) : w[1]);
      if (to > from) total += to - from;
    }
    cur = at(new Date(cur.getTime() + 864e5), 0);
  }
  return total;
}

const workdayMinutes = (std: CommStandard) => {
  const spans = Object.values(std.hours).filter(Boolean).map((w) => w![1] - w![0]);
  return spans.length ? Math.max(...spans) : 540;
};

/**
 * "N business days" = the same time of day, N business days later. A start outside business hours counts from the
 * next opening; a time outside the target day's hours is clamped into them (Thursday opens at 10:00).
 */
export function addBusinessDays(std: CommStandard, start: Date, days: number): Date {
  let cur = addBusinessMinutes(std, start, 0);
  const tod = minsOf(cur);
  for (let n = 0; n < days; n++) {
    let d = at(new Date(cur.getTime() + 864e5), 0);
    for (let guard = 0; guard < 30 && !window(std, d); guard++) d = at(new Date(d.getTime() + 864e5), 0);
    const w = window(std, d)!;
    cur = at(d, Math.min(Math.max(tod, w[0]), w[1]));
  }
  return cur;
}

// ---------------------------------------------------------------- per-ticket status

export type CommKind = 'first' | 'update' | 'follow-up';
export type CommLevel = 'ok' | 'soon' | 'overdue' | 'support' | 'manager';

export interface CommStatus {
  kind: CommKind;
  /** When the next communication is due. */
  due: Date;
  /** The last requester-visible communication, and where we learned about it. */
  last?: { at: Date; source: 'sd-note' | 'sd-response' | 'hub' | 'sd-any-change'; by?: string };
  level: CommLevel;
  /** Business minutes late (0 if not late). */
  lateMinutes: number;
  /** Who should act now. */
  responsible?: string;
  /** Why it went to the responsible person. */
  why: string;
  critical: boolean;
  /** For requester follow-ups: attempts so far. */
  attempts?: number;
  /** Plain-language label, e.g. "Weekly update". */
  label: string;
}

const isCritical = (i: WorkItem) => i.priority === 'P1';
const waitingOnRequester = (i: WorkItem) => /waiting for requester|awaiting requester|pending requester/i.test(i.source_status ?? '');

/** Communication status of an open ticket, or undefined when the standard doesn't apply (closed, not a ticket). */
export function commStatus(state: HubState, i: WorkItem, now = new Date()): CommStatus | undefined {
  const cfg = state.config;
  if (i.source !== 'SD' || i.stale || i.column === 'Done' || i.sourceClosed || isStatus(cfg.closedStatuses, i.source_status)) return undefined;
  const std = standardOf(cfg);
  const critical = isCritical(i);
  // Before go-live nothing was being tracked: clocks start no earlier than enforceFrom.
  const floor = std.enforceFrom ? new Date(std.enforceFrom + 'T00:00:00') : undefined;
  const atLeastFloor = (d: Date) => (floor && d < floor ? floor : d);
  const created = atLeastFloor(new Date(i.created));

  // What we know about requester-visible communication.
  const hubLog = (i.commLog ?? []).filter((c) => c.kind !== 'internal');
  const lastHub = hubLog[hubLog.length - 1];
  const cands: NonNullable<CommStatus['last']>[] = [];
  if (i.sd_last_note) cands.push({ at: new Date(i.sd_last_note), source: 'sd-note' });
  if (i.sd_responded) cands.push({ at: new Date(i.sd_responded), source: 'sd-response' });
  if (lastHub) cands.push({ at: new Date(lastHub.ts), source: 'hub', by: lastHub.user });
  if (std.sdLastUpdatedCountsAsUpdate && i.sd_last_modified && !i.sd_last_note) cands.push({ at: new Date(i.sd_last_modified), source: 'sd-any-change' });
  const last = cands.sort((a, b) => b.at.getTime() - a.at.getTime())[0];
  const firstDone = !!i.sd_responded || hubLog.length > 0 || (std.sdLastUpdatedCountsAsUpdate && !!i.sd_last_modified && new Date(i.sd_last_modified) > new Date(new Date(i.created).getTime() + 60000));

  let kind: CommKind;
  let due: Date;
  let attempts: number | undefined;
  if (!firstDone) {
    kind = 'first';
    due = critical ? addBusinessMinutes(std, created, std.p1FirstResponseHours * 60) : addBusinessDays(std, created, std.firstResponseBusinessDays);
  } else if (waitingOnRequester(i)) {
    kind = 'follow-up';
    const since = i.columnSince ? new Date(i.columnSince) : last?.at ?? created;
    attempts = hubLog.filter((c) => c.kind === 'follow-up' && new Date(c.ts) >= since).length;
    const base = atLeastFloor(last && last.at > since ? last.at : since);
    due = new Date(base.getTime() + (critical ? std.p1FollowUpHours : std.followUpHours) * 3600000);
  } else {
    kind = 'update';
    const base = atLeastFloor(last?.at ?? created);
    due = critical ? addBusinessMinutes(std, base, std.p1UpdateHours * 60) : addBusinessDays(std, base, std.updateBusinessDays);
  }
  // A promised next-update date earlier than the standard wins (end of that business day).
  if (i.next_update_due && kind !== 'first') {
    const d = new Date(i.next_update_due + 'T12:00:00');
    const w = window(std, d);
    const promised = at(d, w ? w[1] : 17 * 60 + 30);
    if (promised < due) due = promised;
  }

  const late = now > due ? (kind === 'follow-up' ? Math.round((now.getTime() - due.getTime()) / 60000) : businessMinutesBetween(std, due, now)) : 0;
  const untilDue = now < due ? businessMinutesBetween(std, now, due) : 0;
  const toSupport = critical ? std.p1EscalateToSupportAfterMinutes : std.escalateToSupportAfterHours * 60;
  const toManager = critical ? std.p1EscalateToManagerAfterMinutes : std.escalateToManagerAfterHours * 60;
  let level: CommLevel = 'ok';
  if (late > 0) level = late >= toManager ? 'manager' : late >= toSupport ? 'support' : 'overdue';
  else if (untilDue <= (critical ? std.p1DueSoonMinutes : std.dueSoonHours * 60)) level = 'soon';

  // Who acts: the owner, unless they're out or there is none; escalations go to support, then the manager.
  const today = todayISO(now);
  const support = currentDispatch(cfg, today)?.analyst;
  const manager = cfg.people.find((p) => p.role === 'manager')?.username;
  const ownerOff = i.owner ? offOn(cfg, i.owner, today) : undefined;
  let responsible = i.owner;
  let why = i.owner ? 'Owner' : 'No owner yet';
  if (!i.owner || ownerOff) {
    responsible = support ?? manager;
    why = ownerOff ? `${findPerson(cfg, i.owner)?.name ?? i.owner} is off` : 'No owner: support handles it';
  }
  // Support can't escalate to themselves: if the owner is the person on support (or support is off), go to the manager.
  if (level === 'support' && (!support || support === i.owner || offOn(cfg, support, today))) {
    level = 'manager';
    why = support === i.owner ? 'Owner is on support, so it goes to the manager' : 'Escalated to the manager';
  }
  if (level === 'support') {
    responsible = support;
    why = 'Escalated to support';
  }
  if (level === 'manager') {
    responsible = manager;
    if (!why.startsWith('Owner is on support')) why = 'Escalated to the manager';
  }
  const label = kind === 'first' ? 'First response' : kind === 'follow-up' ? `Requester follow-up${attempts !== undefined ? ` (attempt ${Math.min(attempts + 1, std.followUpAttempts)} of ${std.followUpAttempts})` : ''}` : critical ? 'P1 update' : 'Weekly update';
  return { kind, due, last, level, lateMinutes: late, responsible, why, critical, attempts, label };
}

export interface CommNotice {
  item: WorkItem;
  status: CommStatus;
  /** Why this person sees it. */
  role: 'owner' | 'support' | 'manager';
}

/** Everything a person should act on or know about, most urgent first. */
export function noticesFor(state: HubState, username: string, now = new Date()): CommNotice[] {
  const cfg = state.config;
  const manager = cfg.people.find((p) => p.role === 'manager')?.username;
  const support = currentDispatch(cfg, todayISO(now))?.analyst;
  const out: CommNotice[] = [];
  for (const i of state.items.values()) {
    const st = commStatus(state, i, now);
    if (!st || st.level === 'ok') continue;
    if (st.responsible === username || i.owner === username) {
      out.push({ item: i, status: st, role: i.owner === username ? 'owner' : username === manager ? 'manager' : 'support' });
    } else if (username === manager && (st.level === 'support' || st.level === 'manager')) {
      out.push({ item: i, status: st, role: 'manager' });
    } else if (username === support && st.level === 'support') {
      out.push({ item: i, status: st, role: 'support' });
    }
  }
  const rank: Record<CommLevel, number> = { manager: 0, support: 1, overdue: 2, soon: 3, ok: 4 };
  return out.sort((a, b) => rank[a.status.level] - rank[b.status.level] || Number(b.status.critical) - Number(a.status.critical) || a.status.due.getTime() - b.status.due.getTime());
}

/** Team-wide numbers for the Overview. */
export function commSummary(state: HubState, now = new Date()) {
  const all = [...state.items.values()].map((i) => commStatus(state, i, now)).filter((s): s is CommStatus => !!s);
  const late = all.filter((s) => s.lateMinutes > 0);
  return {
    tracked: all.length,
    onTime: all.length - late.length,
    pct: all.length ? Math.round(((all.length - late.length) / all.length) * 100) : 100,
    late: late.length,
    escalated: all.filter((s) => s.level === 'support' || s.level === 'manager').length,
    firstOverdue: late.filter((s) => s.kind === 'first').length,
  };
}

/** "3h 20m" / "2 business days" style for business minutes. */
export function fmtBusiness(std: CommStandard, mins: number) {
  const day = workdayMinutes(std);
  if (mins >= day) {
    const d = Math.round((mins / day) * 10) / 10;
    return `${d} business day${d === 1 ? '' : 's'}`;
  }
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

/** Ready-to-paste note for the requester, following the standard's wording. */
export function commTemplate(state: HubState, i: WorkItem, kind: CommKind, nextUpdate: string, me: string) {
  const owner = findPerson(state.config, i.owner ?? me)?.name ?? me;
  const when = new Date(nextUpdate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const t = `#${i.source_id}`;
  if (kind === 'first') return `Hello${i.requester ? ` ${i.requester}` : ''}, this is ${owner} with IT Core. I've taken ownership of ticket ${t} ("${i.title}"). Your next update will be by ${when}.`;
  if (kind === 'follow-up') return `Hello${i.requester ? ` ${i.requester}` : ''}, following up on ticket ${t} ("${i.title}"). We need your reply to continue. ${owner}, IT Core.`;
  return `Update on ticket ${t} ("${i.title}"): <what changed>. Owner: ${owner}, IT Core. Next update by ${when}.`;
}

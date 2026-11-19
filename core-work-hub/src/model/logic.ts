import type { Rotation, ShiftLength, Bucket, Column, DispatchShift, HubConfig, HubState, Person, Priority, Role, SystemOwnership, WorkItem } from './types';

// ---------------------------------------------------------------- dates

export const todayISO = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return todayISO(d);
};
export const daysBetween = (fromIso: string, to = new Date()) =>
  Math.max(0, Math.floor((to.getTime() - new Date(fromIso).getTime()) / 86400000));

export const isOverdue = (item: WorkItem, today = todayISO()) =>
  item.column !== 'Done' && !!item.next_update_due && item.next_update_due < today;

export const fmtShortDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const fmtAge = (iso: string) => {
  const d = daysBetween(iso);
  if (d === 0) return 'today';
  if (d < 14) return `${d}d`;
  if (d < 70) return `${Math.floor(d / 7)}w`;
  return `${Math.floor(d / 30)}mo`;
};

// ---------------------------------------------------------------- scoring

/** score = (impact × urgency) ÷ effort. Range 0.2 – 25. */
export function computeScore(impact?: number, urgency?: number, effort?: number): number | undefined {
  if (!impact || !urgency || !effort) return undefined;
  return Math.round(((impact * urgency) / effort) * 10) / 10;
}

/** Suggested priority from the score. The team decides; this only pre-selects a button. */
export function suggestPriority(score?: number): Priority | undefined {
  if (score === undefined) return undefined;
  if (score >= 15) return 'P1';
  if (score >= 8) return 'P2';
  if (score >= 3) return 'P3';
  return 'P4';
}

const PRIORITY_ORDER: Record<Priority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };

/** Map free-text Service Desk priority ("High", "P2 - High", "Urgent") to P1–P4. */
export function mapSourcePriority(raw?: string): Priority | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase();
  const m = s.match(/\bp\s*([1-4])\b/);
  if (m) return ('P' + m[1]) as Priority;
  if (/(critical|urgent|emergency|highest)/.test(s)) return 'P1';
  if (/(high|vip)/.test(s)) return 'P2';
  if (/(medium|normal|moderate)/.test(s)) return 'P3';
  if (/(low|lowest|planning)/.test(s)) return 'P4';
  return undefined;
}

// ---------------------------------------------------------------- people & roles

export function findPerson(config: HubConfig, key?: string): Person | undefined {
  if (!key) return undefined;
  const k = key.trim().toLowerCase();
  return config.people.find(
    (p) => p.username.toLowerCase() === k || p.name.toLowerCase() === k || (p.sdName && p.sdName.toLowerCase() === k),
  );
}

/**
 * Hub person for a Service Desk technician name ("Wesley Wilson", "Cathy E. Garcia"). Tries sdName, then
 * username/name, then a unique first-name match among non-viewers ("Wes" ~ "Wesley"). Undefined when the
 * technician isn't on the hub (e.g. someone on another team).
 */
export function personForSourceName(config: HubConfig, raw?: string): Person | undefined {
  const name = raw?.trim();
  if (!name || /^(not assigned|-|unassigned)$/i.test(name)) return undefined;
  const k = name.toLowerCase().replace(/^retained until [\d/]+ - /, '');
  const bySd = config.people.find((p) => p.sdName && p.sdName.trim().toLowerCase() === k);
  if (bySd) return bySd;
  const direct = findPerson(config, name);
  if (direct) return direct;
  const first = k.split(/\s+/)[0];
  const hits = config.people.filter((p) => {
    if (p.role === 'viewer' || p.sdName) return false;
    const n = p.name.trim().toLowerCase();
    return first === n || (n.length >= 3 && first.startsWith(n)) || (first.length >= 3 && n.startsWith(first));
  });
  return hits.length === 1 ? hits[0] : undefined;
}

/** System from the ownership map whose name or aliases match an SD sub-category (or category). */
export function systemForCategory(config: HubConfig, ...cats: (string | undefined)[]) {
  for (const c of cats) {
    const k = c?.trim().toLowerCase();
    if (!k) continue;
    const s = config.systems.find((x) => x.name.toLowerCase() === k || x.aliases?.some((a) => a.trim().toLowerCase() === k));
    if (s) return s.id;
  }
  return undefined;
}

/** People who carry work: every analyst, plus a manager marked `works: true` (Nick). Team view, capacity and WIP use this. */
export const analysts = (config: HubConfig) => config.people.filter((p) => p.role === 'analyst' || (p.role === 'manager' && p.works));
export const assignable = (config: HubConfig) => config.people.filter((p) => p.role !== 'viewer');

export const roleOf = (config: HubConfig, username: string): Role | undefined => findPerson(config, username)?.role;

/**
 * Manager always; analysts when analystsCanGrade; and whoever is on level 1 support on `date` (triage is the
 * support job), unless supportCanTriage is false.
 */
export const canGrade = (config: HubConfig, username: string, date = todayISO()) => {
  const r = roleOf(config, username);
  if (r === 'manager' || (r === 'analyst' && config.analystsCanGrade)) return true;
  return r === 'analyst' && config.supportCanTriage !== false && currentDispatch(config, date)?.analyst === username;
};

/** Time-off entry covering `date` for this person, if any. */
export const offOn = (config: HubConfig, username: string | undefined, date = todayISO()) =>
  username ? (config.timeOff ?? []).find((t) => t.username === username && t.from <= date && date <= t.to) : undefined;

/** Time-off entries that overlap a date range. */
export const offDuring = (config: HubConfig, username: string, from: string, to: string) =>
  (config.timeOff ?? []).filter((t) => t.username === username && t.from <= to && t.to >= from);

export const initials = (p?: Person, fallback?: string) => {
  if (p?.initials) return p.initials;
  const n = p?.name ?? fallback ?? '?';
  const parts = n.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : n.slice(0, 2)).toUpperCase();
};

// ---------------------------------------------------------------- dispatch

/** Last day of a shift that starts on `from`. */
export function shiftEnd(from: string, len: ShiftLength): string {
  if (len === 'week') return addDays(from, 6);
  if (len === '2weeks') return addDays(from, 13);
  const d = new Date(from + 'T12:00:00');
  // A month later, minus a day: Dec 1 -> Dec 31, Dec 15 -> Jan 14.
  const n = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate(), 12);
  return addDays(todayISO(n), -1);
}

/** First day of a shift that ends on `to` (inverse of shiftEnd). */
export function shiftStart(to: string, len: ShiftLength): string {
  if (len === 'week') return addDays(to, -6);
  if (len === '2weeks') return addDays(to, -13);
  const d = new Date(addDays(to, 1) + 'T12:00:00');
  return todayISO(new Date(d.getFullYear(), d.getMonth() - 1, d.getDate(), 12));
}

const isOut = (r: Rotation, username: string, onDate: string) =>
  r.out.some((o) => o.username === username && (!o.until || o.until >= onDate));

/**
 * Level 1 shifts from the rotation: the current shift, then the running order from the person after the current
 * one, skipping anyone out on the shift's start date. Backup = whoever is up next.
 */
export function rotationShifts(config: HubConfig, count = 12): DispatchShift[] {
  const r = config.rotation;
  if (!r || !r.order.length || !r.current?.analyst || !r.current.until) return [];
  const eligible = (d: string) => r.order.filter((u) => !isOut(r, u, d));
  const out: DispatchShift[] = [];
  let idx = r.order.indexOf(r.current.analyst);
  let from = shiftStart(r.current.until, r.shift);
  out.push({ analyst: r.current.analyst, from, to: r.current.until, escalation: r.escalation, generated: true });
  from = addDays(r.current.until, 1);
  for (let n = 0; n < count && out.length < count + 1; n++) {
    if (!eligible(from).length) break;
    let guard = 0;
    do {
      idx = (idx + 1) % r.order.length;
    } while (isOut(r, r.order[idx], from) && ++guard <= r.order.length);
    const to = shiftEnd(from, r.shift);
    out.push({ analyst: r.order[idx], from, to, escalation: r.escalation, generated: true });
    from = addDays(to, 1);
  }
  out.forEach((s, i) => (s.backup = out[i + 1]?.analyst));
  return out;
}

/** The `n` shifts before the current one, walking the running order backwards (for shift history). */
export function pastShifts(config: HubConfig, n = 6): DispatchShift[] {
  const r = config.rotation;
  if (!r || !r.order.length || !r.current?.analyst) return [];
  const out: DispatchShift[] = [];
  let idx = r.order.indexOf(r.current.analyst);
  let to = addDays(shiftStart(r.current.until, r.shift), -1);
  for (let k = 0; k < n; k++) {
    const from = shiftStart(to, r.shift);
    let guard = 0;
    do {
      idx = (idx - 1 + r.order.length) % r.order.length;
    } while (isOut(r, r.order[idx], from) && ++guard <= r.order.length);
    out.unshift({ analyst: r.order[idx], from, to, escalation: r.escalation, generated: true });
    to = addDays(from, -1);
  }
  return out;
}

/**
 * The schedule people see: rotation shifts with covers and swaps cut into them. A cover replaces the rotation for
 * exactly its dates; the rest of the original shift stays with the rotation person.
 */
export function schedule(config: HubConfig, count = 12, back = 0): DispatchShift[] {
  const covers = config.dispatch.map((s) => ({ ...s, generated: false, escalation: s.escalation ?? config.rotation?.escalation })).sort((a, b) => a.from.localeCompare(b.from));
  const out: DispatchShift[] = [];
  const base = [...pastShifts(config, back), ...rotationShifts(config, count)];
  for (const shift of base) {
    let cursor = shift.from;
    for (const c of covers.filter((c) => c.from <= shift.to && c.to >= shift.from)) {
      if (c.from > cursor) out.push({ ...shift, from: cursor, to: addDays(c.from, -1) });
      cursor = addDays(c.to, 1) > cursor ? addDays(c.to, 1) : cursor;
    }
    if (cursor <= shift.to) out.push({ ...shift, from: cursor });
  }
  covers.forEach((c) => {
    const under = base.find((s) => s.from <= c.from && c.from <= s.to);
    out.push({ ...c, coverFor: c.coverFor ?? under?.analyst });
  });
  return out.sort((a, b) => a.from.localeCompare(b.from));
}

/** Upcoming shifts whose person has time off during it with no cover in place for those days. */
export function coverageGaps(config: HubConfig, count = 12, today = todayISO()) {
  return schedule(config, count)
    .filter((s) => s.to >= today)
    .flatMap((s) =>
      offDuring(config, s.analyst, s.from, s.to).map((t) => ({
        shift: s,
        off: t,
        from: t.from > s.from ? t.from : s.from,
        to: t.to < s.to ? t.to : s.to,
      })),
    );
}

export function currentDispatch(config: HubConfig, today = todayISO()): DispatchShift | undefined {
  // A cover/swap wins over the rotation for its dates.
  return (
    config.dispatch.find((s) => s.from <= today && today <= s.to) ??
    rotationShifts(config, 2).find((s) => s.from <= today && today <= s.to)
  );
}
export function nextDispatch(config: HubConfig, today = todayISO()): DispatchShift | undefined {
  const cur = currentDispatch(config, today);
  const after = cur ? cur.to : today;
  return schedule(config, 3).filter((s) => s.from > after).sort((a, b) => a.from.localeCompare(b.from))[0];
}

// ---------------------------------------------------------------- ranking

/** Ranked list (To Do by default, or Ready) of a bucket, in rank order. */
export function rankedList(state: HubState, bucket: Bucket, column: Column = 'To Do'): WorkItem[] {
  return [...state.items.values()]
    .filter((i) => i.column === column && i.bucket === bucket && !i.stale)
    .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));
}

/**
 * Rank key for dropping an item at `index` within `list` (which must not contain the item).
 * Midpoint between neighbours; returns undefined when the gap is too small, so the caller normalizes.
 */
export function rankKeyAt(list: WorkItem[], index: number): number | undefined {
  const prev = list[index - 1]?.rankKey;
  const next = list[index]?.rankKey;
  if (prev === undefined && next === undefined) return 1;
  if (prev === undefined) return (next as number) - 1;
  if (next === undefined) return prev + 1;
  const mid = (prev + next) / 2;
  if (next - prev < 1e-6 || mid === prev || mid === next) return undefined;
  return mid;
}

/** Where score ordering would put a newly graded item: after all higher priorities / better scores. */
export function suggestedRankIndex(list: WorkItem[], priority: Priority, score = 0): number {
  const idx = list.findIndex((other) => {
    const op = PRIORITY_ORDER[other.priority ?? 'P4'];
    const p = PRIORITY_ORDER[priority];
    if (p !== op) return p < op;
    return score > (other.score ?? 0);
  });
  return idx === -1 ? list.length : idx;
}

// ---------------------------------------------------------------- owner suggestion

export interface OwnerSuggestion {
  username: string;
  slot: 'primary' | 'secondary' | 'third';
  reason: string;
}

/**
 * Suggests the owner for a system from the ownership map, alternating between primary and secondary.
 * Whoever owns fewer graded items for the system is next; ties go to whoever did not get the most recent one.
 */
function suggestOwnerRaw(state: HubState, systemId?: string, excludeItem?: string): OwnerSuggestion | undefined {
  const sys = state.config.systems.find((s) => s.id === systemId);
  if (!sys) return undefined;
  const primary = sys.primary;
  const secondary = sys.secondary;
  if (!primary && !secondary) return undefined;
  if (!secondary) return { username: primary!, slot: 'primary', reason: 'Only owner on the map' };
  if (!primary) return { username: secondary, slot: 'secondary', reason: 'No primary on the map' };
  const graded = [...state.items.values()].filter((i) => i.system === sys.id && i.graded && i.id !== excludeItem);
  const pc = graded.filter((i) => i.owner === primary).length;
  const sc = graded.filter((i) => i.owner === secondary).length;
  const last = graded
    .filter((i) => i.owner === primary || i.owner === secondary)
    .sort((a, b) => (b.graded ?? '').localeCompare(a.graded ?? ''))[0];
  const nameOf = (u: string) => findPerson(state.config, u)?.name ?? u;
  if (pc === sc) {
    if (last?.owner === primary)
      return { username: secondary, slot: 'secondary', reason: `Last ${sys.name} item went to ${nameOf(primary)}` };
    return { username: primary, slot: 'primary', reason: last ? `Last ${sys.name} item went to ${nameOf(secondary)}` : 'First item for this system' };
  }
  return pc < sc
    ? { username: primary, slot: 'primary', reason: `${nameOf(primary)} ${pc} vs ${nameOf(secondary)} ${sc} on ${sys.name}` }
    : { username: secondary, slot: 'secondary', reason: `${nameOf(secondary)} ${sc} vs ${nameOf(primary)} ${pc} on ${sys.name}` };
}

/** Owner suggestion from the map, skipping anyone who's off today (falls to the other owner, then the third backup). */
export function suggestOwner(state: HubState, systemId?: string, excludeItem?: string): OwnerSuggestion | undefined {
  const s = suggestOwnerRaw(state, systemId, excludeItem);
  if (!s || !offOn(state.config, s.username)) return s;
  const sys = state.config.systems.find((x) => x.id === systemId)!;
  const name = (u: string) => findPerson(state.config, u)?.name ?? u;
  const off = offOn(state.config, s.username)!;
  const alts: [string | undefined, OwnerSuggestion['slot']][] = [[sys.primary, 'primary'], [sys.secondary, 'secondary'], [sys.third, 'third']];
  const alt = alts.find(([u]) => u && u !== s.username && !offOn(state.config, u));
  return alt ? { username: alt[0]!, slot: alt[1], reason: `${name(s.username)} is off until ${fmtShortDate(off.to)}` } : s;
}

export const systemName = (systems: SystemOwnership[], id?: string) => systems.find((s) => s.id === id)?.name ?? id;

// ---------------------------------------------------------------- WIP

export interface WipCheck {
  ok: boolean;
  messages: string[];
}

export const personWipLimit = (config: HubConfig, username: string) =>
  findPerson(config, username)?.wipLimit ?? config.defaultWipLimit;

export const doingFor = (state: HubState, username: string) =>
  [...state.items.values()].filter((i) => i.column === 'Doing' && i.owner === username && !i.stale);

/** Would moving `item` into Doing (owned by `owner`) break a limit? */
export function checkWip(state: HubState, item: WorkItem, owner: string | undefined, toColumn: Column): WipCheck {
  const msgs: string[] = [];
  if (toColumn !== 'Doing' || (item.column === 'Doing' && item.owner === owner)) return { ok: true, messages: [] };
  const cfg = state.config;
  const others = [...state.items.values()].filter((i) => i.column === 'Doing' && i.id !== item.id && !i.stale);
  if (owner) {
    const p = findPerson(cfg, owner);
    const mine = others.filter((i) => i.owner === owner);
    const limit = personWipLimit(cfg, owner);
    if (mine.length + 1 > limit) msgs.push(`${p?.name ?? owner} would have ${mine.length + 1} in Doing (limit ${limit}).`);
    const bl = item.bucket ? p?.bucketWip?.[item.bucket] : undefined;
    if (item.bucket && bl !== undefined) {
      const n = mine.filter((i) => i.bucket === item.bucket).length + 1;
      if (n > bl) msgs.push(`${p?.name ?? owner} would have ${n} ${item.bucket} items in Doing (limit ${bl}).`);
    }
  }
  if (item.bucket) {
    const tl = cfg.bucketWip[item.bucket];
    if (tl !== undefined) {
      const n = others.filter((i) => i.bucket === item.bucket).length + 1;
      if (n > tl) msgs.push(`The team would have ${n} ${item.bucket} items in Doing (bucket limit ${tl}).`);
    }
  }
  return { ok: msgs.length === 0, messages: msgs };
}

// ---------------------------------------------------------------- "needs you" tiles

export function needsAck(state: HubState, me: string, role: Role | undefined) {
  return [...state.items.values()].filter(
    (i) => !i.stale && i.owner && !i.acked && i.column !== 'Done' && i.column !== 'Intake' && (role === 'manager' || role === 'viewer' || i.owner === me),
  );
}
export function noOwner(state: HubState) {
  return [...state.items.values()].filter((i) => !i.stale && !i.owner && !i.source_owner && i.column !== 'Done' && i.column !== 'Intake');
}
export function readyToClose(state: HubState, me: string, role: Role | undefined) {
  const items = [...state.items.values()];
  return items.filter((i) => {
    if (i.stale || i.column === 'Done') return false;
    if (role === 'analyst' && i.owner !== me) return false;
    if (i.sourceResolved) return true;
    const kids = items.filter((k) => k.parent_id === i.id);
    return kids.length > 0 && kids.every((k) => k.column === 'Done');
  });
}

export function priorityRank(p?: Priority) {
  return p ? PRIORITY_ORDER[p] : 9;
}

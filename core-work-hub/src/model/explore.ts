// Explore: answer a question about tickets with one sentence of dropdowns ("Number of tickets opened by month in
// the last 12 months, where priority is P2"). Pure, so it's unit-tested; the page draws the result.
import type { HubState, WorkItem } from './types';
import { businessMinutesBetween, standardOf, workdayMinutes } from './comms';
import { closes } from './fun';
import { findPerson } from './logic';
import { closedAtOf, isClosedItem } from './trends';

export type Measure = 'count' | 'days_to_close' | 'days_open' | 'on_time';
export type Event = 'opened' | 'closed' | 'open_now';
export type Dim = 'none' | 'month' | 'week' | 'weekday' | 'hour' | 'priority' | 'bucket' | 'owner' | 'department' | 'subcategory' | 'system' | 'status' | 'source' | 'requester';
export type Range = '30d' | '90d' | 'month' | 'quarter' | 'year' | '12m' | 'all';
export interface Query {
  measure: Measure;
  event: Event;
  by: Dim;
  range: Range;
  where?: Partial<Record<'priority' | 'bucket' | 'owner' | 'department' | 'subcategory' | 'system' | 'status' | 'source', string>>;
}

export const MEASURE_LABEL: Record<Measure, string> = { count: 'Number of tickets', days_to_close: 'Median business days to close', days_open: 'Median days open so far', on_time: '% closed on time' };
export const EVENT_LABEL: Record<Event, string> = { opened: 'opened', closed: 'closed', open_now: 'open right now' };
export const DIM_LABEL: Record<Dim, string> = { none: 'in total', month: 'by month', week: 'by week', weekday: 'by day of the week', hour: 'by time of day', priority: 'by priority', bucket: 'by bucket', owner: 'by person', department: 'by department', subcategory: 'by category', system: 'by system', status: 'by status', source: 'by source', requester: 'by requester' };
export const RANGE_LABEL: Record<Range, string> = { '30d': 'in the last 30 days', '90d': 'in the last 90 days', month: 'this month', quarter: 'this quarter', year: 'this year', '12m': 'in the last 12 months', all: 'all time' };
export const TIME_DIMS: Dim[] = ['month', 'week', 'weekday', 'hour'];
/** Which measures make sense for which events. */
export const MEASURES_FOR: Record<Event, Measure[]> = { opened: ['count'], closed: ['count', 'days_to_close', 'on_time'], open_now: ['count', 'days_open'] };

const DAY = 864e5;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function rangeStart(r: Range, now: Date): Date | undefined {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (r === '30d') return new Date(d.getTime() - 30 * DAY);
  if (r === '90d') return new Date(d.getTime() - 90 * DAY);
  if (r === 'month') { d.setDate(1); return d; }
  if (r === 'quarter') { d.setDate(1); d.setMonth(d.getMonth() - (d.getMonth() % 3)); return d; }
  if (r === 'year') { d.setMonth(0, 1); return d; }
  if (r === '12m') { d.setDate(1); d.setMonth(d.getMonth() - 11); return d; }
  return undefined;
}

export interface Row { key: string; label: string; value: number; n: number; ids: string[] }
export interface Answer { rows: Row[]; total: number; unit: string; sentence: string; time: boolean; ids: string[] }

export function dimValue(state: HubState, i: WorkItem, by: Dim, at: Date): { key: string; label: string } {
  const cfg = state.config;
  const pad = (n: number) => String(n).padStart(2, '0');
  switch (by) {
    case 'none': return { key: 'all', label: 'All' };
    case 'month': return { key: `${at.getFullYear()}-${pad(at.getMonth() + 1)}`, label: at.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) };
    case 'week': {
      const w = new Date(at); w.setHours(0, 0, 0, 0); w.setDate(w.getDate() - ((w.getDay() + 6) % 7));
      return { key: w.toISOString().slice(0, 10), label: w.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) };
    }
    case 'weekday': { const k = (at.getDay() + 6) % 7; return { key: String(k), label: WEEKDAYS[k] }; }
    case 'hour': return { key: pad(at.getHours()), label: `${((at.getHours() + 11) % 12) + 1}${at.getHours() < 12 ? 'am' : 'pm'}` };
    case 'priority': return { key: i.priority ?? 'zz', label: i.priority ?? 'No priority' };
    case 'bucket': return { key: i.bucket ?? 'zz', label: i.bucket ?? 'Not graded' };
    case 'owner': { const u = i.owner; return u ? { key: u, label: findPerson(cfg, u)?.name ?? u } : { key: 'zz' + (i.source_owner ?? ''), label: i.source_owner ? `${i.source_owner} (not on the hub)` : 'No owner' }; }
    case 'department': return { key: i.department || 'zz', label: i.department || 'No department' };
    case 'subcategory': return { key: i.subcategory || 'zz', label: i.subcategory || 'No category' };
    case 'system': { const s = cfg.systems.find((x) => x.id === i.system); return { key: s?.id ?? 'zz', label: s?.name ?? 'No system' }; }
    case 'status': return { key: i.source_status || 'zz', label: i.source_status || 'No status' };
    case 'source': return { key: i.source, label: i.source === 'SD' ? 'Service Desk' : i.source };
    case 'requester': return { key: i.requester || 'zz', label: i.requester || 'No requester' };
  }
}

const median = (v: number[]) => { if (!v.length) return 0; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function explore(state: HubState, q: Query, now = new Date()): Answer {
  const std = standardOf(state.config);
  const wd = workdayMinutes(std);
  const onTime = q.measure === 'on_time' ? new Map(closes(state).map((c) => [c.item.id, c.onTime])) : undefined;
  const from = rangeStart(q.range, now);
  const measure = MEASURES_FOR[q.event].includes(q.measure) ? q.measure : 'count';
  const groups = new Map<string, { label: string; vals: number[]; ids: string[] }>();
  for (const i of state.items.values()) {
    if (i.stale) continue;
    let at: Date;
    if (q.event === 'opened') at = new Date(i.created);
    else if (q.event === 'closed') { const c = closedAtOf(i); if (!c) continue; at = c; }
    else { if (isClosedItem(i)) continue; at = new Date(i.created); }
    if (q.event !== 'open_now' && from && (at < from || at > now)) continue;
    const w = q.where ?? {};
    let skip = false;
    for (const [k, v] of Object.entries(w)) {
      if (!v) continue;
      if (dimValue(state, i, k as Dim, at).key !== v) { skip = true; break; }
    }
    if (skip) continue;
    const d = dimValue(state, i, q.by, at);
    let val = 1;
    if (measure === 'days_to_close') val = Math.max(0, businessMinutesBetween(std, new Date(i.created), at)) / wd;
    else if (measure === 'days_open') val = (now.getTime() - new Date(i.created).getTime()) / DAY;
    else if (measure === 'on_time') { const o = onTime!.get(i.id); if (o === undefined) continue; val = o ? 1 : 0; }
    const g = groups.get(d.key) ?? { label: d.label, vals: [], ids: [] };
    g.vals.push(val);
    g.ids.push(i.id);
    groups.set(d.key, g);
  }
  const agg = (v: number[]) => (measure === 'count' ? v.length : measure === 'on_time' ? Math.round((v.reduce((a, b) => a + b, 0) / Math.max(1, v.length)) * 100) : Math.round(median(v) * 10) / 10);
  let rows: Row[] = [...groups].map(([key, g]) => ({ key, label: g.label, value: agg(g.vals), n: g.vals.length, ids: g.ids }));
  const time = TIME_DIMS.includes(q.by);
  if (time) {
    // Fill gaps so a month or hour with no tickets still shows.
    if (q.by === 'weekday') for (let k = 0; k < 7; k++) if (!groups.has(String(k))) rows.push({ key: String(k), label: WEEKDAYS[k], value: 0, n: 0, ids: [] });
    if (q.by === 'hour') for (let h = 0; h < 24; h++) { const k = String(h).padStart(2, '0'); if (!groups.has(k)) rows.push({ key: k, label: `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`, value: 0, n: 0, ids: [] }); }
    if (q.by === 'month' && rows.length) {
      const keys = rows.map((r) => r.key).sort();
      const [y0, m0] = keys[0].split('-').map(Number), [y1, m1] = keys[keys.length - 1].split('-').map(Number);
      for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); m === 12 ? (y++, m = 1) : m++) {
        const k = `${y}-${String(m).padStart(2, '0')}`;
        if (!groups.has(k)) rows.push({ key: k, label: new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), value: 0, n: 0, ids: [] });
      }
    }
    rows.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  } else rows.sort((a, b) => b.value - a.value || b.n - a.n);
  const all = [...groups.values()].flatMap((g) => g.vals);
  const unit = measure === 'count' ? 'tickets' : measure === 'on_time' ? '% on time' : 'days';
  const sentence = `${MEASURE_LABEL[measure]} ${EVENT_LABEL[q.event]} ${DIM_LABEL[q.by]}${q.event === 'open_now' ? '' : ' ' + RANGE_LABEL[q.range]}`;
  return { rows, total: agg(all), unit, sentence, time, ids: [...groups.values()].flatMap((g) => g.ids) };
}

/** Ready-made questions people tend to ask. */
export const PRESETS: { q: string; query: Query }[] = [
  { q: 'How many tickets come in each month?', query: { measure: 'count', event: 'opened', by: 'month', range: '12m' } },
  { q: 'Which departments send the most tickets?', query: { measure: 'count', event: 'opened', by: 'department', range: '12m' } },
  { q: 'Who closed the most tickets this quarter?', query: { measure: 'count', event: 'closed', by: 'owner', range: 'quarter' } },
  { q: 'How long do tickets take to close, by priority?', query: { measure: 'days_to_close', event: 'closed', by: 'priority', range: '12m' } },
  { q: 'Which systems get the most tickets?', query: { measure: 'count', event: 'opened', by: 'system', range: '12m' } },
  { q: 'What day of the week is busiest?', query: { measure: 'count', event: 'opened', by: 'weekday', range: '12m' } },
  { q: 'What time of day do tickets come in?', query: { measure: 'count', event: 'opened', by: 'hour', range: '90d' } },
  { q: 'What is open right now, by status?', query: { measure: 'count', event: 'open_now', by: 'status', range: 'all' } },
  { q: 'Who has had tickets open longest?', query: { measure: 'days_open', event: 'open_now', by: 'owner', range: 'all' } },
  { q: 'On-time rate by person this year', query: { measure: 'on_time', event: 'closed', by: 'owner', range: 'year' } },
  { q: 'Which categories are we getting most?', query: { measure: 'count', event: 'opened', by: 'subcategory', range: '90d' } },
  { q: 'How many tickets did we close each month?', query: { measure: 'count', event: 'closed', by: 'month', range: '12m' } },
];

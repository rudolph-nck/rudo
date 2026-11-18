import { computeScore, findPerson, mapSourcePriority, roleOf, canGrade } from './logic';
import type { AuditEntry, Bucket, Conflict, HubConfig, HubEvent, HubState, SourceTicket, TicketsSnapshot, TimeEntry, WorkItem } from './types';
import { BUCKETS } from './types';

export interface SourcedEvent {
  event: HubEvent;
  /** Username taken from the change file name. This, not event.user, decides who did it. */
  file: string;
}

export const itemIdFor = (source: string, sourceId: string) => `${source}:${sourceId}`;

/** Total order every browser agrees on: time, then file, then event id. */
export function sortEvents(events: SourcedEvent[]): SourcedEvent[] {
  return [...events].sort(
    (a, b) => a.event.ts.localeCompare(b.event.ts) || a.file.localeCompare(b.file) || a.event.id.localeCompare(b.event.id),
  );
}

function isStatus(list: string[], status: string) {
  const s = status.trim().toLowerCase();
  return list.some((x) => x.toLowerCase() === s);
}

function fromTicket(t: SourceTicket, config: HubConfig): WorkItem {
  const owner = findPerson(config, t.source_owner)?.username;
  return {
    id: itemIdFor(t.source, t.source_id),
    source: t.source,
    source_id: t.source_id,
    source_url: t.source_url,
    title: t.title,
    requester: t.requester,
    source_status: t.source_status,
    source_owner: t.source_owner,
    column: 'Intake',
    priority: mapSourcePriority(t.source_priority),
    owner,
    // A technician assigned in Service Desk is not a hub acknowledgment.
    acked: false,
    created: t.created,
    touched: t.created,
    comments: [],
  };
}

/**
 * Permission check for one event, by the role of the file's owner.
 * Returns a reason string when the event must be ignored.
 */
export function rejectReason(config: HubConfig, file: string, e: HubEvent, item?: WorkItem): string | undefined {
  const role = roleOf(config, file);
  if (!role) return `"${file}" is not in hub-config.json`;
  if (role === 'viewer') return 'Viewers are read-only';
  if (role === 'manager') return undefined;
  const grader = canGrade(config, file);
  const own = !!item && (item.owner === file || (!item.owner && e.type === 'item.move'));
  switch (e.type) {
    case 'item.create':
      return e.data.column && e.data.column !== 'Intake' && !e.data.parent_id ? 'Analysts submit new work to Intake' : undefined;
    case 'item.comment':
    case 'item.reply':
    case 'time.log':
      return undefined;
    case 'item.ack':
      return item?.owner === file ? undefined : 'Only the owner can acknowledge';
    case 'item.grade':
    case 'item.rank':
    case 'rank.normalize':
      return grader ? undefined : 'Only the manager grades and ranks';
    case 'item.move':
      if (e.data.override && !grader) return 'Only the manager can override a WIP limit';
      if (grader) return undefined;
      if (item?.column === 'Intake' && !item.graded && !item.parent_id) return 'Ungraded items stay in Intake';
      return own ? undefined : 'Analysts move their own cards';
    case 'item.update': {
      const d = e.data;
      if (grader) return undefined;
      if (d.priority !== undefined || d.bucket !== undefined || d.system !== undefined) return 'Only the manager grades';
      if (d.owner !== undefined && d.owner !== file) return 'Analysts can only take ownership themselves';
      if (d.owner === file && item?.owner && item.owner !== file) return 'Item already has an owner';
      if (d.owner === undefined && !own) return 'Analysts update their own cards';
      if ((d.title !== undefined || d.description !== undefined) && item?.source !== 'Hub') return 'Source fields are read-only';
      return undefined;
    }
    default:
      return 'Only the manager changes settings';
  }
}

/** Build the whole hub state from config + snapshot + every event. Pure and deterministic. */
export function replay(baseConfig: HubConfig, snapshot: TicketsSnapshot | undefined, sourced: SourcedEvent[]): HubState {
  const config: HubConfig = structuredClone(baseConfig);
  const items = new Map<string, WorkItem>();
  const audit: AuditEntry[] = [];
  const conflicts: Conflict[] = [];
  const time: TimeEntry[] = [];
  /** When/by whom the hub last set owner / priority, for sync conflict detection. */
  const hubSet = new Map<string, { owner?: { ts: string; user: string }; priority?: { ts: string; user: string } }>();
  const tickets = new Map<string, SourceTicket>();

  for (const t of snapshot?.items ?? []) {
    const it = fromTicket(t, config);
    items.set(it.id, it);
    tickets.set(it.id, t);
  }

  const maxKey = (bucket?: Bucket) => {
    let m = 0;
    for (const i of items.values()) if (i.column === 'To Do' && i.bucket === bucket && i.rankKey !== undefined) m = Math.max(m, i.rankKey);
    return m;
  };
  const markHubSet = (id: string, field: 'owner' | 'priority', ts: string, user: string) => {
    const h = hubSet.get(id) ?? {};
    h[field] = { ts, user };
    hubSet.set(id, h);
  };
  const setColumn = (it: WorkItem, column: WorkItem['column'], ts: string, rankKey?: number) => {
    if (column === 'To Do') {
      if (it.column !== 'To Do' || rankKey !== undefined) it.rankKey = rankKey ?? maxKey(it.bucket) + 1;
    } else it.rankKey = undefined;
    if (column === 'Doing' && !it.started) it.started = ts;
    if (column === 'Done') it.done = ts;
    else it.done = undefined;
    it.column = column;
  };

  for (const { event: e, file } of sortEvents(sourced)) {
    const itemId = 'item' in e ? e.item : undefined;
    const it = itemId ? items.get(itemId) : undefined;
    if (itemId && !it && e.type !== 'item.create' && e.type !== 'time.log') {
      audit.push({ event: e, file, rejected: 'Unknown item (not in snapshot)' });
      continue;
    }
    if (e.type === 'item.create' && items.has(e.item)) {
      audit.push({ event: e, file, rejected: 'Item already exists' });
      continue;
    }
    const why = rejectReason(config, file, e, it);
    if (why) {
      audit.push({ event: e, file, rejected: why });
      continue;
    }
    audit.push({ event: e, file });
    if (it) it.touched = e.ts > it.touched ? e.ts : it.touched;

    switch (e.type) {
      case 'item.create': {
        const d = e.data;
        const n: WorkItem = {
          id: e.item,
          source: d.source,
          source_id: d.source_id,
          source_url: d.source_url,
          title: d.title,
          description: d.description,
          requester: d.requester,
          source_status: 'Open',
          bucket: d.bucket,
          column: 'Intake',
          parent_id: d.parent_id,
          owner: d.owner,
          acked: !!d.owner && d.owner === file,
          created: e.ts,
          touched: e.ts,
          comments: [],
        };
        items.set(n.id, n);
        if (d.column && d.column !== 'Intake') setColumn(n, d.column, e.ts);
        break;
      }
      case 'item.grade': {
        const g = e.data;
        const w = it!;
        const bucketChanged = w.bucket !== g.bucket;
        w.bucket = g.bucket;
        w.priority = g.priority;
        w.impact = g.impact;
        w.urgency = g.urgency;
        w.effort = g.effort;
        w.system = g.system;
        if (g.owner !== undefined && g.owner !== w.owner) {
          w.owner = g.owner || undefined;
          w.acked = !!w.owner && w.owner === file;
          markHubSet(w.id, 'owner', e.ts, file);
        }
        markHubSet(w.id, 'priority', e.ts, file);
        w.graded = w.graded ?? e.ts;
        if (bucketChanged && w.column === 'To Do') w.rankKey = maxKey(w.bucket) + 1;
        break;
      }
      case 'item.move':
        setColumn(it!, e.data.column, e.ts, canGrade(config, file) ? e.data.rankKey : undefined);
        break;
      case 'item.rank':
        if (it!.column === 'To Do') it!.rankKey = e.data.rankKey;
        break;
      case 'rank.normalize':
        e.data.order.forEach((id, i) => {
          const x = items.get(id);
          if (x && x.column === 'To Do' && x.bucket === e.data.bucket) x.rankKey = i + 1;
        });
        break;
      case 'item.update': {
        const d = e.data;
        const w = it!;
        if (d.owner !== undefined && (d.owner || undefined) !== w.owner) {
          w.owner = d.owner || undefined;
          w.acked = !!w.owner && w.owner === file;
          markHubSet(w.id, 'owner', e.ts, file);
        }
        if (d.priority !== undefined) {
          w.priority = d.priority;
          markHubSet(w.id, 'priority', e.ts, file);
        }
        if (d.next_update_due !== undefined) w.next_update_due = d.next_update_due || undefined;
        if (d.title !== undefined) w.title = d.title;
        if (d.description !== undefined) w.description = d.description;
        if (d.parent_id !== undefined) w.parent_id = d.parent_id || undefined;
        if (d.system !== undefined) w.system = d.system;
        if (d.bucket !== undefined && d.bucket !== w.bucket) {
          w.bucket = d.bucket;
          if (w.column === 'To Do') w.rankKey = maxKey(w.bucket) + 1;
        }
        break;
      }
      case 'item.ack':
        it!.acked = true;
        break;
      case 'item.comment':
        it!.comments.push({ id: e.id, ts: e.ts, user: file, text: e.data.text });
        break;
      case 'item.reply':
        break;
      case 'time.log':
        time.push({ id: e.id, ts: e.ts, user: file, item: e.item, ...e.data });
        break;
      case 'config.person': {
        const p = config.people.find((x) => x.username === e.data.username);
        if (p) {
          if (e.data.wipLimit !== undefined) p.wipLimit = e.data.wipLimit;
          if (e.data.bucketWip !== undefined) p.bucketWip = e.data.bucketWip;
        }
        break;
      }
      case 'config.bucketWip':
        config.bucketWip = { ...config.bucketWip, ...e.data };
        for (const k of Object.keys(e.data) as Bucket[]) if (e.data[k] === undefined || (e.data[k] as unknown) === null) delete config.bucketWip[k];
        break;
      case 'config.dispatch':
        config.dispatch = e.data.shifts;
        break;
      case 'config.system': {
        const { deleted, ...sys } = e.data;
        const idx = config.systems.findIndex((s) => s.id === sys.id);
        if (deleted) {
          if (idx >= 0) config.systems.splice(idx, 1);
        } else if (idx >= 0) config.systems[idx] = sys;
        else config.systems.push(sys);
        break;
      }
    }
  }

  // ---- Sync rules (source wins on conflicts; closed in source => Done).
  for (const [id, t] of tickets) {
    const w = items.get(id)!;
    const h = hubSet.get(id);
    const srcOwner = findPerson(config, t.source_owner)?.username;
    if (t.changed?.source_owner && h?.owner && t.changed.source_owner > h.owner.ts && srcOwner !== w.owner) {
      conflicts.push({ ts: t.changed.source_owner, item: id, field: 'owner', hubValue: w.owner, sourceValue: srcOwner ?? t.source_owner, hubUser: h.owner.user });
      w.owner = srcOwner;
      w.acked = false;
    }
    const srcPri = mapSourcePriority(t.source_priority);
    if (t.changed?.source_priority && h?.priority && t.changed.source_priority > h.priority.ts && srcPri && srcPri !== w.priority) {
      conflicts.push({ ts: t.changed.source_priority, item: id, field: 'priority', hubValue: w.priority, sourceValue: srcPri, hubUser: h.priority.user });
      w.priority = srcPri;
    }
    if (isStatus(config.closedStatuses, t.source_status)) {
      w.sourceClosed = true;
      if (w.column !== 'Done') {
        w.column = 'Done';
        w.rankKey = undefined;
        w.done = t.closed ?? snapshot?.generatedAt ?? w.touched;
      }
    } else if (isStatus(config.resolvedStatuses, t.source_status)) w.sourceResolved = true;
  }

  // ---- Unique integer ranks per bucket.
  for (const b of BUCKETS) {
    const list = [...items.values()].filter((i) => i.column === 'To Do' && i.bucket === b);
    list.sort((a, b2) => (a.rankKey ?? 0) - (b2.rankKey ?? 0) || a.id.localeCompare(b2.id));
    list.forEach((i, n) => (i.rank = n + 1));
  }
  for (const i of items.values()) {
    if (i.column !== 'To Do') i.rank = undefined;
    i.score = computeScore(i.impact, i.urgency, i.effort);
  }

  return { config, items, audit, conflicts, time, snapshot };
}

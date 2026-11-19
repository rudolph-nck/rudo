import type { SourceTicket, TicketsSnapshot, WorkItem, HubConfig, Source } from './types';

/** Masks anything that looks like an account or card number (8–19 digits, spaces/dashes allowed), keeping the last 4. */
export function maskNumbers(text: string): string {
  return text.replace(/\b\d(?:[ -]?\d){7,18}\b/g, (m) => {
    const digits = m.replace(/\D/g, '');
    return '••••' + digits.slice(-4);
  });
}

/** RFC 4180 CSV parser (quotes, escaped quotes, CRLF, newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

export function toCsv(rows: (string | number | undefined | null)[][]): string {
  const esc = (v: string | number | undefined | null) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

const HEADERS = {
  source_id: /^(request\s*id|id|ticket\s*(id|number|#)?|request\s*#|display\s*id)$/i,
  title: /^(subject|title|summary|name|task\s*name|project\s*name)$/i,
  requester: /^(requester|requester\s*name|requested\s*by)$/i,
  department: /^department$/i,
  source_status: /^(request\s*status|status)$/i,
  source_priority: /^priority$/i,
  sla: /^sla$/i,
  source_owner: /^(technician|assigned\s*to|owner|assignee|assignees)$/i,
  group: /^(group|support\s*group|queue|backlog\s*stage)$/i,
  category: /^(category|work\s*type)$/i,
  subcategory: /^(sub\s*category|platform)$/i,
  created: /^(created\s*(time|date|on)?|date\s*created|opened|start\s*date)$/i,
  closed: /^(completed\s*(time|date)|closed\s*(time|date)|resolved\s*(time|date))$/i,
  updated: /^last\s*updated\s*(time|date)?$/i,
  responded: /^(responded|first\s*response)\s*(time|date|on)?$/i,
  last_note: /^last\s*(note|conversation|reply|public\s*note|technician\s*reply)\s*(time|date|added)?$/i,
  due_by: /^due\s*(by\s*)?(time|date)?$/i,
};
type HeaderKey = keyof typeof HEADERS;

/** Service Desk writes these for "no value". */
const EMPTY = /^(not assigned|-|n\/a|none|null)$/i;

function parseDate(v: string): string | undefined {
  const s = v.trim();
  if (!s || EMPTY.test(s)) return undefined;
  // "11-18-2026 16:45" (US, Service Desk export) first; then whatever Date understands ("Nov 18, 2026 09:14 AM").
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
  let d: Date;
  if (m) {
    let h = +(m[4] ?? 0);
    if (m[7]) h = (h % 12) + (m[7].toUpperCase() === 'PM' ? 12 : 0);
    d = new Date(+m[3], +m[1] - 1, +m[2], h, +(m[5] ?? 0), +(m[6] ?? 0));
  } else d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Fills a link pattern: {id} = full ticket ID ("INC-79744"), {num} = its digits only ("79744"). */
export function fillLink(tpl: string | undefined, id: string | undefined): string | undefined {
  if (!tpl || !id) return undefined;
  const num = (id.match(/\d+/g) ?? []).join('');
  return tpl.replace('{id}', encodeURIComponent(id)).replace('{num}', encodeURIComponent(num || id));
}

export interface CsvImportResult {
  tickets: SourceTicket[];
  warnings: string[];
  columns: Record<string, string>;
  /** Rows dropped because they closed before the cut-off. */
  skippedOldClosed: number;
  /** Rows with no ID that look like group headings (Wrike exports), skipped quietly. */
  skippedHeadings?: number;
}

export interface CsvImportOptions {
  urlTemplate?: string;
  /** Status test for "closed" (from hub config). */
  isClosed?: (status: string) => boolean;
  /** Keep closed rows only if they closed within this many days (default 90). */
  closedDays?: number;
  now?: Date;
  /** Per-row link from the first column (Excel exports): Wrike IDs are read from these when there's no ID column. */
  links?: Map<string, string>;
}

/** Wrike task/project ID from an open.htm?id=… link. */
export const wrikeIdFrom = (url?: string) => url?.match(/[?&]id=(\d+)/)?.[1];

/** Turns a Service Desk Plus (or Wrike) CSV export into snapshot rows. Unknown columns are ignored (no descriptions). */
export function importTicketsCsv(text: string, source: Source, opts: CsvImportOptions | string = {}): CsvImportResult {
  const o: CsvImportOptions = typeof opts === 'string' ? { urlTemplate: opts } : opts;
  return importTicketRows(parseCsv(text), source, o);
}

/** Rows (from CSV or an Excel sheet) -> snapshot rows. Unknown columns are ignored (no descriptions). */
export function importTicketRows(rows: string[][], source: Source, o: CsvImportOptions = {}): CsvImportResult {
  const warnings: string[] = [];
  const empty = { tickets: [], warnings, columns: {}, skippedOldClosed: 0 };
  const linkAt = (ri: number) => o.links?.get(`${ri},0`);
  // Service Desk report exports put a few title lines ("IT Service Desk", "Total records : …") above the header.
  // Wrike exports have no ID column: the ID comes from each row's link.
  const hi = rows.slice(0, 25).findIndex((r) => {
    const cells = r.map((h) => (h ?? '').trim());
    const hasTitle = cells.some((c) => HEADERS.title.test(c));
    return hasTitle && (cells.some((c) => HEADERS.source_id.test(c)) || !!o.links?.size);
  });
  if (hi < 0) {
    warnings.push(`Could not find a header row with the ID and Subject (or Name) columns. First row: ${(rows[0] ?? []).join(', ')}`);
    return empty;
  }
  const header = rows[hi].map((h) => h.trim());
  const col: Partial<Record<HeaderKey, number>> = {};
  const columns: Record<string, string> = {};
  (Object.keys(HEADERS) as HeaderKey[]).forEach((k) => {
    const i = header.findIndex((h) => HEADERS[k].test(h));
    if (i >= 0) {
      col[k] = i;
      columns[k] = header[i];
    }
  });
  const get = (r: string[], k: HeaderKey) => {
    const v = col[k] !== undefined ? (r[col[k]!] ?? '').trim() : '';
    return EMPTY.test(v) ? '' : v;
  };
  const closedDays = o.closedDays ?? 90;
  const cutoff = new Date((o.now ?? new Date()).getTime() - closedDays * 864e5).toISOString();
  const isClosed = o.isClosed ?? ((s: string) => /^(closed|cancel+ed|rejected|completed)/i.test(s));
  const tickets: SourceTicket[] = [];
  const seen = new Set<string>();
  let skippedOldClosed = 0;
  let skippedHeadings = 0;
  rows.slice(hi + 1).forEach((r, n) => {
    const line = hi + n + 2;
    const link = linkAt(hi + 1 + n);
    const id = (get(r, 'source_id') || (source === 'Wrike' ? wrikeIdFrom(link) : '') || '').replace(/^#/, '');
    if (!id) {
      // A row with only a name and no link is a group heading ("New - Not Started", "Planning"…).
      if (o.links?.size && r.filter((c) => (c ?? '').trim()).length <= 3) return void skippedHeadings++;
      return void warnings.push(`Row ${line}: no ID, skipped.`);
    }
    if (seen.has(id)) return void warnings.push(`Row ${line}: duplicate ID ${id}, skipped.`);
    seen.add(id);
    const status = get(r, 'source_status') || 'Open';
    const closedAt = isClosed(status) ? parseDate(get(r, 'closed')) ?? parseDate(get(r, 'updated')) : parseDate(get(r, 'closed'));
    if (isClosed(status) && (!closedAt || closedAt < cutoff)) {
      skippedOldClosed++;
      return;
    }
    const created = parseDate(get(r, 'created'));
    if (!created && source !== 'Wrike') warnings.push(`Row ${line}: no readable created date, using now.`);
    const dept = get(r, 'department');
    tickets.push({
      source,
      source_id: id,
      source_url: link && /^https?:\/\//.test(link) ? link : fillLink(o.urlTemplate, id),
      title: maskNumbers(get(r, 'title')) || `(no subject) #${id}`,
      requester: get(r, 'requester') || dept || undefined,
      department: dept || undefined,
      source_status: status,
      // No Priority column in the Core report: the SLA ("High SLA", "VIP SLA"…) stands in for it.
      source_priority: get(r, 'source_priority') || get(r, 'sla') || undefined,
      source_owner: get(r, 'source_owner') || undefined,
      group: get(r, 'group') || undefined,
      category: get(r, 'category') || undefined,
      subcategory: get(r, 'subcategory') || undefined,
      created: created ?? new Date().toISOString(),
      closed: closedAt,
      due_by: parseDate(get(r, 'due_by')),
      responded: parseDate(get(r, 'responded')),
      last_note: parseDate(get(r, 'last_note')),
      last_modified: parseDate(get(r, 'updated')),
    });
  });
  return { tickets, warnings, columns, skippedOldClosed, skippedHeadings };
}

/**
 * Merges freshly imported rows into the previous snapshot: rows for other sources are kept, and per-field change
 * timestamps are carried forward / stamped so replay can detect sync conflicts.
 */
export function mergeSnapshot(prev: TicketsSnapshot | undefined, fresh: SourceTicket[], source: Source, by: string, mode: string): TicketsSnapshot {
  const now = new Date().toISOString();
  const old = new Map((prev?.items ?? []).filter((t) => t.source === source).map((t) => [t.source_id, t]));
  const items = fresh.map((t) => {
    const o = old.get(t.source_id);
    // Exports without a created date (Wrike) keep the date the hub first saw the item.
    if (o && t.created > o.created && !t.closed && t.source === 'Wrike') t = { ...t, created: o.created };
    const changed = { ...(o?.changed ?? {}) };
    if (o && (o.source_owner ?? '') !== (t.source_owner ?? '')) changed.source_owner = now;
    if (o && (o.source_priority ?? '') !== (t.source_priority ?? '')) changed.source_priority = now;
    return Object.keys(changed).length ? { ...t, changed } : t;
  });
  const keep = (prev?.items ?? []).filter((t) => t.source !== source);
  return { generatedAt: now, generatedBy: by, mode, items: [...keep, ...items] };
}

/** Flat export of every work item, for Power BI. */
export function itemsCsv(items: WorkItem[], config: HubConfig): string {
  const name = (u?: string) => config.people.find((p) => p.username === u)?.name ?? u ?? '';
  const sys = (id?: string) => config.systems.find((s) => s.id === id)?.name ?? id ?? '';
  const head = ['id', 'source', 'source_id', 'source_url', 'title', 'requester', 'source_status', 'bucket', 'column', 'rank', 'priority', 'impact', 'urgency', 'effort', 'score', 'system', 'owner', 'next_update_due', 'parent_id', 'created', 'graded', 'started', 'done'];
  return toCsv([
    head,
    ...items.map((i) => [i.id, i.source, i.source_id, i.source_url, i.title, i.requester, i.source_status, i.bucket, i.column, i.rank, i.priority, i.impact, i.urgency, i.effort, i.score, sys(i.system), name(i.owner), i.next_update_due, i.parent_id, i.created, i.graded, i.started, i.done]),
  ]);
}

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

const HEADERS: Record<keyof Pick<SourceTicket, 'source_id' | 'title' | 'requester' | 'source_status' | 'source_priority' | 'source_owner' | 'group' | 'category' | 'created' | 'closed'>, RegExp> = {
  source_id: /^(request\s*id|id|ticket\s*(id|number|#)?|request\s*#|display\s*id)$/i,
  title: /^(subject|title|summary)$/i,
  requester: /^(requester|requester\s*name|requested\s*by)$/i,
  source_status: /^(request\s*status|status)$/i,
  source_priority: /^priority$/i,
  source_owner: /^(technician|assigned\s*to|owner|assignee)$/i,
  group: /^(group|support\s*group|queue)$/i,
  category: /^(category|sub\s*category)$/i,
  created: /^(created\s*(time|date|on)?|date\s*created|opened)$/i,
  closed: /^(completed\s*(time|date)|closed\s*(time|date)|resolved\s*(time|date))$/i,
};

function parseDate(v: string): string | undefined {
  const s = v.trim();
  if (!s) return undefined;
  // Service Desk exports often use "Nov 18, 2026 09:14 AM" or "18/11/2026 09:14" style; Date handles the first.
  let d = new Date(s);
  if (isNaN(d.getTime())) {
    const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (m) d = new Date(+m[3], +m[1] - 1, +m[2], +(m[4] ?? 0), +(m[5] ?? 0));
  }
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

export interface CsvImportResult {
  tickets: SourceTicket[];
  warnings: string[];
  columns: Record<string, string>;
}

/** Turns a Service Desk Plus (or Wrike) CSV export into snapshot rows. Unknown columns are ignored (no descriptions). */
export function importTicketsCsv(text: string, source: Source, urlTemplate?: string): CsvImportResult {
  const rows = parseCsv(text);
  const warnings: string[] = [];
  if (rows.length < 2) return { tickets: [], warnings: ['The file has no data rows.'], columns: {} };
  const header = rows[0].map((h) => h.trim());
  const col: Partial<Record<keyof typeof HEADERS, number>> = {};
  const columns: Record<string, string> = {};
  (Object.keys(HEADERS) as (keyof typeof HEADERS)[]).forEach((k) => {
    const i = header.findIndex((h) => HEADERS[k].test(h));
    if (i >= 0) {
      col[k] = i;
      columns[k] = header[i];
    }
  });
  if (col.source_id === undefined || col.title === undefined) {
    return { tickets: [], warnings: [`Could not find the ID and Subject columns. Found: ${header.join(', ')}`], columns };
  }
  const get = (r: string[], k: keyof typeof HEADERS) => (col[k] !== undefined ? (r[col[k]!] ?? '').trim() : '');
  const tickets: SourceTicket[] = [];
  const seen = new Set<string>();
  rows.slice(1).forEach((r, n) => {
    const id = get(r, 'source_id').replace(/^#/, '');
    if (!id) return void warnings.push(`Row ${n + 2}: no ID, skipped.`);
    if (seen.has(id)) return void warnings.push(`Row ${n + 2}: duplicate ID ${id}, skipped.`);
    seen.add(id);
    const created = parseDate(get(r, 'created'));
    if (!created) warnings.push(`Row ${n + 2}: no readable created date, using now.`);
    tickets.push({
      source,
      source_id: id,
      source_url: urlTemplate ? urlTemplate.replace('{id}', encodeURIComponent(id)) : undefined,
      title: maskNumbers(get(r, 'title')) || `(no subject) #${id}`,
      requester: get(r, 'requester') || undefined,
      source_status: get(r, 'source_status') || 'Open',
      source_priority: get(r, 'source_priority') || undefined,
      source_owner: get(r, 'source_owner') || undefined,
      group: get(r, 'group') || undefined,
      category: get(r, 'category') || undefined,
      created: created ?? new Date().toISOString(),
      closed: parseDate(get(r, 'closed')),
    });
  });
  return { tickets, warnings, columns };
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

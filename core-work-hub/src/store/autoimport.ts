// Auto-import: a Service Desk export (e.g. "Core - All.csv", overwritten every hour by a scheduled export)
// sits in the hub folder's import\ folder. Whenever it changes, the first open hub that notices imports it
// with the same code as Settings → Ticket data, and stamps tickets.json so it isn't imported twice.
import { importTicketRows, importTicketsCsv, mergeSnapshot } from '../model/csv';
import { isStatus } from '../model/replay';
import { readXlsx } from '../model/xlsx';
import type { HubConfig, TicketsSnapshot } from '../model/types';
import type { HubStore } from './storage';

export const DEFAULT_IMPORT_FILE = 'Core - All.csv';

export interface ImportStatus {
  file: string;
  /** When the export file was last written. */
  lastModified?: number;
  /** When this hub last imported it. */
  importedAt?: string;
  count?: number;
  open?: number;
  error?: string;
  waiting?: boolean;
}

export async function autoImport(store: HubStore, config: HubConfig, snap: TicketsSnapshot | undefined, me: string, now = Date.now()): Promise<{ snap?: TicketsSnapshot; status?: ImportStatus }> {
  const ai = config.autoImport ?? {};
  if (ai.enabled === false || !store.statImport || !store.readImport) return {};
  const file = ai.file || DEFAULT_IMPORT_FILE;
  const st = await store.statImport(file);
  if (!st) return {};
  const base: ImportStatus = { file, lastModified: st.lastModified };
  const done = snap?.importedFrom;
  if (done && done.file === file && done.lastModified === st.lastModified && done.size === st.size) {
    const sd = snap!.items.filter((t) => t.source === 'SD');
    return { status: { ...base, importedAt: snap!.generatedAt, count: sd.length, open: sd.filter((t) => !isStatus(config.closedStatuses, t.source_status)).length } };
  }
  // The API sync is newer than this export: leave it alone.
  if (snap?.mode === 'api' && Date.parse(snap.generatedAt) > st.lastModified) return { status: { ...base, error: 'The Service Desk API sync is newer than this export, so it was not imported.' } };
  if (!store.writable) return { status: base };
  // Wait until the file has stopped changing (the export may still be writing it).
  if (now - st.lastModified < (ai.settleSeconds ?? 20) * 1000) return { status: { ...base, waiting: true } };

  const bytes = await store.readImport(file);
  const again = await store.statImport(file);
  if (!again || again.lastModified !== st.lastModified || again.size !== st.size) return { status: { ...base, waiting: true } };

  const opts = { urlTemplate: config.ticketUrls?.SD, isClosed: (s: string) => isStatus(config.closedStatuses, s) };
  let res;
  if (/\.xlsx$/i.test(file)) {
    const sheet = await readXlsx(bytes);
    res = importTicketRows(sheet.rows, 'SD', { ...opts, links: sheet.links });
  } else {
    res = importTicketsCsv(new TextDecoder().decode(bytes), 'SD', opts);
  }
  if (!res.tickets.length) return { status: { ...base, error: `No tickets found in ${file}. ${res.warnings[0] ?? ''}`.trim() } };
  const next: TicketsSnapshot = { ...mergeSnapshot(snap, res.tickets, 'SD', me, 'csv-auto'), importedFrom: { file, lastModified: st.lastModified, size: st.size } };
  await store.writeSnapshot(next);
  const open = res.tickets.filter((t) => !isStatus(config.closedStatuses, t.source_status)).length;
  return { snap: next, status: { ...base, importedAt: next.generatedAt, count: res.tickets.length, open } };
}

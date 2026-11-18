import { normalizeConfig, defaultConfig } from '../model/config';
import type { SourcedEvent } from '../model/replay';
import type { HubConfig, HubEvent, TicketsSnapshot } from '../model/types';

/**
 * Where the hub's files live. In production this is the shared folder (File System Access API in Edge).
 *
 *   <shared folder>/
 *     index.html            the app (this page)
 *     hub-config.json       people, roles, WIP limits, ownership map (edited by Nick)
 *     tickets.json          Service Desk snapshot, written only by the sync script / Nick's CSV import
 *     changes/<user>.jsonl  one append-only file per person; nobody writes anyone else's file
 */
export interface HubStore {
  kind: 'folder' | 'opfs' | 'demo';
  label: string;
  writable: boolean;
  readConfig(): Promise<HubConfig | undefined>;
  writeConfig(c: HubConfig): Promise<void>;
  readSnapshot(): Promise<TicketsSnapshot | undefined>;
  writeSnapshot(s: TicketsSnapshot): Promise<void>;
  /** All events from all change files. Incremental under the hood. */
  readEvents(): Promise<{ events: SourcedEvent[]; problems: string[] }>;
  append(user: string, events: HubEvent[]): Promise<void>;
}

export const CONFIG_FILE = 'hub-config.json';
export const TICKETS_FILE = 'tickets.json';
export const CHANGES_DIR = 'changes';

const safeName = (u: string) => u.toLowerCase().replace(/[^a-z0-9._-]/g, '_');

interface FileCache {
  lastModified: number;
  size: number;
  /** Bytes consumed (only whole lines). */
  offset: number;
  events: SourcedEvent[];
  problems: string[];
}

function parseLines(text: string, file: string, startLine: number, problems: string[]): SourcedEvent[] {
  const out: SourcedEvent[] = [];
  text.split('\n').forEach((line, i) => {
    const l = line.trim();
    if (!l) return;
    try {
      const e = JSON.parse(l) as HubEvent;
      if (!e || typeof e.type !== 'string' || typeof e.ts !== 'string' || typeof e.id !== 'string') throw new Error('missing fields');
      out.push({ event: e, file });
    } catch {
      problems.push(`${CHANGES_DIR}/${file}.jsonl line ${startLine + i + 1} is not valid and was skipped.`);
    }
  });
  return out;
}

export class FolderStore implements HubStore {
  kind: 'folder' | 'opfs';
  label: string;
  writable: boolean;
  private cache = new Map<string, FileCache>();
  private snapCache?: { lastModified: number; size: number; snap?: TicketsSnapshot };

  constructor(private root: FileSystemDirectoryHandle, kind: 'folder' | 'opfs', writable: boolean) {
    this.kind = kind;
    this.label = kind === 'opfs' ? 'Browser test storage' : root.name;
    this.writable = writable;
  }

  private async readJson<T>(name: string): Promise<T | undefined> {
    try {
      const fh = await this.root.getFileHandle(name);
      const text = await (await fh.getFile()).text();
      return text.trim() ? (JSON.parse(text) as T) : undefined;
    } catch (e) {
      if ((e as DOMException).name === 'NotFoundError') return undefined;
      throw new Error(`Could not read ${name}: ${(e as Error).message}`);
    }
  }

  /** Whole-file replace. createWritable writes to a swap file and swaps it in on close, so readers never see half a file. */
  private async writeText(dir: FileSystemDirectoryHandle, name: string, text: string) {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
  }

  async readConfig() {
    const raw = await this.readJson<Partial<HubConfig>>(CONFIG_FILE);
    return raw ? normalizeConfig(raw) : undefined;
  }
  async writeConfig(c: HubConfig) {
    await this.writeText(this.root, CONFIG_FILE, JSON.stringify(c, null, 2) + '\n');
  }

  async readSnapshot() {
    try {
      const fh = await this.root.getFileHandle(TICKETS_FILE);
      const f = await fh.getFile();
      if (this.snapCache && this.snapCache.lastModified === f.lastModified && this.snapCache.size === f.size) return this.snapCache.snap;
      const text = await f.text();
      const snap = text.trim() ? (JSON.parse(text) as TicketsSnapshot) : undefined;
      this.snapCache = { lastModified: f.lastModified, size: f.size, snap };
      return snap;
    } catch (e) {
      if ((e as DOMException).name === 'NotFoundError') return undefined;
      // The sync may be mid-write on a slow share; keep the last good copy.
      if (this.snapCache) return this.snapCache.snap;
      throw new Error(`Could not read ${TICKETS_FILE}: ${(e as Error).message}`);
    }
  }
  async writeSnapshot(s: TicketsSnapshot) {
    await this.writeText(this.root, TICKETS_FILE, JSON.stringify(s, null, 1) + '\n');
    this.snapCache = undefined;
  }

  private async changesDir(create: boolean) {
    try {
      return await this.root.getDirectoryHandle(CHANGES_DIR, { create });
    } catch (e) {
      if ((e as DOMException).name === 'NotFoundError') return undefined;
      throw e;
    }
  }

  async readEvents() {
    const dir = await this.changesDir(false);
    const events: SourcedEvent[] = [];
    const problems: string[] = [];
    if (!dir) return { events, problems };
    const seen = new Set<string>();
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind !== 'file' || !name.endsWith('.jsonl')) continue;
      const user = name.slice(0, -'.jsonl'.length);
      seen.add(user);
      const f = await (handle as FileSystemFileHandle).getFile();
      let c = this.cache.get(user);
      if (!c || f.size < c.offset || (f.lastModified !== c.lastModified && f.size === c.size)) {
        c = { lastModified: 0, size: 0, offset: 0, events: [], problems: [] };
      }
      if (f.size !== c.size || f.lastModified !== c.lastModified) {
        const tail = await f.slice(c.offset).text();
        const lastNl = tail.lastIndexOf('\n');
        if (lastNl >= 0) {
          const whole = tail.slice(0, lastNl + 1);
          const startLine = c.events.length + c.problems.length;
          c.events = c.events.concat(parseLines(whole, user, startLine, c.problems));
          c.offset += new TextEncoder().encode(whole).length;
        }
        c.size = f.size;
        c.lastModified = f.lastModified;
        this.cache.set(user, c);
      }
      events.push(...c.events);
      problems.push(...c.problems);
    }
    for (const k of this.cache.keys()) if (!seen.has(k)) this.cache.delete(k);
    return { events, problems };
  }

  async append(user: string, evs: HubEvent[]) {
    if (!this.writable) throw new Error('This hub is open read-only.');
    const dir = (await this.changesDir(true))!;
    const name = safeName(user) + '.jsonl';
    const body = evs.map((e) => JSON.stringify(e)).join('\n') + '\n';
    const run = async () => {
      const fh = await dir.getFileHandle(name, { create: true });
      const f = await fh.getFile();
      let prefix = '';
      if (f.size > 0) {
        const last = await f.slice(f.size - 1).text();
        if (last !== '\n') prefix = '\n';
      }
      const w = await fh.createWritable({ keepExistingData: true });
      await w.seek(f.size);
      await w.write(prefix + body);
      await w.close();
    };
    // Two tabs of the same person must not interleave appends to the same file.
    if (navigator.locks) await navigator.locks.request(`cwh-append-${name}`, run);
    else await run();
  }
}

// ------------------------------------------------------------------------------------ demo store

const DEMO_PREFIX = 'cwh.demo.';

/** Everything in localStorage. Lets people try the hub (and see live updates across tabs) without the shared folder. */
export class DemoStore implements HubStore {
  kind = 'demo' as const;
  label = 'Demo data (this browser only)';
  writable = true;
  constructor(private seed: () => { config: HubConfig; snapshot: TicketsSnapshot; events: HubEvent[] }) {
    if (!localStorage.getItem(DEMO_PREFIX + 'config')) this.reset();
  }
  reset() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(DEMO_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    const s = this.seed();
    localStorage.setItem(DEMO_PREFIX + 'config', JSON.stringify(s.config));
    localStorage.setItem(DEMO_PREFIX + 'snapshot', JSON.stringify(s.snapshot));
    const byUser = new Map<string, HubEvent[]>();
    s.events.forEach((e) => byUser.set(e.user, [...(byUser.get(e.user) ?? []), e]));
    byUser.forEach((evs, u) => localStorage.setItem(DEMO_PREFIX + 'changes.' + u, evs.map((e) => JSON.stringify(e)).join('\n') + '\n'));
  }
  async readConfig() {
    const t = localStorage.getItem(DEMO_PREFIX + 'config');
    return t ? normalizeConfig(JSON.parse(t)) : defaultConfig();
  }
  async writeConfig(c: HubConfig) {
    localStorage.setItem(DEMO_PREFIX + 'config', JSON.stringify(c));
  }
  async readSnapshot() {
    const t = localStorage.getItem(DEMO_PREFIX + 'snapshot');
    return t ? (JSON.parse(t) as TicketsSnapshot) : undefined;
  }
  async writeSnapshot(s: TicketsSnapshot) {
    localStorage.setItem(DEMO_PREFIX + 'snapshot', JSON.stringify(s));
  }
  async readEvents() {
    const events: SourcedEvent[] = [];
    const problems: string[] = [];
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(DEMO_PREFIX + 'changes.')) continue;
      const user = k.slice((DEMO_PREFIX + 'changes.').length);
      events.push(...parseLines(localStorage.getItem(k) ?? '', user, 0, problems));
    }
    return { events, problems };
  }
  async append(user: string, evs: HubEvent[]) {
    const k = DEMO_PREFIX + 'changes.' + safeName(user);
    localStorage.setItem(k, (localStorage.getItem(k) ?? '') + evs.map((e) => JSON.stringify(e)).join('\n') + '\n');
  }
}

// ------------------------------------------------------------------------------------ handle persistence

const DB = 'core-work-hub';
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function saveHandle(h: FileSystemDirectoryHandle | null) {
  const db = await idb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    if (h) tx.objectStore('kv').put(h, 'root');
    else tx.objectStore('kv').delete('root');
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
export async function loadHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const r = db.transaction('kv').objectStore('kv').get('root');
      r.onsuccess = () => res(r.result as FileSystemDirectoryHandle | undefined);
      r.onerror = () => res(undefined);
    });
  } catch {
    return undefined;
  }
}

export const fsAccessSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

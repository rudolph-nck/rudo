import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { replay, type SourcedEvent } from '../model/replay';
import type { HubConfig, HubEvent, HubState, NewEvent, Role, TicketsSnapshot } from '../model/types';
import { canGrade, findPerson } from '../model/logic';
import type { HubStore } from './storage';

export const POLL_MS = 20_000;

interface HubCtx {
  store: HubStore;
  state: HubState;
  me: string;
  role: Role | undefined;
  /** Manager, or analyst when analystsCanGrade. */
  grader: boolean;
  readOnly: boolean;
  lastSync?: Date;
  syncing: boolean;
  error?: string;
  problems: string[];
  /** Write events to my change file and apply them right away. */
  commit: (events: NewEvent[]) => Promise<boolean>;
  refresh: () => Promise<void>;
  writeSnapshot: (s: TicketsSnapshot) => Promise<void>;
  signOut: () => void;
}

const Ctx = createContext<HubCtx | null>(null);
export const useHub = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useHub outside provider');
  return c;
};

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

/** Field name in an event -> field name on the work item, for the audit trail's "before". */
const FIELD_MAP: Record<string, string> = { rankKey: 'rank' };

export function HubProvider({ store, config, me, onSignOut, children }: { store: HubStore; config: HubConfig; me: string; onSignOut: () => void; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<TicketsSnapshot | undefined>();
  const [events, setEvents] = useState<SourcedEvent[]>([]);
  const [pending, setPending] = useState<SourcedEvent[]>([]);
  const [lastSync, setLastSync] = useState<Date>();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string>();
  const [problems, setProblems] = useState<string[]>([]);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setSyncing(true);
    try {
      const [snap, ev] = await Promise.all([store.readSnapshot(), store.readEvents()]);
      setSnapshot(snap);
      setEvents(ev.events);
      setProblems(ev.problems);
      // Drop optimistic events once they show up in the files.
      setPending((p) => {
        const ids = new Set(ev.events.map((x) => x.event.id));
        return p.filter((x) => !ids.has(x.event.id));
      });
      setLastSync(new Date());
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busy.current = false;
      setSyncing(false);
    }
  }, [store]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), POLL_MS);
    const onVis = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVis);
    // Demo store: other tabs write localStorage; pick that up immediately.
    const onStorage = (e: StorageEvent) => e.key?.startsWith('cwh.demo.') && void refresh();
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  const state = useMemo(() => {
    const ids = new Set(events.map((e) => e.event.id));
    return replay(config, snapshot, [...events, ...pending.filter((p) => !ids.has(p.event.id))]);
  }, [config, snapshot, events, pending]);

  const stateRef = useRef(state);
  stateRef.current = state;

  const role = findPerson(config, me)?.role;
  const readOnly = role === 'viewer' || !store.writable;

  const commit = useCallback(
    async (news: NewEvent[]) => {
      if (readOnly || !news.length) return false;
      const base = Date.now();
      const full: HubEvent[] = news.map((n, i) => {
        const e = { ...n, id: uid(), ts: new Date(base + i).toISOString(), user: me } as HubEvent;
        if ('item' in e && e.item && e.type !== 'item.create' && 'data' in e) {
          const it = stateRef.current.items.get(e.item) as unknown as Record<string, unknown> | undefined;
          if (it) {
            const before: Record<string, unknown> = {};
            for (const k of Object.keys(e.data as object)) before[k] = it[FIELD_MAP[k] ?? k] ?? null;
            if (Object.keys(before).length) e.before = before;
          }
        }
        return e;
      });
      const sourced = full.map((event) => ({ event, file: me }));
      setPending((p) => [...p, ...sourced]);
      try {
        await store.append(me, full);
        setError(undefined);
        return true;
      } catch (err) {
        setPending((p) => p.filter((x) => !full.includes(x.event)));
        setError(`Could not save your change: ${(err as Error).message}`);
        return false;
      }
    },
    [me, readOnly, store],
  );

  const writeSnapshot = useCallback(
    async (s: TicketsSnapshot) => {
      await store.writeSnapshot(s);
      await refresh();
    },
    [store, refresh],
  );

  const value: HubCtx = {
    store,
    state,
    me,
    role,
    grader: canGrade(config, me),
    readOnly,
    lastSync,
    syncing,
    error,
    problems,
    commit,
    refresh,
    writeSnapshot,
    signOut: onSignOut,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

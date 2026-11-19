import { BrandMark } from './components/logo';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProfileDialog } from './components/Profile';
import { useCallback, useEffect, useState } from 'react';
import { HubProvider, useHub } from './store/hub';
import { DemoStore, FolderStore, fsAccessSupported, LauncherStore, launcherKey, launcherMode, loadHandle, loadIdentity, saveHandle, saveIdentity, type HubStore } from './store/storage';
import { defaultConfig } from './model/config';
import { currentDispatch, findPerson, nextDispatch, fmtShortDate, offOn, todayISO } from './model/logic';
import type { HubConfig } from './model/types';
import { demoSeed } from './demo';
import { NavCtx, parseHash, useNav, type View } from './nav';
import { UiProvider } from './components/actions';
import { Avatar, Icon, Toaster, useCopyLinks } from './components/ui';
import { Board } from './views/Board';
import { Triage } from './views/Triage';
import { Team } from './views/Team';
import { Overview } from './views/Overview';
import { Rotation } from './views/Rotation';
import { TimeOff } from './views/TimeOff';
import { Priorities } from './views/Priorities';
import { TeamScore } from './views/TeamScore';
import { Notifications, useDesktopAlerts, useNow } from './views/Notifications';
import { noticesFor } from './model/comms';
import { Audit } from './views/Audit';
import { Settings } from './views/Settings';
import { MyWork, NeedsList } from './views/Lists';

// ------------------------------------------------------------------ theme
type Theme = 'auto' | 'light' | 'dark';
const getTheme = (): Theme => {
  try {
    return (localStorage.getItem('cwh.theme') as Theme) || 'auto';
  } catch {
    return 'auto';
  }
};
function applyTheme(t: Theme) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}
applyTheme(getTheme());

function ThemeToggle() {
  const [t, setT] = useState<Theme>(getTheme);
  const set = (v: Theme) => {
    setT(v);
    applyTheme(v);
    try { localStorage.setItem('cwh.theme', v); } catch { /* ignore */ }
  };
  return (
    <div className="seg theme-seg" role="radiogroup" aria-label="Color theme">
      {([['auto', 'auto', 'System'], ['light', 'sun', 'Light'], ['dark', 'moon', 'Dark']] as const).map(([v, icon, label]) => (
        <button key={v} role="radio" aria-checked={t === v} onClick={() => set(v)} title={label} aria-label={label}>
          <Icon name={icon} size={16} />
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ shell
function Sidebar() {
  const { state, me, lastSync, syncing, refresh, signOut, store, readOnly, error } = useHub();
  const { view, go } = useNav();
  const cfg = state.config;
  const intake = [...state.items.values()].filter((i) => i.column === 'Intake' && !i.stale).length;
  const outToday = (cfg.timeOff ?? []).filter((t) => t.from <= todayISO() && todayISO() <= t.to).length;
  const now = useNow();
  const myNotices = noticesFor(state, me, now);
  const escalated = myNotices.some((n) => n.status.lateMinutes > 0);
  const disp = currentDispatch(cfg);
  const next = nextDispatch(cfg);
  const meP = findPerson(cfg, me);
  const [profileOpen, setProfileOpen] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, []);
  const ago = lastSync ? Math.round((Date.now() - lastSync.getTime()) / 1000) : undefined;
  const items: [View, string, string, number?][] = [
    ['notifications', 'bell', 'Notifications', myNotices.length],
    ['overview', 'chart', 'Overview'],
    ['board', 'board', 'Board'],
    ['priorities', 'flag', 'Priorities'],
    ['teamscore', 'star', 'Team score'],
    ['mine', 'me', 'My work'],
    ['triage', 'inbox', 'Intake', intake],
    ['team', 'team', 'Team'],
    ['rotation', 'clock', 'Rotation'],
    ['timeoff', 'calendar', 'Time off', outToday],
  ];
  return (
    <aside className="sidebar" aria-label="Main">
      <div className="brand">
        <BrandMark />
        Core Work Hub
      </div>
      <nav className="nav" aria-label="Views">
        {items.map(([v, icon, label, count]) => (
          <button key={v} aria-current={view === v ? 'page' : undefined} onClick={() => go(v)}>
            <Icon name={icon} />
            {label}
            {count ? (
              <span className={`count ${v === 'notifications' && escalated ? 'alert' : ''}`} aria-label={v === 'timeoff' ? `${count} out today` : v === 'notifications' ? `${count} notifications` : `${count} waiting`}>
                {count}
              </span>
            ) : null}
          </button>
        ))}
        <div className="nav-sep" />
        <button aria-current={view === 'audit' ? 'page' : undefined} onClick={() => go('audit')}><Icon name="log" />Audit log</button>
        <button aria-current={view === 'settings' ? 'page' : undefined} onClick={() => go('settings')}><Icon name="gear" />Settings</button>
      </nav>

      <section className="dispatch-card" aria-label="Dispatcher" onClick={(e) => { if (!(e.target as HTMLElement).closest('button')) go('rotation'); }} title="Support rotation">
        <div className="section-title">On support</div>
        {disp ? (
          <>
            <div className="who">
              <Avatar user={disp.analyst} config={cfg} />
              {findPerson(cfg, disp.analyst)?.name ?? disp.analyst}
            </div>
            {offOn(cfg, disp.analyst) && <div className="chip bad" style={{ marginBottom: 4 }}>Off today: set a cover</div>}
            <div className="small muted dc-until">Until {fmtShortDate(disp.to)}{disp.escalation ? ` · escalation ${findPerson(cfg, disp.escalation)?.name ?? disp.escalation}` : ''}</div>
          </>
        ) : (
          <div className="small muted" style={{ marginTop: 6 }}>No one scheduled. Set up the rotation.</div>
        )}
        {next && <div className="small muted dc-next" style={{ marginTop: 6 }}>Next: {findPerson(cfg, next.analyst)?.name} from {fmtShortDate(next.from)}</div>}
        <button className="btn sm ghost dc-link" style={{ marginTop: 6, paddingLeft: 0 }} onClick={() => go('rotation')}>Schedule →</button>
      </section>

      <div className="sidebar-foot">
        {store.kind === 'demo' && <span className="chip warn" style={{ alignSelf: 'flex-start' }}>Demo data</span>}
        {readOnly && <span className="chip src" style={{ alignSelf: 'flex-start' }}>Read-only</span>}
        <div className="row small muted foot-row" aria-live="polite">
          <span className="grow">{error ? <span className="danger-text">Sync problem</span> : syncing ? 'Syncing…' : ago !== undefined ? `Synced ${ago < 5 ? 'now' : ago + 's ago'}` : ''}</span>
          <button className="btn icon ghost" onClick={() => void refresh()} aria-label="Refresh now" title="Refresh now"><Icon name="refresh" size={16} /></button>
        </div>
        <div className="row">
          <button className="me-btn" onClick={() => setProfileOpen(true)} title="Change your avatar: colour, emoji or photo" aria-label={`${meP?.name ?? me}: change my avatar`}>
            <Avatar user={me} config={cfg} />
            <span className="grow" style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meP?.name ?? me}</span>
          </button>
          <ThemeToggle />
          <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
          {store.kind !== 'launcher' && <button className="btn sm ghost" onClick={signOut} title="Change who you are on this PC">Not you?</button>}
        </div>
      </div>
    </aside>
  );
}

function Shell() {
  const { error, role } = useHub();
  useDesktopAlerts();
  useCopyLinks();
  const [route, setRoute] = useState(() => (location.hash.length > 2 ? parseHash(location.hash) : { view: (role === 'analyst' ? 'board' : 'overview') as View, param: undefined }));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((v: View, p?: string) => {
    location.hash = `/${v}${p ? '/' + encodeURIComponent(p) : ''}`;
  }, []);
  useEffect(() => {
    document.title = `${{ overview: 'Overview', rotation: 'Rotation', timeoff: 'Time off', priorities: 'Priorities', teamscore: 'Team score', notifications: 'Notifications', board: 'Board', mine: 'My work', triage: 'Triage', team: 'Team', metrics: 'Metrics', audit: 'Audit log', settings: 'Settings', list: 'Needs you' }[route.view]} · Core Work Hub`;
    (document.querySelector('main') as HTMLElement | null)?.focus({ preventScroll: true });
  }, [route.view]);
  return (
    <NavCtx.Provider value={{ ...route, go }}>
      <UiProvider>
        <div className="app">
          <Sidebar />
          <main className="main" tabIndex={-1} style={{ outline: 'none' }}>
            {error && <div className="banner error" role="alert" style={{ margin: '16px 28px 0' }}>{error}</div>}
            <ErrorBoundary key={route.view}>
              {route.view === 'board' && <Board />}
              {route.view === 'mine' && <MyWork />}
              {route.view === 'triage' && <Triage />}
              {route.view === 'team' && <Team />}
              {route.view === 'overview' && <Overview />}
              {route.view === 'rotation' && <Rotation />}
              {route.view === 'timeoff' && <TimeOff />}
              {route.view === 'priorities' && <Priorities />}
              {route.view === 'teamscore' && <TeamScore />}
              {route.view === 'notifications' && <Notifications />}
              {route.view === 'audit' && <Audit />}
              {route.view === 'settings' && <Settings />}
              {route.view === 'list' && <NeedsList />}
            </ErrorBoundary>
          </main>
        </div>
        <Toaster />
      </UiProvider>
    </NavCtx.Provider>
  );
}

// ------------------------------------------------------------------ gates: folder -> config -> identity

type Gate =
  | { k: 'loading' }
  | { k: 'helper'; err: string }
  | { k: 'connect'; unsupported: boolean; err?: string }
  | { k: 'reconnect'; handle: FileSystemDirectoryHandle }
  | { k: 'noconfig'; store: HubStore }
  | { k: 'ready'; store: HubStore; config: HubConfig };

const params = new URLSearchParams(location.search);

async function openFolder(handle: FileSystemDirectoryHandle): Promise<HubStore> {
  let rw = (await handle.queryPermission({ mode: 'readwrite' })) === 'granted';
  if (!rw) rw = (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
  if (!rw && (await handle.requestPermission({ mode: 'read' })) !== 'granted') throw new Error('Folder access was not granted.');
  return new FolderStore(handle, 'folder', rw);
}

export function App() {
  const [gate, setGate] = useState<Gate>({ k: 'loading' });
  const [me, setMe] = useState<string | undefined>(() => params.get('as') ?? (() => { try { return localStorage.getItem('cwh.me') ?? undefined; } catch { return undefined; } })());
  // The pick is saved twice (localStorage + IndexedDB) so it's a one-time choice on each PC.
  useEffect(() => {
    if (!me) void loadIdentity().then((u) => u && setMe((cur) => cur ?? u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const withStore = async (store: HubStore) => {
    const config = await store.readConfig();
    setGate(config ? { k: 'ready', store, config } : { k: 'noconfig', store });
  };

  useEffect(() => {
    (async () => {
      try {
        // Desktop icon: the Python launcher serves the page and writes the folder as the Windows user.
        if (launcherMode()) {
          const ls = await new LauncherStore(launcherKey()!).init();
          setMe(ls.user);
          return withStore(ls);
        }
        if (params.has('demo') || localStorage.getItem('cwh.mode') === 'demo') return withStore(new DemoStore(demoSeed));
        if (params.get('store') === 'opfs') {
          const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('hub', { create: true });
          return withStore(new FolderStore(root, 'opfs', true));
        }
        if (!fsAccessSupported()) return setGate({ k: 'connect', unsupported: true });
        const h = await loadHandle();
        if (!h) return setGate({ k: 'connect', unsupported: false });
        const perm = await h.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') return withStore(new FolderStore(h, 'folder', true));
        if ((await h.queryPermission({ mode: 'read' })) === 'granted') return withStore(new FolderStore(h, 'folder', false));
        setGate({ k: 'reconnect', handle: h });
      } catch (e) {
        if (launcherMode()) return setGate({ k: 'helper', err: (e as Error).message });
        setGate({ k: 'connect', unsupported: !fsAccessSupported(), err: (e as Error).message });
      }
    })();
  }, []);

  const pick = async () => {
    try {
      const h = await window.showDirectoryPicker({ id: 'core-work-hub', mode: 'readwrite' });
      await saveHandle(h);
      await withStore(await openFolder(h));
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') setGate({ k: 'connect', unsupported: false, err: (e as Error).message });
    }
  };
  const demo = () => {
    try { localStorage.setItem('cwh.mode', 'demo'); } catch { /* ignore */ }
    void withStore(new DemoStore(demoSeed));
  };
  const leaveDemo = () => {
    localStorage.removeItem('cwh.mode');
    location.search = '';
  };

  if (gate.k === 'loading') return <div className="gate"><span className="muted">Loading…</span></div>;

  if (gate.k === 'helper')
    return (
      <div className="gate">
        <div className="gate-card">
          <div className="brand"><BrandMark />Core Work Hub</div>
          <h1>Start the hub from your desktop icon</h1>
          <p style={{ margin: 0 }}>{gate.err}</p>
        </div>
      </div>
    );

  if (gate.k === 'connect' || gate.k === 'reconnect')
    return (
      <div className="gate">
        <div className="gate-card">
          <div className="brand"><BrandMark />Core Work Hub</div>
          {gate.k === 'reconnect' ? (
            <>
              <h1>Reconnect to the shared folder</h1>
              <p className="muted" style={{ margin: 0 }}>Edge needs your OK once per session to read and write <strong>{gate.handle.name}</strong>. Choose “Allow on every visit” to skip this next time.</p>
              <button className="btn primary" onClick={async () => { try { await withStore(await openFolder(gate.handle)); } catch (e) { setGate({ k: 'connect', unsupported: false, err: (e as Error).message }); } }}>
                <Icon name="folder" /> Reconnect to {gate.handle.name}
              </button>
              <button className="btn ghost" onClick={pick}>Choose a different folder</button>
            </>
          ) : gate.unsupported ? (
            <>
              <h1>Open this page in Microsoft Edge</h1>
              <p className="muted" style={{ margin: 0 }}>The hub uses Edge’s built-in folder access to read and write the shared folder. This browser doesn’t have it.</p>
              <button className="btn" onClick={demo}>Look around with demo data</button>
            </>
          ) : (
            <>
              <h1>Connect the shared folder</h1>
              <p className="muted" style={{ margin: 0 }}>
                Pick the Core Work Hub folder on the shared drive (the folder that holds this page and <code>hub-config.json</code>). Edge asks once and remembers it.
              </p>
              {gate.err && <div className="banner error" role="alert">{gate.err}</div>}
              <button className="btn primary" onClick={pick}><Icon name="folder" /> Choose the shared folder</button>
              <button className="btn" onClick={demo}>Try it with demo data instead</button>
            </>
          )}
        </div>
      </div>
    );

  if (gate.k === 'noconfig')
    return (
      <div className="gate">
        <div className="gate-card">
          <h1>No hub-config.json in “{gate.store.label}”</h1>
          <p className="muted" style={{ margin: 0 }}>
            This folder hasn’t been set up. If it’s the right folder, create a starter config (people, roles, WIP limits and a sample ownership map) and edit the usernames afterwards.
          </p>
          <button className="btn primary" disabled={!gate.store.writable} onClick={async () => { await gate.store.writeConfig(defaultConfig()); await withStore(gate.store); }}>
            Create starter hub-config.json
          </button>
          <button className="btn" onClick={pick}>Choose a different folder</button>
        </div>
      </div>
    );

  const config = gate.config;
  const person = me ? findPerson(config, me) : undefined;
  if (!person && gate.store.kind === 'launcher')
    return (
      <div className="gate">
        <div className="gate-card">
          <div className="brand"><BrandMark />Core Work Hub</div>
          <h1>You’re not on the hub yet</h1>
          <p style={{ margin: 0 }}>
            You’re signed in to Windows as <code>{gate.store.user}</code>, but that username isn’t in <code>hub-config.json</code>. Ask Nick to add it (people → username), then open the hub again.
          </p>
        </div>
      </div>
    );
  if (!person)
    return (
      <div className="gate">
        <div className="gate-card">
          <div className="brand"><BrandMark />Core Work Hub</div>
          <h1>Who are you?</h1>
          <p className="muted" style={{ margin: 0 }}>Your changes are saved to your own file, <code>changes/&lt;your username&gt;.jsonl</code>, and signed with your name in the audit log.</p>
          <div className="people">
            {config.people.map((p) => (
              <button key={p.username} onClick={() => { void saveIdentity(p.username); setMe(p.username); }}>
                <Avatar user={p.username} config={config} />
                <span className="grow">{p.name}<br /><span className="small muted" style={{ fontWeight: 500 }}>{p.role === 'manager' ? 'Manager' : p.role === 'viewer' ? 'Viewer' : 'Analyst'} · {p.username}</span></span>
              </button>
            ))}
          </div>
          {gate.store.kind === 'demo' && <button className="btn ghost" onClick={leaveDemo}>Leave demo and connect the real folder</button>}
        </div>
      </div>
    );

  return (
    <HubProvider
      key={gate.store.label + person.username}
      store={gate.store}
      config={config}
      me={person.username}
      onSignOut={() => {
        if (!confirm(`You're signed in as ${person.name}. Change who you are on this PC? Only do this if this isn't your computer.`)) return;
        void saveIdentity(null);
        setMe(undefined);
      }}
    >
      <Shell />
    </HubProvider>
  );
}

import { BrandMark } from './components/logo';
import { ErrorBoundary } from './components/ErrorBoundary';
import { splash } from './components/Splash';
import { Standup } from './views/Standup';
import { Training } from './views/Training';
import { PandaHQ } from './views/PandaHQ';
import { TourHost, startTour } from './training/Tour';
import { LESSONS, lessonsFor } from './training/lessons';
import { standup } from './model/priority';
import { ProfileDialog, toAvatarPhoto } from './components/Profile';
import { AppearanceDialog, bootAppearance, ModeToggle, QuickThemes, useAppearanceSync } from './components/Appearance';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HubProvider, useHub } from './store/hub';
import { DemoStore, FolderStore, fsAccessSupported, LauncherStore, launcherKey, launcherMode, loadHandle, loadIdentity, saveHandle, saveIdentity, type HubStore } from './store/storage';
import { defaultConfig } from './model/config';
import { currentDispatch, findPerson, nextDispatch, fmtShortDate, offOn, todayISO, initials } from './model/logic';
import type { HubConfig } from './model/types';
import { demoSeed } from './demo';
import { NavCtx, parseHash, useNav, type View } from './nav';
import { UiProvider } from './components/actions';
import { Avatar, avatarColor, Icon, Toaster, useCopyLinks } from './components/ui';
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
import { NeedsList } from './views/Lists';
import { Projects } from './views/Projects';
import { Tickets } from './views/Tickets';
import { Trends } from './views/Trends';
import { Explore } from './views/Explore';
import { OffPath } from './views/OffPath';
import { MyWork } from './views/MyWork';
import { canOpen, homeFor, isAdmin, sectionOf, sectionsFor, type Section } from './sections';
import { myWork } from './model/mywork';
import { LEVEL_LABEL } from './model/types';

// ------------------------------------------------------------------ theme (per person: see components/Appearance)
bootAppearance();

// ------------------------------------------------------------------ shell
const getCollapsed = () => {
  try {
    const v = localStorage.getItem('cwh.navCollapsed');
    if (v !== null) return v === '1';
  } catch { /* ignore */ }
  return window.innerWidth < 1200;
};

function Sidebar({ collapsed, onToggle, sectionId }: { collapsed: boolean; onToggle: () => void; sectionId?: string }) {
  const { state, me, role, store, readOnly } = useHub();
  const { view, go } = useNav();
  const cfg = state.config;
  const now = useNow();
  const intake = [...state.items.values()].filter((i) => i.column === 'Intake' && !i.stale).length;
  const outToday = (cfg.timeOff ?? []).filter((t) => t.from <= todayISO() && todayISO() <= t.to).length;
  const disp = currentDispatch(cfg);
  const next = nextDispatch(cfg);
  const mustDiscuss = useMemo(() => (isAdmin(role) ? standup(state, now).mustDiscuss : 0), [state, now, role]);
  const myFocus = useMemo(() => myWork(state, me, now).focus.length, [state, me, now]);
  const sections = sectionsFor(role);
  const current = sectionOf(role, view, sectionId);
  const counts: Record<string, [number, string] | undefined> = {
    overview: mustDiscuss ? [mustDiscuss, `${mustDiscuss} to discuss at stand-up`] : undefined,
    mine: myFocus ? [myFocus, `${myFocus} need focus`] : undefined,
    board: intake ? [intake, `${intake} in intake`] : undefined,
    team: outToday ? [outToday, `${outToday} out today`] : undefined,
  };
  const button = (sec: Section) => {
    const c = counts[sec.id];
    return (
      <button
        key={sec.id}
        data-section={sec.id}
        aria-current={current?.id === sec.id ? 'page' : undefined}
        onClick={() => go(sec.tabs[0].view)}
        title={collapsed ? sec.label + (c ? ` (${c[1]})` : '') : undefined}
        aria-label={collapsed ? sec.label : undefined}
      >
        <Icon name={sec.icon} />
        <span className="lbl">{sec.label}</span>
        {c ? <span className="count" aria-label={c[1]}>{c[0]}</span> : null}
      </button>
    );
  };
  const main = sections.filter((x) => !x.admin);
  const admin = sections.filter((x) => x.admin);
  return (
    <aside className="sidebar" aria-label="Main">
      <div className="brand">
        <BrandMark />
        <span className="lbl grow">Core Work Hub</span>
        <button className="btn icon ghost nav-toggle" onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand menu' : 'Collapse menu'} title={collapsed ? 'Expand menu' : 'Collapse menu'}>
          <Icon name="sidebar" size={18} />
        </button>
      </div>
      <nav className="nav" aria-label="Views">
        {main.map(button)}
        {admin.length > 0 && (
          <>
            <div className="nav-sep" />
            <div className="nav-group lbl">Admin</div>
            {admin.map(button)}
          </>
        )}
      </nav>

      <section className="dispatch-card" aria-label="Dispatcher" onClick={(e) => { if (!(e.target as HTMLElement).closest('button')) go('rotation'); }} title={collapsed && disp ? `On support: ${findPerson(cfg, disp.analyst)?.name ?? disp.analyst}` : 'Support rotation'}>
        <div className="section-title">On support</div>
        {disp ? (
          <>
            <div className="who">
              <Avatar user={disp.analyst} config={cfg} />
              <span className="lbl">{findPerson(cfg, disp.analyst)?.name ?? disp.analyst}</span>
            </div>
            {offOn(cfg, disp.analyst) && <div className="chip bad dc-off" style={{ marginBottom: 4 }}>Off today: set a cover</div>}
            <div className="small muted dc-until">Until {fmtShortDate(disp.to)}{disp.escalation ? ` · escalation ${findPerson(cfg, disp.escalation)?.name ?? disp.escalation}` : ''}</div>
          </>
        ) : (
          <div className="small muted dc-until" style={{ marginTop: 6 }}>No one scheduled. Set up the rotation.</div>
        )}
        {next && <div className="small muted dc-next" style={{ marginTop: 6 }}>Next: {findPerson(cfg, next.analyst)?.name} from {fmtShortDate(next.from)}</div>}
        <button className="btn sm ghost dc-link" style={{ marginTop: 6, paddingLeft: 0 }} onClick={() => go('rotation')}>Schedule →</button>
      </section>

      <div className="sidebar-foot">
        {store.kind === 'demo' && <span className="chip warn" style={{ alignSelf: 'flex-start' }}>Demo<span className="lbl">&nbsp;data</span></span>}
        {readOnly && <span className="chip src" style={{ alignSelf: 'flex-start' }}>Read-only</span>}
      </div>
    </aside>
  );
}

function ProfileMenu() {
  const { state, me, realMe, viewAs, setViewAs, store, signOut } = useHub();
  const { go } = useNav();
  const cfg = state.config;
  const real = findPerson(cfg, realMe);
  const shown = findPerson(cfg, me);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<'main' | 'viewas'>('main');
  const [profileOpen, setProfileOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const lessonsLeft = viewAs ? 0 : lessonsFor(real?.role, false).filter((l) => !state.training?.[realMe]?.[l.id]).length;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) { setPage('main'); return; }
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', off);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  const realRole = real?.role;
  const roleLabel = (p?: typeof real) => (p?.role === 'manager' ? 'Manager' : p?.role === 'viewer' ? 'Viewer' : p?.level ? LEVEL_LABEL[p.level] : 'Analyst');
  const preview = (u?: string) => {
    setOpen(false);
    setViewAs(u);
    const r = findPerson(cfg, u ?? realMe)?.role;
    location.hash = '/' + homeFor(r);
  };
  return (
    <div className="profile-wrap" ref={ref}>
      <button className={`me-btn ${viewAs ? 'previewing' : ''}`} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={`${shown?.name ?? me}: profile menu`} title={viewAs ? `Viewing as ${shown?.name}` : shown?.name ?? me}>
        <Avatar user={me} config={cfg} />
        <span className="me-name">{shown?.name ?? me}</span>
        {lessonsLeft > 0 && !open && <span className="me-dot" title={`${lessonsLeft} training lessons to go`} aria-hidden />}
      </button>
      {open && page === 'main' && (
        <div className="profile-menu" role="menu">
          <div className="pm-head">
            <Avatar user={realMe} config={cfg} size="lg" />
            <div>
              <strong>{real?.name ?? realMe}</strong>
              <div className="small muted">{roleLabel(real)} · {realMe}</div>
            </div>
          </div>
          {viewAs && (
            <button role="menuitem" className="pm-item pm-preview" onClick={() => preview(undefined)}><Icon name="x" size={16} />Stop viewing as {shown?.name}</button>
          )}
          <div className="pm-theme">
            <span className="small muted">Mode</span>
            <ModeToggle />
          </div>
          <div className="pm-theme col">
            <span className="small muted">Colour theme</span>
            <QuickThemes />
          </div>
          <button role="menuitem" className="pm-item" onClick={() => { setOpen(false); setAppearanceOpen(true); }}><Icon name="palette" size={16} />Appearance and custom themes…</button>
          <button role="menuitem" className="pm-item" disabled={!!viewAs} onClick={() => { setOpen(false); setProfileOpen(true); }}><Icon name="me" size={16} />Change my picture</button>
          {(realRole === 'manager' || realRole === 'viewer') && (
            <button role="menuitem" className="pm-item" onClick={() => setPage('viewas')}><Icon name="eye" size={16} />View as…<span className="grow" /><span className="muted">›</span></button>
          )}
          <button role="menuitem" className="pm-item" onClick={() => { setOpen(false); go('training'); }}><Icon name="help" size={16} />Help and training{lessonsLeft ? <span className="pm-count" aria-label={`${lessonsLeft} lessons to go`}>{lessonsLeft}</span> : null}</button>
          {store.kind !== 'launcher' && !viewAs && <button role="menuitem" className="pm-item" onClick={() => { setOpen(false); signOut(); }}><Icon name="logout" size={16} />Not you?</button>}
        </div>
      )}
      {open && page === 'viewas' && (
        <div className="profile-menu" role="menu" aria-label="View as">
          <button className="pm-item" onClick={() => setPage('main')}><span className="muted">‹</span>View as…</button>
          <div className="small muted" style={{ padding: '0 8px 6px' }}>See the hub exactly as they do: their menu, first page and work. Nothing you do is saved.</div>
          {cfg.people.filter((p) => p.username !== realMe).map((p) => (
            <button key={p.username} role="menuitemradio" aria-checked={viewAs === p.username} className="pm-item" onClick={() => preview(p.username)}>
              <Avatar user={p.username} config={cfg} />
              <span className="grow">{p.name}</span>
              <span className="small muted">{roleLabel(p)}</span>
            </button>
          ))}
        </div>
      )}
      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
      <AppearanceDialog open={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
    </div>
  );
}

function PreviewBar() {
  const { state, me, role, viewAs, setViewAs, realMe } = useHub();
  if (!viewAs) return null;
  const p = findPerson(state.config, me);
  const exit = () => {
    setViewAs(undefined);
    location.hash = '/' + homeFor(findPerson(state.config, realMe)?.role);
  };
  return (
    <div className="preview-bar" role="status">
      <Icon name="eye" size={18} />
      <span>Viewing as <strong>{p?.name ?? me}</strong> · {role === 'manager' ? 'Manager' : role === 'viewer' ? 'Viewer' : 'Team'} view. Try anything: nothing is saved.</span>
      <button className="btn sm" onClick={exit}>Exit preview</button>
    </div>
  );
}

function TopBar({ sectionId }: { sectionId?: string }) {
  const { state, me, role, lastSync, syncing, refresh, error } = useHub();
  const { view, go } = useNav();
  const now = useNow();
  const notices = noticesFor(state, me, now);
  const escalated = notices.some((n) => n.status.lateMinutes > 0);
  const section = sectionOf(role, view, sectionId);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, []);
  const ago = lastSync ? Math.round((Date.now() - lastSync.getTime()) / 1000) : undefined;
  return (
    <header className="topbar">
      {section && section.tabs.length > 1 ? (
        <nav className="section-tabs" aria-label={`${section.label} pages`}>
          {section.tabs.map((t) => (
            <button key={t.view} aria-current={view === t.view || (view === 'list' && t.view === 'board') ? 'page' : undefined} onClick={() => go(t.view)}>
              {t.label}
            </button>
          ))}
        </nav>
      ) : (
        <div className="topbar-title">{view === 'notifications' ? 'Notifications' : view === 'training' ? 'Help and training' : section?.label}</div>
      )}
      <div className="topbar-right">
        <span className="small muted sync-text" aria-live="polite">{error ? <span className="danger-text">Sync problem</span> : syncing ? 'Syncing…' : ago !== undefined ? `Synced ${ago < 5 ? 'now' : ago + 's ago'}` : ''}</span>
        <button className="btn icon ghost" onClick={() => void refresh()} aria-label="Refresh now" title="Refresh now"><Icon name="refresh" size={18} /></button>
        <button className={`btn icon ghost bell ${view === 'notifications' ? 'on' : ''}`} onClick={() => go('notifications')} aria-label={`Notifications${notices.length ? `, ${notices.length}` : ''}`} title="Notifications">
          <Icon name="bell" size={20} />
          {notices.length > 0 && <span className={`count ${escalated ? 'alert' : ''}`} aria-hidden="true">{notices.length > 99 ? '99+' : notices.length}</span>}
        </button>
        <ProfileMenu />
      </div>
    </header>
  );
}

/** First visit with no lessons done: offer the 2-minute tour once (per PC). */
function TrainingPrompt() {
  const { state, me, commit, readOnly, lastSync, viewAs } = useHub();
  const [hide, setHide] = useState(() => { try { return !!localStorage.getItem('cwh.trainPrompt.' + me); } catch { return true; } });
  const { go } = useNav();
  if (viewAs || hide || !lastSync || readOnly || Object.keys(state.training?.[me] ?? {}).length || navigator.webdriver) return null;
  const close = () => { try { localStorage.setItem('cwh.trainPrompt.' + me, '1'); } catch { /* ignore */ } setHide(true); };
  const first = LESSONS[0];
  return (
    <div className="train-prompt" role="dialog" aria-label="Training">
      <Icon name="learn" />
      <div className="grow">
        <strong>New to the hub?</strong>
        <div className="small muted">Take the 2-minute tour, or find every lesson under Help and training (click your picture, top right).</div>
      </div>
      <button className="btn sm ghost" onClick={() => { close(); go('training'); }}>Lessons</button>
      <button className="btn sm primary" onClick={() => { close(); startTour(first, () => void commit([{ type: 'training.done', data: { lesson: first.id } }])); }}>Start tour</button>
      <button className="btn icon ghost" onClick={close} aria-label="Not now"><Icon name="x" size={16} /></button>
    </div>
  );
}

function Shell() {
  const { error, role, state, me, lastSync, store, readOnly, commit, viewAs } = useHub();
  useAppearanceSync();
  const meP = findPerson(state.config, me);
  useEffect(() => {
    if (meP) splash.user(meP.name, initials(meP, me), avatarColor(me, state.config), meP.avatar);
    if (lastSync) splash.ready();
  }, [meP, me, state.config, lastSync]);
  // First time on the desktop icon with no avatar chosen: use the Windows account picture (they can change it).
  useEffect(() => {
    if (viewAs || !lastSync || readOnly || !store.windowsPicture || !meP || meP.avatar !== undefined) return;
    const key = 'cwh.winpicTried.' + me;
    try { if (localStorage.getItem(key)) return; } catch { return; }
    let cancelled = false;
    const done = () => { try { localStorage.setItem(key, '1'); } catch { /* ignore */ } };
    void (async () => {
      try {
        const blob = await store.windowsPicture!();
        if (cancelled) return;
        if (!blob) return done(); // Windows has no picture: don't ask again
        // Only mark it done once saved, so a reload mid-way tries again next time.
        if (await commit([{ type: 'profile.set', data: { photo: await toAvatarPhoto(blob) } }])) done();
      } catch { /* try again next time */ }
    })();
    return () => { cancelled = true; };
  }, [viewAs, lastSync, readOnly, store, meP, me, commit]);
  useDesktopAlerts();
  useCopyLinks();
  const [route, setRoute] = useState(() => (location.hash.length > 2 ? parseHash(location.hash) : { view: homeFor(role), param: undefined }));
  const [collapsed, setCollapsed] = useState(getCollapsed);
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem('cwh.navCollapsed', c ? '0' : '1'); } catch { /* ignore */ } return !c; });
  const allowed = canOpen(role, route.view);
  // Remember which section you're in, so a page shared by two sections (All tickets) doesn't jump the menu.
  const [sectionId, setSectionId] = useState<string | undefined>(() => sectionOf(role, route.view)?.id);
  useEffect(() => {
    setSectionId((prev) => sectionOf(role, route.view, prev)?.id);
  }, [role, route.view]);
  useEffect(() => {
    if (!allowed) location.replace('#/' + homeFor(role));
  }, [allowed, role]);
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((v: View, p?: string) => {
    location.hash = `/${v}${p ? '/' + encodeURIComponent(p) : ''}`;
  }, []);
  useEffect(() => {
    document.title = `${{ overview: 'Overview', rotation: 'Rotation', timeoff: 'Time off', priorities: 'Priorities', teamscore: 'Team score', notifications: 'Notifications', standup: 'Stand-up', training: 'Training', pandahq: 'Panda HQ', projects: 'Projects', tickets: 'All tickets', trends: 'Trends', explore: 'Ask', offpath: 'Off-path work', board: 'Board', mine: 'My work', triage: 'Triage', team: 'Team', metrics: 'Metrics', audit: 'Audit log', settings: 'Settings', list: 'Needs you' }[route.view]} · Core Work Hub`;
    (document.querySelector('main') as HTMLElement | null)?.focus({ preventScroll: true });
  }, [route.view]);
  return (
    <NavCtx.Provider value={{ ...route, go }}>
      <UiProvider>
        <div className={`app ${collapsed ? 'collapsed' : ''}`}>
          <Sidebar collapsed={collapsed} onToggle={toggle} sectionId={sectionId} />
          <main className="main" tabIndex={-1} style={{ outline: 'none' }}>
            <TopBar sectionId={sectionId} />
            {error && <div className="banner error" role="alert" style={{ margin: '16px 28px 0' }}>{error}</div>}
            {allowed && <ErrorBoundary key={route.view}>
              {route.view === 'board' && <Board />}
              {route.view === 'mine' && <MyWork />}
              {route.view === 'triage' && <Triage />}
              {route.view === 'team' && <Team />}
              {route.view === 'overview' && <Overview />}
              {route.view === 'rotation' && <Rotation />}
              {route.view === 'timeoff' && <TimeOff />}
              {route.view === 'priorities' && <Priorities />}
              {route.view === 'standup' && <Standup />}
              {route.view === 'training' && <Training />}
              {route.view === 'pandahq' && <PandaHQ />}
              {route.view === 'teamscore' && <TeamScore />}
              {route.view === 'notifications' && <Notifications />}
              {route.view === 'audit' && <Audit />}
              {route.view === 'settings' && <Settings />}
              {route.view === 'list' && <NeedsList />}
              {route.view === 'projects' && <Projects />}
              {route.view === 'tickets' && <Tickets />}
              {route.view === 'trends' && <Trends />}
              {route.view === 'explore' && <Explore />}
              {route.view === 'offpath' && <OffPath />}
            </ErrorBoundary>}
          </main>
        </div>
        <PreviewBar />
        <Toaster />
        <TourHost />
        <TrainingPrompt />
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
  const showsHub = gate.k === 'ready' && !!(me && findPerson(gate.config, me));
  useEffect(() => {
    if (gate.k !== 'loading' && !showsHub) splash.ready();
  }, [gate.k, showsHub]);

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

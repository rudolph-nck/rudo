// My work: a personal dashboard. What needs focus now, the line-up, and the same work by status or by due date.
import { useMemo, useState } from 'react';
import { useHub } from '../store/hub';
import { useUi } from '../components/actions';
import { Icon, PriorityChip, SourceBadge, toast } from '../components/ui';
import { LogUpdateDialog } from '../components/Comm';
import { addDays, capacityFor, findPerson, fmtShortDate, schedule, todayISO } from '../model/logic';
import { BUCKET_LABEL, COLUMN_LABEL, LEVEL_LABEL, TIME_BUCKETS, type Bucket, type Column, type TimeBucket, type WorkItem } from '../model/types';
import { DUE_GROUPS, dueGroup, myWork, type MyItem } from '../model/mywork';
import { BADGES, leaderboard } from '../model/fun';
import { useNow } from './Notifications';

type Mode = 'lineup' | 'board' | 'due' | 'table';
type Filter = 'all' | 'focus' | 'week' | 'ack';
const MODES: [Mode, string, string][] = [
  ['lineup', 'list', 'Line-up'],
  ['board', 'board', 'By status'],
  ['due', 'timeline', 'By due date'],
  ['table', 'table', 'Table'],
];
const BOARD_COLS: Column[] = ['To Do', 'Ready', 'Doing', 'On Hold', 'Waiting'];

const pref = <T extends string>(k: string, d: T): T => {
  try { return (localStorage.getItem('cwh.mine.' + k) as T) || d; } catch { return d; }
};
const save = (k: string, v: string) => { try { localStorage.setItem('cwh.mine.' + k, v); } catch { /* ignore */ } };

const greeting = (d: Date) => (d.getHours() < 12 ? 'Good morning' : d.getHours() < 17 ? 'Good afternoon' : 'Good evening');
const longDate = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

function dueText(x: MyItem, now: Date) {
  if (!x.due) return '—';
  const g = dueGroup(x, now);
  const when = g === 'Today' ? 'Today' : g === 'Tomorrow' ? 'Tomorrow' : fmtShortDate(todayISO(x.due));
  return `${x.dueKind === 'promised' ? 'Promised' : x.dueKind === 'due' ? 'Due' : 'Target'} ${when}`;
}

function AgeBar({ x }: { x: MyItem }) {
  if (!x.age || x.age.backlog) return x.age?.backlog ? <span className="chip src" title="Opened before the standard started: cleared against the weekly backlog goal">Backlog</span> : null;
  const pct = Math.min(1, x.age.pct);
  const tone = x.age.stage === 'past' || x.age.stage === 'double' ? 'bad' : x.age.stage === 'risk' ? 'warn' : x.age.stage === 'waiting' ? 'muted' : 'ok';
  return (
    <span className={`mw-age ${tone}`} title={`Day ${Math.max(1, Math.ceil(x.age.dayOf))} of ${x.age.target} business days for ${x.age.priority}`}>
      <span className="bar"><span style={{ width: `${Math.round(pct * 100)}%` }} /></span>
    </span>
  );
}

function Bucket({ b }: { b?: Bucket }) {
  return b ? (
    <span className={`chip bucket-badge ${b}`} title={`${BUCKET_LABEL[b]} work`}>
      <span className={`dot ${b}`} aria-hidden />
      {b}
    </span>
  ) : null;
}

export function MyWork() {
  const { state, me, readOnly, commit, role } = useHub();
  const { openItem, openNew, requestMove } = useUi();
  const now = useNow();
  const cfg = state.config;
  const meP = findPerson(cfg, me);
  const w = useMemo(() => myWork(state, me, now), [state, me, now]);
  const [mode, setMode] = useState<Mode>(() => pref('mode', 'lineup'));
  const [filter, setFilter] = useState<Filter>('all');
  const [bucket, setBucket] = useState<Bucket | 'all'>('all');
  const [q, setQ] = useState('');
  const [logging, setLogging] = useState<WorkItem | null>(null);
  const today = todayISO(now);

  const shown = w.open.filter((x) => {
    if (bucket !== 'all' && x.item.bucket !== bucket) return false;
    if (q && !`${x.item.title} ${x.item.source_id ?? ''} ${x.item.requester ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'focus') return x.focus;
    if (filter === 'ack') return x.reasons.some((r) => r.key === 'ack');
    if (filter === 'week') return !!x.due && ['Overdue', 'Today', 'Tomorrow', 'This week'].includes(dueGroup(x, now));
    return true;
  });

  // Context: support week, time off, capacity split
  const shifts = schedule(cfg, 12);
  const onNow = shifts.find((s) => s.analyst === me && s.from <= today && today <= s.to);
  const nextShift = shifts.find((s) => s.analyst === me && s.from > today);
  const myOff = (cfg.timeOff ?? []).filter((t) => t.username === me && t.to >= today).sort((a, b) => a.from.localeCompare(b.from));
  const monday = addDays(today, -((now.getDay() + 6) % 7));
  const cap = capacityFor(cfg, me, monday);
  const logged = state.time.filter((t) => t.user === me && t.date >= monday && t.date <= addDays(monday, 6));
  const loggedBy = (b: TimeBucket) => logged.filter((t) => t.bucket === b).reduce((s, t) => s + t.hours, 0);
  const totalLogged = logged.reduce((s, t) => s + t.hours, 0);
  const totalCap = Object.values(cap.hours).reduce((s, n) => s + n, 0);
  const standing = useMemo(() => leaderboard(state, 'week', now).find((s) => s.user === me), [state, now, me]);

  const ack = (i: WorkItem) => commit([{ type: 'item.ack', item: i.id, data: {} }]);

  const actions = (x: MyItem) => {
    if (readOnly) return null;
    const i = x.item;
    if (x.reasons.some((r) => r.key === 'ack')) return <button className="btn sm primary" onClick={() => void ack(i)}>Acknowledge</button>;
    if (x.reasons.some((r) => r.key === 'comm' || r.key === 'commSoon')) return <button className="btn sm" onClick={() => setLogging(i)}>Log update</button>;
    if ((i.column === 'To Do' || i.column === 'Ready') && !i.statusDriven) return <button className="btn sm" onClick={() => void requestMove(i, 'Doing')}>Start</button>;
    return null;
  };

  const row = (x: MyItem, n?: number) => (
    <li key={x.item.id} className={`mw-row ${x.focus ? 'focus' : ''}`}>
      {n !== undefined && <span className="mw-n" aria-hidden>{n}</span>}
      <div className="mw-main">
        <div className="mw-chips">
          <PriorityChip p={x.item.priority} />
          <Bucket b={x.item.bucket} />
          <SourceBadge item={x.item} />
          <span className="chip src mw-col">{COLUMN_LABEL[x.item.column]}</span>
        </div>
        <button className="mw-title" onClick={() => openItem(x.item.id)}>{x.item.title}</button>
        {x.reasons.length > 0 && (
          <div className="mw-reasons">
            {x.reasons.map((r) => <span key={r.key} className={`chip ${r.tone === 'info' ? 'src' : r.tone === 'good' ? 'ok' : r.tone}`}>{r.label}</span>)}
          </div>
        )}
      </div>
      <div className="mw-side">
        <span className={`small ${x.due && x.due < now ? 'danger-text' : 'muted'}`}>{dueText(x, now)}</span>
        <AgeBar x={x} />
      </div>
      <div className="mw-act">{actions(x)}</div>
    </li>
  );

  const list = (items: MyItem[], numbered = false, empty = 'Nothing here.') =>
    items.length ? <ol className="mw-list">{items.map((x, k) => row(x, numbered ? k + 1 : undefined))}</ol> : <div className="mw-empty muted">{empty}</div>;

  const tiles: [Filter, string, number, string, string][] = [
    ['focus', 'Needs focus', w.focus.length, w.focus.length ? 'bad' : 'ok', 'Late, past target, due today or waiting on you'],
    ['all', 'Open', w.open.length, '', `${w.doing} in Doing · limit ${w.wipLimit}`],
    ['week', 'Due this week', w.dueThisWeek, w.overdue ? 'warn' : '', w.overdue ? `${w.overdue} overdue` : 'Commitments and targets'],
    ['ack', 'To acknowledge', w.toAck, w.toAck ? 'warn' : 'ok', w.toAck ? 'New assignments' : 'All caught up'],
  ];

  return (
    <div className="page my-work">
      <div className="page-head">
        <div className="grow">
          <div className="eyebrow">{longDate(now)}</div>
          <h1>{greeting(now)}, {meP?.name?.split(' ')[0] ?? me}</h1>
          <div className="sub">
            {w.focus.length
              ? `${w.focus.length} ${w.focus.length === 1 ? 'thing needs' : 'things need'} your attention first. Start at the top of your line-up.`
              : w.open.length
                ? 'Nothing urgent. Work your line-up from the top.'
                : 'Your plate is clear. Pick something up from the Board.'}
          </div>
          <div className="mw-context">
            {onNow && <span className="chip warn"><Icon name="clock" size={14} /> On support until {fmtShortDate(onNow.to)}: projects pause</span>}
            {myOff[0] && <span className="chip src"><Icon name="calendar" size={14} /> Off {fmtShortDate(myOff[0].from)}{myOff[0].to !== myOff[0].from ? `–${fmtShortDate(myOff[0].to)}` : ''}</span>}
            {meP?.level && <span className="chip src">{LEVEL_LABEL[meP.level]} · {cap.label === LEVEL_LABEL[meP.level] ? 'normal week' : cap.label}</span>}
            {w.doing > w.wipLimit && <span className="chip bad">Over your WIP limit: {w.doing} of {w.wipLimit} in Doing</span>}
          </div>
        </div>
        {!readOnly && (
          <div className="topbar-actions">
            <button className="btn primary" onClick={() => openNew()}><Icon name="plus" /> New work</button>
          </div>
        )}
      </div>

      <div className="mw-tiles" role="group" aria-label="Show">
        {tiles.map(([f, label, n, tone, sub]) => (
          <button key={f} className={`mw-tile ${tone}`} aria-pressed={filter === f} onClick={() => setFilter(filter === f && f !== 'all' ? 'all' : f)}>
            <span className="t">{label}</span>
            <span className="n">{n}</span>
            <span className="d">{sub}</span>
          </button>
        ))}
        <div className="mw-tile static good">
          <span className="t">Closed this week</span>
          <span className="n">{standing?.closes ?? 0}</span>
          <span className="d">{standing ? `${standing.points} pts · ${Math.round(standing.onTimePct * 100)}% on time` : 'Every close goes in the dumpster'}</span>
        </div>
      </div>

      <div className="mw-grid">
        <div className="mw-col-main">
          {w.focus.length > 0 && w.open.length > 4 && filter === 'all' && (
            <section className="panel mw-panel" aria-labelledby="mw-focus-h">
              <div className="mw-panel-head">
                <h2 id="mw-focus-h"><Icon name="target" size={18} /> Focus now</h2>
                <span className="muted small">The most pressing first</span>
                {w.focus.length > 3 && <button className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={() => setFilter('focus')}>All {w.focus.length} →</button>}
              </div>
              {list(w.focus.slice(0, 3))}
            </section>
          )}

          <section className="panel mw-panel" aria-labelledby="mw-all-h">
            <div className="mw-panel-head wrap">
              <h2 id="mw-all-h">{filter === 'focus' ? 'Needs focus' : filter === 'week' ? 'Due this week' : filter === 'ack' ? 'To acknowledge' : 'My line-up'}</h2>
              {filter !== 'all' && <button className="btn sm ghost" onClick={() => setFilter('all')}>Show all</button>}
              <div className="seg mw-modes" role="radiogroup" aria-label="View" style={{ marginLeft: 'auto' }}>
                {MODES.map(([m, icon, label]) => (
                  <button key={m} role="radio" aria-checked={mode === m} onClick={() => { setMode(m); save('mode', m); }} title={label}>
                    <Icon name={icon} size={15} /><span className="lbl">{label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mw-filters">
              <div className="seg" role="radiogroup" aria-label="Bucket">
                {(['all', 'Project', 'Maintenance', 'Support'] as const).map((b) => (
                  <button key={b} role="radio" aria-checked={bucket === b} onClick={() => setBucket(b)}>{b === 'all' ? 'All' : b}</button>
                ))}
              </div>
              <label className="mw-search">
                <Icon name="search" size={16} />
                <input className="input" placeholder="Search my work" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search my work" />
              </label>
            </div>

            {mode === 'lineup' && list(shown, true, filter === 'all' && !q && bucket === 'all' ? 'Nothing open. Nice.' : 'Nothing matches.')}

            {mode === 'board' && (
              <div className="mw-board">
                {BOARD_COLS.map((c) => {
                  const col = shown.filter((x) => x.item.column === c);
                  return (
                    <div key={c} className="mw-bcol" aria-label={COLUMN_LABEL[c]}>
                      <div className="mw-bhead">{COLUMN_LABEL[c]} <span className="muted">{col.length}</span></div>
                      {col.map((x) => (
                        <button key={x.item.id} className={`mw-bcard ${x.focus ? 'focus' : ''}`} onClick={() => openItem(x.item.id)}>
                          <span className="mw-chips"><PriorityChip p={x.item.priority} /><Bucket b={x.item.bucket} /></span>
                          <span className="mw-btitle">{x.item.title}</span>
                          {x.reasons[0] && <span className={`chip ${x.reasons[0].tone === 'info' ? 'src' : x.reasons[0].tone}`}>{x.reasons[0].label}</span>}
                          <span className="small muted">{dueText(x, now)}</span>
                        </button>
                      ))}
                      {!col.length && <div className="mw-bempty">—</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {mode === 'due' && (
              <div className="mw-due">
                {DUE_GROUPS.map((g) => {
                  const items = shown.filter((x) => dueGroup(x, now) === g).sort((a, b) => (a.due?.getTime() ?? 0) - (b.due?.getTime() ?? 0) || b.urgency - a.urgency);
                  if (!items.length) return null;
                  return (
                    <div key={g} className={`mw-dgroup ${g === 'Overdue' ? 'bad' : g === 'Today' ? 'warn' : ''}`}>
                      <h3>{g} <span className="muted">{items.length}</span></h3>
                      {list(items)}
                    </div>
                  );
                })}
                {!shown.length && <div className="mw-empty muted">Nothing matches.</div>}
              </div>
            )}

            {mode === 'table' && (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Item</th><th>Status</th><th>Due</th><th>Next update</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {shown.map((x) => (
                      <tr key={x.item.id}>
                        <td>
                          <div className="row" style={{ gap: 6 }}><PriorityChip p={x.item.priority} /><Bucket b={x.item.bucket} /><SourceBadge item={x.item} /></div>
                          <button className="btn ghost sm" style={{ padding: 0, fontWeight: 700, minHeight: 32, textAlign: 'left', whiteSpace: 'normal' }} onClick={() => openItem(x.item.id)}>{x.item.title}</button>
                        </td>
                        <td>{COLUMN_LABEL[x.item.column]}</td>
                        <td className={x.due && x.due < now ? 'danger-text' : ''}>{dueText(x, now)}</td>
                        <td>{x.comm ? `${x.comm.label} · ${x.comm.due.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : x.item.next_update_due ? fmtShortDate(x.item.next_update_due) : '—'}</td>
                        <td>{actions(x)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!shown.length && <div className="mw-empty muted">Nothing matches.</div>}
              </div>
            )}
          </section>
        </div>

        <aside className="mw-rail" aria-label="My week">
          <section className="panel mw-card">
            <h2>Time this week</h2>
            <div className="small muted">{totalLogged}h logged of about {totalCap}h · {cap.label}</div>
            <div className="mw-cap">
              {TIME_BUCKETS.filter((b) => cap.hours[b.key] > 0 || loggedBy(b.key) > 0).map((b) => {
                const got = loggedBy(b.key);
                const want = cap.hours[b.key];
                return (
                  <div key={b.key} className="mw-cap-row">
                    <span className="small">{b.label}</span>
                    <span className="bar"><span style={{ width: `${Math.min(100, want ? (got / want) * 100 : 100)}%` }} className={got > want ? 'over' : ''} /></span>
                    <span className="small muted">{got}/{want}h</span>
                  </div>
                );
              })}
            </div>
            {!readOnly && <LogTime today={today} />}
          </section>

          <section className="panel mw-card">
            <h2>Coming up</h2>
            <ul className="mw-up">
              {onNow && <li><Icon name="clock" size={16} /><span>On support now, until <strong>{fmtShortDate(onNow.to)}</strong></span></li>}
              {nextShift && <li><Icon name="clock" size={16} /><span>Next support week from <strong>{fmtShortDate(nextShift.from)}</strong></span></li>}
              {myOff.slice(0, 2).map((t) => <li key={t.id}><Icon name="calendar" size={16} /><span>Off <strong>{fmtShortDate(t.from)}{t.to !== t.from ? `–${fmtShortDate(t.to)}` : ''}</strong>{t.cover ? ` · ${findPerson(cfg, t.cover)?.name ?? t.cover} covers` : ''}</span></li>)}
              {w.open.filter((x) => x.dueKind === 'promised' && x.due && x.due >= now).slice(0, 3).map((x) => (
                <li key={x.item.id}><Icon name="flag" size={16} /><span>Promised <strong>{fmtShortDate(todayISO(x.due!))}</strong>: <button className="linkish" onClick={() => openItem(x.item.id)}>{x.item.title}</button></span></li>
              ))}
              {!onNow && !nextShift && !myOff.length && <li className="muted small">Nothing scheduled.</li>}
            </ul>
          </section>

          <section className="panel mw-card">
            <h2>Recently closed</h2>
            {w.doneRecently.length ? (
              <ul className="mw-up">
                {w.doneRecently.slice(0, 5).map((i) => <li key={i.id}><Icon name="check" size={16} /><button className="linkish" onClick={() => openItem(i.id)}>{i.title}</button></li>)}
              </ul>
            ) : <div className="small muted">Nothing closed in the last 7 days.</div>}
            {standing && standing.badges.length > 0 && (
              <div className="mw-badges">{standing.badges.map((b) => <span key={b} className="chip src" title={BADGES[b].how}>{BADGES[b].icon} {BADGES[b].label}</span>)}</div>
            )}
            {role !== 'viewer' && <div className="small muted" style={{ marginTop: 6 }}>Closes count toward the team goal in Panda HQ.</div>}
          </section>
        </aside>
      </div>
      {logging && <LogUpdateDialog item={logging} onClose={() => setLogging(null)} />}
    </div>
  );
}

function LogTime({ today }: { today: string }) {
  const { commit } = useHub();
  const [hours, setHours] = useState('');
  const [bucket, setBucket] = useState<TimeBucket>('owner_tickets');
  const ok = Number(hours) > 0 && Number(hours) <= 24;
  return (
    <form className="mw-log" aria-label="Log time for today" onSubmit={async (e) => {
      e.preventDefault();
      if (!ok) return;
      if (await commit([{ type: 'time.log', data: { bucket, hours: Number(hours), date: today } }])) { setHours(''); toast('Time logged.'); }
    }}>
      <input className="input" type="number" min={0.25} step={0.25} max={24} placeholder="Hours" aria-label="Hours" value={hours} onChange={(e) => setHours(e.target.value)} />
      <select className="input" aria-label="Capacity bucket" value={bucket} onChange={(e) => setBucket(e.target.value as TimeBucket)}>
        {TIME_BUCKETS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
      </select>
      <button className="btn" disabled={!ok}>Log</button>
    </form>
  );
}

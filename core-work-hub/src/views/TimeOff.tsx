import { useMemo, useState } from 'react';
import { useHub } from '../store/hub';
import { useUi } from '../components/actions';
import { Avatar, BucketDot, Icon, Modal, PriorityChip, SourceBadge, toast } from '../components/ui';
import { addDays, analysts, assignable, coverageGaps, currentDispatch, findPerson, fmtShortDate, offOn, schedule, todayISO } from '../model/logic';
import { COLUMN_LABEL, TIME_OFF_KINDS, type NewEvent, type TimeOff as TO, type TimeOffKind, type WorkItem } from '../model/types';
import { useNav } from '../nav';

const WEEKS = 6;
const kindLabel = (k: TimeOffKind) => TIME_OFF_KINDS.find((x) => x.key === k)?.label ?? k;
const range = (t: { from: string; to: string }) => (t.from === t.to ? fmtShortDate(t.from) : `${fmtShortDate(t.from)} – ${fmtShortDate(t.to)}`);
const workdays = (from: string, to: string) => {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const w = new Date(d + 'T12:00:00').getDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
};

export function TimeOff() {
  const { state, role, readOnly } = useHub();
  const { go } = useNav();
  const cfg = state.config;
  const edit = role === 'manager' && !readOnly;
  const today = todayISO();
  const name = (u?: string) => findPerson(cfg, u)?.name ?? u ?? '—';
  const [editing, setEditing] = useState<TO | null>(null);
  const [handoff, setHandoff] = useState<TO | null>(null);
  const entries = [...(cfg.timeOff ?? [])].sort((a, b) => a.from.localeCompare(b.from));
  const outToday = entries.filter((t) => t.from <= today && today <= t.to);
  const upcoming = entries.filter((t) => t.to >= today);
  const past = entries.filter((t) => t.to < today).reverse().slice(0, 10);
  const gaps = coverageGaps(cfg, 12, today);

  // Calendar: next WEEKS weeks from this Monday, one row per person.
  const monday = addDays(today, -((new Date(today + 'T12:00:00').getDay() + 6) % 7));
  const days = Array.from({ length: WEEKS * 7 }, (_, i) => addDays(monday, i));
  const people = [...analysts(cfg), ...cfg.people.filter((p) => p.role !== 'viewer' && !analysts(cfg).includes(p))];
  const shifts = schedule(cfg, 4);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Time off</h1>
          <div className="sub">Who’s out, who’s covering, and what happens to their work. Everyone can see this page{edit ? '' : '; Nick keeps it up to date'}.</div>
        </div>
        {edit && (
          <div className="topbar-actions">
            <button className="btn primary" onClick={() => setEditing({ id: '', username: analysts(cfg)[0]?.username ?? '', from: today, to: today, kind: 'pto' })}>
              <Icon name="plus" /> Add time off
            </button>
          </div>
        )}
      </div>

      <div className="off-today">
        <section className="panel" aria-labelledby="out-h" style={{ padding: '16px 18px' }}>
          <h2 id="out-h" style={{ marginBottom: 10 }}>Out today</h2>
          {outToday.length === 0 && <p className="muted" style={{ margin: 0 }}>Everyone’s in.</p>}
          <ul className="out-list">
            {outToday.map((t) => (
              <li key={t.id}>
                <Avatar user={t.username} config={cfg} size="lg" />
                <div className="grow">
                  <strong>{name(t.username)}</strong>
                  <div className="small muted">{kindLabel(t.kind)} · back {fmtShortDate(addDays(t.to, 1))}{t.cover ? ` · ${name(t.cover)} covering` : ''}</div>
                </div>
                <button className="btn sm" onClick={() => setHandoff(t)}>Their work</button>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel" aria-labelledby="sup-h" style={{ padding: '16px 18px' }}>
          <h2 id="sup-h" style={{ marginBottom: 10 }}>Support coverage</h2>
          {gaps.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}><Icon name="check" size={14} /> No support shifts clash with time off.</p>
          ) : (
            <ul className="out-list">
              {gaps.map((g) => (
                <li key={g.off.id + g.shift.from}>
                  <span className="chip bad">No cover</span>
                  <span className="grow small">{name(g.shift.analyst)} is on support but off {range(g)}.</span>
                  <button className="btn sm" onClick={() => go('rotation')}>Set cover</button>
                </li>
              ))}
            </ul>
          )}
          {currentDispatch(cfg) && <p className="small muted" style={{ marginBottom: 0 }}>On support now: {name(currentDispatch(cfg)!.analyst)}.</p>}
        </section>
      </div>

      <section className="panel" aria-labelledby="cal-h">
        <div className="viz-head">
          <h2 id="cal-h" className="grow">Next {WEEKS} weeks</h2>
          <div className="legend">
            <span><i style={{ background: 'var(--b-support)' }} />Off</span>
            <span><i style={{ background: 'var(--accent-soft)', outline: '1px solid var(--accent)' }} />On support</span>
          </div>
        </div>
        <div className="cal-scroll">
          <table className="cal" aria-label="Time off and support shifts, next six weeks">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Person</span></th>
                {days.map((d) => {
                  const dt = new Date(d + 'T12:00:00');
                  const wkend = dt.getDay() === 0 || dt.getDay() === 6;
                  return (
                    <th key={d} scope="col" className={`${wkend ? 'wkend' : ''} ${d === today ? 'today' : ''}`} title={dt.toDateString()}>
                      {dt.getDay() === 1 || d === days[0] ? <span className="mon">{dt.toLocaleDateString(undefined, { month: 'short' })}</span> : null}
                      {dt.getDate()}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.username}>
                  <th scope="row"><div className="row"><Avatar user={p.username} config={cfg} />{p.name}</div></th>
                  {days.map((d) => {
                    const off = entries.find((t) => t.username === p.username && t.from <= d && d <= t.to);
                    const sup = shifts.find((s) => s.analyst === p.username && s.from <= d && d <= s.to);
                    const dt = new Date(d + 'T12:00:00');
                    const wkend = dt.getDay() === 0 || dt.getDay() === 6;
                    return (
                      <td
                        key={d}
                        className={`${wkend ? 'wkend' : ''} ${d === today ? 'today' : ''} ${sup ? 'sup' : ''}`}
                        title={[off ? `${p.name}: ${kindLabel(off.kind)}${off.cover ? `, ${name(off.cover)} covering` : ''}` : '', sup ? `${p.name} on support` : ''].filter(Boolean).join(' · ') || undefined}
                      >
                        {off && (
                          <button
                            className={`off-bar ${off.from === d ? 'start' : ''} ${off.to === d ? 'end' : ''} ${off.kind === 'partial' ? 'partial' : ''}`}
                            aria-label={`${p.name} ${kindLabel(off.kind)} ${range(off)}`}
                            onClick={() => (edit ? setEditing(off) : setHandoff(off))}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="up-h">
        <div className="viz-head"><h2 id="up-h" className="grow">Upcoming</h2></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Person</th><th>When</th><th className="num">Work days</th><th>Type</th><th>Covering</th><th>Note</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {upcoming.map((t) => (
                <TimeOffRow key={t.id} t={t} edit={edit} onEdit={() => setEditing(t)} onHandoff={() => setHandoff(t)} />
              ))}
              {upcoming.length === 0 && <tr><td colSpan={7} className="muted">Nothing booked.</td></tr>}
            </tbody>
          </table>
        </div>
        {past.length > 0 && (
          <details style={{ padding: '0 18px 16px' }}>
            <summary className="small muted" style={{ cursor: 'pointer', minHeight: 32 }}>Recent ({past.length})</summary>
            <table className="table"><tbody>{past.map((t) => <TimeOffRow key={t.id} t={t} edit={edit} onEdit={() => setEditing(t)} onHandoff={() => setHandoff(t)} />)}</tbody></table>
          </details>
        )}
      </section>

      {editing && <TimeOffDialog entry={editing} onClose={() => setEditing(null)} onSaved={(t) => { setEditing(null); if (t.from <= addDays(today, 7)) setHandoff(t); }} />}
      {handoff && <HandoffDialog entry={handoff} onClose={() => setHandoff(null)} />}
    </div>
  );
}

function TimeOffRow({ t, edit, onEdit, onHandoff }: { t: TO; edit: boolean; onEdit: () => void; onHandoff: () => void }) {
  const { state } = useHub();
  const cfg = state.config;
  const name = (u?: string) => findPerson(cfg, u)?.name ?? u ?? '—';
  const open = [...state.items.values()].filter((i) => i.owner === t.username && i.column !== 'Done' && i.column !== 'Intake').length;
  return (
    <tr>
      <td><div className="row"><Avatar user={t.username} config={cfg} />{name(t.username)}</div></td>
      <td>{range(t)}</td>
      <td className="num">{workdays(t.from, t.to)}</td>
      <td>{kindLabel(t.kind)}</td>
      <td>{t.cover ? <div className="row"><Avatar user={t.cover} config={cfg} />{name(t.cover)}</div> : <span className="muted">—</span>}</td>
      <td className="small">{t.note}</td>
      <td>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn sm" onClick={onHandoff}>Their work ({open})</button>
          {edit && <button className="btn sm ghost" onClick={onEdit}>Edit</button>}
        </div>
      </td>
    </tr>
  );
}

function TimeOffDialog({ entry, onClose, onSaved }: { entry: TO; onClose: () => void; onSaved: (t: TO) => void }) {
  const { state, commit } = useHub();
  const cfg = state.config;
  const [t, setT] = useState<TO>(entry);
  const people = assignable(cfg);
  const isNew = !entry.id;
  const onSupport = schedule(cfg, 12).filter((s) => s.analyst === t.username && s.from <= t.to && s.to >= t.from);
  const save = async () => {
    const rec: TO = { ...t, id: t.id || (crypto.randomUUID?.() ?? Date.now().toString(36)), note: t.note?.trim() || undefined, cover: t.cover || undefined };
    if (await commit([{ type: 'config.timeoff', data: rec }])) {
      toast(isNew ? 'Time off added.' : 'Time off updated.');
      onSaved(rec);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Add time off' : 'Edit time off'}
      footer={
        <>
          {!isNew && (
            <button className="btn danger" style={{ marginRight: 'auto' }} onClick={async () => { if (confirm('Remove this time off?') && (await commit([{ type: 'config.timeoff', data: { ...entry, deleted: true } }]))) onClose(); }}>
              Remove
            </button>
          )}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!t.username || t.to < t.from} onClick={save}>Save</button>
        </>
      }
    >
      <div className="grid2">
        <label className="field"><span>Who</span>
          <select className="input" value={t.username} onChange={(e) => setT({ ...t, username: e.target.value, cover: t.cover === e.target.value ? undefined : t.cover })}>
            {people.map((p) => <option key={p.username} value={p.username}>{p.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Type</span>
          <select className="input" value={t.kind} onChange={(e) => setT({ ...t, kind: e.target.value as TimeOffKind })}>
            {TIME_OFF_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        </label>
        <label className="field"><span>First day off</span><input className="input" type="date" value={t.from} onChange={(e) => setT({ ...t, from: e.target.value, to: t.to < e.target.value ? e.target.value : t.to })} /></label>
        <label className="field"><span>Last day off</span><input className="input" type="date" min={t.from} value={t.to} onChange={(e) => setT({ ...t, to: e.target.value })} /></label>
      </div>
      <label className="field"><span>Who covers their work</span>
        <select className="input" value={t.cover ?? ''} onChange={(e) => setT({ ...t, cover: e.target.value || undefined })}>
          <option value="">No one named</option>
          {people.filter((p) => p.username !== t.username).map((p) => <option key={p.username} value={p.username}>{p.name}</option>)}
        </select>
      </label>
      <label className="field"><span>Note (optional, visible to the whole team: no personal details)</span>
        <input className="input" value={t.note ?? ''} onChange={(e) => setT({ ...t, note: e.target.value })} placeholder="e.g. Reachable by phone for P1s" />
      </label>
      {onSupport.length > 0 && (
        <div className="banner warn">
          {findPerson(cfg, t.username)?.name} is on support {range(onSupport[0])}. Set a cover on the Rotation page after saving.
        </div>
      )}
    </Modal>
  );
}

/** Manage an absent person's open work: hand it to the cover, put it on hold until they're back, or release it. */
function HandoffDialog({ entry, onClose }: { entry: TO; onClose: () => void }) {
  const { state, commit, grader, readOnly } = useHub();
  const { openItem } = useUi();
  const cfg = state.config;
  const name = (u?: string) => findPerson(cfg, u)?.name ?? u ?? '—';
  const back = addDays(entry.to, 1);
  const items = useMemo(
    () => [...state.items.values()].filter((i) => i.owner === entry.username && !['Done', 'Intake'].includes(i.column)).sort((a, b) => ['Doing', 'Waiting', 'Ready', 'To Do', 'On Hold'].indexOf(a.column) - ['Doing', 'Waiting', 'Ready', 'To Do', 'On Hold'].indexOf(b.column)),
    [state.items, entry.username],
  );
  const [cover, setCover] = useState(entry.cover ?? '');
  const [sel, setSel] = useState<Set<string>>(() => new Set(items.filter((i) => i.column === 'Doing' || i.column === 'Waiting').map((i) => i.id)));
  const chosen = items.filter((i) => sel.has(i.id));
  const sdLocked = chosen.filter((i) => i.ownerFromSource);
  const canAct = grader && !readOnly;
  const reason = `${name(entry.username)} out ${range(entry)}`;

  const run = async (what: 'cover' | 'hold' | 'ready') => {
    const ev: NewEvent[] = [];
    for (const i of chosen) {
      if (what === 'cover') {
        if (!i.ownerFromSource) ev.push({ type: 'item.update', item: i.id, data: { owner: cover } });
      } else if (what === 'hold') {
        if (i.column !== 'On Hold' && !i.statusDriven) ev.push({ type: 'item.move', item: i.id, data: { column: 'On Hold', reason: `${reason}; back ${fmtShortDate(back)}` } });
        if (i.next_update_due && i.next_update_due < back) ev.push({ type: 'item.update', item: i.id, data: { next_update_due: back } });
      } else if (!i.statusDriven) {
        ev.push({ type: 'item.move', item: i.id, data: { column: 'Ready', reason, release: !i.ownerFromSource } });
      }
    }
    if (!ev.length) return toast('Nothing to change for the selected items.');
    if (await commit(ev)) {
      toast(what === 'cover' ? `Handed to ${name(cover)}.` : what === 'hold' ? `On hold until ${fmtShortDate(back)}.` : 'Released to Ready for anyone to pick up.');
      setSel(new Set());
    }
  };

  return (
    <Modal open drawer onClose={onClose} title={`${name(entry.username)}’s work · out ${range(entry)}`}>
      <p className="muted" style={{ margin: 0 }}>
        {items.length} open item{items.length === 1 ? '' : 's'}. Pick what to do with each while {name(entry.username)} is out{entry.cover ? `; ${name(entry.cover)} is the named cover` : ''}.
      </p>
      {canAct && (
        <div className="handoff-actions">
          <label className="field" style={{ minWidth: 180 }}>
            <span>Hand to</span>
            <select className="input" value={cover} onChange={(e) => setCover(e.target.value)}>
              <option value="">Choose…</option>
              {assignable(cfg).filter((p) => p.username !== entry.username).map((p) => (
                <option key={p.username} value={p.username}>{p.name}{offOn(cfg, p.username) ? ' (also off today)' : ''}</option>
              ))}
            </select>
          </label>
          <button className="btn primary" disabled={!cover || !(chosen.length - sdLocked.length)} onClick={() => run('cover')}>Hand {chosen.length - sdLocked.length} to {cover ? name(cover) : '…'}</button>
          <button className="btn" disabled={!chosen.length} onClick={() => run('hold')}>Put on hold until {fmtShortDate(back)}</button>
          <button className="btn" disabled={!chosen.length} onClick={() => run('ready')}>Release to Ready</button>
        </div>
      )}
      {sdLocked.length > 0 && (
        <div className="banner info">
          {sdLocked.length} selected ticket{sdLocked.length === 1 ? ' is' : 's are'} assigned in Service Desk. Reassign those there (links below); the hub follows on the next sync.
        </div>
      )}
      <ul className="handoff">
        {items.map((i: WorkItem) => (
          <li key={i.id}>
            {canAct && (
              <input type="checkbox" aria-label={`Select ${i.title}`} checked={sel.has(i.id)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(i.id); else n.delete(i.id); setSel(n); }} />
            )}
            <span className={`chip ${i.column === 'Doing' ? 'p3' : 'src'}`}>{COLUMN_LABEL[i.column]}</span>
            <div className="grow" style={{ minWidth: 0 }}>
              <button className="t" onClick={() => openItem(i.id)}>{i.title}</button>
              <div className="row small muted" style={{ gap: 6 }}>
                <BucketDot b={i.bucket} />
                <PriorityChip p={i.priority} />
                <SourceBadge item={i} />
                {i.next_update_due && <span>update {fmtShortDate(i.next_update_due)}</span>}
                {i.ownerFromSource && i.source_url && <a href={i.source_url} target="_blank" rel="noreferrer">Reassign in SD</a>}
              </div>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="muted">Nothing open. All clear.</li>}
      </ul>
    </Modal>
  );
}

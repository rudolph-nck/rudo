import { useState } from 'react';
import { useHub } from '../store/hub';
import { Avatar, Icon, toast } from '../components/ui';
import { addDays, assignable, coverageGaps, currentDispatch, findPerson, fmtShortDate, offDuring, rotationShifts, schedule, todayISO } from '../model/logic';
import { shiftStats } from '../model/analytics';
import { Modal } from '../components/ui';
import type { DispatchShift, Rotation as Rot, ShiftLength } from '../model/types';

const LEN: Record<ShiftLength, string> = { week: 'Weekly', '2weeks': 'Every 2 weeks', month: 'Monthly' };
const fmtLong = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

export function Rotation() {
  const { state, role, readOnly } = useHub();
  const cfg = state.config;
  const edit = role === 'manager' && !readOnly;
  const name = (u?: string) => findPerson(cfg, u)?.name ?? u ?? '—';
  const today = todayISO();
  const cur = currentDispatch(cfg);
  const shifts = schedule(cfg, 12).filter((s) => s.to >= today);
  const r = cfg.rotation;
  const gaps = coverageGaps(cfg, 12, today);
  const [override, setOverride] = useState<OverrideInit | null>(null);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Support rotation</h1>
          <div className="sub">Level 1 support, in running order. {r?.escalation ? `${name(r.escalation)} is the escalation point.` : ''}</div>
        </div>
      </div>

      <div className="rota-top">
        <section className="panel rota-now" aria-label="On support now">
          <div className="l">On support now</div>
          {cur ? (
            <>
              <div className="row" style={{ gap: 14, marginTop: 10 }}>
                <Avatar user={cur.analyst} config={cfg} size="lg" />
                <div>
                  <div className="big-name">{name(cur.analyst)}</div>
                  <div className="muted">until {fmtLong(cur.to)}{cur.generated ? '' : ' (cover)'}</div>
                  <div className="small muted">Shift {fmtShortDate(cur.from)} – {fmtShortDate(cur.to)}{r ? ` · ${LEN[r.shift].toLowerCase()} rotation` : ''}</div>
                </div>
              </div>
              <div className="esc-path" aria-label="Escalation path">
                <span>Requester</span><span aria-hidden>→</span><span>Service Desk</span><span aria-hidden>→</span>
                <strong>Level 1: {name(cur.analyst)}</strong><span aria-hidden>→</span><strong>Escalation: {name(cur.escalation)}</strong>
              </div>
              <div className="rota-roles">
                <div><span className="label">Escalation</span><div className="row"><Avatar user={cur.escalation} config={cfg} />{name(cur.escalation)}</div></div>
                <div><span className="label">Next up</span><div className="row"><Avatar user={cur.backup ?? shifts[1]?.analyst} config={cfg} />{name(cur.backup ?? shifts[1]?.analyst)}</div></div>
              </div>
            </>
          ) : (
            <p className="muted">No rotation set yet.{edit ? ' Set it up below.' : ''}</p>
          )}
        </section>
        <section className="panel rota-order" aria-label="Running order">
          <div className="l">Running order · {r ? LEN[r.shift] : '—'}</div>
          <ol>
            {(r?.order ?? []).map((u) => {
              const out = r?.out.find((o) => o.username === u && (!o.until || o.until >= today));
              return (
                <li key={u} className={out ? 'out' : ''}>
                  <Avatar user={u} config={cfg} />
                  <span className="grow">{name(u)}</span>
                  {out && <span className="chip src">Out{out.until ? ` until ${fmtShortDate(out.until)}` : ' for now'}</span>}
                  {cur?.analyst === u && <span className="chip p3">On now</span>}
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      {gaps.length > 0 && (
        <div className="banner warn" role="alert">
          <div className="stack" style={{ gap: 6 }}>
            {gaps.map((g) => (
              <div key={g.off.id + g.shift.from} className="row wrap">
                <span>
                  {name(g.shift.analyst)} is on support but off {fmtShortDate(g.from)}{g.to !== g.from ? `–${fmtShortDate(g.to)}` : ''}. No cover set.
                </span>
                {edit && (
                  <button className="btn sm" onClick={() => setOverride({ shift: g.shift, from: g.from, to: g.to, cover: g.off.cover ?? g.shift.backup })}>
                    Set a cover
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="panel" aria-labelledby="sched-h">
        <div className="viz-head">
          <h2 id="sched-h" className="grow">Upcoming shifts</h2>
          {edit && <span className="small muted">Use Change for one-off covers and swaps; edit the running order below.</span>}
        </div>
        <ol className="timeline-shifts">
          {shifts.map((s, i) => {
            const now = s.from <= today && today <= s.to;
            const offs = offDuring(cfg, s.analyst, s.from, s.to);
            return (
              <li key={s.from + s.analyst + i} className={now ? 'now' : ''}>
                <div className="when">
                  <strong>{fmtShortDate(s.from)}</strong> – {fmtShortDate(s.to)}
                  <div className="small muted">{new Date(s.from + 'T12:00:00').getFullYear()}</div>
                </div>
                <span className="track" aria-hidden><i /></span>
                <div className="row grow wrap">
                  <Avatar user={s.analyst} config={cfg} />
                  <strong>{name(s.analyst)}</strong>
                  {now && <span className="chip p3">On now</span>}
                  {!s.generated && <span className="chip warn">Covering{s.coverFor ? ` for ${name(s.coverFor)}` : ''}</span>}
                  {s.note && <span className="small muted">{s.note}</span>}
                  {offs.map((o) => (
                    <span key={o.id} className="chip bad">Off {fmtShortDate(o.from > s.from ? o.from : s.from)}{o.to !== o.from ? `–${fmtShortDate(o.to < s.to ? o.to : s.to)}` : ''}</span>
                  ))}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <span className="small muted">Escalation: {name(s.escalation)}</span>
                  {edit && (
                    <button className="btn sm" onClick={() => setOverride({ shift: s, from: s.from < today ? today : s.from, to: s.to, cover: s.backup })} aria-label={`Change ${name(s.analyst)}'s shift ${fmtShortDate(s.from)} to ${fmtShortDate(s.to)}`}>
                      Change
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          {!shifts.length && <li className="muted">Nothing scheduled.</li>}
        </ol>
      </section>

      <ShiftHistory />

      {override && <OverrideDialog init={override} shifts={shifts} onClose={() => setOverride(null)} />}
      {edit && <RotationEditor />}
      {edit && <Covers />}
    </div>
  );
}

function RotationEditor() {
  const { state, commit } = useHub();
  const cfg = state.config;
  const people = assignable(cfg);
  const init: Rot = cfg.rotation ?? { order: [], shift: 'month', current: { analyst: '', until: todayISO() }, out: [] };
  const [r, setR] = useState<Rot>(() => structuredClone(init));
  const name = (u?: string) => findPerson(cfg, u)?.name ?? u ?? '—';
  const move = (i: number, d: number) => {
    const o = [...r.order];
    const j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    setR({ ...r, order: o });
  };
  const outOf = (u: string) => r.out.find((o) => o.username === u);
  const setOut = (u: string, on: boolean, until?: string) =>
    setR({ ...r, out: on ? [...r.out.filter((o) => o.username !== u), { username: u, until: until || undefined }] : r.out.filter((o) => o.username !== u) });
  const preview = rotationShifts({ ...cfg, rotation: r }, 6);
  const valid = r.order.length > 0 && r.order.includes(r.current.analyst) && !!r.current.until;

  return (
    <section className="panel" aria-labelledby="rot-edit">
      <div className="viz-head">
        <h2 id="rot-edit" className="grow">Edit the rotation</h2>
        <span className="small muted">Saved to your change file and logged like any other change.</span>
      </div>
      <div className="rota-edit">
        <div className="stack">
          <span className="label">Running order</span>
          <ol className="order-edit">
            {r.order.map((u, i) => {
              const o = outOf(u);
              return (
                <li key={u}>
                  <span className="num">{i + 1}</span>
                  <Avatar user={u} config={cfg} />
                  <span className="grow" style={{ fontWeight: 700 }}>{name(u)}</span>
                  <label className="toggle sm-toggle">
                    <input type="checkbox" checked={!o} onChange={(e) => setOut(u, !e.target.checked)} />
                    In rotation
                  </label>
                  {o && (
                    <label className="field" style={{ width: 160 }}>
                      <span className="sr-only">Back on</span>
                      <input className="input" type="date" aria-label={`${name(u)} back on`} title="Back in the rotation on (leave empty for until further notice)" value={o.until ?? ''} onChange={(e) => setOut(u, true, e.target.value)} />
                    </label>
                  )}
                  <button className="btn icon ghost" aria-label={`Move ${name(u)} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button className="btn icon ghost" aria-label={`Move ${name(u)} down`} disabled={i === r.order.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <button className="btn icon ghost" aria-label={`Remove ${name(u)} from the order`} onClick={() => setR({ ...r, order: r.order.filter((x) => x !== u), out: r.out.filter((x) => x.username !== u) })}><Icon name="x" size={16} /></button>
                </li>
              );
            })}
          </ol>
          <label className="field" style={{ maxWidth: 260 }}>
            <span>Add someone to the order</span>
            <select className="input" value="" onChange={(e) => e.target.value && setR({ ...r, order: [...r.order, e.target.value] })}>
              <option value="">Choose…</option>
              {people.filter((p) => !r.order.includes(p.username)).map((p) => <option key={p.username} value={p.username}>{p.name}</option>)}
            </select>
          </label>
        </div>
        <div className="stack">
          <label className="field">
            <span>Shift length</span>
            <select className="input" value={r.shift} onChange={(e) => setR({ ...r, shift: e.target.value as ShiftLength })}>
              {Object.entries(LEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <div className="grid2">
            <label className="field">
              <span>On support now</span>
              <select className="input" value={r.current.analyst} onChange={(e) => setR({ ...r, current: { ...r.current, analyst: e.target.value } })}>
                <option value="">Choose…</option>
                {r.order.map((u) => <option key={u} value={u}>{name(u)}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Their last day</span>
              <input className="input" type="date" value={r.current.until} onChange={(e) => setR({ ...r, current: { ...r.current, until: e.target.value } })} />
            </label>
          </div>
          <label className="field">
            <span>Escalation point</span>
            <select className="input" value={r.escalation ?? ''} onChange={(e) => setR({ ...r, escalation: e.target.value || undefined })}>
              <option value="">None</option>
              {people.map((p) => <option key={p.username} value={p.username}>{p.name}</option>)}
            </select>
          </label>
          <div>
            <span className="label">Preview</span>
            <ul className="preview">
              {preview.map((s) => (
                <li key={s.from}><strong>{name(s.analyst)}</strong> <span className="muted">{fmtShortDate(s.from)} – {fmtShortDate(s.to)}</span></li>
              ))}
            </ul>
          </div>
          <div className="row">
            <button className="btn primary" disabled={!valid} onClick={async () => { if (await commit([{ type: 'config.rotation', data: r }])) toast('Rotation saved.'); }}>Save rotation</button>
            <button className="btn" onClick={() => setR(structuredClone(init))}>Reset</button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Covers and swaps: hand-entered shifts that override the rotation for their dates. */
function Covers() {
  const { state, commit } = useHub();
  const cfg = state.config;
  const people = assignable(cfg);
  const name = (u?: string) => findPerson(cfg, u)?.name ?? u ?? '—';
  const [rows, setRows] = useState<DispatchShift[]>(() => cfg.dispatch.filter((s) => s.to >= addDays(todayISO(), -30)));
  const [n, setN] = useState<DispatchShift>({ analyst: people[0]?.username ?? '', from: todayISO(), to: todayISO() });
  const save = async (next: DispatchShift[]) => {
    if (await commit([{ type: 'config.dispatch', data: { shifts: next } }])) {
      setRows(next);
      toast('Covers saved.');
    }
  };
  return (
    <section className="panel" aria-labelledby="cover-h">
      <div className="viz-head">
        <div className="grow">
          <h2 id="cover-h">Covers and swaps</h2>
          <div className="small muted">Someone covering a few days, or two people swapping. These win over the rotation for their dates.</div>
        </div>
      </div>
      <div className="modal-body" style={{ paddingTop: 0 }}>
        {rows.length > 0 && (
          <table className="table">
            <thead><tr><th>Covering</th><th>From</th><th>To</th><th><span className="sr-only">Remove</span></th></tr></thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={i}>
                  <td><div className="row"><Avatar user={s.analyst} config={cfg} />{name(s.analyst)}</div></td>
                  <td>{fmtShortDate(s.from)}</td>
                  <td>{fmtShortDate(s.to)}</td>
                  <td><button className="btn sm ghost danger" onClick={() => save(rows.filter((_, k) => k !== i))}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="row wrap" style={{ alignItems: 'flex-end' }}>
          <label className="field"><span>Who covers</span>
            <select className="input" value={n.analyst} onChange={(e) => setN({ ...n, analyst: e.target.value })}>
              {people.map((p) => <option key={p.username} value={p.username}>{p.name}</option>)}
            </select>
          </label>
          <label className="field"><span>From</span><input className="input" type="date" value={n.from} onChange={(e) => setN({ ...n, from: e.target.value, to: n.to < e.target.value ? e.target.value : n.to })} /></label>
          <label className="field"><span>To</span><input className="input" type="date" value={n.to} min={n.from} onChange={(e) => setN({ ...n, to: e.target.value })} /></label>
          <button className="btn" disabled={!n.analyst || n.to < n.from} onClick={() => save([...rows, { ...n }].sort((a, b) => a.from.localeCompare(b.from)))}><Icon name="plus" size={16} /> Add cover</button>
          <span className="small muted">Tip: a full swap is two covers.</span>
        </div>
      </div>
    </section>
  );
}


interface OverrideInit {
  shift: DispatchShift;
  from: string;
  to: string;
  cover?: string;
}

/** One-off change to a shift: someone covers some or all of it, or two people swap shifts. */
function OverrideDialog({ init, shifts, onClose }: { init: OverrideInit; shifts: DispatchShift[]; onClose: () => void }) {
  const { state, commit } = useHub();
  const cfg = state.config;
  const people = assignable(cfg).filter((p) => p.username !== init.shift.analyst);
  const name = (u?: string) => findPerson(cfg, u)?.name ?? u ?? '—';
  const [mode, setMode] = useState<'cover' | 'swap'>('cover');
  const [cover, setCover] = useState(init.cover && init.cover !== init.shift.analyst ? init.cover : people[0]?.username ?? '');
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [note, setNote] = useState('');
  const others = shifts.filter((s) => s.analyst !== init.shift.analyst && s.from > todayISO() && s.generated);
  const [swapWith, setSwapWith] = useState(others[0] ? others[0].from : '');
  const off = cover ? offDuring(cfg, cover, from, to) : [];
  const save = async () => {
    let add: DispatchShift[];
    if (mode === 'cover') add = [{ analyst: cover, from, to, coverFor: init.shift.analyst, note: note.trim() || undefined }];
    else {
      const other = others.find((s) => s.from === swapWith);
      if (!other) return;
      const n = note.trim() || `Swap: ${name(init.shift.analyst)} ↔ ${name(other.analyst)}`;
      add = [
        { analyst: other.analyst, from: init.shift.from, to: init.shift.to, coverFor: init.shift.analyst, note: n },
        { analyst: init.shift.analyst, from: other.from, to: other.to, coverFor: other.analyst, note: n },
      ];
    }
    if (await commit([{ type: 'config.dispatch', data: { shifts: [...cfg.dispatch, ...add].sort((a, b) => a.from.localeCompare(b.from)) } }])) {
      toast(mode === 'cover' ? `${name(cover)} covers ${fmtShortDate(from)}–${fmtShortDate(to)}.` : 'Shifts swapped.');
      onClose();
    }
  };
  const valid = mode === 'cover' ? !!cover && from <= to && from >= init.shift.from && to <= init.shift.to : !!swapWith;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Change ${name(init.shift.analyst)}’s shift · ${fmtShortDate(init.shift.from)}–${fmtShortDate(init.shift.to)}`}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!valid} onClick={save}>{mode === 'cover' ? 'Save cover' : 'Swap shifts'}</button>
        </>
      }
    >
      <div className="seg" role="radiogroup" aria-label="Kind of change" style={{ alignSelf: 'flex-start' }}>
        <button role="radio" aria-checked={mode === 'cover'} onClick={() => setMode('cover')}>Someone covers</button>
        <button role="radio" aria-checked={mode === 'swap'} onClick={() => setMode('swap')} disabled={!others.length}>Swap with another shift</button>
      </div>
      {mode === 'cover' ? (
        <>
          <label className="field">
            <span>Who covers</span>
            <select className="input" value={cover} onChange={(e) => setCover(e.target.value)}>
              {people.map((p) => <option key={p.username} value={p.username}>{p.name}</option>)}
            </select>
          </label>
          <div className="grid2">
            <label className="field"><span>From</span><input className="input" type="date" min={init.shift.from} max={init.shift.to} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="field"><span>To</span><input className="input" type="date" min={from} max={init.shift.to} value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
          {off.length > 0 && <div className="banner warn">{name(cover)} also has time off {fmtShortDate(off[0].from)}–{fmtShortDate(off[0].to)}.</div>}
          <p className="small muted" style={{ margin: 0 }}>The rest of the shift stays with {name(init.shift.analyst)}.</p>
        </>
      ) : (
        <label className="field">
          <span>Swap with</span>
          <select className="input" value={swapWith} onChange={(e) => setSwapWith(e.target.value)}>
            {others.map((s) => <option key={s.from} value={s.from}>{name(s.analyst)} · {fmtShortDate(s.from)}–{fmtShortDate(s.to)}</option>)}
          </select>
        </label>
      )}
      <label className="field">
        <span>Note (optional, visible to the team)</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Trey covering while Tabitha is at training" />
      </label>
    </Modal>
  );
}

/** What each person on support handled during their shift. */
function ShiftHistory() {
  const { state } = useHub();
  const cfg = state.config;
  const today = todayISO();
  const name = (u?: string) => findPerson(cfg, u)?.name ?? u ?? '—';
  const rows = schedule(cfg, 1, 6).filter((s) => s.from <= today).reverse();
  if (!rows.length) return null;
  return (
    <section className="panel" aria-labelledby="hist-h">
      <div className="viz-head">
        <div className="grow">
          <h2 id="hist-h">Support shift tracking</h2>
          <div className="small muted">What came in during each shift and what the person on support triaged, worked and closed. Triaged = graded, sent on from Intake, assigned, or replied to.</div>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>On support</th><th>Shift</th>
              <th className="num">Came in</th><th className="num">Triaged</th><th className="num">Worked</th><th className="num">Closed</th>
              <th className="num">Dispatch hours</th><th className="num">Still in Intake</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const st = shiftStats(state, s.analyst, s.from, s.to < today ? s.to : today);
              const now = s.from <= today && today <= s.to;
              return (
                <tr key={s.from + s.analyst + i}>
                  <td><div className="row"><Avatar user={s.analyst} config={cfg} /><strong>{name(s.analyst)}</strong>{now && <span className="chip p3">Now</span>}{!s.generated && <span className="chip warn">Cover</span>}</div></td>
                  <td>{fmtShortDate(s.from)} – {fmtShortDate(s.to)}</td>
                  <td className="num">{st.cameIn}</td>
                  <td className="num"><strong>{st.triaged}</strong>{st.cameIn ? <span className="muted small"> ({Math.round((st.triaged / st.cameIn) * 100)}%)</span> : null}</td>
                  <td className="num">{st.worked}</td>
                  <td className="num">{st.closed}</td>
                  <td className="num">{st.dispatchHours || ''}</td>
                  <td className={`num ${st.stillInIntake ? 'danger-text' : ''}`}>{st.stillInIntake || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

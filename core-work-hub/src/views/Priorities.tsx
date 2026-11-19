import { useMemo, useState } from 'react';
import { useHub } from '../store/hub';
import { useUi } from '../components/actions';
import { Avatar, BucketDot, Icon, Modal, PriorityChip, SourceBadge, toast } from '../components/ui';
import { ExpediteDialog } from '../components/Expedite';
import { heldUp, priorityConflicts, type PriorityConflict } from '../model/analytics';
import { analysts, daysBetween, findPerson, fmtShortDate, isOverdue, offOn, rankedList } from '../model/logic';
import { BUCKETS, BUCKET_LABEL, COLUMN_LABEL, PRIORITIES, type Bucket, type Column, type NewEvent, type Priority, type WorkItem } from '../model/types';

const COL_ORDER: Column[] = ['Doing', 'Waiting', 'On Hold', 'Ready', 'To Do', 'Intake'];
const PRI_NOTE: Record<Priority, string> = { P1: 'Drop everything', P2: 'Next up', P3: 'Planned', P4: 'When there’s room' };

export function Priorities() {
  const { state, grader, readOnly, commit, role } = useHub();
  const [forcing, setForcing] = useState<WorkItem | null>(null);
  const forced = [...state.items.values()].filter((i) => i.expedite && i.column !== 'Done' && !i.stale);
  const { openItem } = useUi();
  const cfg = state.config;
  const name = (u?: string) => findPerson(cfg, u)?.name ?? u ?? '';
  const [bucket, setBucket] = useState<Bucket | ''>('');
  const [owner, setOwner] = useState('');
  const [withIntake, setWithIntake] = useState(false);
  const [q, setQ] = useState('');
  const [change, setChange] = useState<{ item: WorkItem; to: Priority } | null>(null);
  const canEdit = grader && !readOnly;

  const items = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return [...state.items.values()].filter(
      (i) =>
        !i.stale &&
        i.column !== 'Done' &&
        (withIntake || i.column !== 'Intake') &&
        (!bucket || i.bucket === bucket) &&
        (!owner || (owner === '__none' ? !i.owner && !i.source_owner : i.owner === owner)) &&
        (!ql || i.title.toLowerCase().includes(ql) || (i.source_id ?? '').toLowerCase().includes(ql)),
    );
  }, [state.items, bucket, owner, withIntake, q]);
  const conflicts = useMemo(() => priorityConflicts(state), [state]);

  const groups = [...PRIORITIES, undefined].map((p) => ({
    p,
    list: items
      .filter((i) => i.priority === p)
      .sort((a, b) => Number(!!b.expedite) - Number(!!a.expedite) || COL_ORDER.indexOf(a.column) - COL_ORDER.indexOf(b.column) || (b.score ?? 0) - (a.score ?? 0) || a.created.localeCompare(b.created)),
  }));

  /** Fix for "lower priority in Doing while a higher one waits": park the lower one, start the higher one. */
  const swapIn = async (c: PriorityConflict) => {
    if (!c.item || !c.other) return;
    const ok = await commit([
      { type: 'item.move', item: c.other.id, data: { column: 'On Hold', reason: `Priority shift: ${c.item.priority} “${c.item.title}” goes first` } },
      { type: 'item.move', item: c.item.id, data: { column: 'Doing' } },
    ]);
    if (ok) toast(`${c.other.priority} parked in On Hold; ${c.item.priority} moved to Doing.`);
  };
  /** Fix for rank inversions: renumber the list by priority, keeping the current order within a priority. */
  const reRank = async (c: PriorityConflict) => {
    if (!c.bucket || !c.item) return;
    const col = c.item.column;
    const list = rankedList(state, c.bucket, col);
    const order = [...list].sort((a, b) => (a.priority ?? 'P9').localeCompare(b.priority ?? 'P9') || (a.rank ?? 0) - (b.rank ?? 0));
    if (await commit([{ type: 'rank.normalize', data: { bucket: c.bucket, column: col, order: order.map((i) => i.id) } }])) toast(`${BUCKET_LABEL[c.bucket]} ${COLUMN_LABEL[col]} re-ranked by priority.`);
  };

  const counts = Object.fromEntries(PRIORITIES.map((p) => [p, items.filter((i) => i.priority === p).length]));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Priorities</h1>
          <div className="sub">Every open item, highest priority first. Spot conflicts and shift priorities in one place.</div>
        </div>
      </div>

      <div className="pri-summary" role="list" aria-label="Open items by priority">
        {PRIORITIES.map((p) => (
          <a key={p} role="listitem" className={`pri-tile ${p.toLowerCase()}`} href={`#pri-${p}`}>
            <span className={`chip ${p.toLowerCase()}`}>{p}</span>
            <strong>{counts[p]}</strong>
            <span className="small muted">{PRI_NOTE[p]}</span>
          </a>
        ))}
      </div>

      {forced.length > 0 && (
        <section className="panel forced-panel" aria-labelledby="forced-h">
          <div className="viz-head">
            <div className="grow">
              <h2 id="forced-h">Forced priorities ({forced.length})</h2>
              <div className="small muted">Leadership “drop everything” work. It sits above every grade, rank and team score until Nick ends it.</div>
            </div>
          </div>
          <ul className="conflicts">
            {forced.map((i) => (
              <li key={i.id}>
                <span className="chip forced">FORCED</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <button className="linkish strong" onClick={() => openItem(i.id)}>{i.title}</button>
                  <div className="small muted">
                    Requested by {i.expedite!.requestedBy}{i.expedite!.approvedBy ? ` · holds approved by ${i.expedite!.approvedBy}` : ''} · “{i.expedite!.reason}”{i.expedite!.due ? ` · needed by ${fmtShortDate(i.expedite!.due)}` : ''} · {COLUMN_LABEL[i.column]}{i.owner ? ` · ${findPerson(cfg, i.owner)?.name}` : ''}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {conflicts.length > 0 && (
        <section className="panel" aria-labelledby="conf-h">
          <div className="viz-head">
            <div className="grow">
              <h2 id="conf-h">Priority conflicts ({conflicts.length})</h2>
              <div className="small muted">Where the work isn’t following the priorities.</div>
            </div>
          </div>
          <ul className="conflicts">
            {conflicts.map((c, n) => (
              <li key={n}>
                <span className={`chip ${c.kind === 'rank-inversion' ? 'warn' : 'bad'}`}>
                  {c.kind === 'lower-first' ? 'Lower priority first' : c.kind === 'unowned' ? 'No owner' : c.kind === 'stuck' ? 'Stuck' : c.kind === 'owner-off' ? 'Owner off' : 'Rank order'}
                </span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{c.text}</div>
                  <div className="small muted row wrap" style={{ gap: 6 }}>
                    {c.item && <button className="linkish" onClick={() => openItem(c.item!.id)}>{c.item.priority} · {c.item.title}</button>}
                    {c.other && c.kind === 'lower-first' && <><span>vs</span><button className="linkish" onClick={() => openItem(c.other!.id)}>{c.other.priority} · {c.other.title}</button></>}
                  </div>
                </div>
                {canEdit && c.kind === 'lower-first' && <button className="btn sm primary" onClick={() => swapIn(c)}>Park the {c.other!.priority}, start the {c.item!.priority}</button>}
                {canEdit && c.kind === 'rank-inversion' && <button className="btn sm" onClick={() => reRank(c)}>Re-rank by priority</button>}
                {(c.kind === 'unowned' || c.kind === 'stuck' || c.kind === 'owner-off') && <button className="btn sm" onClick={() => openItem(c.item!.id)}>Open</button>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Bucket">
          <button aria-pressed={bucket === ''} onClick={() => setBucket('')}>All</button>
          {BUCKETS.map((b) => (
            <button key={b} aria-pressed={bucket === b} onClick={() => setBucket(b)}><span className={`dot ${b}`} />{BUCKET_LABEL[b]}</button>
          ))}
        </div>
        <div className="filters">
          <select aria-label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Everyone</option>
            <option value="__none">No owner</option>
            {analysts(cfg).map((p) => <option key={p.username} value={p.username}>{p.name}</option>)}
          </select>
          <input className="input" style={{ maxWidth: 240, minHeight: 40 }} aria-label="Search title or ticket" placeholder="Search title or ticket #" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="toggle"><input type="checkbox" checked={withIntake} onChange={(e) => setWithIntake(e.target.checked)} />Include ungraded Intake</label>
        </div>
      </div>

      {groups.map(({ p, list }) =>
        !list.length && !p ? null : (
          <section key={p ?? 'none'} id={p ? `pri-${p}` : undefined} className="panel" aria-label={p ?? 'No priority'}>
            <div className="viz-head">
              <h2 className="grow row" style={{ gap: 8 }}>
                {p ? <PriorityChip p={p} /> : <span className="chip src">No priority</span>}
                <span>{p ? PRI_NOTE[p] : 'Not graded yet'}</span>
                <span className="muted" style={{ fontWeight: 600 }}>{list.length}</span>
              </h2>
            </div>
            {list.length === 0 ? (
              <p className="muted small" style={{ padding: '0 18px 16px', margin: 0 }}>Nothing open at {p}.</p>
            ) : (
              <div className="table-wrap">
                <table className="table pri-table">
                  <thead>
                    <tr>
                      <th>Item</th><th>Where</th><th>Owner</th><th className="num">Score</th><th className="num">Age</th><th>Next update</th>
                      <th>{canEdit ? 'Change priority' : 'Priority'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((i) => {
                      const h = heldUp(i);
                      const off = offOn(cfg, i.owner);
                      return (
                        <tr key={i.id}>
                          <td>
                            <div className="row" style={{ gap: 6 }}>
                              <BucketDot b={i.bucket} />
                              <SourceBadge item={i} />
                              {h && <span className={`chip ${h.kind === 'stale' ? 'warn' : 'src'}`}>{h.kind === 'hold' ? 'On hold' : h.kind === 'stale' ? 'Stalled' : 'Waiting'} {h.days}d</span>}
                            </div>
                            <button className="linkish strong" onClick={() => openItem(i.id)}>{i.title}</button>
                          </td>
                          <td>{COLUMN_LABEL[i.column]}{i.rank ? ` #${i.rank}` : ''}</td>
                          <td>
                            <div className="row" style={{ gap: 6 }}>
                              <Avatar user={i.owner} config={cfg} external={i.owner ? undefined : i.source_owner} />
                              <span>{i.owner ? name(i.owner) : i.source_owner ?? '—'}</span>
                              {off && <span className="chip bad">Off</span>}
                            </div>
                          </td>
                          <td className="num">{i.score ?? ''}</td>
                          <td className="num">{daysBetween(i.created)}d</td>
                          <td className={isOverdue(i) ? 'danger-text' : ''}>{i.next_update_due ? `${isOverdue(i) ? 'Overdue · ' : ''}${fmtShortDate(i.next_update_due)}` : '—'}</td>
                          <td>
                            {i.expedite ? (
                              <span className="chip forced">FORCED P1</span>
                            ) : canEdit ? (
                              <div className="row" style={{ gap: 6 }}>
                                <div className="pick pri-pick" role="radiogroup" aria-label={`Priority for ${i.title}`}>
                                  {PRIORITIES.map((x) => (
                                    <button key={x} role="radio" aria-checked={i.priority === x} onClick={() => i.priority !== x && setChange({ item: i, to: x })}>{x}</button>
                                  ))}
                                </div>
                                {role === 'manager' && (
                                  <button className="btn sm ghost" aria-label={`Force ${i.title} to the top`} title="Force to the top (leadership request)" onClick={() => setForcing(i)}>
                                    <Icon name="flag" size={14} />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <PriorityChip p={i.priority} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ),
      )}

      {forcing && <ExpediteDialog item={forcing} onClose={() => setForcing(null)} />}
      {change && <PriorityDialog item={change.item} to={change.to} onClose={() => setChange(null)} />}
    </div>
  );
}

/** Priority change with an optional reason (kept as a comment on the card; the audit log keeps before → after). */
function PriorityDialog({ item, to, onClose }: { item: WorkItem; to: Priority; onClose: () => void }) {
  const { state, commit } = useHub();
  const [reason, setReason] = useState('');
  const [reRank, setReRank] = useState(item.column === 'To Do' || item.column === 'Ready');
  const up = (item.priority ?? 'P9') > to;
  const save = async () => {
    const ev: NewEvent[] = [{ type: 'item.update', item: item.id, data: { priority: to } }];
    if (reason.trim()) ev.push({ type: 'item.comment', item: item.id, data: { text: `Priority ${item.priority ?? '—'} → ${to}: ${reason.trim()}` } });
    if (reRank && item.bucket && (item.column === 'To Do' || item.column === 'Ready')) {
      // Place it after the last item of equal or higher priority in its list.
      const list = rankedList(state, item.bucket, item.column).filter((x) => x.id !== item.id);
      const idx = list.findIndex((x) => (x.priority ?? 'P9') > to);
      const order = [...list];
      order.splice(idx === -1 ? order.length : idx, 0, item);
      ev.push({ type: 'rank.normalize', data: { bucket: item.bucket, column: item.column, order: order.map((x) => x.id) } });
    }
    if (await commit(ev)) {
      toast(`${item.title}: ${item.priority ?? '—'} → ${to}.`);
      onClose();
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`${up ? 'Raise' : 'Lower'} to ${to}`}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Change to {to}</button></>}
    >
      <p style={{ margin: 0 }}><strong>{item.title}</strong> · now {item.priority ?? 'no priority'}</p>
      <label className="field">
        <span>Why? (optional, saved as a comment on the card)</span>
        <textarea className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Exam finding due Friday; moved ahead of the Wi-Fi survey" autoFocus />
      </label>
      {(item.column === 'To Do' || item.column === 'Ready') && (
        <label className="toggle" style={{ alignSelf: 'flex-start' }}>
          <input type="checkbox" checked={reRank} onChange={(e) => setReRank(e.target.checked)} />
          Move it in the {COLUMN_LABEL[item.column]} rank to match (currently #{item.rank})
        </label>
      )}
      {item.source === 'SD' && <p className="small muted" style={{ margin: 0 }}>The hub priority changes here; Service Desk’s own priority isn’t touched.</p>}
    </Modal>
  );
}

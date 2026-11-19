import { useMemo, useState } from 'react';
import { useHub } from '../store/hub';
import { useUi } from './actions';
import { assignable, daysBetween, findPerson, fmtShortDate, isOverdue, systemName, todayISO } from '../model/logic';
import { COLUMNS, COLUMN_LABEL, TIME_BUCKETS, type TimeBucket, type WorkItem } from '../model/types';
import { Avatar, BucketDot, Icon, Modal, PriorityChip, SourceBadge, toast } from './ui';
import { GradeForm, draftFrom, effectiveGrade, type Draft } from './GradeForm';
import { describeEvent } from './describe';
import { CommSection } from './Comm';

export function ItemDrawer({ item, initialTab, onClose }: { item: WorkItem; initialTab?: 'grade'; onClose: () => void }) {
  const { state, me, grader, readOnly, commit } = useHub();
  const { requestMove, openNew, openItem, pickUp } = useUi();
  const cfg = state.config;
  const [draft, setDraft] = useState<Draft>(() => draftFrom(item));
  const [gradeOpen, setGradeOpen] = useState(initialTab === 'grade' || (!item.graded && grader && item.column === 'Intake'));
  const [comment, setComment] = useState('');
  const [hours, setHours] = useState('');
  const [hBucket, setHBucket] = useState<TimeBucket>(item.bucket === 'Project' ? 'projects' : item.bucket === 'Maintenance' ? 'maintenance' : 'owner_tickets');
  const mine = item.owner === me;
  const canEdit = !readOnly && (grader || mine);
  const kids = useMemo(() => [...state.items.values()].filter((i) => i.parent_id === item.id), [state.items, item.id]);
  const parent = item.parent_id ? state.items.get(item.parent_id) : undefined;
  const history = useMemo(() => state.audit.filter((a) => 'item' in a.event && a.event.item === item.id).reverse(), [state.audit, item.id]);
  const conflicts = state.conflicts.filter((c) => c.item === item.id);
  const name = (u?: string) => findPerson(cfg, u)?.name ?? u ?? '—';

  const saveGrade = async () => {
    const g = effectiveGrade(draft);
    if (!g) return toast('Pick a bucket and all three scores first.');
    if (await commit([{ type: 'item.grade', item: item.id, data: g }])) {
      toast('Grade saved.');
      setGradeOpen(false);
    }
  };

  return (
    <Modal
      open
      drawer
      onClose={onClose}
      title={
        <span className="stack" style={{ gap: 8 }}>
          <span className="row wrap" style={{ gap: 6 }}>
            <BucketDot b={item.bucket} />
            <span className="small muted" style={{ fontWeight: 700 }}>{item.bucket ?? 'Not graded'}</span>
            <PriorityChip p={item.priority} />
            <SourceBadge item={item} />
            {item.rank && <span className="chip src">Rank #{item.rank}</span>}
          </span>
          <span>{item.title}</span>
        </span>
      }
    >
      {conflicts.map((c) => (
        <div key={c.ts + c.field} className="banner warn">
          Sync conflict on {c.field}: Service Desk changed it to “{String(c.sourceValue ?? '—')}” after {name(c.hubUser)} set “{String(c.hubValue ?? '—')}”. The source value is kept.
        </div>
      ))}

      {item.source_url && (
        <a className="btn primary" style={{ alignSelf: 'flex-start' }} href={item.source_url} target="_blank" rel="noreferrer">
          Open {item.source === 'SD' ? `#${item.source_id} in Service Desk` : item.source === 'Wrike' ? 'in Wrike' : 'link'} <Icon name="link" size={16} />
        </a>
      )}
      {item.statusDriven && (
        <div className="banner info">
          In {item.statusDriven} because Service Desk says “{item.source_status}”. Change the status in Service Desk to move it.
        </div>
      )}
      <div className="row wrap">
        <span className="label">Column</span>
        <div className="seg" role="group" aria-label="Move to column">
          {COLUMNS.map((c) => (
            <button key={c} aria-pressed={item.column === c} disabled={readOnly} onClick={() => requestMove(item, c)}>
              {COLUMN_LABEL[c]}
            </button>
          ))}
        </div>
      </div>
      {item.hold && (
        <div className="banner warn">
          {item.column === 'On Hold' ? 'On hold' : 'Taken off Doing'} since {new Date(item.hold.since).toLocaleDateString()} by {name(item.hold.user)}
          {item.hold.reason ? `: ${item.hold.reason}` : ''}
        </div>
      )}
      {item.column === 'Ready' && !readOnly && (!item.owner || mine) && (
        <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={async () => { if (await pickUp(item)) onClose(); }}>
          Pick it up
        </button>
      )}

      <dl className="kv">
        <dt>Owner</dt>
        <dd className="row wrap">
          <Avatar user={item.owner} config={cfg} external={item.owner ? undefined : item.source_owner} />
          {item.ownerFromSource ? (
            <span>
              {item.owner ? name(item.owner) : item.source_owner}
              <span className="small muted"> · assigned in Service Desk{item.owner ? '' : ' (not on the hub)'}</span>
            </span>
          ) : grader && !readOnly ? (
            <select className="input" style={{ maxWidth: 220 }} aria-label="Owner" value={item.owner ?? ''} onChange={(e) => commit([{ type: 'item.update', item: item.id, data: { owner: e.target.value || null } }])}>
              <option value="">No owner</option>
              {assignable(cfg).map((p) => (
                <option key={p.username} value={p.username}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <span>{name(item.owner)}</span>
          )}
          {item.ownerFromSource && item.source_url && !readOnly && (
            <a className="btn sm" href={item.source_url} target="_blank" rel="noreferrer">
              Reassign in Service Desk <Icon name="link" size={14} />
            </a>
          )}
          {!item.owner && !item.ownerFromSource && !readOnly && !grader && (
            <button className="btn sm" onClick={() => commit([{ type: 'item.update', item: item.id, data: { owner: me } }])}>
              Take it
            </button>
          )}
          {mine && !item.acked && !readOnly && (
            <button className="btn sm primary" onClick={() => commit([{ type: 'item.ack', item: item.id, data: {} }])}>
              <Icon name="check" size={16} /> Acknowledge
            </button>
          )}
          {item.owner && item.acked && <span className="chip ok">Acknowledged</span>}
          {item.source === 'SD' && item.owner && !item.ownerFromSource && (
            <span className="small" style={{ color: 'var(--warn)', fontWeight: 600, flexBasis: '100%' }}>
              Not assigned in Service Desk yet. Set the technician to {name(item.owner)} there too
              {item.source_url && (
                <>
                  {' '}
                  (<a href={item.source_url} target="_blank" rel="noreferrer">open #{item.source_id}</a>)
                </>
              )}
              .
            </span>
          )}
        </dd>
        <dt>
          <label htmlFor="nud">Next update due</label>
        </dt>
        <dd className="row">
          <input id="nud" className="input" type="date" style={{ maxWidth: 190 }} disabled={!canEdit} value={item.next_update_due ?? ''} onChange={(e) => commit([{ type: 'item.update', item: item.id, data: { next_update_due: e.target.value || null } }])} />
          {isOverdue(item) && <span className="chip bad">Overdue</span>}
        </dd>
        <dt>System</dt>
        <dd>{systemName(cfg.systems, item.system) ?? '—'}</dd>
        <dt>Score</dt>
        <dd>{item.score !== undefined ? `${item.score} (impact ${item.impact} × urgency ${item.urgency} ÷ effort ${item.effort})` : '—'}</dd>
        <dt>Requester</dt>
        <dd>{item.requester ?? '—'}</dd>
        <dt>Source status</dt>
        <dd>{item.source_status}{item.source_owner ? ` · technician ${item.source_owner}` : ''}</dd>
        <dt>Age</dt>
        <dd>
          {daysBetween(item.created)} days (opened {fmtShortDate(item.created)}){item.started ? ` · started ${fmtShortDate(item.started)}` : ''}
          {item.done ? ` · done ${fmtShortDate(item.done)}` : ''}
        </dd>
        {parent && (
          <>
            <dt>Part of</dt>
            <dd>
              <button className="btn sm ghost" onClick={() => openItem(parent.id)}>{parent.title}</button>
            </dd>
          </>
        )}
      </dl>
      {item.description && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{item.description}</p>}

      <CommSection item={item} />

      {grader && !readOnly && (
        <section className="stack">
          <div className="row">
            <h3 className="grow">Grade</h3>
            <button className="btn sm" aria-expanded={gradeOpen} onClick={() => setGradeOpen((o) => !o)}>
              {gradeOpen ? 'Hide' : item.graded ? 'Re-grade' : 'Grade now'}
            </button>
          </div>
          {gradeOpen && (
            <>
              <GradeForm item={item} draft={draft} onChange={setDraft} />
              <div className="row">
                <button className="btn primary" onClick={saveGrade}>
                  Save grade
                </button>
                {item.column === 'Intake' && (
                  <button
                    className="btn"
                    onClick={async () => {
                      const g = effectiveGrade(draft);
                      if (!g) return toast('Pick a bucket and all three scores first.');
                      await commit([{ type: 'item.grade', item: item.id, data: g }, { type: 'item.move', item: item.id, data: { column: 'To Do' } }]);
                      toast('Graded and sent to To Do.');
                      onClose();
                    }}
                  >
                    Save and send to To Do
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}

      <section className="stack">
        <div className="row">
          <h3 className="grow">Tasks ({kids.length})</h3>
          {!readOnly && (
            <button className="btn sm" onClick={() => openNew(item)}>
              <Icon name="plus" size={16} /> Split into a task
            </button>
          )}
        </div>
        {kids.length > 0 && (
          <ul className="ranked" style={{ padding: 0 }}>
            {kids.map((k) => (
              <li key={k.id} className="r-item" style={{ paddingLeft: 12 }}>
                <span className={`chip ${k.column === 'Done' ? 'ok' : 'src'}`}>{k.column}</span>
                <button className="t grow" style={{ background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', minHeight: 44 }} onClick={() => openItem(k.id)}>
                  {k.title}
                </button>
                <Avatar user={k.owner} config={cfg} />
              </li>
            ))}
          </ul>
        )}
        {kids.length === 0 && <p className="muted small" style={{ margin: 0 }}>Bigger than a day? Split it into tasks that each fit in a day.</p>}
      </section>

      {!readOnly && (
        <section className="stack">
          <h3>Log time</h3>
          <div className="row wrap">
            <label className="field" style={{ width: 110 }}>
              <span>Hours</span>
              <input className="input" type="number" min={0.25} step={0.25} max={24} value={hours} onChange={(e) => setHours(e.target.value)} />
            </label>
            <label className="field grow">
              <span>Capacity bucket</span>
              <select className="input" value={hBucket} onChange={(e) => setHBucket(e.target.value as TimeBucket)}>
                {TIME_BUCKETS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn"
              style={{ alignSelf: 'flex-end' }}
              disabled={!(Number(hours) > 0 && Number(hours) <= 24)}
              onClick={async () => {
                if (await commit([{ type: 'time.log', item: item.id, data: { bucket: hBucket, hours: Number(hours), date: todayISO() } }])) {
                  setHours('');
                  toast('Time logged.');
                }
              }}
            >
              Log
            </button>
          </div>
        </section>
      )}

      <section className="stack">
        <h3>Comments</h3>
        {item.comments.map((c) => (
          <div key={c.id} className="row" style={{ alignItems: 'flex-start' }}>
            <Avatar user={c.user} config={cfg} />
            <div className="grow">
              <div className="small muted">
                <strong style={{ color: 'var(--text)' }}>{name(c.user)}</strong> · {new Date(c.ts).toLocaleString()}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{c.text}</div>
            </div>
          </div>
        ))}
        {!readOnly && (
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <label className="field grow">
              <span>Add a comment</span>
              <textarea className="input" value={comment} onChange={(e) => setComment(e.target.value)} style={{ minHeight: 60 }} />
            </label>
            <button
              className="btn"
              disabled={!comment.trim()}
              onClick={async () => {
                if (await commit([{ type: 'item.comment', item: item.id, data: { text: comment.trim() } }])) setComment('');
              }}
            >
              Post
            </button>
          </div>
        )}
      </section>

      <section className="stack">
        <h3>History</h3>
        <div className="timeline">
          {history.map((a) => (
            <div className="ev" key={a.event.id}>
              <Avatar user={a.file} config={cfg} />
              <div className="what">
                <div>
                  <strong>{name(a.file)}</strong> {describeEvent(a.event, cfg)}
                  {a.rejected && <span className="chip bad" style={{ marginLeft: 6 }}>Ignored: {a.rejected}</span>}
                </div>
                <div className="small muted">{new Date(a.event.ts).toLocaleString()}</div>
              </div>
            </div>
          ))}
          {history.length === 0 && <p className="muted small">No changes yet. Synced from {item.source === 'SD' ? 'Service Desk' : item.source}.</p>}
        </div>
      </section>
    </Modal>
  );
}

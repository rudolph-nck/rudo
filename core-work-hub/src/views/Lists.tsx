import { useState } from 'react';
import { useHub } from '../store/hub';
import { useUi } from '../components/actions';
import { Avatar, BucketDot, Icon, PriorityChip, SourceBadge, toast } from '../components/ui';
import { fmtAge, fmtShortDate, isOverdue, needsAck, noOwner, priorityRank, readyToClose, todayISO, findPerson } from '../model/logic';
import { COLUMNS, COLUMN_LABEL, TIME_BUCKETS, type TimeBucket, type WorkItem } from '../model/types';
import { useNav } from '../nav';

export function ItemTable({ items, empty }: { items: WorkItem[]; empty: string }) {
  const { state, me, readOnly, commit } = useHub();
  const { openItem } = useUi();
  if (!items.length) return <div className="panel" style={{ padding: 28, textAlign: 'center' }}><span className="muted">{empty}</span></div>;
  return (
    <div className="panel table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Column</th>
            <th>Owner</th>
            <th>Next update</th>
            <th>Age</th>
            <th><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td>
                <div className="row" style={{ gap: 6 }}>
                  <BucketDot b={i.bucket} />
                  <PriorityChip p={i.priority} />
                  <SourceBadge item={i} />
                </div>
                <button className="btn ghost sm" style={{ padding: 0, fontWeight: 700, minHeight: 36, textAlign: 'left', whiteSpace: 'normal' }} onClick={() => openItem(i.id)}>
                  {i.title}
                </button>
              </td>
              <td>{i.column}{i.rank ? ` #${i.rank}` : ''}</td>
              <td><div className="row"><Avatar user={i.owner} config={state.config} />{findPerson(state.config, i.owner)?.name ?? '—'}</div></td>
              <td className={isOverdue(i) ? 'danger-text' : ''}>{i.next_update_due ? `${isOverdue(i) ? 'Overdue · ' : ''}${fmtShortDate(i.next_update_due)}` : '—'}</td>
              <td>{fmtAge(i.created)}</td>
              <td>
                {i.owner === me && !i.acked && !readOnly && i.column !== 'Done' && (
                  <button className="btn sm primary" onClick={() => commit([{ type: 'item.ack', item: i.id, data: {} }])}>
                    Acknowledge
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const LISTS: Record<string, { title: string; sub: string }> = {
  ack: { title: 'Waiting for acknowledgment', sub: 'Owner has not acknowledged the assignment yet.' },
  noowner: { title: 'No owner', sub: 'Graded work that nobody owns. Assign it in the card.' },
  close: { title: 'Ready to close', sub: 'Resolved in Service Desk, or every task under it is done.' },
  overdue: { title: 'Overdue next updates', sub: 'The requester is owed an update.' },
};

export function NeedsList() {
  const { state, me, role } = useHub();
  const { view, param, go } = useNav();
  const key = view === 'list' && param && LISTS[param] ? param : 'ack';
  const items =
    key === 'ack' ? needsAck(state, me, role) : key === 'noowner' ? noOwner(state) : key === 'close' ? readyToClose(state, me, role) : [...state.items.values()].filter((i) => isOverdue(i));
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <button className="btn ghost sm" onClick={() => go('board')}>← Board</button>
          <h1>{LISTS[key].title}</h1>
          <div className="sub">{LISTS[key].sub}</div>
        </div>
      </div>
      <ItemTable items={items.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))} empty="Nothing here." />
    </div>
  );
}

export function MyWork() {
  const { state, me, readOnly, commit } = useHub();
  const { openNew } = useUi();
  const mine = [...state.items.values()].filter((i) => i.owner === me && !i.stale && (i.column !== 'Done' || (i.done ?? '') >= new Date(Date.now() - 7 * 864e5).toISOString()));
  const [hours, setHours] = useState('');
  const [bucket, setBucket] = useState<TimeBucket>('owner_tickets');
  const [note, setNote] = useState('');
  const today = todayISO();
  const todays = state.time.filter((t) => t.user === me && t.date === today);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>My work</h1>
          <div className="sub">Everything you own. Acknowledge new assignments and keep next-update dates honest.</div>
        </div>
        <div className="topbar-actions">
          {!readOnly && (
            <button className="btn primary" onClick={() => openNew()}>
              <Icon name="plus" /> New work
            </button>
          )}
        </div>
      </div>
      {!readOnly && (
        <section className="panel" style={{ padding: 16 }} aria-labelledby="lt">
          <h2 id="lt" style={{ marginBottom: 10 }}>Log time for today</h2>
          <div className="row wrap" style={{ alignItems: 'flex-end' }}>
            <label className="field" style={{ width: 110 }}>
              <span>Hours</span>
              <input className="input" type="number" min={0.25} step={0.25} max={24} value={hours} onChange={(e) => setHours(e.target.value)} />
            </label>
            <label className="field" style={{ width: 200 }}>
              <span>Capacity bucket</span>
              <select className="input" value={bucket} onChange={(e) => setBucket(e.target.value as TimeBucket)}>
                {TIME_BUCKETS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </label>
            <label className="field grow">
              <span>Note (optional)</span>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <button
              className="btn"
              disabled={!(Number(hours) > 0 && Number(hours) <= 24)}
              onClick={async () => {
                if (await commit([{ type: 'time.log', data: { bucket, hours: Number(hours), date: today, note: note.trim() || undefined } }])) {
                  setHours('');
                  setNote('');
                  toast('Time logged.');
                }
              }}
            >
              Log
            </button>
          </div>
          {todays.length > 0 && (
            <p className="small muted" style={{ marginBottom: 0 }}>
              Today: {todays.map((t) => `${t.hours}h ${TIME_BUCKETS.find((b) => b.key === t.bucket)?.label}`).join(' · ')}
            </p>
          )}
        </section>
      )}
      {COLUMNS.filter((c) => c !== 'Intake').map((c) => {
        const list = mine.filter((i) => i.column === c).sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)) || priorityRank(a.priority) - priorityRank(b.priority));
        return (
          <section key={c} className="stack" aria-label={c}>
            <h2>{COLUMN_LABEL[c]} <span className="muted">({list.length})</span></h2>
            <ItemTable items={list} empty={c === 'Done' ? 'Nothing finished in the last 7 days.' : `Nothing in ${c}.`} />
          </section>
        );
      })}
    </div>
  );
}

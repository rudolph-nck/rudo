import { useHub } from '../store/hub';
import { useUi } from '../components/actions';
import { Avatar, BucketDot, PriorityChip, SourceBadge } from '../components/ui';
import { fmtAge, fmtShortDate, isOverdue, needsAck, noOwner, priorityRank, readyToClose, findPerson } from '../model/logic';
import type { WorkItem } from '../model/types';
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

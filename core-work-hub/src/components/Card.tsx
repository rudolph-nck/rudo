import { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useHub } from '../store/hub';
import { useUi } from './actions';
import { fmtAge, fmtShortDate, isOverdue, systemName } from '../model/logic';
import { COLUMNS, COLUMN_LABEL, type WorkItem } from '../model/types';
import { Avatar, BucketDot, Icon, PriorityChip, SourceBadge } from './ui';

export function CardBody({ item, menu }: { item: WorkItem; menu?: React.ReactNode }) {
  const { state, me, readOnly } = useHub();
  const { openItem, pickUp } = useUi();
  const canPick = item.column === 'Ready' && !readOnly && (item.owner === me || (!item.owner && !item.ownerFromSource));
  const overdue = isOverdue(item);
  const sys = systemName(state.config.systems, item.system);
  return (
    <>
      <div className="top">
        {item.rank !== undefined && <span className="rank" aria-label={`Rank ${item.rank}`}>#{item.rank}</span>}
        <BucketDot b={item.bucket} />
        <PriorityChip p={item.priority} />
        <SourceBadge item={item} />
        {menu}
      </div>
      <button className="title" onClick={() => openItem(item.id)} onPointerDown={(e) => e.stopPropagation()}>
        {item.title}
      </button>
      {item.hold && (item.column === 'On Hold' || item.column === 'Ready' || item.column === 'To Do') && (
        <div className="hold" title={`By ${state.config.people.find((p) => p.username === item.hold!.user)?.name ?? item.hold.user} on ${new Date(item.hold.since).toLocaleDateString()}`}>
          {item.column === 'On Hold' ? 'On hold' : 'Taken off Doing'} {fmtShortDate(item.hold.since)}
          {item.hold.reason ? `: ${item.hold.reason}` : ''}
        </div>
      )}
      {item.source === 'SD' && !item.sourceClosed && item.source_status && !/^(open|in progress|assigned)$/i.test(item.source_status) && (
        <div className="meta">
          <span className="chip sd-status" title={item.statusDriven ? 'Service Desk status decides this column' : 'Service Desk status'}>
            SD: {item.source_status}
          </span>
        </div>
      )}
      {(sys || item.parent_id) && <div className="meta">{[sys, item.parent_id ? 'Task' : undefined].filter(Boolean).join(' · ')}</div>}
      <div className="foot">
        <Avatar user={item.owner} config={state.config} external={item.owner ? undefined : item.source_owner} />
        {item.owner && !item.acked && item.column !== 'Done' && item.column !== 'Intake' && <span className="chip warn">Not acked</span>}
        <span title={`Opened ${new Date(item.created).toLocaleDateString()}`}>
          <span className="sr-only">Age </span>
          {fmtAge(item.created)}
        </span>
        <span className="grow" />
        {canPick && (
          <button className="btn sm primary pickup" onClick={() => void pickUp(item)} onPointerDown={(e) => e.stopPropagation()} aria-label={`Pick up ${item.title}`}>
            Pick up
          </button>
        )}
        {!canPick && item.next_update_due && item.column !== 'Done' && (
          <span className={`due ${overdue ? 'overdue' : ''}`} title="Next update due">
            <Icon name="clock" size={13} /> {overdue ? 'Overdue · ' : ''}
            {fmtShortDate(item.next_update_due)}
          </span>
        )}
      </div>
    </>
  );
}

/** "Move to…" menu: the keyboard/touch alternative to dragging. */
function MoveMenu({ item }: { item: WorkItem }) {
  const { readOnly } = useHub();
  const { requestMove, openItem } = useUi();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  if (readOnly) return null;
  return (
    <div ref={ref} className="card-menu" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button className="menu-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`Actions for ${item.title}`} onClick={() => setOpen((o) => !o)}>
        <Icon name="more" />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-label">Move to</div>
          {COLUMNS.filter((c) => c !== item.column).map((c) => (
            <button
              key={c}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void requestMove(item, c);
              }}
            >
              {COLUMN_LABEL[c]}
            </button>
          ))}
          <div className="nav-sep" />
          <button role="menuitem" onClick={() => { setOpen(false); openItem(item.id); }}>
            Open details
          </button>
        </div>
      )}
    </div>
  );
}

export function SortableCard({ item, disabled }: { item: WorkItem; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, data: { item }, disabled });
  const ref = (el: HTMLElement | null) => {
    setNodeRef(el);
    setActivatorNodeRef(el);
  };
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <article
      ref={ref}
      style={style}
      className={`card ${isDragging ? 'dragging' : ''} ${item.owner && !item.acked && item.column !== 'Done' && item.column !== 'Intake' ? 'unacked' : ''}`}
      aria-label={`${item.title}${item.rank ? `, rank ${item.rank}` : ''}`}
      {...attributes}
      {...listeners}
      role="group"
      aria-roledescription="draggable card"
    >
      <CardBody item={item} menu={<MoveMenu item={item} />} />
    </article>
  );
}

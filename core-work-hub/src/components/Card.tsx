import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { ageOf, dayNo } from '../model/priority';
import { CSS } from '@dnd-kit/utilities';
import { useHub } from '../store/hub';
import { useUi } from './actions';
import { addDays, fmtAge, fmtShortDate, isOverdue, offOn, systemName } from '../model/logic';
import { COLUMNS, COLUMN_LABEL, type WorkItem } from '../model/types';
import { CommChip } from './Comm';
import { computeTeamScore, criteriaOf, isProject } from '../model/teamscore';
import { BUCKET_LABEL } from '../model/types';
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
        {item.bucket ? (
          <span className={`chip bucket-badge ${item.bucket}`} title={`${BUCKET_LABEL[item.bucket]} work`}>
            <span className={`dot ${item.bucket}`} aria-hidden />
            {item.bucket}
          </span>
        ) : (
          <BucketDot b={item.bucket} />
        )}
        {item.expedite && <span className="chip forced" title={`Forced priority: ${item.expedite.reason} (requested by ${item.expedite.requestedBy})`}>FORCED</span>}
        <PriorityChip p={item.priority} />
        <SourceBadge item={item} />
        {isProject(item) && computeTeamScore(item, criteriaOf(state.config)).score !== undefined && (
          <span className="chip ts-chip" title="Team score">★ {computeTeamScore(item, criteriaOf(state.config)).score}</span>
        )}
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
        {item.owner && item.column !== 'Done' && offOn(state.config, item.owner) && (
          <span className="chip bad" title="Owner is off today">Off · back {fmtShortDate(addDays(offOn(state.config, item.owner)!.to, 1))}</span>
        )}
        <span title={`Opened ${new Date(item.created).toLocaleDateString()}`}>
          <span className="sr-only">Age </span>
          {fmtAge(item.created)}
        </span>
        <AgeChip item={item} />
        <span className="grow" />
        <CommChip item={item} />
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

/** Resolution clock: shown once an item is halfway to its target ("Day 4 of 3"), with any aging raise. */
function AgeChip({ item }: { item: WorkItem }) {
  const { state } = useHub();
  const a = ageOf(state, item);
  if (!a || a.stage === 'ok' || a.stage === 'waiting') return null;
  const late = a.stage === 'past' || a.stage === 'double';
  const label = `Day ${late ? Math.max(dayNo(a), a.target + 1) : dayNo(a)} of ${a.target}`;
  return (
    <span className={`chip ${late ? 'bad' : 'warn'}`} title={`${a.priority} target: ${a.target} business day${a.target === 1 ? '' : 's'}${a.backlog ? ' (clock started on the standard’s start date)' : ''}. Due ${a.due.toLocaleString()}.${a.raised ? ` Aging raised it to ${a.effective}.` : ''}${item.bumps ? ` Bumped ${item.bumps}×.` : ''}`}>
      {label}{a.raised ? ` · ↑${a.effective}` : ''}
    </span>
  );
}

/** "Move to…" menu: the keyboard/touch alternative to dragging. */
function MoveMenu({ item }: { item: WorkItem }) {
  const { readOnly } = useHub();
  const { requestMove, openItem } = useUi();
  const [pos, setPos] = useState<{ top: number; left: number }>();
  const open = !!pos;
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = () => setPos(undefined);
  // The menu floats above the board (fixed position, outside the card), so a scrolling column never cuts it off.
  const place = () => {
    const r = btn.current!.getBoundingClientRect();
    const w = 200;
    const h = menu.current?.offsetHeight ?? 330;
    const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
    const below = r.bottom + 4;
    const top = below + h > window.innerHeight - 8 && r.top - h - 4 > 8 ? r.top - h - 4 : Math.min(below, Math.max(8, window.innerHeight - h - 8));
    setPos({ top, left });
  };
  useEffect(() => {
    if (!open) return;
    place(); // re-place once the menu's real height is known
    const outside = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && !menu.current?.contains(e.target as Node) && close();
    // Follow the button when something scrolls; close only once the button has scrolled out of view.
    const onScroll = (e: Event) => {
      if (menu.current?.contains(e.target as Node) || !btn.current) return;
      const r = btn.current.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight || r.width === 0) close();
      else place();
    };
    document.addEventListener('mousedown', outside);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', outside);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (readOnly) return null;
  return (
    <div ref={ref} className="card-menu" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && close()}>
      <button ref={btn} className="menu-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`Actions for ${item.title}`} onClick={() => (open ? close() : place())}>
        <Icon name="more" />
      </button>
      {pos &&
        createPortal(
          <div ref={menu} className="menu floating" role="menu" style={{ top: pos.top, left: pos.left }} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') { close(); btn.current?.focus(); } }}>
            <div className="menu-label">Move to</div>
            {COLUMNS.filter((c) => c !== item.column).map((c) => (
              <button
                key={c}
                role="menuitem"
                onClick={() => {
                  close();
                  void requestMove(item, c);
                }}
              >
                {COLUMN_LABEL[c]}
              </button>
            ))}
            <div className="nav-sep" />
            <button role="menuitem" onClick={() => { close(); openItem(item.id); }}>
              Open details
            </button>
          </div>,
          document.body,
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

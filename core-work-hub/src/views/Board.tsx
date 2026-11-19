import { Fragment, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  type CollisionDetection,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useHub } from '../store/hub';
import { useUi } from '../components/actions';
import { CardBody, SortableCard } from '../components/Card';
import { Icon, toast } from '../components/ui';
import { analysts, daysBetween, needsAck, noOwner, priorityRank, readyToClose } from '../model/logic';
import { BUCKETS, BUCKET_LABEL, COLUMNS, COLUMN_LABEL, PRIORITIES, isRanked, type Bucket, type Column, type WorkItem } from '../model/types';
import { useNav } from '../nav';

type Lane = Bucket | 'all' | 'intake';

/** Prefer whatever is under the pointer (card or column); fall back to nearest corners for keyboard drags. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length) {
    const card = hits.find((h) => !String(h.id).startsWith('cell|'));
    return card ? [card] : hits;
  }
  return closestCorners(args);
};
const cellId = (lane: Lane, col: Column) => `cell|${lane}|${col}`;
const parseCell = (id: string) => {
  const [, lane, col] = id.split('|');
  return { lane: lane as Lane, col: col as Column };
};
const DONE_DAYS = 14;

export interface Filters {
  owner: string;
  priority: string;
  system: string;
  source: string;
}
const NO_FILTERS: Filters = { owner: '', priority: '', system: '', source: '' };

export function applyFilters(items: WorkItem[], f: Filters) {
  return items.filter(
    (i) =>
      (!f.owner || (f.owner === '__none' ? !i.owner : i.owner === f.owner)) &&
      (!f.priority || i.priority === f.priority) &&
      (!f.system || i.system === f.system) &&
      (!f.source || i.source === f.source),
  );
}

function sortCell(items: WorkItem[], col: Column, lane: Lane) {
  if (isRanked(col)) {
    return [...items].sort((a, b) => (lane === 'all' ? priorityRank(a.priority) - priorityRank(b.priority) || (a.rank ?? 0) - (b.rank ?? 0) : (a.rank ?? 0) - (b.rank ?? 0)));
  }
  if (col === 'Done') return [...items].sort((a, b) => (b.done ?? '').localeCompare(a.done ?? ''));
  return [...items].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.created.localeCompare(b.created));
}

function Cell({ lane, col, items, highlight, readOnly }: { lane: Lane; col: Column; items: WorkItem[]; highlight?: 'ok' | 'blocked'; readOnly: boolean }) {
  const { setNodeRef } = useDroppable({ id: cellId(lane, col), data: { lane, col } });
  const shown = col === 'Done' ? items.slice(0, 12) : items;
  return (
    <SortableContext id={cellId(lane, col)} items={shown.map((i) => i.id)} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className={`cell ${highlight ? 'over' : ''} ${highlight === 'blocked' ? 'blocked' : ''}`} aria-label={`${col}${lane !== 'all' && lane !== 'intake' ? `, ${lane}` : ''}`} role="list">
        {shown.map((i) => (
          <div role="listitem" key={i.id}>
            <SortableCard item={i} disabled={readOnly} />
          </div>
        ))}
        {items.length > shown.length && <div className="empty">+{items.length - shown.length} more done</div>}
        {items.length === 0 && <div className="empty">{col === 'Intake' ? 'Nothing waiting' : 'Drop cards here'}</div>}
      </div>
    </SortableContext>
  );
}

export function Board() {
  const { state, me, role, readOnly, grader } = useHub();
  const { requestMove, openNew } = useUi();
  const { go } = useNav();
  const cfg = state.config;
  const [bucket, setBucket] = useState<Bucket | 'all'>(() => (localStorage.getItem('cwh.bucket') as Bucket) || 'all');
  // One row of columns by default; each card carries a Project / Maintenance / Support badge. Swimlanes are optional.
  const [lanes, setLanes] = useState(() => localStorage.getItem('cwh.lanes2') === '1');
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [active, setActive] = useState<WorkItem>();
  const [overCell, setOverCell] = useState<string>();

  const setB = (b: Bucket | 'all') => {
    setBucket(b);
    try { localStorage.setItem('cwh.bucket', b); } catch { /* private mode */ }
  };

  const visible = useMemo(() => {
    const all = [...state.items.values()].filter((i) => !i.stale && (i.column !== 'Done' || daysBetween(i.done ?? i.touched) <= DONE_DAYS));
    return applyFilters(all, f);
  }, [state.items, f]);

  const swim = bucket === 'all' && lanes;
  const laneList: Lane[] = bucket !== 'all' ? [bucket] : swim ? [...BUCKETS] : ['all'];
  /** Every rendered cell. In swimlane mode one shared Intake cell spans all lanes. */
  const cells: [Lane, Column][] = swim
    ? [['intake', 'Intake'], ...BUCKETS.flatMap((b) => COLUMNS.filter((c) => c !== 'Intake').map((c) => [b, c] as [Lane, Column]))]
    : laneList.flatMap((l) => COLUMNS.map((c) => [l, c] as [Lane, Column]));
  const cellItems = (lane: Lane, col: Column) =>
    sortCell(
      visible.filter((i) => {
        if (i.column !== col) return false;
        if (lane === 'all' || lane === 'intake') return true;
        return i.bucket === lane;
      }),
      col,
      lane,
    );
  // In a single-bucket view, ungraded intake still shows in the Intake column.
  const cellItemsFor = (lane: Lane, col: Column) =>
    bucket !== 'all' && col === 'Intake' ? sortCell(visible.filter((i) => i.column === 'Intake' && (!i.bucket || i.bucket === lane)), col, lane) : cellItems(lane, col);

  const findCell = (id: string): string | undefined => {
    if (id.startsWith('cell|')) return id;
    for (const [lane, col] of cells) if (cellItemsFor(lane, col).some((i) => i.id === id)) return cellId(lane, col);
    return undefined;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onStart = (e: DragStartEvent) => setActive(state.items.get(String(e.active.id)));
  const onOver = (e: DragOverEvent) => setOverCell(e.over ? findCell(String(e.over.id)) : undefined);
  const onEnd = async (e: DragEndEvent) => {
    setActive(undefined);
    setOverCell(undefined);
    const item = state.items.get(String(e.active.id));
    if (!item || !e.over) return;
    const target = findCell(String(e.over.id));
    const source = findCell(item.id);
    if (!target) return;
    const { lane, col } = parseCell(target);
    if (lane !== 'all' && lane !== 'intake' && item.bucket && item.bucket !== lane) {
      toast(`To move it to ${BUCKET_LABEL[lane]}, re-grade the item.`);
      return;
    }
    let index: number | undefined;
    if (isRanked(col) && lane !== 'all' && lane !== 'intake') {
      const list = cellItemsFor(lane, col);
      const overIdx = list.findIndex((i) => i.id === String(e.over!.id));
      index = overIdx >= 0 ? overIdx : list.filter((i) => i.id !== item.id).length;
      if (f.owner || f.priority || f.system || f.source) {
        // Filtered list: map the visible position onto the full ranked list.
        const full = [...state.items.values()].filter((i) => i.column === col && i.bucket === lane).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
        const anchor = overIdx >= 0 ? list[overIdx] : undefined;
        const others = full.filter((i) => i.id !== item.id);
        const movingDown = source === target && list.findIndex((i) => i.id === item.id) < overIdx;
        index = anchor ? others.findIndex((i) => i.id === anchor.id) + (movingDown ? 1 : 0) : others.length;
      }
      if (source === target && item.column === col) {
        if (!grader) return toast(`Only Nick re-ranks ${COLUMN_LABEL[col]} (or the team in standup).`);
        if (item.rank === index + 1 || (overIdx >= 0 && list[overIdx].id === item.id)) return;
      }
    } else if (source === target) return;
    if (isRanked(col) && lane === 'all' && source === target) return toast(`Pick a bucket to re-rank its ${COLUMN_LABEL[col]} list.`);
    // Let the drag library finish its drop before any dialog (WIP, reason, Service Desk) takes focus.
    await new Promise((r) => setTimeout(r, 0));
    await requestMove(item, col, { index });
  };

  const ack = needsAck(state, me, role);
  const unowned = noOwner(state);
  const closeable = readyToClose(state, me, role);
  const doingTotal = [...state.items.values()].filter((i) => i.column === 'Doing' && (bucket === 'all' || i.bucket === bucket)).length;
  const bucketLimit = bucket !== 'all' ? cfg.bucketWip[bucket] : undefined;
  const ownerOpts = cfg.people.filter((p) => p.role !== 'viewer');

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Board</h1>
          <div className="sub">Force-ranked To Do and Ready per bucket. Finish before you start.</div>
        </div>
        <div className="topbar-actions">
          {!readOnly && (
            <button className="btn primary" onClick={() => openNew()}>
              <Icon name="plus" /> New work
            </button>
          )}
        </div>
      </div>

      <section aria-label="Needs you" className="tiles">
        <button className="tile" onClick={() => go('list', 'ack')}>
          <span className="ico"><Icon name="bell" /></span>
          <span className="num">{ack.length}</span>
          <span><span className="t">Waiting for acknowledgment</span><br /><span className="d">{role === 'analyst' ? 'Assigned to you, not yet acked' : 'Assigned but not acked by the owner'}</span></span>
        </button>
        <button className="tile" onClick={() => go('list', 'noowner')}>
          <span className="ico"><Icon name="user0" /></span>
          <span className="num">{unowned.length}</span>
          <span><span className="t">No owner</span><br /><span className="d">Graded work nobody owns</span></span>
        </button>
        <button className="tile" onClick={() => go('list', 'close')}>
          <span className="ico"><Icon name="check" /></span>
          <span className="num">{closeable.length}</span>
          <span><span className="t">Ready to close</span><br /><span className="d">Resolved in Service Desk, or all tasks done</span></span>
        </button>
      </section>

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Bucket">
          {(['all', ...BUCKETS] as const).map((b) => (
            <button key={b} aria-pressed={bucket === b} onClick={() => setB(b)}>
              {b !== 'all' && <span className={`dot ${b}`} />}
              {b === 'all' ? 'All' : BUCKET_LABEL[b]}
            </button>
          ))}
        </div>
        {bucket === 'all' && (
          <label className="toggle">
            <input
              type="checkbox"
              checked={lanes}
              onChange={(e) => {
                setLanes(e.target.checked);
                try { localStorage.setItem('cwh.lanes2', e.target.checked ? '1' : '0'); } catch { /* ignore */ }
              }}
            />
            Swimlanes
          </label>
        )}
        <div className="filters" role="group" aria-label="Filters">
          <select aria-label="Filter by analyst" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}>
            <option value="">All analysts</option>
            <option value="__none">No owner</option>
            {ownerOpts.map((p) => (
              <option key={p.username} value={p.username}>{p.name}</option>
            ))}
          </select>
          <select aria-label="Filter by priority" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select aria-label="Filter by system" value={f.system} onChange={(e) => setF({ ...f, system: e.target.value })}>
            <option value="">All systems</option>
            {cfg.systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select aria-label="Filter by source" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
            <option value="">All sources</option>
            <option value="SD">Service Desk</option>
            <option value="Wrike">Wrike</option>
            <option value="Hub">Hub</option>
          </select>
          {(f.owner || f.priority || f.system || f.source) && (
            <button className="btn sm ghost" onClick={() => setF(NO_FILTERS)}>Clear filters</button>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={() => { setActive(undefined); setOverCell(undefined); }}>
        <div className="board-scroll">
          <div className="board" role="presentation">
            {COLUMNS.map((c) => (
              <div key={c} className="col-head">
                {COLUMN_LABEL[c]}
                <span className="n">{visible.filter((i) => i.column === c && (bucket === 'all' || i.bucket === bucket || (c === 'Intake' && !i.bucket))).length}</span>
                {c === 'Doing' && (
                  <span className={`wip chip ${bucketLimit !== undefined && doingTotal > bucketLimit ? 'bad' : 'src'}`} title="Work in progress">
                    WIP {doingTotal}
                    {bucketLimit !== undefined ? ` / ${bucketLimit}` : ` / ${analysts(cfg).reduce((s, p) => s + (p.wipLimit ?? cfg.defaultWipLimit), 0)}`}
                  </span>
                )}
                {c === 'Done' && <span className="wip small muted">last {DONE_DAYS} days</span>}
              </div>
            ))}
          </div>
          {swim ? (
            <div className="board">
              <div className="intake-span" style={{ gridColumn: 1, gridRow: `1 / span ${BUCKETS.length * 2}` }}>
                <Cell lane="intake" col="Intake" items={cellItemsFor('intake', 'Intake')} readOnly={readOnly} highlight={overCell === cellId('intake', 'Intake') ? 'ok' : undefined} />
              </div>
              {BUCKETS.map((b, k) => (
                <Fragment key={b}>
                  <div className="lane-head" style={{ gridColumn: `2 / ${COLUMNS.length + 1}`, gridRow: k * 2 + 1, marginTop: k ? 10 : 0 }}>
                    <span className={`dot ${b}`} />
                    {BUCKET_LABEL[b]}
                  </div>
                  {COLUMNS.filter((c) => c !== 'Intake').map((c, n) => (
                    <div key={c} className="lane-slot" style={{ gridColumn: n + 2, gridRow: k * 2 + 2, display: 'flex' }}>
                      <Cell lane={b} col={c} items={cellItemsFor(b, c)} readOnly={readOnly} highlight={overCell === cellId(b, c) ? 'ok' : undefined} />
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
          ) : (
            <div className="board flat">
              {cells.map(([lane, c]) => (
                <Cell key={c} lane={lane} col={c} items={cellItemsFor(lane, c)} readOnly={readOnly} highlight={overCell === cellId(lane, c) ? 'ok' : undefined} />
              ))}
            </div>
          )}
        </div>
        <DragOverlay>{active && <div className="card overlay"><CardBody item={active} /></div>}</DragOverlay>
      </DndContext>
    </div>
  );
}

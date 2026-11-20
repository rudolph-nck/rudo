import { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useHub } from '../store/hub';
import { useUi, rankEvents } from '../components/actions';
import { GradeForm, draftFrom, effectiveGrade, type Draft } from '../components/GradeForm';
import { Avatar, BucketDot, Icon, PriorityChip, SourceBadge, openLink, toast } from '../components/ui';
import { analysts, computeScore, doingFor, findPerson, fmtAge, fmtShortDate, isOverdue, personWipLimit, rankedList, suggestOwner, suggestPriority, suggestedRankIndex } from '../model/logic';
import { BUCKETS, BUCKET_LABEL, PRIORITIES, type Bucket, type Priority, type WorkItem } from '../model/types';

export function CapacityStrip() {
  const { state } = useHub();
  return (
    <div className="capacity" aria-label="Doing slots against WIP limits">
      {analysts(state.config).map((p) => {
        const n = doingFor(state, p.username).length;
        const lim = personWipLimit(state.config, p.username);
        const slots = Math.max(lim, n);
        return (
          <div className="cap" key={p.username} title={`${p.name}: ${n} in Doing, limit ${lim}`}>
            <Avatar user={p.username} config={state.config} />
            {p.name}
            <span className="slots" aria-label={`${n} of ${lim}`}>
              {Array.from({ length: slots }, (_, i) => (
                <span key={i} className={`slot ${i < n ? (i >= lim ? 'over' : 'full') : ''}`} />
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RankRow({ item, disabled }: { item: WorkItem; disabled: boolean }) {
  const { state } = useHub();
  const { openItem } = useUi();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled });
  const overdue = isOverdue(item);
  return (
    <li ref={setNodeRef} className="r-item" style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      {!disabled && (
        <button ref={setActivatorNodeRef} className="handle" aria-label={`Drag to re-rank ${item.title}`} {...attributes} {...listeners}>
          <Icon name="grip" />
        </button>
      )}
      <span className="num">{item.rank}</span>
      <div className="grow" style={{ minWidth: 0 }}>
        <button className="t" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => openItem(item.id)}>
          {item.title}
        </button>
        <div className="row small muted" style={{ gap: 6, marginTop: 2 }}>
          <PriorityChip p={item.priority} />
          <SourceBadge item={item} />
          {item.score !== undefined && <span>score {item.score}</span>}
          {item.next_update_due && <span className={overdue ? 'danger-text' : ''}>{overdue ? 'Overdue ' : 'Update '}{fmtShortDate(item.next_update_due)}</span>}
        </div>
      </div>
      <Avatar user={item.owner} config={state.config} />
    </li>
  );
}

export function Triage() {
  const { state, grader, readOnly, commit } = useHub();
  const { openItem } = useUi();
  const queue = useMemo(
    () => [...state.items.values()].filter((i) => i.column === 'Intake' && !i.stale).sort((a, b) => a.created.localeCompare(b.created)),
    [state.items],
  );
  const [selId, setSelId] = useState<string | undefined>(queue[0]?.id);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [listBucket, setListBucket] = useState<Bucket>('Support');
  const [listCol, setListCol] = useState<'To Do' | 'Ready'>('To Do');
  const sel = selId ? state.items.get(selId) : undefined;
  const draft = sel ? drafts[sel.id] ?? draftFrom(sel) : undefined;
  const setDraft = (d: Draft) => sel && setDrafts((x) => ({ ...x, [sel.id]: d }));
  const canAct = grader && !readOnly;
  const selRef = useRef<HTMLLIElement>(null);

  // Keep a valid selection as items leave the queue.
  useEffect(() => {
    if (!sel || sel.column !== 'Intake') setSelId(queue[0]?.id);
  }, [queue, sel]);
  useEffect(() => {
    if (draft?.bucket) setListBucket(draft.bucket);
  }, [draft?.bucket]);
  useEffect(() => {
    selRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selId]);

  const list = rankedList(state, listBucket, listCol);
  const score = draft ? computeScore(draft.impact, draft.urgency, draft.effort) : undefined;
  const sugOwner = draft ? suggestOwner(state, draft.system, sel?.id)?.username : undefined;
  const grade = draft ? effectiveGrade(draft, sugOwner) : undefined;
  const pri: Priority | undefined = draft ? (draft.priorityTouched ? draft.priority : suggestPriority(score) ?? draft.priority) : undefined;
  const insertAt = grade && grade.bucket === listBucket && listCol === 'To Do' ? suggestedRankIndex(list, grade.priority, score) : undefined;

  const send = async () => {
    if (!sel || !canAct) return;
    if (!grade) return toast('Pick a bucket and all three scores first.');
    const target = rankedList(state, grade.bucket);
    const idx = suggestedRankIndex(target, grade.priority, score);
    const { pre, key } = rankEvents(target, sel, idx, grade.bucket);
    const i = queue.findIndex((q) => q.id === sel.id);
    const ok = await commit([{ type: 'item.grade', item: sel.id, data: grade }, ...pre, { type: 'item.move', item: sel.id, data: { column: 'To Do', rankKey: key } }]);
    if (ok) {
      toast(`Sent to ${BUCKET_LABEL[grade.bucket]} To Do at #${idx + 1}.`);
      setSelId(queue[i + 1]?.id ?? queue[i - 1]?.id);
    }
  };
  const reply = async () => {
    if (!sel) return;
    const isEmail = sel.requester && /@/.test(sel.requester);
    if (sel.source_url) openLink(sel.source_url);
    else if (isEmail) window.location.href = `mailto:${sel.requester}?subject=${encodeURIComponent(sel.title)}`;
    else return toast('No link or email for the requester on this item.');
    await commit([{ type: 'item.reply', item: sel.id, data: { via: sel.source_url ? (sel.source === 'SD' ? 'Service Desk' : sel.source) : 'email' } }]);
  };
  const openSource = () => {
    if (sel?.source_url) openLink(sel.source_url);
    else toast('No link for this item.');
  };
  const close = async () => {
    if (!sel) return;
    // Tickets close in Service Desk; the card follows on the next sync.
    if (sel.source === 'SD') {
      openSource();
      return toast(`Close #${sel.source_id} in Service Desk; the card moves to Done on the next sync.`);
    }
    if (await commit([{ type: 'item.move', item: sel.id, data: { column: 'Done', reason: 'Closed from triage' } }])) toast('Moved to Done.');
  };


  // Standup shortcuts: J/K move, 1–4 priority, Enter sends.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      const i = queue.findIndex((q) => q.id === selId);
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        setSelId(queue[Math.min(queue.length - 1, i + 1)]?.id);
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setSelId(queue[Math.max(0, i - 1)]?.id);
      } else if (['1', '2', '3', '4'].includes(e.key) && draft && canAct) {
        e.preventDefault();
        setDraft({ ...draft, priority: PRIORITIES[Number(e.key) - 1], priorityTouched: true });
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        openSource();
      } else if (e.key === 'Enter' && t.tagName !== 'BUTTON' && t.tagName !== 'A') {
        e.preventDefault();
        void send();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onRankEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const item = state.items.get(String(e.active.id));
    const to = list.findIndex((i) => i.id === e.over!.id);
    if (!item || to < 0) return;
    const { pre, key } = rankEvents(list, item, to, listBucket, listCol);
    await commit([...pre, { type: 'item.rank', item: item.id, data: { rankKey: key } }]);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Triage and rank</h1>
          <div className="sub">Grade intake, then force-rank To Do. No ties.</div>
        </div>
        <div className="topbar-actions small muted" aria-label="Keyboard shortcuts">
          <span><span className="kbd">J</span>/<span className="kbd">K</span> move</span>
          <span><span className="kbd">1</span>–<span className="kbd">4</span> priority</span>
          <span><span className="kbd">Enter</span> send</span>
          <span><span className="kbd">O</span> open in SD</span>
        </div>
      </div>
      {!canAct && <div className="banner info">{readOnly ? 'Read-only view.' : 'Grading and ranking happen in standup on Nick’s screen. You can review the queue here.'}</div>}
      <CapacityStrip />

      <div className="triage">
        <section className="panel" aria-labelledby="q-h">
          <div className="panel-head">
            <h2 id="q-h" className="grow">Intake queue</h2>
            <span className="chip src">{queue.length} waiting</span>
          </div>
          <ul className="queue" role="listbox" aria-label="Intake items" aria-activedescendant={selId ? `q-${selId}` : undefined}>
            {queue.length === 0 && <li className="muted" style={{ padding: 24, textAlign: 'center' }}>Intake is empty. Nice.</li>}
            {queue.map((it) => {
              const isSel = it.id === selId;
              return (
                <li key={it.id} id={`q-${it.id}`} ref={isSel ? selRef : undefined} className={`q-item ${isSel ? 'sel' : ''}`} role="option" aria-selected={isSel}>
                  <button className="q-btn" onClick={() => setSelId(it.id)} aria-expanded={isSel}>
                    <BucketDot b={(drafts[it.id]?.bucket ?? it.bucket) as Bucket | undefined} />
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 700, display: 'block' }}>{it.title}</span>
                      <span className="row small muted" style={{ gap: 6 }}>
                        <SourceBadge item={it} />
                        {it.source_status && <span className="chip src q-status" title="Status in the source system">{it.source_status}</span>}
                        {it.requester && <span>{it.requester}</span>}
                        <span>· {fmtAge(it.created)}</span>
                      </span>
                    </span>
                    <PriorityChip p={it.priority} />
                  </button>
                  {isSel && draft && (
                    <div className="q-body stack">
                      <div className="q-facts small">
                        <span><span className="muted">Status</span> <strong>{it.source_status || '—'}</strong></span>
                        {(it.source_owner || it.owner) && <span><span className="muted">{it.ownerFromSource || !it.owner ? 'Technician' : 'Owner'}</span> <strong>{findPerson(state.config, it.owner)?.name ?? it.source_owner}</strong></span>}
                        <span><span className="muted">Opened</span> <strong>{new Date(it.created).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</strong> ({fmtAge(it.created)})</span>
                        {it.due_by && <span><span className="muted">Due by</span> <strong>{fmtShortDate(it.due_by.slice(0, 10))}</strong></span>}
                        {it.department && <span><span className="muted">Department</span> <strong>{it.department}</strong></span>}
                        <button className="btn sm" onClick={() => openItem(it.id)}><Icon name="more" size={16} /> Open details</button>
                      </div>
                      {it.description && <p className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{it.description}</p>}
                      <GradeForm item={it} draft={draft} onChange={setDraft} disabled={!canAct} />
                      <div className="row wrap">
                        <button className="btn primary" onClick={send} disabled={!canAct || !grade}>
                          Send to To Do{grade ? ` · #${(grade.bucket === listBucket ? insertAt ?? list.length : suggestedRankIndex(rankedList(state, grade.bucket), grade.priority, score)) + 1} in ${BUCKET_LABEL[grade.bucket]}` : ''}
                        </button>
                        {it.source_url && (
                          <a className="btn" href={it.source_url} target="_blank" rel="noreferrer">
                            Open in {it.source === 'SD' ? 'Service Desk' : it.source} <Icon name="link" size={16} />
                          </a>
                        )}
                        <button className="btn" onClick={reply} disabled={readOnly}>Reply to requester</button>
                        <button className="btn danger" onClick={close} disabled={!canAct}>{it.source === 'SD' ? 'Close in Service Desk' : 'Close'}</button>
                        {pri && <span className="small muted">Will be {pri}</span>}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel" aria-labelledby="r-h">
          <div className="panel-head">
            <h2 id="r-h" className="grow">Ranked</h2>
            <div className="seg" role="group" aria-label="List">
              {(['To Do', 'Ready'] as const).map((c) => (
                <button key={c} aria-pressed={listCol === c} onClick={() => setListCol(c)}>
                  {c === 'Ready' ? 'Ready to pick up' : c}
                </button>
              ))}
            </div>
            <div className="seg" role="group" aria-label="Bucket">
              {BUCKETS.map((b) => (
                <button key={b} aria-pressed={listBucket === b} onClick={() => setListBucket(b)}>
                  <span className={`dot ${b}`} />
                  {BUCKET_LABEL[b]}
                </button>
              ))}
            </div>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onRankEnd}>
            <SortableContext items={list.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ol className="ranked" aria-label={`${BUCKET_LABEL[listBucket]} ${listCol} in rank order`}>
                {list.map((it, n) => (
                  <RankFragment key={it.id} showNew={insertAt === n} sel={sel} rank={n + 1}>
                    <RankRow item={it} disabled={!canAct} />
                  </RankFragment>
                ))}
                {insertAt === list.length && sel && <NewRow sel={sel} rank={list.length + 1} />}
                {list.length === 0 && insertAt === undefined && <li className="muted" style={{ padding: 24, textAlign: 'center' }}>Nothing in {BUCKET_LABEL[listBucket]} {listCol === 'Ready' ? 'Ready to pick up' : 'To Do'} yet.</li>}
              </ol>
            </SortableContext>
          </DndContext>
        </section>
      </div>
    </div>
  );
}

function NewRow({ sel, rank }: { sel: WorkItem; rank: number }) {
  return (
    <li className="r-item new" aria-label={`Preview: ${sel.title} would land at rank ${rank}`}>
      <span className="handle" aria-hidden />
      <span className="num">{rank}</span>
      <span className="t grow">{sel.title}</span>
      <span className="chip src">New</span>
    </li>
  );
}
function RankFragment({ showNew, sel, rank, children }: { showNew: boolean; sel?: WorkItem; rank: number; children: React.ReactNode }) {
  return (
    <>
      {showNew && sel && <NewRow sel={sel} rank={rank} />}
      {children}
    </>
  );
}

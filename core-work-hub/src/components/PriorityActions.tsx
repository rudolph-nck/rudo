// Re-prioritize (reason required when lowering, logged with "requester told" / "discussed with manager") and
// "commit to a date" from stand-up. Both are recorded in the audit log.
import { useState } from 'react';
import { useHub } from '../store/hub';
import { rankedList, todayISO } from '../model/logic';
import { COLUMN_LABEL, PRIORITIES, type NewEvent, type Priority, type WorkItem } from '../model/types';
import { fmtResolve, priorityStandardOf, PRIORITY_MEANING } from '../model/priority';
import { Modal, toast } from './ui';

const R: Record<Priority, number> = { P1: 1, P2: 2, P3: 3, P4: 4 };

export function ReprioritizeDialog({ item, to: initial, onClose }: { item: WorkItem; to?: Priority; onClose: () => void }) {
  const { state, commit } = useHub();
  const ps = priorityStandardOf(state.config);
  const [to, setTo] = useState<Priority>(initial ?? (item.priority === 'P4' ? 'P3' : 'P4'));
  const [reason, setReason] = useState('');
  const [told, setTold] = useState(false);
  const [aware, setAware] = useState(false);
  const [reRank, setReRank] = useState(item.column === 'To Do' || item.column === 'Ready');
  const lower = !!item.priority && R[to] > R[item.priority];
  const same = to === item.priority;
  const message = `Hi${item.requester ? ` ${item.requester.split(/[\s,@]/)[0]}` : ''}, an update on ${item.source_id ? `#${item.source_id}` : 'your request'} (“${item.title}”): because of higher-priority work across IT Core, we've moved this to ${to}. Our target for ${to} items is ${fmtResolve(ps[to], to)}. ${reason.trim() ? reason.trim() + ' ' : ''}We'll keep you updated. — IT Core`;
  const save = async () => {
    if (same) return onClose();
    if (lower && !reason.trim()) return toast('Add a reason for lowering the priority.');
    const ev: NewEvent[] = [{ type: 'item.reprioritize', item: item.id, data: { priority: to, reason: reason.trim() || (lower ? '' : 'Raised'), toldRequester: lower ? told : undefined, managerAware: lower ? aware : undefined } }];
    if (reRank && item.bucket && (item.column === 'To Do' || item.column === 'Ready')) {
      const list = rankedList(state, item.bucket, item.column).filter((x) => x.id !== item.id);
      const idx = list.findIndex((x) => (x.priority ?? 'P9') > to);
      const order = [...list];
      order.splice(idx === -1 ? order.length : idx, 0, item);
      ev.push({ type: 'rank.normalize', data: { bucket: item.bucket, column: item.column, order: order.map((x) => x.id) } });
    }
    if (await commit(ev)) {
      toast(`${item.source_id ? '#' + item.source_id + ' ' : ''}${item.priority ?? '—'} → ${to}. Logged in the audit trail.`);
      onClose();
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Change priority"
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} disabled={same}>{same ? 'No change' : `Change to ${to}`}</button></>}
    >
      <p style={{ margin: 0 }}><strong>{item.title}</strong> · now {item.priority ?? 'no priority'}{item.priorityLog?.length ? ` · changed ${item.priorityLog.length} time${item.priorityLog.length === 1 ? '' : 's'} before` : ''}</p>
      <div className="seg" role="radiogroup" aria-label="New priority">
        {PRIORITIES.map((p) => (
          <button key={p} role="radio" aria-checked={to === p} onClick={() => setTo(p)} title={PRIORITY_MEANING[p]}>{p}</button>
        ))}
      </div>
      <p className="small muted" style={{ margin: 0 }}>{PRIORITY_MEANING[to]} Target: {fmtResolve(ps[to], to)}.</p>
      <label className="field">
        <span>Why?{lower ? ' (required when lowering)' : ' (optional)'}</span>
        <textarea className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={lower ? 'e.g. P1 outage this week; requester agreed it can wait until Dec 15' : 'e.g. Exam finding due Friday'} autoFocus />
      </label>
      {lower && (
        <>
          <label className="toggle" style={{ alignSelf: 'flex-start' }}>
            <input type="checkbox" checked={told} onChange={(e) => setTold(e.target.checked)} />
            Requester told
          </label>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm" onClick={() => { void navigator.clipboard?.writeText(message); toast('Message copied. Paste it into Service Desk.'); }}>Copy a message for the requester</button>
          </div>
          <label className="toggle" style={{ alignSelf: 'flex-start' }}>
            <input type="checkbox" checked={aware} onChange={(e) => setAware(e.target.checked)} />
            Discussed with my manager
          </label>
        </>
      )}
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

export function CommitDialog({ item, onClose }: { item: WorkItem; onClose: () => void }) {
  const { commit } = useHub();
  const [date, setDate] = useState(item.commitment?.date ?? '');
  const [note, setNote] = useState(item.commitment?.note ?? '');
  const save = async () => {
    if (!date) return toast('Pick a date.');
    if (await commit([{ type: 'item.commit', item: item.id, data: { date, note: note.trim() || undefined } }])) {
      toast(`Committed to ${date}. It drops off "past target" until then.`);
      onClose();
    }
  };
  const clear = async () => {
    if (await commit([{ type: 'item.commit', item: item.id, data: { date: null } }])) onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Commit to a date"
      footer={<>{item.commitment && <button className="btn ghost" onClick={clear}>Clear</button>}<button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Commit</button></>}
    >
      <p style={{ margin: 0 }}><strong>{item.title}</strong></p>
      <p className="small muted" style={{ margin: 0 }}>The team agrees a new date at stand-up. Until then it's off the “past target” list; if the date passes, it comes back as a missed commitment.</p>
      <label className="field"><span>Date</span><input className="input" type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 200 }} /></label>
      <label className="field"><span>Note (optional)</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Waiting on vendor patch; Wes owns it" /></label>
    </Modal>
  );
}

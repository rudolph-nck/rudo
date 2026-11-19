import { useMemo, useState } from 'react';
import { useHub } from '../store/hub';
import { assignable, findPerson, fmtShortDate } from '../model/logic';
import { COLUMN_LABEL, type NewEvent, type WorkItem } from '../model/types';
import { Icon, Modal, PriorityChip, toast } from './ui';

const ASKERS = ['Executive team', 'CEO', 'Matt'];

/**
 * Force a priority ("drop everything"): records who asked, who approved holding other work, and why. The item
 * becomes P1, goes to the top of every list, may enter Doing past WIP limits, and the chosen items go On Hold.
 */
export function ExpediteDialog({ item, onClose }: { item: WorkItem; onClose: () => void }) {
  const { state, commit } = useHub();
  const cfg = state.config;
  const [asker, setAsker] = useState('Executive team');
  const [other, setOther] = useState('');
  const [approvedBy, setApprovedBy] = useState('Matt');
  const [reason, setReason] = useState('');
  const [due, setDue] = useState('');
  const [owner, setOwner] = useState(item.owner ?? '');
  const [start, setStart] = useState(item.column !== 'Doing');
  const name = (u?: string) => findPerson(cfg, u)?.name ?? u ?? '—';
  // Candidate work to put on hold: the owner's Doing first, then everything else in Doing.
  const doing = useMemo(
    () => [...state.items.values()].filter((i) => i.column === 'Doing' && i.id !== item.id && !i.stale).sort((a, b) => Number(b.owner === owner) - Number(a.owner === owner)),
    [state.items, item.id, owner],
  );
  const [holds, setHolds] = useState<Set<string>>(new Set());
  const requestedBy = asker === 'Other' ? other.trim() : asker;
  const valid = !!requestedBy && reason.trim().length > 3 && (!holds.size || approvedBy.trim());

  const save = async () => {
    const ev: NewEvent[] = [];
    const ownerLocked = item.ownerFromSource;
    if (owner && owner !== item.owner && !ownerLocked) ev.push({ type: 'item.update', item: item.id, data: { owner } });
    ev.push({
      type: 'item.expedite',
      item: item.id,
      data: { requestedBy, approvedBy: approvedBy.trim() || undefined, reason: reason.trim(), due: due || undefined, holds: [...holds] },
    });
    for (const id of holds) {
      ev.push({ type: 'item.move', item: id, data: { column: 'On Hold', reason: `Held for forced priority “${item.title}” (requested by ${requestedBy}${approvedBy ? `, approved by ${approvedBy}` : ''})` } });
    }
    if (start && item.column !== 'Doing' && !item.statusDriven) {
      ev.push({ type: 'item.move', item: item.id, data: { column: 'Doing', override: `Forced priority: ${reason.trim()} (requested by ${requestedBy})` } });
    }
    if (await commit(ev)) {
      toast(`Forced to the top${holds.size ? `; ${holds.size} item${holds.size === 1 ? '' : 's'} on hold` : ''}.`);
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Force a priority"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!valid} onClick={save}><Icon name="flag" size={16} /> Force to the top</button>
        </>
      }
    >
      <p style={{ margin: 0 }}>
        <strong>{item.title}</strong> becomes <strong>P1</strong>, goes to the top of every list (board, Priorities, Team score), and can go straight into Doing past WIP limits. Everything is recorded in the audit log.
      </p>
      <div className="grid2">
        <label className="field">
          <span>Requested by</span>
          <select className="input" value={asker} onChange={(e) => setAsker(e.target.value)}>
            {ASKERS.map((a) => <option key={a}>{a}</option>)}
            <option value="Other">Someone else…</option>
          </select>
        </label>
        {asker === 'Other' ? (
          <label className="field"><span>Who</span><input className="input" value={other} onChange={(e) => setOther(e.target.value)} placeholder="Name or group" /></label>
        ) : (
          <label className="field"><span>Needed by (optional)</span><input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
        )}
      </div>
      <label className="field">
        <span>Why (required, visible to the team)</span>
        <textarea className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Exam finding: board review Friday; executive team asked to drop everything" />
      </label>
      <div className="grid2">
        <label className="field">
          <span>Who works it</span>
          <select className="input" value={owner} disabled={item.ownerFromSource} onChange={(e) => setOwner(e.target.value)}>
            <option value="">{item.ownerFromSource ? `${item.source_owner} (Service Desk)` : 'Leave as is'}</option>
            {assignable(cfg).map((p) => <option key={p.username} value={p.username}>{p.name}</option>)}
          </select>
        </label>
        <label className="toggle" style={{ alignSelf: 'flex-end' }}>
          <input type="checkbox" checked={start} disabled={item.column === 'Doing' || !!item.statusDriven} onChange={(e) => setStart(e.target.checked)} />
          Start it now (move to Doing)
        </label>
      </div>

      <fieldset className="holds">
        <legend>Put other work on hold to make room (optional)</legend>
        {doing.length === 0 && <p className="small muted" style={{ margin: 0 }}>Nothing is in Doing.</p>}
        <ul>
          {doing.slice(0, 12).map((i) => (
            <li key={i.id}>
              <label className="row" style={{ gap: 8, minHeight: 40 }}>
                <input type="checkbox" checked={holds.has(i.id)} onChange={(e) => { const n = new Set(holds); if (e.target.checked) n.add(i.id); else n.delete(i.id); setHolds(n); }} />
                <PriorityChip p={i.priority} />
                <span className="grow">{i.title}</span>
                <span className="small muted">{name(i.owner)} · {COLUMN_LABEL[i.column]}</span>
              </label>
            </li>
          ))}
        </ul>
        {holds.size > 0 && (
          <label className="field" style={{ maxWidth: 280 }}>
            <span>Holding approved by</span>
            <input className="input" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} />
          </label>
        )}
      </fieldset>
    </Modal>
  );
}

/** Banner for a forced item, with a way to clear it. */
export function ExpediteBanner({ item }: { item: WorkItem }) {
  const { state, commit, role, readOnly } = useHub();
  const x = item.expedite;
  if (!x) return null;
  const name = (u?: string) => findPerson(state.config, u)?.name ?? u ?? '';
  return (
    <div className="banner error" role="status" style={{ alignItems: 'flex-start' }}>
      <Icon name="flag" />
      <div className="grow">
        <strong>Forced priority.</strong> Requested by {x.requestedBy}
        {x.approvedBy ? `, holds approved by ${x.approvedBy}` : ''}; set by {name(x.by)} on {fmtShortDate(x.ts)}
        {x.due ? `, needed by ${fmtShortDate(x.due)}` : ''}. “{x.reason}”
        {x.holds?.length ? ` ${x.holds.length} item${x.holds.length === 1 ? ' was' : 's were'} put on hold for it.` : ''}
      </div>
      {role === 'manager' && !readOnly && (
        <button
          className="btn sm"
          onClick={async () => {
            const why = prompt('Why is the forced priority ending? (optional)') ?? undefined;
            if (await commit([{ type: 'item.expedite', item: item.id, data: { clear: true, reason: why || undefined } }])) toast('Forced priority cleared. Remember to take held work off hold.');
          }}
        >
          End forced priority
        </button>
      )}
    </div>
  );
}

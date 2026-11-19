import { useState } from 'react';
import { useHub } from '../store/hub';
import { addBusinessDays, commStatus, commTemplate, fmtBusiness, standardOf, type CommKind, type CommStatus } from '../model/comms';
import { findPerson, todayISO } from '../model/logic';
import type { NewEvent, WorkItem } from '../model/types';
import { Icon, Modal, Tip, toast } from './ui';

const dateIso = (d: Date) => todayISO(d);
const fmtDue = (d: Date) => d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Small status chip for cards and lists. Nothing when the ticket is on track. */
export function CommChip({ item }: { item: WorkItem }) {
  const { state } = useHub();
  const st = commStatus(state, item);
  if (!st || st.level === 'ok') return null;
  const std = standardOf(state.config);
  const cls = st.level === 'soon' ? 'warn' : 'bad';
  const text =
    st.level === 'soon'
      ? `${st.kind === 'first' ? 'Response' : st.kind === 'follow-up' ? 'Follow-up' : 'Update'} due ${fmtDue(st.due)}`
      : st.level === 'overdue'
        ? `${st.label} late`
        : st.level === 'support'
          ? 'Escalated to support'
          : 'Escalated to Nick';
  return (
    <Tip
      className={`chip ${cls}`}
      content={
        <>
          <strong>{st.label}</strong>
          <p>Due {fmtDue(st.due)}{st.lateMinutes ? `, ${fmtBusiness(std, st.lateMinutes)} late` : ''}.</p>
          <p>{st.why}{st.responsible ? `: ${findPerson(state.config, st.responsible)?.name ?? st.responsible}` : ''}.</p>
          {st.last && <p className="muted">Last update {st.last.at.toLocaleString()} ({sourceText(st.last.source)}).</p>}
        </>
      }
    >
      <Icon name="bell" size={12} /> {text}
    </Tip>
  );
}

export const sourceText = (s: NonNullable<CommStatus['last']>['source']) =>
  s === 'sd-note' ? 'note in Service Desk' : s === 'sd-response' ? 'first response in Service Desk' : s === 'hub' ? 'logged in the hub' : 'Service Desk “Last Updated”, any change';

/**
 * Log that the requester was updated in Service Desk. Shows a ready-to-paste note that follows the standard
 * (ticket number, owner's name, date of the next update), opens the ticket, then records it and resets the clock.
 */
export function LogUpdateDialog({ item, onClose }: { item: WorkItem; onClose: () => void }) {
  const { state, me, commit } = useHub();
  const std = standardOf(state.config);
  const st = commStatus(state, item);
  const [kind, setKind] = useState<CommKind>(st?.kind ?? 'update');
  const crit = item.priority === 'P1';
  const defaultNext = dateIso(crit ? new Date() : addBusinessDays(std, new Date(), std.updateBusinessDays));
  const [next, setNext] = useState(item.next_update_due && item.next_update_due > todayISO() ? item.next_update_due : defaultNext);
  const [text, setText] = useState(() => commTemplate(state, item, st?.kind ?? 'update', defaultNext, me));
  const [note, setNote] = useState('');
  const attempts = st?.attempts ?? 0;

  const save = async () => {
    const ev: NewEvent[] = [];
    if (kind === 'first' && !item.owner && !item.ownerFromSource) ev.push({ type: 'item.update', item: item.id, data: { owner: me } });
    if (kind === 'first' && (item.owner === me || (!item.owner && !item.ownerFromSource)) && !item.acked) ev.push({ type: 'item.ack', item: item.id, data: {} });
    ev.push({ type: 'item.reply', item: item.id, data: { via: 'Service Desk', kind, nextUpdate: next, note: note.trim() || undefined } });
    if (await commit(ev)) {
      toast(`Logged. Next update due ${new Date(next + 'T12:00:00').toLocaleDateString()}.`);
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Update the requester · #${item.source_id}`}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}><Icon name="check" size={16} /> I posted it in Service Desk</button>
        </>
      }
    >
      <p style={{ margin: 0 }}><strong>{item.title}</strong></p>
      {st && (
        <div className={`banner ${st.lateMinutes ? 'error' : st.level === 'soon' ? 'warn' : 'info'}`}>
          {st.label} {st.lateMinutes ? `was due ${fmtDue(st.due)} (${fmtBusiness(std, st.lateMinutes)} late)` : `due ${fmtDue(st.due)}`}.
          {st.last ? ` Last update ${st.last.at.toLocaleString()} (${sourceText(st.last.source)}).` : ' No update recorded yet.'}
        </div>
      )}
      <div className="seg" role="radiogroup" aria-label="Kind of update" style={{ alignSelf: 'flex-start' }}>
        {(['first', 'update', 'follow-up'] as const).map((k) => (
          <button key={k} role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setText(commTemplate(state, item, k, next, me)); }}>
            {k === 'first' ? 'First response' : k === 'follow-up' ? 'Requester follow-up' : 'Status update'}
          </button>
        ))}
      </div>
      {kind === 'follow-up' && attempts >= 1 && (
        <div className="banner warn">
          {attempts + 1 >= standardOf(state.config).followUpAttempts
            ? 'This is the third attempt: per the standard, close the ticket in Service Desk as “Requester Unresponsive”.'
            : 'Second attempt: per the standard, copy the requester’s manager.'}
        </div>
      )}
      <label className="field" style={{ maxWidth: 220 }}>
        <span>Next update by</span>
        <input className="input" type="date" min={todayISO()} value={next} onChange={(e) => { setNext(e.target.value); setText(commTemplate(state, item, kind, e.target.value, me)); }} />
      </label>
      <label className="field">
        <span>Note for the requester (paste into Service Desk)</span>
        <textarea className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="row wrap">
        <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(text); toast('Copied.'); } catch { toast('Copy failed: select the text and copy it.'); } }}>Copy note</button>
        {item.source_url && (
          <a className="btn" href={item.source_url} target="_blank" rel="noreferrer">Open #{item.source_id} in Service Desk <Icon name="link" size={16} /></a>
        )}
      </div>
      <label className="field">
        <span>Hub note (optional, for the team)</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Called the requester; vendor ETA Friday" />
      </label>
      <p className="small muted" style={{ margin: 0 }}>
        Post the note on the ticket in Service Desk, then click “I posted it”. This logs the update with your name and resets the clock. Once the API sync is on, the hub also sees Service Desk notes on its own.
      </p>
    </Modal>
  );
}

/** Communication section for the card details. */
export function CommSection({ item }: { item: WorkItem }) {
  const { state, readOnly } = useHub();
  const [open, setOpen] = useState(false);
  const st = commStatus(state, item);
  if (!st) return null;
  const std = standardOf(state.config);
  const name = (u?: string) => findPerson(state.config, u)?.name ?? u ?? '—';
  return (
    <section className="stack">
      <div className="row">
        <h3 className="grow">Communication standard</h3>
        {!readOnly && <button className="btn sm primary" onClick={() => setOpen(true)}>Log update</button>}
      </div>
      <dl className="kv">
        <dt>Next</dt>
        <dd>
          <strong>{st.label}</strong> due {fmtDue(st.due)}{' '}
          {st.level !== 'ok' && <span className={`chip ${st.level === 'soon' ? 'warn' : 'bad'}`}>{st.lateMinutes ? `${fmtBusiness(std, st.lateMinutes)} late` : 'due soon'}</span>}
        </dd>
        <dt>Last update</dt>
        <dd>{st.last ? `${st.last.at.toLocaleString()} · ${sourceText(st.last.source)}${st.last.by ? ` by ${name(st.last.by)}` : ''}` : 'None recorded'}</dd>
        <dt>Who acts</dt>
        <dd>{name(st.responsible)} <span className="muted small">({st.why})</span></dd>
        <dt>Target</dt>
        <dd className="small">
          {st.critical
            ? `P1: first response within ${std.p1FirstResponseHours} business hours, then updates every ${std.p1UpdateHours} business hours until resolved.`
            : `First response within ${std.firstResponseBusinessDays} business day, then updates at least every ${std.updateBusinessDays} business days.`}
        </dd>
      </dl>
      {(item.commLog ?? []).length > 0 && (
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          {[...(item.commLog ?? [])].reverse().slice(0, 5).map((c) => (
            <li key={c.ts}>{new Date(c.ts).toLocaleString()} · {name(c.user)} logged a {c.kind === 'first' ? 'first response' : c.kind === 'follow-up' ? 'follow-up' : 'update'}{c.note ? `: ${c.note}` : ''}</li>
          ))}
        </ul>
      )}
      {open && <LogUpdateDialog item={item} onClose={() => setOpen(false)} />}
    </section>
  );
}

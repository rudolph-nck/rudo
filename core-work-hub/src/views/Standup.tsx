// Daily stand-up: one agenda of what must be discussed today, run by Nick and whoever is on support.
// Each row gets a quick check-in (On track / At risk / Blocked, with an optional note), a commit date, or a new priority.
import { useMemo, useState } from 'react';
import { useHub } from '../store/hub';
import { useUi } from '../components/actions';
import { useNav } from '../nav';
import { Avatar, Icon, PriorityChip, SourceBadge, toast } from '../components/ui';
import { CommitDialog, ReprioritizeDialog } from '../components/PriorityActions';
import { currentDispatch, findPerson, todayISO } from '../model/logic';
import { fmtResolve, fmtTarget, priorityStandardOf, PRIORITIES, PRIORITY_MEANING, standup, standupText, type StandupRow } from '../model/priority';
import { STANDUP_LABEL, type HubConfig, type StandupStatus, type WorkItem } from '../model/types';

const STATUSES: StandupStatus[] = ['on-track', 'at-risk', 'blocked'];

/** Today's latest check-in on an item. */
const todaysCheck = (i: WorkItem) => [...(i.standupLog ?? [])].reverse().find((c) => todayISO(new Date(c.ts)) === todayISO());

function CheckIn({ item, canAct, onCommit, onRepri }: { item: WorkItem; canAct: boolean; onCommit: () => void; onRepri: () => void }) {
  const { commit } = useHub();
  const [note, setNote] = useState('');
  const [noting, setNoting] = useState(false);
  const cur = todaysCheck(item);
  const record = async (status: StandupStatus) => {
    if (await commit([{ type: 'item.standup', item: item.id, data: { status, note: note.trim() || undefined } }])) {
      setNote('');
      setNoting(false);
    }
  };
  if (!canAct) return cur ? <span className={`su-status ${cur.status}`}>{STANDUP_LABEL[cur.status]}</span> : null;
  return (
    <div className="su-check">
      <div className="row" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <div className="seg su-seg" role="radiogroup" aria-label={`Stand-up check-in for ${item.title}`}>
          {STATUSES.map((st) => (
            <button key={st} role="radio" aria-checked={cur?.status === st} className={st} onClick={() => void record(st)}>
              {STANDUP_LABEL[st]}
            </button>
          ))}
        </div>
        <button className="btn sm ghost" onClick={() => setNoting((x) => !x)} aria-expanded={noting} title="Add a note with the check-in">Note</button>
        <button className="btn sm ghost" onClick={onCommit} title="Commit to a date">Date</button>
        <button className="btn sm ghost" onClick={onRepri} title="Change the priority">Priority</button>
      </div>
      {noting && (
        <div className="row" style={{ gap: 6, marginTop: 6 }}>
          <input className="input" autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Waiting on vendor; Wes will finish today" aria-label={`Note for ${item.title}`}
            onKeyDown={(e) => e.key === 'Enter' && void record(cur?.status ?? 'on-track')} />
          <button className="btn sm primary" onClick={() => void record(cur?.status ?? 'on-track')}>Save note</button>
        </div>
      )}
    </div>
  );
}

function Rows({ rows, empty, cfg, canAct, onCommit, onRepri, openItem }: { rows: StandupRow[]; empty: string; cfg: HubConfig; canAct: boolean; onCommit: (i: WorkItem) => void; onRepri: (i: WorkItem) => void; openItem: (id: string) => void }) {
  if (!rows.length) return <p className="muted small" style={{ margin: '4px 16px 14px' }}>{empty}</p>;
  const name = (u?: string) => (u ? findPerson(cfg, u)?.name ?? u : '');
  const sysName = (id?: string) => cfg.systems.find((x) => x.id === id)?.name;
  return (
    <ul className="su-list">
      {rows.map((r) => {
        const c = todaysCheck(r.item);
        return (
          <li key={r.item.id} className={`su-row ${c ? 'checked ' + c.status : ''}`}>
            <div className="su-pri">
              <PriorityChip p={r.age.effective} />
              {r.age.raised > 0 && <span className="small muted" title={`Raised by aging from ${r.age.priority}`}>↑{r.age.priority}</span>}
            </div>
            <div className="su-main">
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <SourceBadge item={r.item} />
                <button className="linkish su-title" onClick={() => openItem(r.item.id)}>{r.item.title}</button>
              </div>
              <div className="small muted">
                {[r.item.owner ? name(r.item.owner) : r.item.source_owner ? `${r.item.source_owner} (SD)` : 'No owner', sysName(r.item.system), r.item.department, r.item.bumps ? `bumped ${r.item.bumps}×` : '', r.item.commitment ? `committed ${r.item.commitment.date}` : ''].filter(Boolean).join(' · ')}
              </div>
              {c && (
                <div className="small su-note">
                  <span className={`su-status ${c.status}`}>{STANDUP_LABEL[c.status]}</span> {name(c.user)} {new Date(c.ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}{c.note ? `: ${c.note}` : ''}
                </div>
              )}
            </div>
            <div className={`su-why ${r.age.stage}`}>{r.why}</div>
            <div className="su-owner">{r.item.owner ? <Avatar user={r.item.owner} config={cfg} /> : <Avatar config={cfg} external={r.item.source_owner} />}</div>
            <div className="su-act">
              <CheckIn item={r.item} canAct={canAct} onCommit={() => onCommit(r.item)} onRepri={() => onRepri(r.item)} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function Standup() {
  const { state, grader, readOnly } = useHub();
  const { openItem } = useUi();
  const { go } = useNav();
  const cfg = state.config;
  const ps = priorityStandardOf(cfg);
  const s = useMemo(() => standup(state), [state]);
  const [repri, setRepri] = useState<WorkItem | null>(null);
  const [committing, setCommitting] = useState<WorkItem | null>(null);
  const canAct = grader && !readOnly;
  const name = (u?: string) => (u ? findPerson(cfg, u)?.name ?? u : '');
  const support = currentDispatch(cfg, todayISO())?.analyst;
  const sysName = (id?: string) => cfg.systems.find((x) => x.id === id)?.name;
  const rowProps = { cfg, canAct, onCommit: setCommitting, onRepri: setRepri, openItem };

  const section = ({ id, title, hint, rows, empty, tone }: { id: string; title: string; hint: string; rows: StandupRow[]; empty: string; tone?: 'bad' | 'warn' }) => (
    <section key={id} className="panel" aria-labelledby={id}>
      <div className="panel-head">
        <h2 id={id} className="grow">{title} <span className={`chip ${rows.length ? tone ?? 'src' : 'src'}`}>{rows.length}</span></h2>
        <span className="small muted">{hint}</span>
      </div>
      <Rows rows={rows} empty={empty} {...rowProps} />
    </section>
  );

  const copy = () => {
    void navigator.clipboard?.writeText(standupText(state, s));
    toast('Stand-up summary copied. Paste it into the Teams channel.');
  };
  const pct = s.mustDiscuss ? Math.round((s.discussed / s.mustDiscuss) * 100) : 100;

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1>Stand-up</h1>
          <div className="sub">Today's agenda: what must be addressed so nothing big or small slips.{support ? ` On support: ${name(support)}.` : ''}</div>
        </div>
        <button className="btn primary" onClick={copy}><Icon name="chat" /> Copy for Teams</button>
      </div>

      {!ps.startFrom && (
        <div className="banner info">
          <span>
            Targets count from each ticket's open date. To start the standard on a set day (so the old backlog isn't all overdue at once), set the start date in{' '}
            <button className="linkish" style={{ fontWeight: 700 }} onClick={() => go('settings')}>Settings → Priority standard</button>.
          </span>
        </div>
      )}

      <section className="panel su-progress" aria-label="Today's progress">
        <div className="row wrap" style={{ gap: 18, alignItems: 'center' }}>
          <div><span className="su-big">{s.discussed}</span><span className="muted"> of {s.mustDiscuss} discussed</span></div>
          <span className="backlog-bar wide" aria-hidden><span style={{ width: `${pct}%` }} /></span>
          <span className="small"><strong>{s.p1.length}</strong> P1 · <strong>{s.dueToday.length}</strong> due today · <strong>{s.past.length}</strong> past target · <strong>{s.comingUp.length}</strong> coming up</span>
          <button className="btn sm ghost" onClick={() => go('notifications')}><Icon name="bell" size={14} /> {s.comm.late} update{s.comm.late === 1 ? '' : 's'} late ({s.comm.escalated} escalated)</button>
        </div>
        {canAct && <p className="small muted" style={{ margin: '8px 0 0' }}>Go down the list: mark each item On track, At risk or Blocked (add a note if useful), commit a date, or change its priority. Everything is logged.</p>}
      </section>

      {section({ id: "su-p1", title: "Open P1s", hint: `Update every ${fmtTarget(ps.P1.update, ps.P1.updateUnit).replace(/^1 /, '')}; on-call covers after hours.`, rows: s.p1, empty: "No open P1s.", tone: "bad" })}
      {section({ id: "su-today", title: "Due today", hint: "Last day of its target. Address it today, or commit a new date or re-prioritize.", rows: s.dueToday, empty: "Nothing reaches its target today.", tone: "bad" })}
      {section({ id: "su-past", title: "Past target", hint: "Re-commit to a date, assign it, or re-prioritize. Aging raises P3/P4 (never to P1).", rows: s.past, empty: "Nothing is past its target.", tone: "bad" })}
      {s.missedCommitments.length > 0 && section({ id: 'su-missed', title: 'Missed commitments', hint: 'A date agreed at stand-up has passed.', rows: s.missedCommitments, empty: '', tone: 'bad' })}
      {section({ id: "su-soon", title: "Coming up", hint: "Reaches its target in the next two business days: a quick touch base.", rows: s.comingUp, empty: "Nothing due in the next two business days.", tone: "warn" })}
      {s.bumped.length > 0 && section({ id: 'su-bumped', title: 'Repeatedly bumped', hint: `Passed over ${ps.bumpFlag}+ times. Give it a slot or re-prioritize it honestly.`, rows: s.bumped, empty: '', tone: 'warn' })}
      {s.departments.length > 0 &&
        section({ id: 'su-dept', title: 'Departments waiting', hint: `Nothing of theirs worked in ${ps.deptIdleDays}+ business days; their oldest item is shown.`, rows: s.departments.map((d) => ({ ...d.oldest, why: `${d.department}: ${d.open} open, ${d.idleDays}+ days untouched` })), empty: '', tone: 'warn' })}

      <section className="panel" aria-labelledby="su-backlog">
        <div className="panel-head">
          <h2 id="su-backlog" className="grow">Backlog: clear next <span className="chip src">{s.backlog.total}</span></h2>
          <span className="small muted">{ps.startFrom ? `Opened before ${ps.startFrom}; worked down against a weekly goal, oldest and most important first.` : 'Set a start date in Settings to track the backlog separately.'}</span>
        </div>
        {ps.startFrom && (
          <>
            <div className="row wrap" style={{ gap: 8, padding: '0 16px 10px', alignItems: 'center' }}>
              {PRIORITIES.map((p) => <span key={p} className={`chip ${p.toLowerCase()}`}>{s.backlog.byPriority[p]} {p}</span>)}
              <span className="small">This week: <strong>{s.backlog.closedThisWeek}</strong> of {s.backlog.goal} cleared</span>
              <span className="backlog-bar" aria-hidden><span style={{ width: `${Math.min(100, (s.backlog.closedThisWeek / Math.max(1, s.backlog.goal)) * 100)}%` }} /></span>
              <span className="small muted">Last week: {s.backlog.closedLastWeek}{s.backlog.weeksLeft ? ` · at this pace about ${s.backlog.weeksLeft} more week${s.backlog.weeksLeft === 1 ? '' : 's'}` : s.backlog.total ? ` · at ${s.backlog.goal}/week: about ${Math.ceil(s.backlog.total / Math.max(1, s.backlog.goal))} weeks` : ''}</span>
            </div>
            <Rows rows={s.backlog.next.slice(0, ps.backlogDaily)} empty="No backlog left. Nice work." {...rowProps} />
          </>
        )}
      </section>

      <details className="panel su-more">
        <summary className="panel-head">
          <h2 className="grow">Waiting on others <span className="chip src">{s.waiting.length}</span></h2>
          <span className="small muted">Past halfway but waiting on the requester or a vendor: chase, don't escalate.</span>
        </summary>
        <Rows rows={s.waiting} empty="Nothing is waiting long." {...rowProps} />
      </details>

      <details className="panel su-more">
        <summary className="panel-head">
          <h2 className="grow">Platform owner check <span className={`chip ${s.mismatches.length ? 'warn' : 'src'}`}>{s.mismatches.length}</span></h2>
          <span className="small muted">Open tickets not owned by anyone on their system's ownership map.</span>
        </summary>
        {s.mismatches.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Ticket</th><th>System</th><th>Owner now</th><th>Map</th><th>Suggest</th></tr></thead>
              <tbody>
                {s.mismatches.map((m) => (
                  <tr key={m.item.id}>
                    <td><div className="row" style={{ gap: 6 }}><PriorityChip p={m.item.priority} /><SourceBadge item={m.item} /><button className="linkish" onClick={() => openItem(m.item.id)}>{m.item.title}</button></div></td>
                    <td>{sysName(m.item.system)}</td>
                    <td>{m.item.owner ? name(m.item.owner) : m.item.source_owner ? `${m.item.source_owner} (not on the hub)` : 'No owner'}</td>
                    <td className="small">{m.owners.map(name).join(' → ')}</td>
                    <td><strong>{name(m.suggested)}</strong>{m.item.ownerFromSource ? <span className="small muted"> · reassign in Service Desk</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted small" style={{ margin: '4px 16px 14px' }}>Every open ticket with a system is owned by someone on its map.</p>
        )}
      </details>

      <details className="panel su-more">
        <summary className="panel-head"><h2 className="grow">The standard</h2><span className="small muted">Business hours: Mon/Tue/Wed/Fri 8:30–5:30, Thu 10:00–5:30.</span></summary>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Priority</th><th>What it means</th><th>First response</th><th>Updates</th><th>Target to resolve</th></tr></thead>
            <tbody>
              {PRIORITIES.map((p) => (
                <tr key={p}>
                  <td><PriorityChip p={p} /></td>
                  <td className="small">{PRIORITY_MEANING[p]}</td>
                  <td>{fmtTarget(ps[p].respond, ps[p].respondUnit)}</td>
                  <td>{p === 'P1' ? `Every ${fmtTarget(ps[p].update, ps[p].updateUnit).replace(/^1 /, '')} (after hours: on-call)` : `Every ${fmtTarget(ps[p].update, ps[p].updateUnit).replace(/^1 /, '')}`.replace('Every twice a week', 'Twice a week').replace('Every weekly', 'Weekly')}</td>
                  <td>{fmtResolve(ps[p], p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {repri && <ReprioritizeDialog item={repri} onClose={() => setRepri(null)} />}
      {committing && <CommitDialog item={committing} onClose={() => setCommitting(null)} />}
    </div>
  );
}

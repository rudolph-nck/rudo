// Daily stand-up: what must be discussed today, so nothing big or small slips. Run by Nick and whoever is on support.
import { useMemo, useState } from 'react';
import { useHub } from '../store/hub';
import { useUi } from '../components/actions';
import { useNav } from '../nav';
import { Avatar, Icon, PriorityChip, SourceBadge, toast } from '../components/ui';
import { CommitDialog, ReprioritizeDialog } from '../components/PriorityActions';
import { currentDispatch, findPerson, todayISO } from '../model/logic';
import { fmtResolve, fmtTarget, priorityStandardOf, PRIORITIES, PRIORITY_MEANING, standup, standupText, type StandupRow } from '../model/priority';
import type { WorkItem } from '../model/types';

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

  const Rows = ({ rows, empty }: { rows: StandupRow[]; empty: string }) =>
    rows.length ? (
      <div className="table-wrap">
        <table className="table su-table">
          <tbody>
            {rows.map((r) => (
              <tr key={r.item.id}>
                <td className="su-pri">
                  <PriorityChip p={r.age.effective} />
                  {r.age.raised > 0 && <span className="small muted" title={`Raised by aging from ${r.age.priority}`}> ↑ from {r.age.priority}</span>}
                </td>
                <td>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <SourceBadge item={r.item} />
                    <button className="linkish strong" onClick={() => openItem(r.item.id)}>{r.item.title}</button>
                  </div>
                  <div className="small muted">{[sysName(r.item.system), r.item.department, r.item.bumps ? `bumped ${r.item.bumps}×` : '', r.item.commitment ? `committed ${r.item.commitment.date}` : ''].filter(Boolean).join(' · ')}</div>
                </td>
                <td className="su-owner">
                  {r.item.owner ? <span className="row" style={{ gap: 6 }}><Avatar user={r.item.owner} config={cfg} />{name(r.item.owner)}</span> : <Avatar config={cfg} external={r.item.source_owner} />}
                </td>
                <td className={`su-why ${r.age.stage}`}>{r.why}</td>
                <td className="su-act">
                  {canAct && (
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn sm" onClick={() => setCommitting(r.item)}>Commit date</button>
                      <button className="btn sm" onClick={() => setRepri(r.item)}>Re-prioritize</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="muted small" style={{ margin: '4px 16px 14px' }}>{empty}</p>
    );

  const Section = ({ id, title, hint, rows, empty, tone }: { id: string; title: string; hint: string; rows: StandupRow[]; empty: string; tone?: 'bad' | 'warn' }) => (
    <section className="panel" aria-labelledby={id}>
      <div className="panel-head">
        <h2 id={id} className="grow">{title} <span className={`chip ${rows.length ? tone ?? 'src' : 'src'}`}>{rows.length}</span></h2>
        <span className="small muted">{hint}</span>
      </div>
      <Rows rows={rows} empty={empty} />
    </section>
  );

  const copy = () => {
    void navigator.clipboard?.writeText(standupText(state, s));
    toast('Stand-up summary copied. Paste it into the Teams channel.');
  };
  const pastBy = PRIORITIES.map((p) => ({ p, n: s.past.filter((r) => r.age.effective === p).length })).filter((x) => x.n);

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1>Stand-up</h1>
          <div className="sub">What must be discussed today, so nothing big or small slips.{support ? ` On support: ${name(support)}.` : ''}</div>
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

      <section className="tiles su-tiles" aria-label="Summary">
        <div className="tile static"><span className="ico"><Icon name="flag" /></span><span className="num">{s.mustDiscuss}</span><span><span className="t">Must discuss</span><br /><span className="d">P1s, past target, missed dates, bumped, departments waiting, backlog next</span></span></div>
        <div className="tile static"><span className="ico"><Icon name="clock" /></span><span className="num">{s.past.length}</span><span><span className="t">Past target</span><br /><span className="d">{pastBy.length ? pastBy.map((x) => `${x.n} ${x.p}`).join(' · ') : 'None'}</span></span></div>
        <button className="tile" onClick={() => go('notifications')}><span className="ico"><Icon name="bell" /></span><span className="num">{s.comm.late}</span><span><span className="t">Updates late</span><br /><span className="d">{s.comm.escalated} escalated · communication standard</span></span></button>
      </section>

      <Section id="su-p1" title="Open P1s" hint={`Respond within ${fmtTarget(ps.P1.respond, ps.P1.respondUnit)}, update every ${fmtTarget(ps.P1.update, ps.P1.updateUnit).replace(/^1 /, '')}. On-call covers after hours.`} rows={s.p1} empty="No open P1s." tone="bad" />
      <Section id="su-past" title="Past target" hint="Re-commit to a date, assign it, or re-prioritize. Aging raises P3/P4 automatically (never to P1)." rows={s.past} empty="Nothing is past its target." tone="bad" />
      <Section id="su-missed" title="Missed commitments" hint="A date agreed at stand-up has passed." rows={s.missedCommitments} empty="No missed commitments." tone="bad" />
      <Section id="su-soon" title="Reaches its target within a business day" hint="Shift focus now to keep these on time." rows={s.dueSoon} empty="Nothing reaches its target tomorrow." tone="warn" />
      <Section id="su-bumped" title="Repeatedly bumped" hint={`Passed over ${ps.bumpFlag}+ times: picked-up work ranked below it, jumped in the ranking, or lowered.`} rows={s.bumped} empty="Nothing has been bumped repeatedly." tone="warn" />

      <section className="panel" aria-labelledby="su-dept">
        <div className="panel-head">
          <h2 id="su-dept" className="grow">Departments waiting <span className={`chip ${s.departments.length ? 'warn' : 'src'}`}>{s.departments.length}</span></h2>
          <span className="small muted">Nothing of theirs worked in {ps.deptIdleDays}+ business days. Their oldest item is shown; the 5 longest-waiting are on the must-discuss list.</span>
        </div>
        <Rows rows={s.departments.map((d) => ({ ...d.oldest, why: `${d.department}: ${d.open} open, nothing worked in ${d.idleDays}+ business days` }))} empty="Every department with open work has had something worked recently." />
      </section>

      <section className="panel" aria-labelledby="su-backlog">
        <div className="panel-head">
          <h2 id="su-backlog" className="grow">Backlog <span className="chip src">{s.backlog.total}</span></h2>
          <span className="small muted">{ps.startFrom ? `Opened before ${ps.startFrom}: worked down against a weekly goal, oldest and most important first.` : 'Set a start date in Settings to track the backlog separately.'}</span>
        </div>
        {ps.startFrom && (
          <>
            <div className="row wrap" style={{ gap: 8, padding: '0 16px 10px', alignItems: 'center' }}>
              {PRIORITIES.map((p) => <span key={p} className={`chip ${p.toLowerCase()}`}>{s.backlog.byPriority[p]} {p}</span>)}
              <span className="small">This week: <strong>{s.backlog.closedThisWeek}</strong> of {s.backlog.goal} cleared</span>
              <span className="backlog-bar" aria-hidden><span style={{ width: `${Math.min(100, (s.backlog.closedThisWeek / Math.max(1, s.backlog.goal)) * 100)}%` }} /></span>
              <span className="small muted">Last week: {s.backlog.closedLastWeek}{s.backlog.weeksLeft ? ` · at this pace about ${s.backlog.weeksLeft} more week${s.backlog.weeksLeft === 1 ? '' : 's'}` : s.backlog.total ? ` · at ${s.backlog.goal}/week: about ${Math.ceil(s.backlog.total / Math.max(1, s.backlog.goal))} weeks` : ''}</span>
            </div>
            <p className="small muted" style={{ margin: '0 16px 6px' }}>Clear next (the top {ps.backlogDaily} are on today's must-discuss list):</p>
            <Rows rows={s.backlog.next} empty="No backlog left. Nice work." />
          </>
        )}
      </section>

      <section className="panel" aria-labelledby="su-wait">
        <div className="panel-head">
          <h2 id="su-wait" className="grow">Waiting on others <span className="chip src">{s.waiting.length}</span></h2>
          <span className="small muted">Past halfway but waiting on the requester or a vendor: chase, don't escalate.</span>
        </div>
        <Rows rows={s.waiting} empty="Nothing is waiting long." />
      </section>

      <details className="panel su-owners">
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

      <section className="panel" aria-labelledby="su-std">
        <div className="panel-head"><h2 id="su-std" className="grow">The standard</h2><span className="small muted">Business hours: Mon/Tue/Wed/Fri 8:30–5:30, Thu 10:00–5:30.</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Priority</th><th>What it means</th><th>First response</th><th>Updates</th><th>Target to resolve</th></tr></thead>
            <tbody>
              {PRIORITIES.map((p) => (
                <tr key={p}>
                  <td><PriorityChip p={p} /></td>
                  <td className="small">{PRIORITY_MEANING[p]}</td>
                  <td>{fmtTarget(ps[p].respond, ps[p].respondUnit)}</td>
                  <td>{p === 'P1' ? `Every ${fmtTarget(ps[p].update, ps[p].updateUnit).replace(/^1 /, '')} (after hours: on-call, on any change)` : `Every ${fmtTarget(ps[p].update, ps[p].updateUnit).replace(/^1 /, '')}`.replace('Every twice a week', 'Twice a week').replace('Every weekly', 'Weekly')}</td>
                  <td>{fmtResolve(ps[p], p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {repri && <ReprioritizeDialog item={repri} onClose={() => setRepri(null)} />}
      {committing && <CommitDialog item={committing} onClose={() => setCommitting(null)} />}
    </div>
  );
}

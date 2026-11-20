import { useEffect, useMemo, useState } from 'react';
import { useHub } from '../store/hub';
import { useUi } from '../components/actions';
import { Avatar, Icon, PriorityChip, SourceBadge } from '../components/ui';
import { LogUpdateDialog, sourceText } from '../components/Comm';
import { copyAndOpenChannel, digestText, nudgeText, TeamsButton } from '../components/Teams';
import { fmtBusiness, noticesFor, standardOf, type CommNotice } from '../model/comms';
import { findPerson } from '../model/logic';
import type { WorkItem } from '../model/types';

const fmtDue = (d: Date) => d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Re-evaluates every minute so "due in" and escalations move with the clock, not only with data changes. */
export function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const GROUPS: { key: string; title: string; sub: string; test: (n: CommNotice) => boolean }[] = [
  { key: 'esc', title: 'Escalated', sub: 'Past the grace period: support, then Nick, follows up with the owner.', test: (n) => n.status.level === 'support' || n.status.level === 'manager' },
  { key: 'late', title: 'Overdue', sub: 'The requester is owed a response or an update now.', test: (n) => n.status.level === 'overdue' },
  { key: 'soon', title: 'Due soon', sub: 'Update the requester before the deadline.', test: (n) => n.status.level === 'soon' },
];

export function Notifications() {
  const { state, me, role, readOnly } = useHub();
  const { openItem } = useUi();
  const now = useNow();
  const std = standardOf(state.config);
  const name = (u?: string) => findPerson(state.config, u)?.name ?? u ?? '—';
  const notices = useMemo(() => noticesFor(state, me, now), [state, me, now]);
  const [logging, setLogging] = useState<WorkItem | null>(null);
  const [perm, setPerm] = useState(() => (typeof Notification !== 'undefined' ? Notification.permission : 'denied'));
  const [alerts, setAlerts] = useState(() => { try { return localStorage.getItem('cwh.alerts') === '1'; } catch { return false; } });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <div className="sub">
            Keeps us to the Core Team Communication Standards: first response within 2 business hours (P1) or 1 business day, updates at least weekly (P1: every {std.p1UpdateHours} business hours), and requester follow-ups every {std.followUpHours} hours.
          </div>
        </div>
        {typeof Notification !== 'undefined' && (
          <div className="topbar-actions">
            {notices.length > 0 && (
              <button className="btn" onClick={() => copyAndOpenChannel(state.config, digestText(state.config, 'Core Work Hub: communication standard', notices))} title="Copies a summary and opens the team’s Teams channel">
                <Icon name="chat" size={16} /> Post digest to Teams
              </button>
            )}
            <button
              className="btn"
              aria-pressed={alerts && perm === 'granted'}
              onClick={async () => {
                let p = perm;
                if (p !== 'granted') p = await Notification.requestPermission();
                setPerm(p);
                const on = p === 'granted' ? !(alerts && perm === 'granted') : false;
                setAlerts(on);
                try { localStorage.setItem('cwh.alerts', on ? '1' : '0'); } catch { /* ignore */ }
              }}
            >
              <Icon name="bell" size={16} /> Desktop alerts: {alerts && perm === 'granted' ? 'On' : 'Off'}
            </button>
          </div>
        )}
      </div>

      {notices.length === 0 && (
        <div className="panel" style={{ padding: 28, textAlign: 'center' }}>
          <Icon name="check" /> <strong>You’re up to date.</strong>
          <div className="muted small">No responses or updates due for you{role === 'manager' ? ', and nothing has escalated to you' : ''}.</div>
        </div>
      )}

      {GROUPS.map((g) => {
        const list = notices.filter(g.test);
        if (!list.length) return null;
        return (
          <section key={g.key} className="panel" aria-labelledby={`n-${g.key}`}>
            <div className="viz-head">
              <div className="grow">
                <h2 id={`n-${g.key}`}>{g.title} ({list.length})</h2>
                <div className="small muted">{g.sub}</div>
              </div>
            </div>
            <ul className="notices">
              {list.map((n) => {
                const s = n.status;
                const i = n.item;
                return (
                  <li key={i.id} className={`notice ${s.level}`}>
                    <span className={`chip ${s.level === 'soon' ? 'warn' : 'bad'}`}>
                      {s.level === 'manager' ? 'Escalated to Nick' : s.level === 'support' ? 'Escalated to support' : s.level === 'overdue' ? 'Overdue' : 'Due soon'}
                    </span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>
                        {s.label}: {s.lateMinutes ? `${fmtBusiness(std, s.lateMinutes)} late` : `due ${fmtDue(s.due)}`}
                        {s.critical && <span className="chip p1" style={{ marginLeft: 6 }}>P1</span>}
                      </div>
                      <button className="linkish strong" onClick={() => openItem(i.id)}>{i.title}</button>
                      <div className="row small muted wrap" style={{ gap: 6 }}>
                        <SourceBadge item={i} />
                        <PriorityChip p={i.priority} />
                        <span>Owner {i.owner ? name(i.owner) : i.source_owner ?? 'none'}</span>
                        <span>· {n.role === 'owner' ? 'You own it' : n.role === 'support' ? 'You’re on support' : 'You’re the escalation point'}</span>
                        <span>· {s.last ? `last update ${s.last.at.toLocaleDateString()} (${sourceText(s.last.source)})` : 'no update recorded'}</span>
                      </div>
                    </div>
                    {i.owner && n.role !== 'owner' && <Avatar user={i.owner} config={state.config} />}
                    {n.role !== 'owner' && i.owner && <TeamsButton config={state.config} to={[i.owner]} label={`Nudge ${name(i.owner)}`} message={nudgeText(state.config, i, n)} />}
                    {!readOnly && <button className="btn sm primary" onClick={() => setLogging(i)}>{n.role === 'owner' || !i.owner ? 'Log update' : 'Follow up'}</button>}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {logging && <LogUpdateDialog item={logging} onClose={() => setLogging(null)} />}
    </div>
  );
}

/**
 * Desktop alerts: when something new becomes due, late or escalated for me, show an OS notification
 * (if the person turned alerts on). Remembers what it already announced so each step alerts once.
 */
export function useDesktopAlerts() {
  const { state, me, viewAs } = useHub();
  const now = useNow(60_000);
  useEffect(() => {
    if (viewAs) return; // previewing someone else's view: their alerts aren't yours
    let on = false;
    try { on = localStorage.getItem('cwh.alerts') === '1'; } catch { /* ignore */ }
    if (!on || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const key = `cwh.alerted.${me}`;
    let seen: string[] = [];
    try { seen = JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { /* ignore */ }
    const fresh = noticesFor(state, me, now).filter((n) => n.status.level !== 'soon' || n.status.critical).filter((n) => !seen.includes(`${n.item.id}|${n.status.kind}|${n.status.level}`));
    for (const n of fresh.slice(0, 3)) {
      try {
        new Notification(`${n.status.label} ${n.status.lateMinutes ? 'overdue' : 'due'}: #${n.item.source_id}`, { body: n.item.title, tag: n.item.id });
      } catch { /* ignore */ }
    }
    if (fresh.length) {
      seen = [...seen, ...fresh.map((n) => `${n.item.id}|${n.status.kind}|${n.status.level}`)].slice(-500);
      try { localStorage.setItem(key, JSON.stringify(seen)); } catch { /* ignore */ }
    }
  }, [state, me, now, viewAs]);
}

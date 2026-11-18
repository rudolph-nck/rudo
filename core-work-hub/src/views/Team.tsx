import { useState } from 'react';
import { useHub } from '../store/hub';
import { Avatar } from '../components/ui';
import { CapacityStrip } from './Triage';
import { addDays, analysts, currentDispatch, doingFor, isOverdue, personWipLimit, todayISO } from '../model/logic';
import { BUCKETS, TIME_BUCKETS } from '../model/types';
import { useUi } from '../components/actions';

const mondayOf = (iso: string) => {
  const d = new Date(iso + 'T12:00:00');
  return addDays(iso, -((d.getDay() + 6) % 7));
};

export function Team() {
  const { state } = useHub();
  const { openItem } = useUi();
  const cfg = state.config;
  const [weekOffset, setWeekOffset] = useState(0);
  const from = addDays(mondayOf(todayISO()), weekOffset * 7);
  const to = addDays(from, 6);
  const disp = currentDispatch(cfg);
  const items = [...state.items.values()].filter((i) => !i.stale);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Team</h1>
          <div className="sub">Each analyst’s load: Doing against their WIP limit, queue, overdue updates, and hours against the capacity model.</div>
        </div>
        <div className="topbar-actions">
          <div className="seg" role="group" aria-label="Hours week">
            <button aria-pressed={weekOffset === -1} onClick={() => setWeekOffset(-1)}>Last week</button>
            <button aria-pressed={weekOffset === 0} onClick={() => setWeekOffset(0)}>This week</button>
          </div>
        </div>
      </div>
      <CapacityStrip />
      <section className="panel" aria-label="Analysts">
        {analysts(cfg).map((p) => {
          const doing = doingFor(state, p.username);
          const lim = personWipLimit(cfg, p.username);
          const todo = items.filter((i) => i.owner === p.username && i.column === 'To Do').sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
          const waiting = items.filter((i) => i.owner === p.username && i.column === 'Waiting');
          const overdue = items.filter((i) => i.owner === p.username && isOverdue(i));
          const unacked = items.filter((i) => i.owner === p.username && !i.acked && i.column !== 'Done' && i.column !== 'Intake');
          const hours = state.time.filter((t) => t.user === p.username && t.date >= from && t.date <= to);
          const role = disp?.analyst === p.username ? 'dispatch' : disp?.backup === p.username ? 'backup' : undefined;
          return (
            <div className="team-row" key={p.username}>
              <div className="row">
                <Avatar user={p.username} config={cfg} size="lg" />
                <div>
                  <div style={{ fontWeight: 800 }}>{p.name}</div>
                  {role === 'dispatch' && <span className="chip p3">On dispatch</span>}
                  {role === 'backup' && <span className="chip src">Dispatch backup</span>}
                </div>
              </div>
              <div>
                <div className="label">Doing</div>
                <div className="row" style={{ marginTop: 4 }}>
                  <span className="slots" aria-hidden>
                    {Array.from({ length: Math.max(lim, doing.length) }, (_, i) => (
                      <span key={i} className={`slot ${i < doing.length ? (i >= lim ? 'over' : 'full') : ''}`} />
                    ))}
                  </span>
                  <strong className={doing.length > lim ? 'danger-text' : ''}>{doing.length} / {lim}</strong>
                </div>
                <div className="small muted" style={{ marginTop: 4 }}>
                  {BUCKETS.map((b) => `${doing.filter((i) => i.bucket === b).length} ${b[0]}`).join(' · ')}
                  {waiting.length ? ` · ${waiting.length} waiting` : ''}
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="label">To Do queue ({todo.length})</div>
                <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none' }}>
                  {doing.concat(todo.slice(0, 3)).slice(0, 4).map((i) => (
                    <li key={i.id} className="small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <button className="btn ghost sm" style={{ padding: '0 4px', minHeight: 30, fontWeight: 600 }} onClick={() => openItem(i.id)}>
                        <span className={`dot ${i.bucket ?? 'none'}`} /> {i.column === 'Doing' ? 'Doing: ' : `#${i.rank} `}
                        {i.title}
                      </button>
                    </li>
                  ))}
                  {doing.length + todo.length === 0 && <li className="small muted">Nothing queued</li>}
                </ul>
              </div>
              <div>
                <div className="label">Overdue updates</div>
                <div style={{ fontSize: 22, fontWeight: 800 }} className={overdue.length ? 'danger-text' : ''}>{overdue.length}</div>
                {unacked.length > 0 && <span className="chip warn">{unacked.length} not acked</span>}
              </div>
              <div>
                <div className="label" style={{ marginBottom: 4 }}>Hours vs capacity model</div>
                <div className="hours">
                  {TIME_BUCKETS.map((b) => {
                    const h = hours.filter((t) => t.bucket === b.key).reduce((s, t) => s + t.hours, 0);
                    const target = cfg.capacityModel[b.key] ?? 0;
                    const pct = target ? Math.min(100, (h / target) * 100) : h ? 100 : 0;
                    return (
                      <div key={b.key} style={{ display: 'contents' }}>
                        <span className="muted">{b.label}</span>
                        <span className={`bar ${target && h > target ? 'over' : ''}`} role="img" aria-label={`${h} of ${target} hours`}>
                          <i style={{ width: `${pct}%` }} />
                        </span>
                        <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{h}/{target}h</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

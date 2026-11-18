import { useMemo } from 'react';
import { useHub } from '../store/hub';
import { download, Icon } from '../components/ui';
import { addDays, analysts, daysBetween, isOverdue, todayISO } from '../model/logic';
import { itemsCsv, toCsv } from '../model/csv';
import { BUCKETS, BUCKET_LABEL, PRIORITIES, TIME_BUCKETS } from '../model/types';

const WEEKS = 8;
const mondayOf = (iso: string) => addDays(iso, -((new Date(iso + 'T12:00:00').getDay() + 6) % 7));

export function Metrics() {
  const { state } = useHub();
  const cfg = state.config;
  const all = useMemo(() => [...state.items.values()].filter((i) => !i.stale), [state.items]);
  const open = all.filter((i) => i.column !== 'Done');
  const avgAge = open.length ? Math.round(open.reduce((s, i) => s + daysBetween(i.created), 0) / open.length) : 0;
  const overdue = open.filter((i) => isOverdue(i)).length;
  const cutoff30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const cycle = all.filter((i) => i.done && i.started && i.done >= cutoff30);
  const avgCycle = cycle.length ? (cycle.reduce((s, i) => s + (new Date(i.done!).getTime() - new Date(i.started!).getTime()) / 864e5, 0) / cycle.length).toFixed(1) : '–';

  const thisMonday = mondayOf(todayISO());
  const weeks = Array.from({ length: WEEKS }, (_, n) => addDays(thisMonday, -(WEEKS - 1 - n) * 7));
  const weekOf = (iso?: string) => (iso ? mondayOf(iso.slice(0, 10)) : undefined);
  const series = weeks.map((w) => ({
    week: w,
    opened: all.filter((i) => weekOf(i.created) === w).length,
    closed: all.filter((i) => i.column === 'Done' && weekOf(i.done) === w).length,
  }));
  const max = Math.max(1, ...series.flatMap((s) => [s.opened, s.closed]));
  const since28 = addDays(todayISO(), -28);
  const throughput = analysts(cfg).map((p) => ({
    p,
    done: all.filter((i) => i.owner === p.username && i.column === 'Done' && (i.done ?? '') >= since28).length,
    doing: all.filter((i) => i.owner === p.username && i.column === 'Doing').length,
  }));
  const maxT = Math.max(1, ...throughput.map((t) => t.done));

  const W = 560, H = 200, pad = 28, bw = (W - pad) / WEEKS;

  const exportWeekly = () =>
    download(`core-hub-weekly-${todayISO()}.csv`, toCsv([['week_start', 'opened', 'closed'], ...series.map((s) => [s.week, s.opened, s.closed])]));
  const exportTime = () =>
    download(
      `core-hub-time-${todayISO()}.csv`,
      toCsv([['date', 'analyst', 'capacity_bucket', 'hours', 'item', 'note'], ...state.time.map((t) => [t.date, t.user, t.bucket, t.hours, t.item, t.note])]),
    );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Metrics</h1>
          <div className="sub">CSV exports feed the existing Power BI dashboards.</div>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={() => download(`core-hub-items-${todayISO()}.csv`, itemsCsv(all, cfg))}><Icon name="download" /> Items CSV</button>
          <button className="btn" onClick={exportWeekly}><Icon name="download" /> Weekly CSV</button>
          <button className="btn" onClick={exportTime}><Icon name="download" /> Time CSV</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="v">{open.length}</div><div className="l">Open items</div></div>
        <div className="stat"><div className="v">{avgAge}d</div><div className="l">Average age of open items</div></div>
        <div className={`stat`}><div className={`v ${overdue ? 'danger-text' : ''}`}>{overdue}</div><div className="l">Overdue next updates</div></div>
        <div className="stat"><div className="v">{avgCycle}{avgCycle !== '–' ? 'd' : ''}</div><div className="l">Avg cycle time, start → done (30 days)</div></div>
      </div>

      <div className="grid2">
        <section className="panel" aria-labelledby="ob">
          <div className="panel-head"><h2 id="ob">Open by bucket and priority</h2></div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Bucket</th>{PRIORITIES.map((p) => <th key={p} className="num">{p}</th>)}<th className="num">None</th><th className="num">Total</th></tr>
              </thead>
              <tbody>
                {[...BUCKETS, undefined].map((b) => {
                  const rows = open.filter((i) => i.bucket === b);
                  return (
                    <tr key={b ?? 'none'}>
                      <td><span className={`dot ${b ?? 'none'}`} /> {b ? BUCKET_LABEL[b] : 'Not graded'}</td>
                      {PRIORITIES.map((p) => <td key={p} className="num">{rows.filter((i) => i.priority === p).length || ''}</td>)}
                      <td className="num">{rows.filter((i) => !i.priority).length || ''}</td>
                      <td className="num"><strong>{rows.length}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel" aria-labelledby="oc">
          <div className="panel-head">
            <h2 id="oc" className="grow">Opened vs closed per week</h2>
            <div className="legend"><span><i style={{ background: 'var(--border-strong)' }} />Opened</span><span><i style={{ background: 'var(--accent)' }} />Closed</span></div>
          </div>
          <div style={{ padding: 16 }}>
            <svg className="chart" viewBox={`0 0 ${W} ${H + 24}`} width="100%" role="img" aria-label={series.map((s) => `Week of ${s.week}: ${s.opened} opened, ${s.closed} closed`).join('; ')}>
              {[0, 0.5, 1].map((t) => (
                <g key={t}>
                  <line x1={pad} x2={W} y1={H - t * (H - 10)} y2={H - t * (H - 10)} stroke="var(--border)" />
                  <text x={pad - 6} y={H - t * (H - 10) + 4} textAnchor="end">{Math.round(t * max)}</text>
                </g>
              ))}
              {series.map((s, n) => {
                const x = pad + n * bw + bw * 0.15;
                const w = bw * 0.33;
                const h1 = (s.opened / max) * (H - 10);
                const h2 = (s.closed / max) * (H - 10);
                return (
                  <g key={s.week}>
                    <rect x={x} y={H - h1} width={w} height={h1} rx={3} fill="var(--border-strong)" />
                    <rect x={x + w + 2} y={H - h2} width={w} height={h2} rx={3} fill="var(--accent)" />
                    <text x={x + w} y={H + 16} textAnchor="middle">{new Date(s.week + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>

        <section className="panel" aria-labelledby="tp">
          <div className="panel-head"><h2 id="tp">Throughput per analyst (last 4 weeks)</h2></div>
          <div style={{ padding: 16 }} className="hours">
            {throughput.map(({ p, done }) => (
              <div key={p.username} style={{ display: 'contents' }}>
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                <span className="bar" role="img" aria-label={`${done} done`}><i style={{ width: `${(done / maxT) * 100}%` }} /></span>
                <span style={{ textAlign: 'right' }}>{done}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel" aria-labelledby="hm">
          <div className="panel-head"><h2 id="hm">Team hours this week vs model</h2></div>
          <div style={{ padding: 16 }} className="hours">
            {TIME_BUCKETS.map((b) => {
              const from = thisMonday;
              const h = state.time.filter((t) => t.bucket === b.key && t.date >= from).reduce((s, t) => s + t.hours, 0);
              const target = (cfg.capacityModel[b.key] ?? 0) * analysts(cfg).length;
              return (
                <div key={b.key} style={{ display: 'contents' }}>
                  <span style={{ fontWeight: 600 }}>{b.label}</span>
                  <span className={`bar ${h > target ? 'over' : ''}`} role="img" aria-label={`${h} of ${target} hours`}><i style={{ width: `${target ? Math.min(100, (h / target) * 100) : 0}%` }} /></span>
                  <span style={{ textAlign: 'right' }}>{h}/{target}h</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

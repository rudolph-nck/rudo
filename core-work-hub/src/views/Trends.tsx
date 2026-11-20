// Trends: how many tickets come in and go out, what the next weeks probably bring, when they arrive, and what's rising.
import { useMemo, useState } from 'react';
import { useHub } from '../store/hub';
import { ChartCard, Heatmap, LineChart, type LineSeries } from '../components/charts';
import { forecast, outlook, risers, weekly, whenTheyArrive } from '../model/trends';
import { useNow } from './Notifications';

const fmtWeek = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 13 }, (_, k) => k + 7); // 7am .. 7pm
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`;
const r1 = (n: number) => Math.round(n * 10) / 10;

export function Trends() {
  const { state } = useHub();
  const now = useNow(10 * 60_000);
  const [source, setSource] = useState<'SD' | 'all'>('SD');
  const [span, setSpan] = useState<26 | 52>(26);
  const items = useMemo(() => [...state.items.values()].filter((i) => !i.stale && (source === 'all' || i.source === source)), [state, source]);
  const hasSD = useMemo(() => [...state.items.values()].some((i) => i.source === 'SD'), [state]);
  const wk = useMemo(() => weekly(items, span, now), [items, span, now]);
  const f = useMemo(() => forecast(items, 8, now), [items, now]);
  const look = useMemo(() => outlook(items, f, now), [items, f, now]);
  const heat = useMemo(() => whenTheyArrive(items, 26, now), [items, now]);
  const riseCat = useMemo(() => risers(items, (i) => i.subcategory, now), [items, now]);
  const riseDept = useMemo(() => risers(items, (i) => i.department, now), [items, now]);

  // Past weeks (the last entry is this week so far), then the forecast weeks after this one.
  const ahead = f ? f.weeks.slice(1) : [];
  const labels = [...wk.map((w) => fmtWeek(w.start)), ...ahead.map((w) => fmtWeek(w.start))];
  const tips = [...wk.map((w, k) => `Week of ${fmtWeek(w.start)}${k === wk.length - 1 ? ' (so far)' : ''}`), ...ahead.map((w) => `Week of ${fmtWeek(w.start)} (forecast)`)];
  const pad = (n: number) => new Array(n).fill(null);
  const cur = wk.length - 1;
  const flow: LineSeries[] = [
    { key: 'opened', label: 'Opened', color: 'var(--chart-gray)', values: [...wk.map((w) => w.opened), ...pad(ahead.length)] },
    { key: 'closed', label: 'Closed', color: 'var(--accent)', values: [...wk.map((w) => w.closed), ...pad(ahead.length)] },
    ...(f ? [{ key: 'forecast', label: 'Expected opened', color: 'var(--chart-gray)', dashed: true, values: [...pad(cur), f.weeks[0].expected, ...ahead.map((w) => w.expected)] }] : []),
  ];
  const band = f ? [...pad(cur), { low: f.weeks[0].low, high: f.weeks[0].high }, ...ahead.map((w) => ({ low: w.low, high: w.high }))] : undefined;
  // Open count, projected at the recent closing pace.
  let proj = look.openNow;
  const openProj = ahead.map((w) => (proj = Math.max(0, proj + w.expected - look.closePace)));
  const openSeries: LineSeries[] = [
    { key: 'open', label: 'Open tickets', color: 'var(--accent)', values: [...wk.map((w) => w.open), ...pad(ahead.length)] },
    ...(f ? [{ key: 'proj', label: 'Projected at the current pace', color: 'var(--accent)', dashed: true, values: [...pad(cur), look.openNow, ...openProj] }] : []),
  ];
  const next = f?.weeks[1];
  const in4 = f ? f.weeks.slice(1, 5).reduce((a, b) => a + b.expected, 0) : 0;
  const busiest = heat.grid.flatMap((r, d) => r.map((v, h) => ({ d, h, v }))).sort((a, b) => b.v - a.v)[0];
  const dayTotals = heat.grid.map((r) => r.reduce((a, b) => a + b, 0));
  const busiestDay = dayTotals.indexOf(Math.max(...dayTotals));

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1>Trends</h1>
          <div className="sub">Tickets in and out each week, what the next few weeks probably bring, and when tickets arrive. Hover any point for the numbers.</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {hasSD && (
            <div className="seg" role="radiogroup" aria-label="Which tickets">
              <button role="radio" aria-checked={source === 'SD'} onClick={() => setSource('SD')}>Service Desk</button>
              <button role="radio" aria-checked={source === 'all'} onClick={() => setSource('all')}>All work</button>
            </div>
          )}
          <div className="seg" role="radiogroup" aria-label="History">
            <button role="radio" aria-checked={span === 26} onClick={() => setSpan(26)}>6 months</button>
            <button role="radio" aria-checked={span === 52} onClick={() => setSpan(52)}>12 months</button>
          </div>
        </div>
      </div>

      {f ? (
        <div className="mw-tiles tr-tiles">
          <div className="mw-tile static">
            <span className="t">Expected next week</span>
            <span className="n">{Math.round(next?.expected ?? 0)}</span>
            <span className="d">Likely {Math.round(next?.low ?? 0)}–{Math.round(next?.high ?? 0)} new tickets</span>
          </div>
          <div className="mw-tile static">
            <span className="t">Next 4 weeks</span>
            <span className="n">~{Math.round(in4)}</span>
            <span className="d">{f.seasonPct >= 5 ? `Seasonally busier (+${Math.round(f.seasonPct)}%)` : f.seasonPct <= -5 ? `Seasonally quieter (${Math.round(f.seasonPct)}%)` : 'A normal time of year'}</span>
          </div>
          <div className="mw-tile static">
            <span className="t">Recent pace</span>
            <span className="n">{r1(f.recentAvg)}</span>
            <span className="d">opened a week · {r1(look.closePace)} closed a week</span>
          </div>
          <div className={`mw-tile static ${look.openIn4 > look.openNow * 1.1 ? 'warn' : look.openIn4 < look.openNow * 0.9 ? 'good' : ''}`}>
            <span className="t">Open in 4 weeks</span>
            <span className="n">~{look.openIn4}</span>
            <span className="d">{look.openNow} open now · {look.openIn4 > look.openNow ? 'growing' : look.openIn4 < look.openNow ? 'shrinking' : 'steady'} at the current closing pace</span>
          </div>
        </div>
      ) : (
        <div className="banner">Not enough history for a forecast yet: it needs at least 12 weeks of tickets.</div>
      )}

      <ChartCard
        wide
        title="Tickets per week"
        sub={f ? 'Opened and closed each week; the dashed line is the forecast, with the shaded likely range (80%).' : 'Opened and closed each week.'}
        legend={flow}
        table={{ head: ['Week', 'Opened', 'Closed', 'Open at week end', 'Expected', 'Likely range'], rows: [...wk.map((w, k) => [fmtWeek(w.start) + (k === cur ? ' (so far)' : ''), w.opened, w.closed, w.open, k === cur && f ? Math.round(f.weeks[0].expected) : '', k === cur && f ? `${Math.round(f.weeks[0].low)}–${Math.round(f.weeks[0].high)}` : '']), ...ahead.map((w) => [fmtWeek(w.start), '', '', '', Math.round(w.expected), `${Math.round(w.low)}–${Math.round(w.high)}`])] }}
      >
        <LineChart labels={labels} tips={tips} series={flow} band={band} nowIndex={cur} label="Tickets opened and closed per week, with forecast" height={280} width={1120} />
      </ChartCard>

      <div className="viz-grid">
        <ChartCard title="Open tickets" sub={f ? `Open at the end of each week; dashed: projected if we keep closing about ${r1(look.closePace)} a week.` : 'Open at the end of each week.'} legend={openSeries} table={{ head: ['Week', 'Open'], rows: [...wk.map((w) => [fmtWeek(w.start), w.open]), ...ahead.map((w, k) => [`${fmtWeek(w.start)} (projected)`, Math.round(openProj[k])])] }}>
          <LineChart labels={labels} tips={tips} series={openSeries} nowIndex={cur} label="Open tickets per week, with projection" />
        </ChartCard>
        <ChartCard
          title="When tickets arrive"
          sub={heat.total ? `Average new tickets per hour, last ${heat.weeks} weeks. Busiest: ${DAYS[busiestDay]}s, and ${DAYS[busiest.d]} around ${hourLabel(busiest.h)}m.` : 'No tickets in the last 26 weeks.'}
          table={{ head: ['Day', ...HOURS.map((h) => hourLabel(h) + 'm')], rows: DAYS.map((d, i) => [d, ...HOURS.map((h) => r1(heat.grid[i][h]))]) }}
        >
          <Heatmap rows={DAYS.slice(0, 5).concat(dayTotals[5] + dayTotals[6] > 0.5 ? DAYS.slice(5) : [])} cols={HOURS.map((h) => hourLabel(h))} values={DAYS.map((_, i) => HOURS.map((h) => heat.grid[i][h]))} label="Tickets by weekday and hour" fmt={(v) => `${r1(v)} a week`} cellTip={(r, c) => `${DAYS[r]} ${hourLabel(HOURS[c])}m`} />
        </ChartCard>
      </div>

      <div className="viz-grid">
        <section className="panel viz-card" aria-labelledby="rise-h">
          <div className="viz-head"><div className="grow"><h2 id="rise-h">Arriving faster than usual</h2><div className="small muted">Last 4 weeks against the usual 4-week pace (previous 6 months). Worth a look for a root cause.</div></div></div>
          <div className="viz-body">
            {riseCat.length + riseDept.length ? (
              <ul className="rise-list">
                {[...riseCat.map((r) => ({ ...r, kind: 'Category' })), ...riseDept.map((r) => ({ ...r, kind: 'Department' }))].map((r) => (
                  <li key={r.kind + r.label}>
                    <span className="chip src">{r.kind}</span>
                    <strong className="grow">{r.label}</strong>
                    <span className="small">{r.recent} in 4 weeks</span>
                    <span className="small muted">usually ~{r1(r.usual)}</span>
                    <span className="chip warn">{r.usual < 1 ? 'New' : `${r1(r.ratio)}×`}</span>
                  </li>
                ))}
              </ul>
            ) : <div className="small muted">Nothing unusual: no category or department is arriving much faster than normal.</div>}
          </div>
        </section>
        <section className="panel viz-card" aria-labelledby="how-h">
          <div className="viz-head"><div className="grow"><h2 id="how-h">How the forecast works</h2></div></div>
          <div className="viz-body small fc-how">
            {f ? (
              <>
                <p>It starts from the <strong>recent weekly pace</strong> (weighted toward the last few weeks), adds the <strong>recent trend</strong> (damped, so one busy month doesn’t run away), and adjusts for the <strong>time of year</strong>{f.seasonal ? `, learned from ${Math.round(f.historyWeeks / 52 * 10) / 10} years of tickets` : ' once there’s more than a year and a half of history'}.</p>
                <p><strong>How accurate it has been:</strong> tested week by week on the last 12 weeks, it was off by about <strong>{r1(f.mae)} tickets a week</strong> ({Math.round(f.maePct)}% of a typical week){Math.abs(f.vsNaivePct) >= 3 ? `, ${f.vsNaivePct > 0 ? `${Math.round(f.vsNaivePct)}% better` : `${Math.round(-f.vsNaivePct)}% worse`} than simply repeating the last 4 weeks’ average` : ', about the same as simply repeating the last 4 weeks’ average'}. Use it for planning (support cover, time off), not as a promise.</p>
                <p className="muted">Trend: {f.trendPerWeek >= 0.05 ? `about +${r1(f.trendPerWeek)} tickets a week each week` : f.trendPerWeek <= -0.05 ? `about ${r1(f.trendPerWeek)} tickets a week each week` : 'flat'}. Holidays and one-off incidents (an outage, a big rollout) can push a week outside the shaded range.</p>
              </>
            ) : <p>A forecast appears once there are 12 weeks of tickets.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

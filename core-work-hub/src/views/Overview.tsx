import { useMemo, useState } from 'react';
import { useHub } from '../store/hub';
import { useUi } from '../components/actions';
import { Avatar, BucketDot, download, Icon, PriorityChip, SourceBadge } from '../components/ui';
import { BUCKET_SERIES, ChartCard, GroupedColumns, Meter, RankedBars, StackedColumns, StackedRows, type Series } from '../components/charts';
import { overview, shiftStats, STALE_DAYS } from '../model/analytics';
import { addDays, analysts, currentDispatch, findPerson, fmtShortDate, nextDispatch, offOn, todayISO } from '../model/logic';
import { itemsCsv, toCsv } from '../model/csv';
import { BUCKETS, BUCKET_LABEL, COLUMN_LABEL, type Bucket } from '../model/types';
import { useNav } from '../nav';

const FLOW: Series[] = [
  { key: 'opened', label: 'Opened', color: 'var(--chart-gray)' },
  { key: 'closed', label: 'Closed', color: 'var(--accent)' },
];
const RANGES = [8, 12, 26] as const;

const d1 = (n?: number) => (n === undefined ? '–' : n < 10 ? n.toFixed(1) : Math.round(n).toString());

function Stat({ label, value, unit, note, tone, icon }: { label: string; value: string | number; unit?: string; note?: string; tone?: 'bad' | 'warn' | 'ok'; icon?: string }) {
  return (
    <div className="stat2">
      <div className="l">{label}</div>
      <div className="v">
        {value}
        {unit && <span className="u">{unit}</span>}
      </div>
      {note && (
        <div className={`n ${tone ?? ''}`}>
          {icon && <Icon name={icon} size={13} />}
          {note}
        </div>
      )}
    </div>
  );
}

export function Overview() {
  const { state } = useHub();
  const { openItem } = useUi();
  const { go } = useNav();
  const cfg = state.config;
  const [bucket, setBucket] = useState<Bucket | ''>('');
  const [owner, setOwner] = useState('');
  const [weeks, setWeeks] = useState<(typeof RANGES)[number]>(12);
  const o = useMemo(() => overview(state, { bucket: bucket || undefined, owner: owner || undefined }, weeks), [state, bucket, owner, weeks]);
  const k = o.kpis;
  const disp = currentDispatch(cfg);
  const next = nextDispatch(cfg);
  const name = (u?: string) => findPerson(cfg, u)?.name ?? u ?? '—';
  const delta = k.doneThisWeek - k.doneLastWeek;
  const fmtWeek = (w: string) => new Date(w + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const exportWeekly = () => download(`core-hub-weekly-${todayISO()}.csv`, toCsv([['week_start', 'opened', 'closed'], ...o.flow.map((s) => [s.week, s.opened, s.closed])]));
  const exportPeople = () =>
    download(
      `core-hub-team-${todayISO()}.csv`,
      toCsv([
        ['analyst', 'doing', 'wip_limit', 'queue', 'waiting', 'on_hold', 'stale', 'overdue_updates', 'oldest_open_days', 'done_14d', 'median_cycle_days_30d'],
        ...o.rows.map((r) => [r.name, r.doing, r.limit, r.queue, r.waiting, r.onHold, r.stale, r.overdue, r.oldestDays, r.done14, r.medianCycle?.toFixed(1)]),
      ]),
    );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <div className="sub">How work is moving, where it’s held up, and each person’s load.</div>
        </div>
        <div className="topbar-actions">
          <button className="btn sm" onClick={() => download(`core-hub-items-${todayISO()}.csv`, itemsCsv([...state.items.values()], cfg))}><Icon name="download" size={16} /> Items CSV</button>
          <button className="btn sm" onClick={exportWeekly}><Icon name="download" size={16} /> Weekly CSV</button>
          <button className="btn sm" onClick={exportPeople}><Icon name="download" size={16} /> Team CSV</button>
        </div>
      </div>

      <div className="toolbar" role="group" aria-label="Filters">
        <div className="seg" role="group" aria-label="Bucket">
          <button aria-pressed={bucket === ''} onClick={() => setBucket('')}>All</button>
          {BUCKETS.map((b) => (
            <button key={b} aria-pressed={bucket === b} onClick={() => setBucket(b)}>
              <span className={`dot ${b}`} />
              {BUCKET_LABEL[b]}
            </button>
          ))}
        </div>
        <div className="filters">
          <select aria-label="Person" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Whole team</option>
            {analysts(cfg).map((p) => <option key={p.username} value={p.username}>{p.name}</option>)}
          </select>
        </div>
        <div className="seg" role="group" aria-label="Time range" style={{ marginLeft: 'auto' }}>
          {RANGES.map((r) => (
            <button key={r} aria-pressed={weeks === r} onClick={() => setWeeks(r)}>{r} weeks</button>
          ))}
        </div>
      </div>

      <div className="ov-hero">
        <section className="panel hero-card" aria-label="Open work">
          <div className="l">Open work{owner ? ` · ${name(owner)}` : ''}</div>
          <div className="hero">{k.open}</div>
          <div className="small muted">{k.openedThisWeek} opened this week · median age {d1(k.medianAgeOpen)} days</div>
          {(() => {
            const col = (c: string) => o.byColumn.find((r) => r.column === c)?.total ?? 0;
            const parts: [string, number, string][] = [
              ['Intake', col('Intake'), 'var(--chart-gray)'],
              ['Queued', col('To Do') + col('Ready'), 'var(--b-maintenance)'],
              ['Doing', col('Doing'), 'var(--accent)'],
              ['Waiting / on hold', col('Waiting') + col('On Hold'), 'var(--b-support)'],
            ];
            return (
              <>
                <div className="hero-split" role="img" aria-label={parts.map(([l, v]) => `${l} ${v}`).join(', ')}>
                  {parts.map(([l, v, c]) => (v > 0 ? <i key={l} style={{ flex: v, background: c }} title={`${l}: ${v}`} /> : null))}
                </div>
                <div className="legend" style={{ flexWrap: 'wrap', rowGap: 4 }}>
                  {parts.map(([l, v, c]) => (
                    <span key={l}><i style={{ background: c }} />{l} <strong style={{ marginLeft: 4 }}>{v}</strong></span>
                  ))}
                </div>
              </>
            );
          })()}
        </section>
        <div className="stat-grid">
          <Stat label="Doing vs WIP slots" value={`${k.doing}`} unit={` / ${k.slots}`} note={k.doing > k.slots ? 'Over the team’s WIP' : `${k.slots - k.doing} slots free`} tone={k.doing > k.slots ? 'bad' : 'ok'} icon={k.doing > k.slots ? 'bell' : 'check'} />
          <Stat label="Closed this week" value={k.doneThisWeek} note={`${delta >= 0 ? '+' : ''}${delta} vs last week · ${k.openedThisWeek} opened`} />
          <Stat label="Held up" value={k.held} note={`Waiting, on hold, or Doing with no update in ${STALE_DAYS}+ days`} tone={k.held ? 'warn' : 'ok'} />
          <Stat label="Overdue next updates" value={k.overdue} note={k.overdue ? 'Requesters are owed an update' : 'All updates on time'} tone={k.overdue ? 'bad' : 'ok'} icon={k.overdue ? 'clock' : 'check'} />
          <Stat label="Cycle time (median)" value={d1(k.medianCycle)} unit=" days" note={`Start → done, last 30 days · lead time ${d1(k.medianLead)}d`} />
          <Stat label="Past SLA due date" value={k.slaOverdue} note={k.slaOverdue ? 'Service Desk due-by has passed' : 'Nothing past its due-by'} tone={k.slaOverdue ? 'warn' : 'ok'} icon={k.slaOverdue ? 'clock' : 'check'} />
        </div>
        <section className="panel rota-mini" aria-label="Support rotation">
          <div className="l">On support now</div>
          {disp ? (
            <>
              <div className="row" style={{ marginTop: 8 }}>
                <Avatar user={disp.analyst} config={cfg} size="lg" />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{name(disp.analyst)}</div>
                  <div className="small muted">until {fmtShortDate(disp.to)}</div>
                </div>
              </div>
              {(() => {
                const st = shiftStats(state, disp.analyst, disp.from, todayISO());
                return (
                  <div className="shift-stats" aria-label="This shift so far">
                    <div><strong>{st.cameIn}</strong><span>came in</span></div>
                    <div><strong>{st.triaged}</strong><span>triaged</span></div>
                    <div><strong>{st.closed}</strong><span>closed</span></div>
                  </div>
                );
              })()}
              <dl className="kv small" style={{ gridTemplateColumns: '84px 1fr', marginTop: 12 }}>
                <dt>Escalation</dt><dd>{name(disp.escalation)}</dd>
                <dt>Next up</dt><dd>{next ? `${name(next.analyst)} · ${fmtShortDate(next.from)}` : '—'}</dd>
              </dl>
            </>
          ) : (
            <p className="small muted">No rotation set.</p>
          )}
          <button className="btn sm ghost" style={{ marginTop: 'auto', alignSelf: 'flex-start' }} onClick={() => go('rotation')}>Full schedule →</button>
        </section>
      </div>

      <div className="viz-grid">
        <ChartCard
          title="Flow: opened vs closed"
          sub={`Per week, last ${weeks} weeks. Closed above opened means the backlog is shrinking.`}
          legend={FLOW}
          table={{ head: ['Week of', 'Opened', 'Closed'], rows: o.flow.map((f) => [fmtWeek(f.week), f.opened, f.closed]) }}
        >
          <GroupedColumns
            label={`Opened and closed per week for the last ${weeks} weeks`}
            series={FLOW}
            data={o.flow.map((f) => ({ label: fmtWeek(f.week), tip: `Week of ${fmtWeek(f.week)}`, values: { opened: f.opened, closed: f.closed } }))}
          />
        </ChartCard>
        <ChartCard
          title="Where the work is"
          sub="Open items by column and bucket. Select a row to open the board."
          legend={BUCKET_SERIES}
          table={{ head: ['Column', ...BUCKET_SERIES.map((s) => s.label), 'Total'], rows: o.byColumn.map((r) => [COLUMN_LABEL[r.column], ...r.parts.map((p) => p.value), r.total]) }}
        >
          <StackedRows label="Open items by column, stacked by bucket" series={BUCKET_SERIES} rows={o.byColumn.map((r) => ({ ...r, label: COLUMN_LABEL[r.column] }))} onRow={(l) => (l === 'Intake' ? go('triage') : go('board'))} />
        </ChartCard>
      </div>

      <section className="panel" aria-labelledby="team-h">
        <div className="viz-head">
          <div className="grow">
            <h2 id="team-h">Team load</h2>
            <div className="small muted">Sorted by what needs attention first: over WIP, overdue updates, stalled work, waiting, unacknowledged.</div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table team-load">
            <thead>
              <tr>
                <th>Person</th>
                <th>Doing / limit</th>
                <th className="num">Queue</th>
                <th className="num">Waiting</th>
                <th className="num">On hold</th>
                <th>Needs attention</th>
                <th className="num">Oldest open</th>
                <th className="num">Done (14d)</th>
                <th className="num">Cycle (median)</th>
              </tr>
            </thead>
            <tbody>
              {[...o.rows].sort((a, b) => b.attention - a.attention || a.name.localeCompare(b.name)).map((r) => (
                <tr key={r.username}>
                  <td>
                    <button className="btn ghost sm" style={{ padding: '0 6px', fontWeight: 700 }} onClick={() => setOwner(owner === r.username ? '' : r.username)} aria-pressed={owner === r.username} title="Filter the dashboard to this person">
                      <Avatar user={r.username} config={cfg} /> {r.name}
                    </button>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <Meter value={r.doing} max={r.limit} label={`${r.name}: ${r.doing} of ${r.limit} in Doing`} />
                      <span className={r.doing > r.limit ? 'danger-text' : ''} style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{r.doing}/{r.limit}</span>
                    </div>
                  </td>
                  <td className="num">{r.queue || ''}</td>
                  <td className="num">{r.waiting || ''}</td>
                  <td className="num">{r.onHold || ''}</td>
                  <td>
                    <div className="row wrap" style={{ gap: 4 }}>
                      {r.doing > r.limit && <span className="chip bad"><Icon name="bell" size={12} />Over WIP</span>}
                      {r.overdue > 0 && <span className="chip bad"><Icon name="clock" size={12} />{r.overdue} overdue</span>}
                      {r.stale > 0 && <span className="chip warn">{r.stale} stalled</span>}
                      {r.unacked > 0 && <span className="chip warn">{r.unacked} not acked</span>}
                      {offOn(cfg, r.username) && <span className="chip bad">Off · back {fmtShortDate(addDays(offOn(cfg, r.username)!.to, 1))}</span>}
                      {r.attention === 0 && <span className="chip ok"><Icon name="check" size={12} />On track</span>}
                    </div>
                  </td>
                  <td className="num">{r.oldestDays !== undefined ? `${r.oldestDays}d` : ''}</td>
                  <td className="num">{r.done14 || ''}</td>
                  <td className="num">{r.medianCycle !== undefined ? `${d1(r.medianCycle)}d` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="viz-grid">
        <section className="panel viz-card" aria-labelledby="held-h">
          <div className="viz-head">
            <div className="grow">
              <h2 id="held-h">Held up</h2>
              <div className="small muted">Longest stuck first. {o.held.length} items.</div>
            </div>
          </div>
          <ul className="held">
            {o.held.slice(0, 10).map((h) => (
              <li key={h.item.id}>
                <span className={`days ${h.days >= 14 ? 'bad' : h.days >= 7 ? 'warn' : ''}`}>
                  <strong>{h.days}</strong>d
                </span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <button className="t" onClick={() => openItem(h.item.id)}>{h.item.title}</button>
                  <div className="row small muted" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <BucketDot b={h.item.bucket} />
                    <PriorityChip p={h.item.priority} />
                    <SourceBadge item={h.item} />
                    <span className={`chip ${h.kind === 'stale' ? 'warn' : 'src'}`}>{h.kind === 'hold' ? 'On hold' : h.kind === 'stale' ? 'Stalled' : 'Waiting'}</span>
                    <span className="why">{h.why}</span>
                  </div>
                </div>
                <Avatar user={h.item.owner} config={cfg} external={h.item.owner ? undefined : h.item.source_owner} />
              </li>
            ))}
            {o.held.length === 0 && <li className="muted">Nothing is held up. Nice.</li>}
          </ul>
        </section>
        <ChartCard title="What it’s waiting on" sub="Held-up items by reason." table={{ head: ['Reason', 'Items'], rows: o.waitingOn.map((w) => [w.label, w.value]) }}>
          <RankedBars label="Held-up items by reason" rows={o.waitingOn} color="var(--b-support)" />
        </ChartCard>
      </div>

      <div className="viz-grid">
        <ChartCard
          title="Age of open work"
          sub="Days since the request was opened. 90+ days is flagged."
          legend={BUCKET_SERIES}
          table={{ head: ['Age', ...BUCKET_SERIES.map((s) => s.label), 'Total'], rows: o.aging.map((a) => [a.band, ...a.parts.map((p) => p.value), a.total]) }}
        >
          <StackedColumns label="Open items by age band, stacked by bucket" series={BUCKET_SERIES} cols={o.aging.map((a) => ({ label: a.band, total: a.total, parts: a.parts }))} danger="90+ days" />
        </ChartCard>
        <ChartCard title="Open work by system" sub="From the ownership map, or the Service Desk sub-category until graded." table={{ head: ['System', 'Open'], rows: o.bySystem.map((s) => [s.label, s.value]) }}>
          <RankedBars label="Open items by system" rows={o.bySystem} />
        </ChartCard>
      </div>
    </div>
  );
}

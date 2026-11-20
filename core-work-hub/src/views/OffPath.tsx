// Off-path work: tickets owned by someone who isn't on that system's ownership map (primary, secondary or third).
import { useMemo, useState } from 'react';
import { useHub } from '../store/hub';
import { useUi } from '../components/actions';
import { ChartCard, StackedRows, type Series } from '../components/charts';
import { Avatar, PriorityChip, SourceBadge } from '../components/ui';
import { findPerson, fmtAge, fmtShortDate } from '../model/logic';
import { offPath, type OffScope } from '../model/offpath';
import { closedAtOf } from '../model/trends';
import { useNow } from './Notifications';

const SERIES: Series[] = [
  { key: 'on', label: 'On their platforms', color: 'var(--accent)' },
  { key: 'off', label: 'Off-path', color: 'var(--b-support)' },
  { key: 'none', label: 'No system mapped', color: 'var(--chart-gray)' },
];
const SCOPE_LABEL: Record<OffScope, string> = { open: 'Open now', '90d': 'Closed, last 90 days', year: 'Closed this year' };

export function OffPath() {
  const { state } = useHub();
  const { openItem } = useUi();
  const now = useNow(10 * 60_000);
  const cfg = state.config;
  const [scope, setScope] = useState<OffScope>('open');
  const [who, setWho] = useState('');
  const [sys, setSys] = useState('');
  const o = useMemo(() => offPath(state, scope, now), [state, scope, now]);
  const name = (u?: string) => (u ? findPerson(cfg, u)?.name ?? u : '—');
  const list = o.items.filter((x) => (!who || x.item.owner === who) && (!sys || x.system.id === sys));
  const people = o.people.filter((p) => p.total > 0);
  const roleOf = (s: (typeof o.items)[number]['system'], u: string) =>
    u === s.primary ? 'Primary' : (Array.isArray(s.secondary) ? s.secondary : [s.secondary]).includes(u) ? 'Secondary' : 'Third';

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1>Off-path work</h1>
          <div className="sub">Tickets owned by someone who isn’t listed on that system’s ownership map (primary, secondary or third). Some is healthy cover and cross-training; a lot can mean the map is out of date or work isn’t reaching the right people.</div>
        </div>
        <div className="seg" role="radiogroup" aria-label="Which tickets">
          {(Object.keys(SCOPE_LABEL) as OffScope[]).map((s) => <button key={s} role="radio" aria-checked={scope === s} onClick={() => { setScope(s); setWho(''); setSys(''); }}>{SCOPE_LABEL[s]}</button>)}
        </div>
      </div>

      <div className="mw-tiles tr-tiles">
        <div className={`mw-tile static ${o.totals.offPct >= 25 ? 'warn' : ''}`}>
          <span className="t">Off-path</span>
          <span className="n">{o.totals.offPct}%</span>
          <span className="d">{o.totals.off} of {o.totals.mapped} tickets on mapped systems</span>
        </div>
        <div className="mw-tile static">
          <span className="t">On the right people</span>
          <span className="n">{o.totals.mapped - o.totals.off}</span>
          <span className="d">owned by a listed owner of that system</span>
        </div>
        <div className="mw-tile static">
          <span className="t">No system mapped</span>
          <span className="n">{o.totals.unmapped}</span>
          <span className="d">can’t tell: the category isn’t on the ownership map</span>
        </div>
        <div className="mw-tile static">
          <span className="t">Most off-path</span>
          <span className="n" style={{ fontSize: 22 }}>{people[0]?.off ? name(people[0].user) : '—'}</span>
          <span className="d">{people[0]?.off ? `${people[0].off} tickets · ${people[0].offPct}% of their mapped work` : 'Nobody'}</span>
        </div>
      </div>

      <div className="viz-grid">
        <ChartCard
          title="By person"
          sub="Each person’s tickets: on their listed platforms, off-path, or on a system with no owners mapped. Click a person to list their off-path tickets."
          legend={SERIES}
          table={{ head: ['Person', 'Tickets', 'On their platforms', 'Off-path', 'Off-path %', 'No system mapped'], rows: o.people.map((p) => [name(p.user), p.total, p.onPath, p.off, `${p.offPct}%`, p.unmapped]) }}
        >
          <StackedRows
            rows={people.map((p) => ({ label: `${name(p.user)} · ${p.offPct}% off`, total: p.total, parts: [{ key: 'on', value: p.onPath }, { key: 'off', value: p.off }, { key: 'none', value: p.unmapped }] }))}
            series={SERIES}
            label="Tickets per person, on-path vs off-path"
            onRow={(label) => { const p = people.find((x) => label.startsWith(name(x.user) + ' ·')); if (p) setWho(p.user === who ? '' : p.user); }}
          />
        </ChartCard>
        <ChartCard title="By system" sub="Where work most often goes to someone not listed. Click a system to filter the list." table={{ head: ['System', 'Tickets', 'Off-path', 'Listed owners'], rows: o.systems.map((s) => [s.system.name, s.total, s.off, [s.system.primary, s.system.secondary, s.system.third].flat().filter(Boolean).map((u) => name(u as string)).join(', ')]) }}>
          {o.systems.length ? (
            <ul className="ask-bars">
              {o.systems.slice(0, 12).map((s) => (
                <li key={s.system.id}>
                  <button className={`ask-bar ${sys === s.system.id ? 'on' : ''}`} onClick={() => setSys(sys === s.system.id ? '' : s.system.id)} aria-pressed={sys === s.system.id}>
                    <span className="lbl">{s.system.name}</span>
                    <span className="track"><span style={{ width: `${(s.off / Math.max(1, o.systems[0].off)) * 100}%`, background: 'var(--b-support)' }} /></span>
                    <span className="val">{s.off}<span className="muted"> of {s.total}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <div className="small muted">No off-path tickets.</div>}
        </ChartCard>
      </div>

      <section className="panel" aria-labelledby="op-h">
        <div className="panel-head">
          <h2 id="op-h" className="grow">Off-path tickets <span className="muted">({list.length})</span></h2>
          <select className="input" style={{ width: 180, minHeight: 38 }} value={who} onChange={(e) => setWho(e.target.value)} aria-label="Person">
            <option value="">Everyone</option>
            {people.filter((p) => p.off).map((p) => <option key={p.user} value={p.user}>{name(p.user)} ({p.off})</option>)}
          </select>
          <select className="input" style={{ width: 220, minHeight: 38 }} value={sys} onChange={(e) => setSys(e.target.value)} aria-label="System">
            <option value="">All systems</option>
            {o.systems.map((s) => <option key={s.system.id} value={s.system.id}>{s.system.name} ({s.off})</option>)}
          </select>
        </div>
        <div className="table-wrap">
          <table className="table tk-table">
            <thead><tr><th>Ticket</th><th>Title</th><th>System</th><th>Owner</th><th>Listed owners</th><th>{scope === 'open' ? 'Age' : 'Closed'}</th></tr></thead>
            <tbody>
              {list.slice(0, 300).map(({ item: i, system: s, listed }) => (
                <tr key={i.id}>
                  <td className="nowrap"><SourceBadge item={i} />{i.priority && <div style={{ marginTop: 4 }}><PriorityChip p={i.priority} /></div>}</td>
                  <td><button className="linkish strong tk-title" onClick={() => openItem(i.id)}>{i.title}</button><div className="small muted">{i.subcategory ?? ''}</div></td>
                  <td className="small">{s.name}{s.criticality ? <div className="muted">{s.criticality}</div> : null}</td>
                  <td><div className="row nowrap" style={{ gap: 6 }}><Avatar user={i.owner} config={cfg} />{name(i.owner)}</div></td>
                  <td className="small">{listed.map((u) => <div key={u}>{name(u)} <span className="muted">· {roleOf(s, u)}</span></div>)}</td>
                  <td className="nowrap small">{scope === 'open' ? fmtAge(i.created) : closedAtOf(i) ? fmtShortDate(i.done!.slice(0, 10)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <div className="mw-empty muted" style={{ margin: 16 }}>No off-path tickets{who || sys ? ' for this filter' : ''}.</div>}
          {list.length > 300 && <div className="small muted" style={{ padding: 12, textAlign: 'center' }}>Showing the first 300 of {list.length}.</div>}
        </div>
      </section>
    </div>
  );
}

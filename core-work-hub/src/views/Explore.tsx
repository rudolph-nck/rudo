// Ask: answer a question about tickets by building one sentence of dropdowns, or picking a ready-made question.
// Every answer is a chart (with a table view) and the tickets behind each bar.
import { useMemo, useState } from 'react';
import { useHub } from '../store/hub';
import { useUi } from '../components/actions';
import { ChartCard, GroupedColumns } from '../components/charts';
import { Icon, PriorityChip, SourceBadge } from '../components/ui';
import { DIM_LABEL, EVENT_LABEL, explore, MEASURE_LABEL, MEASURES_FOR, PRESETS, RANGE_LABEL, dimValue, type Dim, type Event, type Measure, type Query, type Range } from '../model/explore';
import { findPerson, fmtShortDate } from '../model/logic';
import { closedAtOf } from '../model/trends';
import { useNow } from './Notifications';

const FILTER_DIMS = ['owner', 'priority', 'bucket', 'department', 'subcategory', 'system', 'status', 'source'] as const;
const FILTER_LABEL: Record<(typeof FILTER_DIMS)[number], string> = { owner: 'Person', priority: 'Priority', bucket: 'Bucket', department: 'Department', subcategory: 'Category', system: 'System', status: 'Status', source: 'Source' };

export function Explore() {
  const { state } = useHub();
  const { openItem } = useUi();
  const now = useNow(10 * 60_000);
  const [q, setQ] = useState<Query>(PRESETS[0].query);
  const [drill, setDrill] = useState<string | null>(null);
  const a = useMemo(() => explore(state, q, now), [state, q, now]);
  const set = (p: Partial<Query>) => { setDrill(null); setQ((x) => { const n = { ...x, ...p }; if (!MEASURES_FOR[n.event].includes(n.measure)) n.measure = 'count'; return n; }); };

  // Filter choices: values present in the data.
  const choices = useMemo(() => {
    const m: Record<string, Map<string, string>> = {};
    for (const d of FILTER_DIMS) m[d] = new Map();
    for (const i of state.items.values()) {
      if (i.stale) continue;
      for (const d of FILTER_DIMS) { const v = dimValue(state, i, d, new Date(i.created)); if (!m[d].has(v.key)) m[d].set(v.key, v.label); }
    }
    return m;
  }, [state]);

  const drillRow = drill ? a.rows.find((r) => r.key === drill) : undefined;
  const ids = drillRow ? drillRow.ids : [];
  const drillItems = ids.map((id) => state.items.get(id)!).filter(Boolean).slice(0, 300);
  const fmtVal = (v: number) => (a.unit === 'days' ? `${v} days` : a.unit === '% on time' ? `${v}%` : String(v));
  const top = a.time ? a.rows : a.rows.slice(0, 15);
  const preset = PRESETS.find((p) => JSON.stringify(p.query) === JSON.stringify({ ...q, where: q.where && Object.values(q.where).some(Boolean) ? q.where : undefined }));
  const activeWhere = Object.entries(q.where ?? {}).filter(([, v]) => v);

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1>Ask</h1>
          <div className="sub">Pick a question, or build your own from the sentence below. Click any bar or row to see the tickets behind it.</div>
        </div>
      </div>

      <div className="ask-presets" role="group" aria-label="Common questions">
        {PRESETS.map((p) => (
          <button key={p.q} aria-pressed={preset === p} className={`ask-chip ${preset === p ? 'on' : ''}`} onClick={() => { setDrill(null); setQ(p.query); }}>{p.q}</button>
        ))}
      </div>

      <section className="panel ask-builder" aria-label="Build a question">
        <div className="ask-sentence">
          <span className="ask-word">Show</span>
          <select className="input" value={q.measure} onChange={(e) => set({ measure: e.target.value as Measure })} aria-label="Measure">
            {MEASURES_FOR[q.event].map((m) => <option key={m} value={m}>{MEASURE_LABEL[m].toLowerCase()}</option>)}
          </select>
          <select className="input" value={q.event} onChange={(e) => set({ event: e.target.value as Event })} aria-label="Which tickets">
            {(Object.keys(EVENT_LABEL) as Event[]).map((k) => <option key={k} value={k}>{EVENT_LABEL[k]}</option>)}
          </select>
          <select className="input" value={q.by} onChange={(e) => set({ by: e.target.value as Dim })} aria-label="Group by">
            {(Object.keys(DIM_LABEL) as Dim[]).map((k) => <option key={k} value={k}>{DIM_LABEL[k]}</option>)}
          </select>
          {q.event !== 'open_now' && (
            <select className="input" value={q.range} onChange={(e) => set({ range: e.target.value as Range })} aria-label="When">
              {(Object.keys(RANGE_LABEL) as Range[]).map((k) => <option key={k} value={k}>{RANGE_LABEL[k]}</option>)}
            </select>
          )}
        </div>
        <div className="ask-where">
          <span className="ask-word small">Only</span>
          {FILTER_DIMS.map((d) => (
            <select key={d} className={`input ${q.where?.[d] ? 'on' : ''}`} value={q.where?.[d] ?? ''} onChange={(e) => set({ where: { ...(q.where ?? {}), [d]: e.target.value || undefined } })} aria-label={`Only ${FILTER_LABEL[d]}`}>
              <option value="">Any {FILTER_LABEL[d].toLowerCase()}</option>
              {[...choices[d]].sort((x, y) => x[1].localeCompare(y[1])).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          ))}
          {activeWhere.length > 0 && <button className="btn sm ghost" onClick={() => set({ where: undefined })}>Clear</button>}
        </div>
      </section>

      <div className="ask-answer">
        <div className="ask-total">
          <span className="n">{fmtVal(a.total)}</span>
          <span className="small muted">{a.sentence}{activeWhere.length ? `, only ${activeWhere.map(([k, v]) => choices[k]?.get(v!) ?? v).join(', ')}` : ''}{a.unit !== 'tickets' ? ` · from ${a.ids.length} tickets` : ''}</span>
        </div>
      </div>

      {a.rows.length ? (
        <ChartCard
          wide
          title={a.sentence.charAt(0).toUpperCase() + a.sentence.slice(1)}
          sub={!a.time && a.rows.length > 15 ? `Top 15 of ${a.rows.length}. The table shows all.` : 'Click a bar for the tickets behind it.'}
          table={{ head: [q.by === 'none' ? '' : DIM_LABEL[q.by].replace(/^by /, '').replace(/^./, (c) => c.toUpperCase()), a.unit === 'tickets' ? 'Tickets' : MEASURE_LABEL[q.measure], ...(a.unit === 'tickets' ? [] : ['Tickets'])], rows: a.rows.map((r) => [r.label, r.value, ...(a.unit === 'tickets' ? [] : [r.n])]) }}
        >
          {a.time ? (
            <GroupedColumns
              data={top.map((r) => ({ label: r.label, tip: r.label, values: { v: r.value } }))}
              series={[{ key: 'v', label: a.unit === 'tickets' ? 'Tickets' : MEASURE_LABEL[q.measure], color: 'var(--accent)' }]}
              label={a.sentence}
              onBar={(k) => setDrill(top[k].n ? (drill === top[k].key ? null : top[k].key) : null)}
              selected={top.findIndex((r) => r.key === drill)}
            />
          ) : (
            <ul className="ask-bars">
              {top.map((r) => (
                <li key={r.key}>
                  <button className={`ask-bar ${drill === r.key ? 'on' : ''}`} onClick={() => setDrill(drill === r.key ? null : r.key)} aria-pressed={drill === r.key}>
                    <span className="lbl">{r.label}</span>
                    <span className="track"><span style={{ width: `${(r.value / Math.max(1, ...top.map((x) => x.value))) * 100}%` }} /></span>
                    <span className="val">{fmtVal(r.value)}{a.unit !== 'tickets' && <span className="muted"> · {r.n}</span>}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      ) : (
        <div className="panel mw-empty muted">No tickets match this question.</div>
      )}

      {drillRow && (
        <section className="panel" aria-labelledby="drill-h">
          <div className="panel-head">
            <h2 id="drill-h" className="grow">{drillRow.label}: {drillRow.n} ticket{drillRow.n === 1 ? '' : 's'}</h2>
            {drillRow.n > drillItems.length && <span className="small muted">Showing the first {drillItems.length}</span>}
            <button className="btn sm ghost" onClick={() => setDrill(null)}><Icon name="x" size={16} /> Close</button>
          </div>
          <div className="table-wrap">
            <table className="table tk-table">
              <thead><tr><th>Ticket</th><th>Title</th><th>Status</th><th>Priority</th><th>Owner</th><th>Opened</th><th>Closed</th></tr></thead>
              <tbody>
                {drillItems.map((i) => (
                  <tr key={i.id}>
                    <td className="nowrap"><SourceBadge item={i} /></td>
                    <td><button className="linkish strong tk-title" onClick={() => openItem(i.id)}>{i.title}</button></td>
                    <td className="small">{i.source_status}</td>
                    <td>{i.priority ? <PriorityChip p={i.priority} /> : <span className="muted">—</span>}</td>
                    <td className="small">{findPerson(state.config, i.owner)?.name ?? i.source_owner ?? '—'}</td>
                    <td className="nowrap small">{fmtShortDate(i.created.slice(0, 10))} {new Date(i.created).getFullYear()}</td>
                    <td className="nowrap small">{closedAtOf(i) ? `${fmtShortDate(i.done!.slice(0, 10))} ${new Date(i.done!).getFullYear()}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useHub } from '../store/hub';
import { useUi } from '../components/actions';
import { Avatar, download, Icon } from '../components/ui';
import { describeEvent } from '../components/describe';
import { findPerson, todayISO } from '../model/logic';
import { toCsv } from '../model/csv';

export function Audit() {
  const { state, problems } = useHub();
  const { openItem } = useUi();
  const cfg = state.config;
  const [who, setWho] = useState('');
  const [q, setQ] = useState('');
  const [onlyRejected, setOnlyRejected] = useState(false);
  const [limit, setLimit] = useState(200);
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return [...state.audit]
      .reverse()
      .filter((a) => (!who || a.file === who) && (!onlyRejected || a.rejected))
      .filter((a) => {
        if (!ql) return true;
        const it = 'item' in a.event && a.event.item ? state.items.get(a.event.item) : undefined;
        return (it?.title ?? '').toLowerCase().includes(ql) || describeEvent(a.event, cfg).toLowerCase().includes(ql);
      });
  }, [state.audit, state.items, who, q, onlyRejected, cfg]);
  const name = (u?: string) => findPerson(cfg, u)?.name ?? u ?? '';

  const exportCsv = () =>
    download(
      `core-hub-audit-${todayISO()}.csv`,
      toCsv([
        ['ts', 'file', 'user_field', 'type', 'item', 'title', 'description', 'before', 'data', 'rejected'],
        ...state.audit.map((a) => {
          const it = 'item' in a.event && a.event.item ? state.items.get(a.event.item) : undefined;
          return [a.event.ts, a.file, a.event.user, a.event.type, 'item' in a.event ? a.event.item : '', it?.title, describeEvent(a.event, cfg), JSON.stringify(a.event.before ?? {}), JSON.stringify(a.event.data), a.rejected];
        }),
      ]),
    );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
          <div className="sub">Every change: who, what, when, before and after. Read straight from the append-only change files.</div>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={exportCsv}><Icon name="download" /> Export CSV</button>
        </div>
      </div>
      {problems.length > 0 && (
        <div className="banner error" role="alert">
          <div>{problems.slice(0, 5).map((p) => <div key={p}>{p}</div>)}</div>
        </div>
      )}
      {state.conflicts.length > 0 && (
        <section className="panel" aria-labelledby="cf">
          <div className="panel-head"><h2 id="cf">Sync conflicts ({state.conflicts.length})</h2><span className="small muted">Service Desk changed a field after the hub did; the source value was kept.</span></div>
          <table className="table">
            <thead><tr><th>When</th><th>Item</th><th>Field</th><th>Hub value</th><th>Source value (kept)</th></tr></thead>
            <tbody>
              {state.conflicts.map((c) => (
                <tr key={c.item + c.field + c.ts}>
                  <td>{new Date(c.ts).toLocaleString()}</td>
                  <td><button className="btn ghost sm" onClick={() => openItem(c.item)}>{state.items.get(c.item)?.title ?? c.item}</button></td>
                  <td>{c.field}</td>
                  <td>{c.field === 'owner' ? name(String(c.hubValue ?? '')) : String(c.hubValue ?? '—')} <span className="muted">({name(c.hubUser)})</span></td>
                  <td>{c.field === 'owner' ? name(String(c.sourceValue ?? '')) : String(c.sourceValue ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <div className="filters">
        <select aria-label="Filter by person" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Everyone</option>
          {cfg.people.map((p) => <option key={p.username} value={p.username}>{p.name}</option>)}
        </select>
        <input className="input" style={{ maxWidth: 280, minHeight: 40 }} aria-label="Search" placeholder="Search title or change" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="toggle"><input type="checkbox" checked={onlyRejected} onChange={(e) => setOnlyRejected(e.target.checked)} />Only ignored changes</label>
        <span className="muted small">{rows.length} changes</span>
      </div>
      <section className="panel table-wrap">
        <table className="table">
          <thead><tr><th>When</th><th>Who</th><th>Item</th><th>Change</th></tr></thead>
          <tbody>
            {rows.slice(0, limit).map((a) => {
              const it = 'item' in a.event && a.event.item ? state.items.get(a.event.item) : undefined;
              return (
                <tr key={a.event.id + a.file}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(a.event.ts).toLocaleString()}</td>
                  <td><div className="row"><Avatar user={a.file} config={cfg} />{name(a.file)}</div></td>
                  <td style={{ maxWidth: 280 }}>{it ? <button className="btn ghost sm" style={{ whiteSpace: 'normal', textAlign: 'left', padding: '0 4px' }} onClick={() => openItem(it.id)}>{it.title}</button> : <span className="muted">—</span>}</td>
                  <td>
                    {describeEvent(a.event, cfg)}
                    {a.rejected && <span className="chip bad" style={{ marginLeft: 6 }}>Ignored: {a.rejected}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length > limit && <div style={{ padding: 12, textAlign: 'center' }}><button className="btn" onClick={() => setLimit((l) => l + 300)}>Show more</button></div>}
      </section>
    </div>
  );
}

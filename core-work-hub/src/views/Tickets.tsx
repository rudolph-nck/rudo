// All tickets: every ticket and work item, open and closed, with filters, sortable columns, paging and CSV export.
import { useMemo, useState } from 'react';
import { useHub } from '../store/hub';
import { useUi } from '../components/actions';
import { Avatar, download, Icon, PriorityChip, SourceBadge } from '../components/ui';
import { findPerson, fmtShortDate } from '../model/logic';
import { COLUMN_LABEL, type Bucket, type Priority, type WorkItem } from '../model/types';

type Show = 'open' | 'closed' | 'all';
type SortKey = 'id' | 'title' | 'status' | 'priority' | 'owner' | 'created' | 'closed' | 'age';
type Since = 'any' | 'week' | 'month' | 'quarter' | 'year';
const PAGE = 100;
const PRI_RANK: Record<string, number> = { P1: 1, P2: 2, P3: 3, P4: 4 };
const isClosed = (i: WorkItem) => i.column === 'Done' || !!i.sourceClosed;
const day = 864e5;

function sinceDate(s: Since, now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (s === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  else if (s === 'month') d.setDate(1);
  else if (s === 'quarter') { d.setDate(1); d.setMonth(d.getMonth() - (d.getMonth() % 3)); }
  else if (s === 'year') d.setMonth(0, 1);
  else return undefined;
  return d;
}

export function Tickets() {
  const { state } = useHub();
  const { openItem } = useUi();
  const cfg = state.config;
  const [show, setShow] = useState<Show>('open');
  const [source, setSource] = useState('');
  const [bucket, setBucket] = useState<Bucket | ''>('');
  const [pri, setPri] = useState<Priority | 'none' | ''>('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState('');
  const [since, setSince] = useState<Since>('any');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'created', dir: -1 });
  const [limit, setLimit] = useState(PAGE);
  const now = new Date();

  const all = useMemo(() => [...state.items.values()].filter((i) => !i.stale), [state]);
  const name = (u?: string) => (u ? findPerson(cfg, u)?.name ?? u : '');
  const ownerName = (i: WorkItem) => name(i.owner) || i.source_owner || '';
  const closedAt = (i: WorkItem) => (isClosed(i) ? i.done : undefined);
  const ageDays = (i: WorkItem) => Math.max(0, Math.floor(((closedAt(i) ? new Date(closedAt(i)!) : now).getTime() - new Date(i.created).getTime()) / day));

  const counts = { open: all.filter((i) => !isClosed(i)).length, closed: all.filter(isClosed).length, all: all.length };
  const sources = [...new Set(all.map((i) => i.source))].sort();
  const owners = [...new Set(all.map((i) => i.owner).filter(Boolean) as string[])].sort((a, b) => name(a).localeCompare(name(b)));

  // Everything but the status filter, so the status list shows what's available for the other filters.
  const base = all.filter((i) => {
    if (show === 'open' && isClosed(i)) return false;
    if (show === 'closed' && !isClosed(i)) return false;
    if (source && i.source !== source) return false;
    if (bucket && i.bucket !== bucket) return false;
    if (pri === 'none' ? !!i.priority : pri && i.priority !== pri) return false;
    if (owner && i.owner !== owner) return false;
    const from = sinceDate(since, now);
    if (from) {
      const at = show === 'open' ? i.created : closedAt(i) ?? i.created;
      if (new Date(at) < from) return false;
    }
    if (q) {
      const hay = `${i.source_id ?? ''} ${i.title} ${i.requester ?? ''} ${i.source_owner ?? ''} ${i.department ?? ''} ${i.subcategory ?? ''}`.toLowerCase();
      if (!q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  const statusCounts = new Map<string, number>();
  for (const i of base) statusCounts.set(i.source_status || '—', (statusCounts.get(i.source_status || '—') ?? 0) + 1);
  const rows = (status ? base.filter((i) => (i.source_status || '—') === status) : base).sort((a, b) => {
    const k = sort.key;
    const v = (i: WorkItem): string | number =>
      k === 'id' ? Number(String(i.source_id ?? '').replace(/\D/g, '')) || 0
      : k === 'title' ? i.title.toLowerCase()
      : k === 'status' ? `${Number(isClosed(i))}${i.source_status ?? ''}`.toLowerCase()
      : k === 'priority' ? PRI_RANK[i.priority ?? ''] ?? 9
      : k === 'owner' ? ownerName(i).toLowerCase() || '~'
      : k === 'closed' ? closedAt(i) ?? ''
      : k === 'age' ? ageDays(i)
      : i.created;
    const x = v(a), y = v(b);
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || b.created.localeCompare(a.created);
  });

  const head = (key: SortKey, label: string) => (
    <th aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className="th-sort" onClick={() => { setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'created' || key === 'closed' || key === 'age' ? -1 : 1 })); setLimit(PAGE); }}>
        {label}<span aria-hidden className="arrow">{sort.key === key ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const cols = ['Source', 'ID', 'Title', 'Open/Closed', 'Hub column', 'Source status', 'Priority', 'Bucket', 'Owner', 'Requester', 'Department', 'Opened', 'Closed', 'Days open'];
    const lines = rows.map((i) => [i.source === 'SD' ? 'Service Desk' : i.source, i.source_id, i.title, isClosed(i) ? 'Closed' : 'Open', COLUMN_LABEL[i.column], i.source_status, i.priority, i.bucket, ownerName(i), i.requester, i.department, i.created.slice(0, 10), closedAt(i)?.slice(0, 10), ageDays(i)].map(esc).join(','));
    download(`tickets-${show}-${new Date().toISOString().slice(0, 10)}.csv`, [cols.join(','), ...lines].join('\n'));
  };
  const reset = () => { setSource(''); setBucket(''); setPri(''); setOwner(''); setStatus(''); setSince('any'); setQ(''); setLimit(PAGE); };
  const filtered = !!(source || bucket || pri || owner || status || since !== 'any' || q);
  const set = <T,>(f: (v: T) => void) => (v: T) => { f(v); setLimit(PAGE); };

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1>All tickets</h1>
          <div className="sub">Every ticket and work item the hub knows about, open and closed. Click a column to sort; click a ticket for its details.</div>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={exportCsv} disabled={!rows.length}><Icon name="download" size={16} /> Export CSV</button>
        </div>
      </div>

      <div className="tk-bar">
        <div className="seg" role="radiogroup" aria-label="Open or closed">
          {(['open', 'closed', 'all'] as Show[]).map((s) => (
            <button key={s} role="radio" aria-checked={show === s} onClick={() => { setShow(s); setStatus(''); setLimit(PAGE); if (s === 'closed' && sort.key === 'created') setSort({ key: 'closed', dir: -1 }); if (s === 'open' && sort.key === 'closed') setSort({ key: 'created', dir: -1 }); }}>
              {s === 'open' ? 'Open' : s === 'closed' ? 'Closed' : 'All'} <span className="muted">{counts[s].toLocaleString()}</span>
            </button>
          ))}
        </div>
        <label className="mw-search">
          <Icon name="search" size={16} />
          <input className="input" placeholder="Search number, title, requester, department" value={q} onChange={(e) => set(setQ)(e.target.value)} aria-label="Search tickets" />
        </label>
      </div>

      <section className="panel" aria-label="Tickets">
        <div className="tk-filters">
          <select className="input" value={status} onChange={(e) => set(setStatus)(e.target.value)} aria-label="Status">
            <option value="">Any status</option>
            {[...statusCounts].sort((a, b) => b[1] - a[1]).map(([s, n]) => <option key={s} value={s}>{s} ({n})</option>)}
          </select>
          <select className="input" value={source} onChange={(e) => set(setSource)(e.target.value)} aria-label="Source">
            <option value="">Any source</option>
            {sources.map((s) => <option key={s} value={s}>{s === 'SD' ? 'Service Desk' : s}</option>)}
          </select>
          <select className="input" value={pri} onChange={(e) => set(setPri)(e.target.value as Priority | 'none' | '')} aria-label="Priority">
            <option value="">Any priority</option>
            {['P1', 'P2', 'P3', 'P4'].map((p) => <option key={p} value={p}>{p}</option>)}
            <option value="none">No priority</option>
          </select>
          <select className="input" value={bucket} onChange={(e) => set(setBucket)(e.target.value as Bucket | '')} aria-label="Bucket">
            <option value="">Any bucket</option>
            <option value="Project">Project</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Support">Support</option>
          </select>
          <select className="input" value={owner} onChange={(e) => set(setOwner)(e.target.value)} aria-label="Owner">
            <option value="">Anyone</option>
            {owners.map((u) => <option key={u} value={u}>{name(u)}</option>)}
          </select>
          <select className="input" value={since} onChange={(e) => set(setSince)(e.target.value as Since)} aria-label="Date range">
            <option value="any">{show === 'open' ? 'Opened any time' : show === 'closed' ? 'Closed any time' : 'Any time'}</option>
            <option value="week">{show === 'open' ? 'Opened' : 'Closed'} this week</option>
            <option value="month">{show === 'open' ? 'Opened' : 'Closed'} this month</option>
            <option value="quarter">{show === 'open' ? 'Opened' : 'Closed'} this quarter</option>
            <option value="year">{show === 'open' ? 'Opened' : 'Closed'} this year</option>
          </select>
          <span className="small muted tk-count">{rows.length.toLocaleString()} {rows.length === 1 ? 'ticket' : 'tickets'}</span>
          {filtered && <button className="btn sm ghost" onClick={reset}>Clear filters</button>}
        </div>
        <div className="table-wrap">
          <table className="table tk-table">
            <thead>
              <tr>
                {head('id', 'Ticket')}
                {head('title', 'Title')}
                {head('status', 'Status')}
                {head('priority', 'Priority')}
                {head('owner', 'Owner')}
                {head('created', 'Opened')}
                {head('closed', 'Closed')}
                {head('age', show === 'closed' ? 'Took' : 'Age')}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((i) => {
                const c = isClosed(i);
                const age = ageDays(i);
                return (
                  <tr key={i.id} className={c ? 'closed' : ''}>
                    <td className="nowrap"><SourceBadge item={i} /></td>
                    <td><button className="linkish strong tk-title" onClick={() => openItem(i.id)}>{i.title}</button>{(i.requester || i.department) && <div className="small muted">{[...new Set([i.requester, i.department].filter(Boolean))].join(' · ')}</div>}</td>
                    <td>
                      <span className={`chip ${c ? 'ok' : 'src'}`}>{c ? 'Closed' : COLUMN_LABEL[i.column]}</span>
                      {i.source_status && <div className="small muted">{i.source_status}</div>}
                    </td>
                    <td>{i.priority ? <PriorityChip p={i.priority} /> : <span className="muted">—</span>}</td>
                    <td>{i.owner ? <div className="row nowrap" style={{ gap: 6 }}><Avatar user={i.owner} config={cfg} />{name(i.owner)}</div> : <span className="muted">{i.source_owner || 'No owner'}</span>}</td>
                    <td className="nowrap">{fmtShortDate(i.created.slice(0, 10))}<div className="small muted">{new Date(i.created).getFullYear()}</div></td>
                    <td className="nowrap">{closedAt(i) ? <>{fmtShortDate(closedAt(i)!.slice(0, 10))}<div className="small muted">{new Date(closedAt(i)!).getFullYear()}</div></> : <span className="muted">—</span>}</td>
                    <td className="nowrap">{age < 1 ? (c ? 'Under a day' : 'Today') : `${age} day${age === 1 ? '' : 's'}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && <div className="mw-empty muted" style={{ margin: 16 }}>No tickets match.</div>}
        </div>
        {rows.length > limit && (
          <div className="tk-more">
            <span className="small muted">Showing {limit.toLocaleString()} of {rows.length.toLocaleString()}</span>
            <button className="btn sm" onClick={() => setLimit((l) => l + PAGE * 2)}>Show more</button>
            <button className="btn sm ghost" onClick={() => setLimit(rows.length)}>Show all</button>
          </div>
        )}
      </section>
    </div>
  );
}

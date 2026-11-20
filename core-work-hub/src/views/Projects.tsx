// Projects: every project in one list, from intake to done: status, owner, team score, progress and dates.
import { useMemo, useState } from 'react';
import { useHub } from '../store/hub';
import { useUi } from '../components/actions';
import { Avatar, download, Icon, PriorityChip, SourceBadge } from '../components/ui';
import { findPerson, fmtShortDate, ownerList } from '../model/logic';
import { computeTeamScore, criteriaOf, teamBoard } from '../model/teamscore';
import { COLUMN_LABEL, type Column, type WorkItem } from '../model/types';

type Show = 'active' | 'open' | 'done' | 'all';
const ORDER: Column[] = ['Doing', 'Ready', 'To Do', 'On Hold', 'Waiting', 'Intake', 'Done'];
const isProj = (i: WorkItem) => !i.stale && !i.parent_id && (i.bucket === 'Project' || (!i.bucket && i.suggested_bucket === 'Project'));
const closedItem = (i: WorkItem) => i.column === 'Done' || !!i.sourceClosed;

export function Projects() {
  const { state } = useHub();
  const { openItem } = useUi();
  const cfg = state.config;
  const [show, setShow] = useState<Show>('open');
  const [owner, setOwner] = useState('');
  const [q, setQ] = useState('');
  const criteria = criteriaOf(cfg);
  const positions = useMemo(() => new Map(teamBoard(state).scored.map((r) => [r.item.id, r.position])), [state]);
  const all = useMemo(() => [...state.items.values()].filter(isProj), [state]);
  const kids = useMemo(() => {
    const m = new Map<string, WorkItem[]>();
    for (const i of state.items.values()) if (i.parent_id && !i.stale) m.set(i.parent_id, [...(m.get(i.parent_id) ?? []), i]);
    return m;
  }, [state]);

  const counts = {
    active: all.filter((i) => i.column === 'Doing').length,
    next: all.filter((i) => i.column === 'To Do' || i.column === 'Ready').length,
    paused: all.filter((i) => i.column === 'On Hold' || i.column === 'Waiting').length,
    intake: all.filter((i) => i.column === 'Intake').length,
    done: all.filter(closedItem).length,
  };
  const people = [...new Set(all.flatMap((i) => [i.owner, ...(i.source_owners ?? [])]).filter(Boolean) as string[])];

  const rows = all
    .filter((i) => (show === 'active' ? i.column === 'Doing' : show === 'open' ? !closedItem(i) : show === 'done' ? closedItem(i) : true))
    .filter((i) => !owner || i.owner === owner || ownerList(i.source_owners).includes(owner))
    .filter((i) => !q || `${i.title} ${i.source_id ?? ''} ${i.requester ?? ''} ${i.system ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .map((i) => {
      const sub = kids.get(i.id) ?? [];
      const done = sub.filter(closedItem).length;
      const ts = computeTeamScore(i, criteria).score;
      const col: Column = closedItem(i) ? 'Done' : i.column;
      return { i, sub, done, ts, col, pos: positions.get(i.id) };
    })
    .sort((a, b) => ORDER.indexOf(a.col) - ORDER.indexOf(b.col) || (a.pos ?? 999) - (b.pos ?? 999) || (a.i.rank ?? 999) - (b.i.rank ?? 999) || (b.i.done ?? '').localeCompare(a.i.done ?? '') || a.i.created.localeCompare(b.i.created));

  const name = (u?: string) => (u ? findPerson(cfg, u)?.name ?? u : '');
  const dueOf = (i: WorkItem) => i.commitment?.date ?? i.due_by?.slice(0, 10);
  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Project', 'Status', 'Source status', 'Owner', 'Priority', 'Team score', 'Team rank', 'Tasks done', 'Tasks', 'Started', 'Due', 'Done', 'Source', 'Source ID'];
    const lines = rows.map(({ i, sub, done, ts, col, pos }) => [i.title, COLUMN_LABEL[col], i.source_status, name(i.owner) || i.source_owner, i.priority, ts, pos, done, sub.length, i.started?.slice(0, 10), dueOf(i), i.done?.slice(0, 10), i.source, i.source_id].map(esc).join(','));
    download(`projects-${new Date().toISOString().slice(0, 10)}.csv`, [head.join(','), ...lines].join('\n'));
  };

  const tiles: [Show, string, number, string][] = [
    ['active', 'In progress', counts.active, 'In Doing now'],
    ['open', 'Open', all.length - counts.done, `${counts.next} up next · ${counts.paused} on hold or waiting · ${counts.intake} not graded`],
    ['done', 'Done', counts.done, 'Finished projects'],
    ['all', 'All projects', all.length, 'Open and done'],
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1>Projects</h1>
          <div className="sub">Every project in one list, from Intake to Done: who owns it, where it is, its team score and how far along it is.</div>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={exportCsv} disabled={!rows.length}><Icon name="download" size={16} /> Export CSV</button>
        </div>
      </div>

      <div className="mw-tiles pj-tiles" role="group" aria-label="Show">
        {tiles.map(([k, label, n, sub]) => (
          <button key={k} className="mw-tile" aria-pressed={show === k} onClick={() => setShow(k)}>
            <span className="t">{label}</span>
            <span className="n">{n}</span>
            <span className="d">{sub}</span>
          </button>
        ))}
      </div>

      <section className="panel" aria-label="Projects">
        <div className="mw-filters" style={{ padding: '14px 16px' }}>
          <select className="input" style={{ width: 200, minHeight: 40 }} value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">
            <option value="">Everyone</option>
            {people.sort((a, b) => name(a).localeCompare(name(b))).map((u) => <option key={u} value={u}>{name(u)}</option>)}
          </select>
          <label className="mw-search">
            <Icon name="search" size={16} />
            <input className="input" placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search projects" />
          </label>
          <span className="small muted">{rows.length} shown</span>
        </div>
        <div className="table-wrap">
          <table className="table pj-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Status</th>
                <th>Owner</th>
                <th title="Team score (rank among open projects)">Team score</th>
                <th>Progress</th>
                <th>Started</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ i, sub, done, ts, col, pos }) => (
                <tr key={i.id}>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <PriorityChip p={i.priority} />
                      <SourceBadge item={i} />
                      {i.expedite && <span className="chip bad">Drop everything</span>}
                    </div>
                    <button className="linkish strong" onClick={() => openItem(i.id)}>{i.title}</button>
                  </td>
                  <td>
                    <span className={`chip pj-col ${col.replace(/\s/g, '').toLowerCase()}`}>{col === 'Intake' ? 'Not graded' : COLUMN_LABEL[col]}</span>
                    {i.source_status && <div className="small muted">{i.source === 'SD' ? 'Service Desk' : i.source}: {i.source_status}</div>}
                    {i.hold && col !== 'Done' && <div className="small muted" title={i.hold.reason}>{i.hold.reason.length > 60 ? i.hold.reason.slice(0, 60) + '…' : i.hold.reason}</div>}
                  </td>
                  <td>
                    {i.owner ? <div className="row" style={{ gap: 6 }}><Avatar user={i.owner} config={cfg} />{name(i.owner)}</div> : <span className="muted">{i.source_owner || 'No owner'}</span>}
                  </td>
                  <td>{ts !== undefined ? <><strong>{ts}</strong>{pos ? <span className="small muted"> · #{pos}</span> : null}</> : <span className="muted">—</span>}</td>
                  <td>
                    {sub.length ? (
                      <div className="pj-prog" title={`${done} of ${sub.length} tasks done`}>
                        <span className="bar"><span style={{ width: `${(done / sub.length) * 100}%` }} /></span>
                        <span className="small muted">{done}/{sub.length}</span>
                      </div>
                    ) : col === 'Done' ? <span className="small muted">Done {fmtShortDate(i.done?.slice(0, 10))}</span> : <span className="muted">—</span>}
                  </td>
                  <td>{i.started ? fmtShortDate(i.started.slice(0, 10)) : <span className="muted">—</span>}</td>
                  <td>{dueOf(i) ? <span className={col !== 'Done' && dueOf(i)! < new Date().toISOString().slice(0, 10) ? 'danger-text' : ''}>{i.commitment ? 'Promised ' : ''}{fmtShortDate(dueOf(i))}</span> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <div className="mw-empty muted" style={{ margin: 16 }}>No projects match.</div>}
        </div>
      </section>
    </div>
  );
}

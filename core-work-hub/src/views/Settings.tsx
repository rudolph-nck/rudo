import { useState } from 'react';
import { useHub } from '../store/hub';
import { Avatar, download, Icon, toast } from '../components/ui';
import { analysts, assignable, findPerson, personForSourceName, personWipLimit } from '../model/logic';
import { isStatus } from '../model/replay';
import { importTicketsCsv, mergeSnapshot, type CsvImportResult } from '../model/csv';
import { BUCKETS, BUCKET_LABEL, type Bucket, type Source, type SystemOwnership } from '../model/types';
import { DemoStore } from '../store/storage';

function DataImport() {
  const { state, me, role, readOnly, writeSnapshot, store, commit } = useHub();
  const [source, setSource] = useState<Source>('SD');
  const [tpl, setTpl] = useState(() => localStorage.getItem('cwh.urlTpl.SD') ?? state.config.ticketUrls.SD ?? '');
  const [res, setRes] = useState<CsvImportResult>();
  const snap = state.snapshot;
  const manager = role === 'manager' && !readOnly;
  return (
    <section className="panel" aria-labelledby="data-h">
      <div className="panel-head"><h2 id="data-h" className="grow">Ticket data</h2></div>
      <div className="modal-body">
        <dl className="kv">
          <dt>Folder</dt><dd>{store.label}</dd>
          <dt>tickets.json</dt>
          <dd>{snap ? `${snap.items.length} items · ${snap.mode} · written ${new Date(snap.generatedAt).toLocaleString()} by ${snap.generatedBy}` : 'Not found yet. Import a CSV or run the sync script.'}</dd>
        </dl>
        {manager ? (
          <>
            <p className="muted" style={{ margin: 0 }}>
              Phase 0: export open Core requests (plus requests closed in the last 90 days) from Service Desk as CSV and import them here.
              Only metadata is kept: ID, subject, requester, status, priority, technician, group, dates. Descriptions are dropped and card or account numbers in subjects are masked.
            </p>
            <div className="grid2">
              <label className="field">
                <span>Source</span>
                <select className="input" value={source} onChange={(e) => { const s = e.target.value as Source; setSource(s); setTpl(localStorage.getItem('cwh.urlTpl.' + s) ?? (s === 'Wrike' ? 'https://www.wrike.com/open.htm?id={id}' : tpl)); }}>
                  <option value="SD">Service Desk Plus export</option>
                  <option value="Wrike">Wrike export</option>
                </select>
              </label>
              <label className="field">
                <span>Link pattern ({'{id}'} = INC-79744, {'{num}'} = 79744)</span>
                <input className="input" value={tpl} onChange={(e) => setTpl(e.target.value)} />
              </label>
            </div>
            <label className="field">
              <span>CSV file</span>
              <input
                className="input"
                type="file"
                accept=".csv,text/csv"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setRes(importTicketsCsv(await f.text(), source, { urlTemplate: tpl, isClosed: (st) => isStatus(state.config.closedStatuses, st) }));
                }}
              />
            </label>
            {res && (
              <div className="stack">
                <div className={`banner ${res.tickets.length ? 'info' : 'error'}`}>
                  {res.tickets.length} tickets ready ({res.tickets.filter((t) => !isStatus(state.config.closedStatuses, t.source_status)).length} open, the rest closed in the last 90 days)
                  {res.skippedOldClosed ? `; ${res.skippedOldClosed} older closed tickets left out` : ''}. Columns matched: {Object.entries(res.columns).map(([k, v]) => `${v} → ${k}`).join(', ') || 'none'}.
                </div>
                <TechnicianMap tickets={res.tickets} onSave={async (pairs) => { if (await commit(pairs.map(([username, sdName]) => ({ type: 'config.person', data: { username, sdName } })))) toast('Technician names saved.'); }} />
                {res.warnings.length > 0 && <div className="banner warn"><div>{res.warnings.slice(0, 6).map((w) => <div key={w}>{w}</div>)}{res.warnings.length > 6 && <div>…and {res.warnings.length - 6} more</div>}</div></div>}
                <div className="row">
                  <button
                    className="btn primary"
                    disabled={!res.tickets.length}
                    onClick={async () => {
                      try { localStorage.setItem('cwh.urlTpl.' + source, tpl); } catch { /* ignore */ }
                      await writeSnapshot(mergeSnapshot(state.snapshot, res.tickets, source, me, 'csv'));
                      toast(`tickets.json updated with ${res.tickets.length} ${source} items.`);
                      setRes(undefined);
                    }}
                  >
                    <Icon name="upload" /> Replace {source} items in tickets.json
                  </button>
                  <span className="small muted">Items missing from this export stay on the board only if the hub created them.</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>Nick imports ticket data. The sync script refreshes it every 15 minutes once Phase 1 is live.</p>
        )}
        {store instanceof DemoStore && (
          <div className="row">
            <button className="btn danger" onClick={() => { if (confirm('Reset all demo data in this browser?')) { store.reset(); location.reload(); } }}>Reset demo data</button>
          </div>
        )}
      </div>
    </section>
  );
}

/** Service Desk technician -> hub person. Prefilled by name matching; Nick confirms or corrects. */
function TechnicianMap({ tickets, onSave }: { tickets: { source_owner?: string; source_status: string }[]; onSave: (pairs: [string, string][]) => void }) {
  const { state } = useHub();
  const cfg = state.config;
  const counts = new Map<string, number>();
  tickets.forEach((t) => t.source_owner && !isStatus(cfg.closedStatuses, t.source_status) && counts.set(t.source_owner, (counts.get(t.source_owner) ?? 0) + 1));
  tickets.forEach((t) => t.source_owner && !counts.has(t.source_owner) && counts.set(t.source_owner, 0));
  const names = [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
  const [map, setMap] = useState<Record<string, string>>(() => Object.fromEntries(names.map((n) => [n, personForSourceName(cfg, n)?.username ?? ''])));
  if (!names.length) return null;
  const people = assignable(cfg);
  return (
    <div className="panel" style={{ boxShadow: 'none' }}>
      <div className="panel-head">
        <h3 className="grow">Service Desk technicians</h3>
        <span className="small muted">Service Desk assigns the work. Match each technician to a hub person, or leave “Not on the hub”.</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Technician in Service Desk</th><th className="num">Open tickets</th><th>Hub person</th></tr></thead>
          <tbody>
            {names.map((n) => (
              <tr key={n}>
                <td>{n}</td>
                <td className="num">{counts.get(n) || ''}</td>
                <td>
                  <select className="input" aria-label={`Hub person for ${n}`} value={map[n] ?? ''} onChange={(e) => setMap({ ...map, [n]: e.target.value })}>
                    <option value="">Not on the hub</option>
                    {people.map((p) => <option key={p.username} value={p.username}>{p.name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ padding: 12 }}>
        <button
          className="btn"
          onClick={() => {
            const pairs = Object.entries(map).filter(([, u]) => u).map(([n, u]) => [u, n] as [string, string]);
            const dup = pairs.map(([u]) => u).find((u, i, a) => a.indexOf(u) !== i);
            if (dup) return toast(`${findPerson(cfg, dup)?.name} is matched to two technicians; pick one.`);
            onSave(pairs.filter(([u, n]) => findPerson(cfg, u)?.sdName !== n));
          }}
        >
          Save technician names
        </button>
      </div>
    </div>
  );
}

function WipSettings() {
  const { state, commit, role, readOnly } = useHub();
  const cfg = state.config;
  const edit = role === 'manager' && !readOnly;
  return (
    <section className="panel" aria-labelledby="wip-h">
      <div className="panel-head"><h2 id="wip-h" className="grow">WIP limits</h2><span className="small muted">Start at 1–2 items in Doing</span></div>
      <table className="table">
        <thead><tr><th>Analyst</th><th>Doing limit</th>{BUCKETS.map((b) => <th key={b}>{BUCKET_LABEL[b]} limit</th>)}</tr></thead>
        <tbody>
          {analysts(cfg).map((p) => (
            <tr key={p.username}>
              <td><div className="row"><Avatar user={p.username} config={cfg} />{p.name}</div></td>
              <td>
                <input className="input" style={{ width: 90 }} type="number" min={1} max={9} aria-label={`${p.name} Doing limit`} disabled={!edit} defaultValue={personWipLimit(cfg, p.username)}
                  onBlur={(e) => { const v = Number(e.target.value); if (v >= 1 && v !== personWipLimit(cfg, p.username)) void commit([{ type: 'config.person', data: { username: p.username, wipLimit: v } }]); }} />
              </td>
              {BUCKETS.map((b) => (
                <td key={b}>
                  <input className="input" style={{ width: 90 }} type="number" min={0} max={9} placeholder="—" aria-label={`${p.name} ${b} limit`} disabled={!edit} defaultValue={p.bucketWip?.[b] ?? ''}
                    onBlur={(e) => {
                      const v = e.target.value === '' ? undefined : Number(e.target.value);
                      if (v === p.bucketWip?.[b]) return;
                      const next = { ...(p.bucketWip ?? {}) } as Partial<Record<Bucket, number>>;
                      if (v === undefined) delete next[b]; else next[b] = v;
                      void commit([{ type: 'config.person', data: { username: p.username, bucketWip: next } }]);
                    }} />
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td><strong>Whole team</strong></td>
            <td className="muted small">per bucket →</td>
            {BUCKETS.map((b) => (
              <td key={b}>
                <input className="input" style={{ width: 90 }} type="number" min={0} max={30} placeholder="—" aria-label={`Team ${b} limit`} disabled={!edit} defaultValue={cfg.bucketWip[b] ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value === '' ? null : Number(e.target.value);
                    if ((v ?? undefined) === cfg.bucketWip[b]) return;
                    void commit([{ type: 'config.bucketWip', data: { [b]: v } as Partial<Record<Bucket, number>> }]);
                  }} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function SystemsSettings() {
  const { state, commit, role, readOnly } = useHub();
  const cfg = state.config;
  const edit = role === 'manager' && !readOnly;
  const people = assignable(cfg);
  const [draft, setDraft] = useState<SystemOwnership | null>(null);
  const PersonSel = ({ v, on, label }: { v?: string; on: (x?: string) => void; label: string }) => (
    <select className="input" aria-label={label} value={v ?? ''} onChange={(e) => on(e.target.value || undefined)}>
      <option value="">—</option>
      {people.map((p) => <option key={p.username} value={p.username}>{p.name}</option>)}
    </select>
  );
  return (
    <section className="panel" aria-labelledby="sys-h">
      <div className="panel-head"><h2 id="sys-h" className="grow">Ownership map</h2><span className="small muted">Grading suggests owners from this map, alternating primary and secondary.</span></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>System</th><th>SD sub-categories</th><th>Primary</th><th>Secondary</th><th>Third backup</th><th>Criticality</th><th><span className="sr-only">Edit</span></th></tr></thead>
          <tbody>
            {cfg.systems.map((s) =>
              draft?.id === s.id ? (
                <tr key={s.id}>
                  <td><input className="input" aria-label="System name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></td>
                  <td><input className="input" aria-label="Service Desk sub-categories, comma separated" placeholder="Symitar Quest, SymXchange" value={(draft.aliases ?? []).join(', ')} onChange={(e) => setDraft({ ...draft, aliases: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></td>
                  <td><PersonSel label="Primary" v={draft.primary} on={(x) => setDraft({ ...draft, primary: x })} /></td>
                  <td><PersonSel label="Secondary" v={draft.secondary} on={(x) => setDraft({ ...draft, secondary: x })} /></td>
                  <td><PersonSel label="Third backup" v={draft.third} on={(x) => setDraft({ ...draft, third: x })} /></td>
                  <td><select className="input" aria-label="Criticality" value={draft.criticality ?? ''} onChange={(e) => setDraft({ ...draft, criticality: (e.target.value || undefined) as SystemOwnership['criticality'] })}><option value="">—</option><option>High</option><option>Medium</option><option>Low</option></select></td>
                  <td className="row">
                    <button className="btn sm primary" onClick={async () => { if (await commit([{ type: 'config.system', data: draft }])) setDraft(null); }}>Save</button>
                    <button className="btn sm" onClick={() => setDraft(null)}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td className="small muted">{s.aliases?.join(', ') || '—'}</td>
                  <td>{findPerson(cfg, s.primary)?.name ?? '—'}</td>
                  <td>{findPerson(cfg, s.secondary)?.name ?? '—'}</td>
                  <td>{findPerson(cfg, s.third)?.name ?? '—'}</td>
                  <td>{s.criticality ? <span className={`chip ${s.criticality === 'High' ? 'p1' : s.criticality === 'Medium' ? 'p2' : 'p4'}`}>{s.criticality}</span> : '—'}</td>
                  <td>{edit && <div className="row"><button className="btn sm" onClick={() => setDraft({ ...s })}>Edit</button><button className="btn sm ghost danger" onClick={() => confirm(`Remove ${s.name} from the map?`) && commit([{ type: 'config.system', data: { ...s, deleted: true } }])}>Remove</button></div>}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      {edit && !draft && (
        <div style={{ padding: 14 }}>
          <button className="btn" onClick={() => setDraft({ id: 'sys-' + Date.now().toString(36), name: 'New system' })}><Icon name="plus" /> Add system</button>
        </div>
      )}
      {draft && !cfg.systems.some((s) => s.id === draft.id) && (
        <div className="row wrap" style={{ padding: 14 }}>
          <label className="field grow"><span>Name</span><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
          <label className="field"><span>Primary</span><PersonSel label="Primary" v={draft.primary} on={(x) => setDraft({ ...draft, primary: x })} /></label>
          <label className="field"><span>Secondary</span><PersonSel label="Secondary" v={draft.secondary} on={(x) => setDraft({ ...draft, secondary: x })} /></label>
          <button className="btn primary" style={{ alignSelf: 'flex-end' }} onClick={async () => { if (draft.name.trim() && (await commit([{ type: 'config.system', data: draft }]))) setDraft(null); }}>Add</button>
          <button className="btn" style={{ alignSelf: 'flex-end' }} onClick={() => setDraft(null)}>Cancel</button>
        </div>
      )}
    </section>
  );
}

function PeopleSettings() {
  const { state, store, role, readOnly } = useHub();
  const cfg = state.config;
  return (
    <section className="panel" aria-labelledby="ppl-h">
      <div className="panel-head">
        <h2 id="ppl-h" className="grow">People and roles</h2>
        <span className="small muted">Edit hub-config.json in the shared folder to change people, usernames or roles.</span>
      </div>
      <table className="table">
        <thead><tr><th>Name</th><th>Windows username</th><th>Change file</th><th>Role</th><th>Service Desk name</th></tr></thead>
        <tbody>
          {cfg.people.map((p) => (
            <tr key={p.username}>
              <td><div className="row"><Avatar user={p.username} config={cfg} />{p.name}</div></td>
              <td><code>{p.username}</code></td>
              <td><code>changes/{p.username}.jsonl</code></td>
              <td>{p.role === 'manager' ? 'Manager' : p.role === 'analyst' ? 'Analyst' : 'Viewer (read-only)'}</td>
              <td>{p.sdName ?? <span className="muted">same as name</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {role === 'manager' && !readOnly && (
        <div className="row" style={{ padding: 14 }}>
          <button className="btn" onClick={() => download('hub-config.json', JSON.stringify(cfg, null, 2) + '\n', 'application/json')}>
            <Icon name="download" /> Download current config
          </button>
          <button className="btn" onClick={async () => { if (confirm('Write the current settings (including changes made here) into hub-config.json?')) { await store.writeConfig(cfg); toast('hub-config.json saved.'); } }}>
            Save settings into hub-config.json
          </button>
        </div>
      )}
    </section>
  );
}

export function Settings() {
  const { role } = useHub();
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <div className="sub">{role === 'manager' ? 'Changes here are logged in the audit trail like any other change.' : 'Only Nick can change settings.'}</div>
        </div>
      </div>
      <DataImport />
      <WipSettings />
      <SystemsSettings />
      <PeopleSettings />
    </div>
  );
}

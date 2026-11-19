import { useState } from 'react';
import { useHub } from '../store/hub';
import { Avatar, download, Icon, toast } from '../components/ui';
import { analysts, assignable, findPerson, personForSourceName, personWipLimit, ownerList } from '../model/logic';
import { isStatus } from '../model/replay';
import { priorityStandardOf } from '../model/priority';
import { DEFAULT_IMPORT_FILE } from '../store/autoimport';
import { importTicketRows, importTicketsCsv, mergeSnapshot, type CsvImportResult } from '../model/csv';
import { readXlsx } from '../model/xlsx';
import { BUCKETS, BUCKET_LABEL, PRIORITIES, type Bucket, type NewEvent, type Priority, type PriorityStandard, type PriorityTarget, type Source, type SystemOwnership } from '../model/types';
import { DemoStore } from '../store/storage';

function DataImport() {
  const { state, me, role, readOnly, writeSnapshot, store, commit, importStatus: ai } = useHub();
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
          <dt>Auto-import</dt>
          <dd data-testid="autoimport-status">
            {state.config.autoImport?.enabled === false ? (
              'Off (autoImport.enabled is false in hub-config.json).'
            ) : !ai ? (
              <>Waiting for <code>import\{state.config.autoImport?.file || DEFAULT_IMPORT_FILE}</code> in the hub folder. When a scheduled export drops it there, any open hub imports it within about 20 seconds of each change.</>
            ) : (
              <>
                <code>import\{ai.file}</code>
                {ai.lastModified ? ` · exported ${new Date(ai.lastModified).toLocaleString()}` : ''}
                {ai.error ? <span className="danger-text"> · {ai.error}</span> : ai.waiting ? ' · new file, importing shortly…' : ai.importedAt ? ` · imported ${new Date(ai.importedAt).toLocaleString()}${ai.count ? ` (${ai.count} tickets, ${ai.open} open)` : ''}` : ''}
                {ai.lastModified && Date.now() - ai.lastModified > 3 * 3600_000 && <span className="danger-text"> · over 3 hours old: check the scheduled export.</span>}
              </>
            )}
          </dd>
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
              <span>Export file (CSV, or Excel .xlsx as Wrike exports it)</span>
              <input
                className="input"
                type="file"
                accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const opts = { urlTemplate: tpl, isClosed: (st: string) => isStatus(state.config.closedStatuses, st) };
                  try {
                    if (/\.xlsx$/i.test(f.name)) {
                      const sheet = await readXlsx(await f.arrayBuffer());
                      setRes(importTicketRows(sheet.rows, source, { ...opts, links: sheet.links }));
                    } else setRes(importTicketsCsv(await f.text(), source, opts));
                  } catch (err) {
                    toast(`Couldn’t read that file: ${(err as Error).message}`);
                  }
                }}
              />
            </label>
            {res && (
              <div className="stack">
                <div className={`banner ${res.tickets.length ? 'info' : 'error'}`}>
                  {res.tickets.length} {source === 'Wrike' ? 'Wrike items' : 'tickets'} ready ({res.tickets.filter((t) => !isStatus(state.config.closedStatuses, t.source_status)).length} open{source === 'Wrike' ? '' : ', the rest closed in the last 90 days'})
                  {res.skippedOldClosed ? `; ${res.skippedOldClosed} ${source === 'Wrike' ? 'cancelled or completed' : 'older closed'} left out` : ''}
                  {res.skippedHeadings ? `; ${res.skippedHeadings} group headings skipped` : ''}. Columns matched: {Object.entries(res.columns).map(([k, v]) => `${v} → ${k}`).join(', ') || 'none'}.
                </div>
                <TechnicianMap
                  key={source + res.tickets.length}
                  source={source}
                  tickets={res.tickets}
                  onSave={async (pairs) => {
                    // Service Desk names go in sdName; other systems' spellings are kept as extra aliases.
                    const ev: NewEvent[] = pairs.map(([username, n]): NewEvent => {
                      const p = findPerson(state.config, username);
                      return source === 'SD'
                        ? { type: 'config.person', data: { username, sdName: n } }
                        : { type: 'config.person', data: { username, aliases: [...new Set([...(p?.aliases ?? []), n])] } };
                    });
                    if (await commit(ev)) toast('Names saved.');
                  }}
                />
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
function TechnicianMap({ tickets, onSave, source }: { tickets: { source_owner?: string; source_status: string }[]; onSave: (pairs: [string, string][]) => void; source: string }) {
  const { state } = useHub();
  const cfg = state.config;
  const counts = new Map<string, number>();
  // Wrike can list several assignees in one cell: count each person.
  const split = (s?: string) => (s ?? '').split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  tickets.forEach((t) => !isStatus(cfg.closedStatuses, t.source_status) && split(t.source_owner).forEach((n) => counts.set(n, (counts.get(n) ?? 0) + 1)));
  tickets.forEach((t) => split(t.source_owner).forEach((n) => !counts.has(n) && counts.set(n, 0)));
  const names = [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
  const [map, setMap] = useState<Record<string, string>>(() => Object.fromEntries(names.map((n) => [n, personForSourceName(cfg, n)?.username ?? ''])));
  if (!names.length) return null;
  const people = assignable(cfg);
  return (
    <div className="panel" style={{ boxShadow: 'none' }}>
      <div className="panel-head">
        <h3 className="grow">{source === 'SD' ? 'Service Desk technicians' : `${source} assignees`}</h3>
        <span className="small muted">{source === 'SD' ? 'Service Desk' : source} assigns the work. Match each name to a hub person, or leave “Not on the hub”.</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name in {source === 'SD' ? 'Service Desk' : source}</th><th className="num">Open items</th><th>Hub person</th></tr></thead>
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
            onSave(pairs.filter(([u, n]) => findPerson(cfg, u)?.sdName !== n && !(findPerson(cfg, u)?.aliases ?? []).includes(n)));
          }}
        >
          Save names
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
  // A slot that can hold several people in order: one picker per person, plus "add".
  const OwnersSel = ({ v, on, label }: { v?: string | string[]; on: (x?: string | string[]) => void; label: string }) => {
    const list = ownerList(v);
    const set = (next: string[]) => on(next.length > 1 ? next : next[0]);
    return (
      <div className="stack" style={{ gap: 4 }}>
        {(list.length ? list : ['']).map((u, i) => (
          <PersonSel key={i} label={`${label} ${i + 1}`} v={u || undefined} on={(x) => set(x ? Object.assign([...list], { [i]: x }) : list.filter((_, j) => j !== i))} />
        ))}
        {list.length > 0 && list.length < 4 && <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => set([...list, people.find((p) => !list.includes(p.username) && p.username !== draft?.primary)?.username ?? list[0]])}>+ add</button>}
      </div>
    );
  };
  const names = (v?: string | string[]) => ownerList(v).map((u) => findPerson(cfg, u)?.name ?? u).join(' / ') || '—';
  const critClass = (c?: string) => (c === 'Critical' ? 'p1' : c === 'High' ? 'p2' : c === 'Medium' ? 'p3' : 'p4');
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
                  <td><OwnersSel label="Secondary" v={draft.secondary} on={(x) => setDraft({ ...draft, secondary: x })} /></td>
                  <td><OwnersSel label="Third backup" v={draft.third} on={(x) => setDraft({ ...draft, third: x })} /></td>
                  <td><select className="input" aria-label="Criticality" value={draft.criticality ?? ''} onChange={(e) => setDraft({ ...draft, criticality: (e.target.value || undefined) as SystemOwnership['criticality'] })}><option value="">—</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></td>
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
                  <td>{names(s.secondary)}</td>
                  <td>{names(s.third)}</td>
                  <td>{s.criticality ? <span className={`chip ${critClass(s.criticality)}`}>{s.criticality}</span> : '—'}</td>
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
          <label className="field"><span>Secondary</span><OwnersSel label="Secondary" v={draft.secondary} on={(x) => setDraft({ ...draft, secondary: x })} /></label>
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

function PriorityStandardSettings() {
  const { state, role, readOnly, commit } = useHub();
  const ps = priorityStandardOf(state.config);
  const edit = role === 'manager' && !readOnly;
  const [draft, setDraft] = useState<PriorityStandard | null>(null);
  const d = draft ?? ps;
  const setP = (p: Priority, k: keyof PriorityTarget, v: string) => setDraft({ ...d, [p]: { ...d[p], [k]: String(k).endsWith('Unit') ? v : Number(v) } });
  const save = async () => {
    if (!draft) return;
    if (await commit([{ type: 'config.priorityStandard', data: draft }])) {
      toast('Priority standard saved.');
      setDraft(null);
    }
  };
  const unit = (p: Priority, k: 'respondUnit' | 'updateUnit') => (
    <select className="input" aria-label={`${p} ${k === 'respondUnit' ? 'response' : 'update'} unit`} value={d[p][k]} disabled={!edit} onChange={(e) => setP(p, k, e.target.value)} style={{ width: 'auto' }}>
      <option value="h">business hours</option>
      <option value="d">business days</option>
    </select>
  );
  const num = (p: Priority, k: 'respond' | 'update' | 'resolveDays', step = 1) => (
    <input className="input" type="number" min={step} step={step} aria-label={`${p} ${k}`} value={d[p][k]} disabled={!edit} onChange={(e) => setP(p, k, e.target.value)} style={{ width: 70 }} />
  );
  return (
    <section className="panel" aria-labelledby="ps-h">
      <div className="panel-head"><h2 id="ps-h" className="grow">Priority standard</h2><span className="small muted">Response, update and resolution targets per priority (business time). Drives Notifications and Stand-up.</span></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Priority</th><th>First response</th><th>Updates every</th><th>Target to resolve</th></tr></thead>
          <tbody>
            {PRIORITIES.map((p) => (
              <tr key={p}>
                <td><span className={`chip ${p.toLowerCase()}`}>{p}</span></td>
                <td><div className="row" style={{ gap: 6 }}>{num(p, 'respond', 0.5)}{unit(p, 'respondUnit')}</div></td>
                <td><div className="row" style={{ gap: 6 }}>{num(p, 'update', 0.5)}{unit(p, 'updateUnit')}</div></td>
                <td><div className="row" style={{ gap: 6 }}>{num(p, 'resolveDays')} business day{d[p].resolveDays === 1 ? '' : 's'}{p === 'P1' && d[p].resolveDays === 1 ? <span className="small muted"> (same day)</span> : null}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row wrap" style={{ gap: 14, padding: 14 }}>
        <label className="field"><span>Start date (older tickets are the backlog)</span><input className="input" type="date" value={d.startFrom ?? ''} disabled={!edit} onChange={(e) => setDraft({ ...d, startFrom: e.target.value || undefined })} /></label>
        <label className="field"><span>At risk after (% of target)</span><input className="input" type="number" min={10} max={95} step={5} value={Math.round(d.atRiskPct * 100)} disabled={!edit} onChange={(e) => setDraft({ ...d, atRiskPct: Number(e.target.value) / 100 })} style={{ width: 90 }} /></label>
        <label className="field"><span>Flag after being bumped</span><input className="input" type="number" min={1} value={d.bumpFlag} disabled={!edit} onChange={(e) => setDraft({ ...d, bumpFlag: Number(e.target.value) })} style={{ width: 90 }} /></label>
        <label className="field"><span>Backlog: clear per week</span><input className="input" type="number" min={1} value={d.backlogWeeklyGoal} disabled={!edit} onChange={(e) => setDraft({ ...d, backlogWeeklyGoal: Number(e.target.value) })} style={{ width: 90 }} /></label>
        <label className="field"><span>Backlog items on the daily list</span><input className="input" type="number" min={0} value={d.backlogDaily} disabled={!edit} onChange={(e) => setDraft({ ...d, backlogDaily: Number(e.target.value) })} style={{ width: 90 }} /></label>
        <label className="field"><span>Department waiting after (business days)</span><input className="input" type="number" min={1} value={d.deptIdleDays} disabled={!edit} onChange={(e) => setDraft({ ...d, deptIdleDays: Number(e.target.value) })} style={{ width: 90 }} /></label>
        {edit && draft && (
          <div className="row" style={{ gap: 8, alignSelf: 'flex-end' }}>
            <button className="btn" onClick={() => setDraft(null)}>Cancel</button>
            <button className="btn primary" onClick={() => void save()}>Save</button>
          </div>
        )}
      </div>
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
      <PriorityStandardSettings />
      <WipSettings />
      <SystemsSettings />
      <PeopleSettings />
    </div>
  );
}

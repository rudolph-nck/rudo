import { useMemo, useState } from 'react';
import { useHub } from '../store/hub';
import { useUi } from '../components/actions';
import { Avatar, Icon, Modal, PriorityChip, SourceBadge, toast } from '../components/ui';
import { analysts, findPerson, rankedList } from '../model/logic';
import { effortCriterion, effortLabel, effortPoints, nextFreeAbove, teamBoard, usedScores, velocity, type TeamRow } from '../model/teamscore';
import { ScalePick } from '../components/Scale';
import { COLUMN_LABEL, type NewEvent, type TeamCriterion } from '../model/types';

export function TeamScore() {
  const { state, me, grader, readOnly, commit, role } = useHub();
  const cfg = state.config;
  const b = useMemo(() => teamBoard(state), [state]);
  const vel = useMemo(() => velocity(state), [state]);
  const [rating, setRating] = useState<string | null>(null);
  const [setting, setSetting] = useState<TeamRow | null>(null);
  const name = (u?: string) => findPerson(cfg, u)?.name ?? u ?? '';
  const team = analysts(cfg);
  const canRate = !readOnly && role !== 'viewer';
  const canDecide = grader && !readOnly;
  const notRatedByMe = b.rows.filter((r) => !r.item.team?.ratings[me]);

  const breakTie = async (winner: TeamRow, group: TeamRow[]) => {
    const used = usedScores(state, winner.item.id);
    const score = nextFreeAbove(winner.ts.score!, used);
    const others = group.filter((g) => g !== winner).map((g) => `“${g.item.title}”`).join(', ');
    if (await commit([{ type: 'team.score', item: winner.item.id, data: { score, reason: `Tie-break: goes ahead of ${others}` } }]))
      toast(`${winner.item.title} now ${score}, ahead of ${others}.`);
  };

  const applyToBoard = async () => {
    const events: NewEvent[] = [];
    for (const col of ['To Do', 'Ready'] as const) {
      const list = rankedList(state, 'Project', col);
      if (list.length < 2) continue;
      const pos = new Map(b.scored.map((r) => [r.item.id, r.position!]));
      const order = [...list].sort((x, y) => (pos.get(x.id) ?? 1e6) - (pos.get(y.id) ?? 1e6) || (x.rank ?? 0) - (y.rank ?? 0));
      events.push({ type: 'rank.normalize', data: { bucket: 'Project', column: col, order: order.map((i) => i.id) } });
    }
    if (!events.length) return toast('Nothing to re-rank.');
    if (await commit(events)) toast('Projects To Do and Ready re-ranked by team score.');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Team score</h1>
          <div className="sub">One department-wide score per project, set by the team. No two projects share a score, so there’s always a bigger priority.</div>
        </div>
        {canDecide && (
          <div className="topbar-actions">
            <button className="btn" onClick={applyToBoard} disabled={b.ties.length > 0} title={b.ties.length ? 'Break the ties first' : undefined}>
              <Icon name="board" size={16} /> Rank the Projects board by team score
            </button>
          </div>
        )}
      </div>

      <section className="panel criteria" aria-label="How the score works">
        <div className="small muted" style={{ fontWeight: 700 }}>Everyone rates each project 1–5 on:</div>
        <div className="row wrap" style={{ gap: 8 }}>
          {b.criteria.map((c) => (
            <span key={c.key} className="crit" title={c.hint}>
              <strong>{c.label}</strong> <span className="muted">{c.weight}%{c.invert ? ' · less is better' : ''}</span>
            </span>
          ))}
        </div>
        <div className="small muted">Score = weighted team average, 0–100. Ties go to the daily meeting; the decision is recorded.</div>
        <details className="scale-guide">
          <summary>What each number means</summary>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Criterion</th>{[1, 2, 3, 4, 5].map((n) => <th key={n}>{n}</th>)}</tr>
              </thead>
              <tbody>
                {b.criteria.map((c) => (
                  <tr key={c.key}>
                    <th scope="row">{c.label}<div className="small muted" style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>{c.hint}</div></th>
                    {[0, 1, 2, 3, 4].map((n) => (
                      <td key={n} className="small">
                        {c.levels?.[n] ?? ''}
                        {c.points && <div className="pts">{c.points[n]} pt{c.points[n] === 1 ? '' : 's'}</div>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      {vel && (
        <section className="panel velocity" aria-labelledby="vel-h">
          <div className="grow" style={{ minWidth: 260, flexBasis: 320 }}>
            <h2 id="vel-h" style={{ fontSize: 15 }}>Project velocity</h2>
            <div className="small muted">Effort points finished per 2 weeks (the rotation cadence). 1 pt ≈ up to 2 days of work, 2 ≈ a week, 3 ≈ 1–3 weeks, 5 ≈ 1–2 months, 8 ≈ 2+ months.</div>
          </div>
          <div className="vel-stat"><strong>{vel.average}</strong><span>pts / 2 weeks (avg)</span></div>
          <div className="vel-stat"><strong>{vel.inProgress}</strong><span>pts in Doing</span></div>
          <div className="vel-stat"><strong>{vel.queued}</strong><span>pts queued</span></div>
          <div className="vel-stat"><strong>{vel.average > 0 ? `~${Math.ceil(((vel.inProgress + vel.queued) / vel.average) * 2)} wks` : '—'}</strong><span>to clear at this pace</span></div>
          <div className="vel-bars" role="img" aria-label={vel.periods.map((p) => `${p.from} to ${p.to}: ${p.points} points`).join('; ')}>
            {vel.periods.map((p) => (
              <span key={p.from} title={`${p.from} – ${p.to}: ${p.points} pts, ${p.projects} project${p.projects === 1 ? '' : 's'} done`}>
                <i style={{ height: `${Math.max(4, (p.points / Math.max(1, ...vel.periods.map((x) => x.points))) * 100)}%` }} />
              </span>
            ))}
          </div>
        </section>
      )}

      {b.ties.map((group) => (
        <div key={group[0].ts.score} className="banner warn tie" role="alert">
          <div className="grow">
            <strong>Tie at {group[0].ts.score}:</strong> {group.map((g) => `“${g.item.title}”`).join(' and ')}. Which goes first?
          </div>
          {canDecide ? (
            group.map((g) => (
              <button key={g.item.id} className="btn sm" onClick={() => breakTie(g, group)}>
                {g.item.title.length > 32 ? g.item.title.slice(0, 31) + '…' : g.item.title} first
              </button>
            ))
          ) : (
            <span className="small">Decide in the daily meeting.</span>
          )}
        </div>
      ))}

      {canRate && notRatedByMe.length > 0 && (
        <div className="banner info">
          You haven’t rated {notRatedByMe.length} project{notRatedByMe.length === 1 ? '' : 's'} yet.
          <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setRating(notRatedByMe[0].item.id)}>Rate the next one</button>
        </div>
      )}

      <ol className="ts-list" aria-label="Projects by team score">
        {b.rows.map((r) => (
          <TeamRowView
            key={r.item.id}
            r={r}
            criteria={b.criteria}
            teamSize={team.length}
            canRate={canRate}
            canDecide={canDecide}
            rating={rating === r.item.id}
            onRate={() => setRating(rating === r.item.id ? null : r.item.id)}
            onSet={() => setSetting(r)}
            name={name}
          />
        ))}
        {b.rows.length === 0 && <li className="panel muted" style={{ padding: 24 }}>No open projects yet. Grade work into the Projects bucket to score it here.</li>}
      </ol>

      {setting && <SetScoreDialog row={setting} onClose={() => setSetting(null)} />}
    </div>
  );
}

function TeamRowView({ r, criteria, teamSize, canRate, canDecide, rating, onRate, onSet, name }: { r: TeamRow; criteria: TeamCriterion[]; teamSize: number; canRate: boolean; canDecide: boolean; rating: boolean; onRate: () => void; onSet: () => void; name: (u?: string) => string }) {
  const { state, me } = useHub();
  const { openItem } = useUi();
  const cfg = state.config;
  const i = r.item;
  const disagree = criteria.filter((c) => (r.ts.spread[c.key] ?? 0) >= 2);
  const mine = i.team?.ratings[me];
  const board = teamBoard(state);
  const tiedPositions = r.tiedWith.map((t) => board.scored.find((s) => s.item.id === t.id)?.position ?? r.position ?? 0);
  return (
    <li className={`panel ts-row ${r.tiedWith.length ? 'tied' : ''}`}>
      <div className="ts-pos" aria-label={r.position ? (r.tiedWith.length ? `Tied for position ${r.position}` : `Position ${r.position}`) : 'Not scored'}>
        {r.position ? (r.tiedWith.length ? `#${Math.min(r.position, ...tiedPositions)}–${Math.max(r.position, ...tiedPositions)}` : `#${r.position}`) : '—'}
      </div>
      <div className="ts-score" aria-label={r.ts.score !== undefined ? `Team score ${r.ts.score}` : 'No team score yet'}>
        <strong>{r.ts.score ?? '—'}</strong>
        <span>{r.ts.set ? 'team decision' : r.ts.score !== undefined ? 'team score' : 'needs ratings'}</span>
      </div>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row wrap" style={{ gap: 6 }}>
          <PriorityChip p={i.priority} />
          <SourceBadge item={i} />
          <span className="chip src">{COLUMN_LABEL[i.column]}{i.rank ? ` #${i.rank}` : ''}</span>
          {r.tiedWith.length > 0 && <span className="chip bad">Tied</span>}
          {disagree.length > 0 && <span className="chip warn" title="Ratings differ by 2 or more">Discuss: {disagree.map((c) => c.label).join(', ')}</span>}
          {canRate && !mine && <span className="chip p3">You haven’t rated</span>}
        </div>
        <button className="linkish strong" onClick={() => openItem(i.id)}>{i.title}</button>
        <div className="ts-crit">
          {criteria.map((c) => {
            const a = r.ts.avg[c.key];
            return (
              <div key={c.key} className="ts-c" title={`${c.label}: team average ${a?.toFixed(1) ?? '—'}${r.ts.spread[c.key] !== undefined ? `, ratings span ${r.ts.spread[c.key]}` : ''}`}>
                <span className="small muted">{c.label}</span>
                <span className="bar"><i style={{ width: a ? `${(a / 5) * 100}%` : 0 }} /></span>
                <span className="small" style={{ fontVariantNumeric: 'tabular-nums' }}>{a ? a.toFixed(1) : '—'}</span>
              </div>
            );
          })}
        </div>
        {(() => {
          const ec = effortCriterion(criteria);
          const a = ec ? r.ts.avg[ec.key] : undefined;
          return ec && a !== undefined ? (
            <div className="small" style={{ marginTop: 6 }}>
              <strong>Est. effort:</strong> {effortLabel(ec, a)} · {effortPoints(ec, a)} pt{effortPoints(ec, a) === 1 ? '' : 's'}
              {(r.ts.spread[ec.key] ?? 0) >= 2 && <span className="muted"> (the team’s estimates differ: discuss)</span>}
            </div>
          ) : null;
        })()}
        {r.ts.set && (
          <div className="small muted" style={{ marginTop: 4 }}>
            Set by {name(r.ts.set.by)}{r.ts.set.reason ? `: ${r.ts.set.reason}` : ''}. Ratings alone say {r.ts.base ?? '—'}.
          </div>
        )}
      </div>
      <div className="ts-side">
        <div className="ts-raters" aria-label={`${r.ts.raters.length} of ${teamSize} rated`}>
          {r.ts.raters.slice(0, 6).map((u) => <Avatar key={u} user={u} config={cfg} />)}
          <span className="small muted">{r.ts.raters.length}/{teamSize} rated</span>
        </div>
        <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
          {i.owner && <span className="small muted">Owner {name(i.owner)}</span>}
          {canRate && <button className="btn sm" aria-expanded={rating} aria-label={`${mine ? 'Update my rating' : 'Rate'}: ${i.title}`} onClick={onRate}>{mine ? 'Update my rating' : 'Rate'}</button>}
          {canDecide && <button className="btn sm ghost" aria-label={`Set score: ${i.title}`} onClick={onSet}>Set score</button>}
        </div>
      </div>
      {rating && <RateForm r={r} criteria={criteria} onDone={onRate} />}
    </li>
  );
}

function RateForm({ r, criteria, onDone }: { r: TeamRow; criteria: TeamCriterion[]; onDone: () => void }) {
  const { me, commit } = useHub();
  const [v, setV] = useState<Record<string, number>>(() => ({ ...(r.item.team?.ratings[me] ?? {}) }));
  const complete = criteria.every((c) => v[c.key]);
  return (
    <div className="ts-rate">
      {criteria.map((c) => (
        <div key={c.key} className="grade-row" style={{ alignItems: 'flex-start' }}>
          <span className="label" style={{ width: 170, paddingTop: 8 }}>
            {c.label}
            <span className="small muted" style={{ display: 'block', fontWeight: 500 }}>{c.hint}</span>
          </span>
          <ScalePick
            label={c.label}
            value={v[c.key]}
            onChange={(x) => setV({ ...v, [c.key]: x })}
            levels={c.levels}
            short={c.short}
            extra={<span className="small muted">team {r.ts.avg[c.key]?.toFixed(1) ?? '—'}</span>}
          />
        </div>
      ))}
      <div className="row">
        <button
          className="btn primary"
          disabled={!complete}
          onClick={async () => {
            if (await commit([{ type: 'team.rate', item: r.item.id, data: { ratings: v } }])) {
              toast('Rating saved.');
              onDone();
            }
          }}
        >
          Save my rating
        </button>
        <button className="btn" onClick={onDone}>Cancel</button>
        <span className="small muted">Only your own rating changes; the team score is everyone’s average.</span>
      </div>
    </div>
  );
}

function SetScoreDialog({ row, onClose }: { row: TeamRow; onClose: () => void }) {
  const { state, commit } = useHub();
  const used = usedScores(state, row.item.id);
  const [score, setScore] = useState(String(row.ts.score ?? row.ts.base ?? ''));
  const [reason, setReason] = useState('');
  const n = Math.round(Number(score) * 10) / 10;
  const valid = score !== '' && !Number.isNaN(n) && n >= 0 && n <= 1000;
  const clash = valid && used.includes(n);
  const holder = clash ? [...state.items.values()].find((i) => i.id !== row.item.id && teamBoard(state).scored.some((r) => r.item.id === i.id && r.ts.score === n)) : undefined;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Set the team score · ${row.item.title}`}
      footer={
        <>
          {row.ts.set && (
            <button className="btn" style={{ marginRight: 'auto' }} onClick={async () => { if (await commit([{ type: 'team.score', item: row.item.id, data: { score: null } }])) { toast('Back to the ratings score.'); onClose(); } }}>
              Use the ratings score ({row.ts.base ?? '—'})
            </button>
          )}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!valid || clash || !reason.trim()} onClick={async () => { if (await commit([{ type: 'team.score', item: row.item.id, data: { score: n, reason: reason.trim() } }])) { toast(`Team score set to ${n}.`); onClose(); } }}>
            Set {valid ? n : ''}
          </button>
        </>
      }
    >
      <p className="muted" style={{ margin: 0 }}>Record a decision from the daily meeting. The ratings say {row.ts.base ?? '—'}; the score you set wins until you clear it.</p>
      <label className="field" style={{ maxWidth: 200 }}>
        <span>Team score (one decimal)</span>
        <input className="input" type="number" step="0.1" value={score} onChange={(e) => setScore(e.target.value)} aria-invalid={clash || undefined} />
      </label>
      {clash && <div className="banner error" role="alert">{n} is already “{holder?.title ?? 'another project'}”. Scores must be unique: try {nextFreeAbove(n, used)} to go ahead of it.</div>}
      <label className="field">
        <span>Why (required, visible to the team)</span>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Exam finding due in Q1; agreed in standup" />
      </label>
    </Modal>
  );
}

// Panda HQ: team goals (the trash panda's dumpster), the leaderboard, badges and monthly awards.
import { useEffect, useMemo, useState } from 'react';
import { useHub } from '../store/hub';
import { Avatar, Icon, Modal, PriorityChip, toast } from '../components/ui';
import { DumpsterScene } from '../components/Dumpster';
import { findPerson } from '../model/logic';
import { BADGES, BACKLOG_BONUS, closes, funOf, goals, leaderboard, monthlyAwards, ON_TIME_BONUS, PERIOD_LABEL, POINTS, type FunConfig, type GoalProgress, type Period } from '../model/fun';

const GOAL_LABEL: Record<GoalProgress['period'], string> = { week: 'This week', month: 'This month', year: 'This year', all: 'All time' };
const MEDAL = ['🥇', '🥈', '🥉'];

const seenKey = (k: string) => 'cwh.fire.' + k;
const wasSeen = (k: string) => { try { return !!localStorage.getItem(seenKey(k)); } catch { return true; } };
const markSeen = (k: string) => { try { localStorage.setItem(seenKey(k), '1'); } catch { /* ignore */ } };

function FireShow({ goal, onClose }: { goal: GoalProgress; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const what = goal.period === 'all' ? `${goal.count.toLocaleString()} tickets closed, all time` : `${goal.count} tickets closed ${GOAL_LABEL[goal.period].toLowerCase()}`;
  return (
    <div className="fire-show" role="dialog" aria-modal="true" aria-label="Goal reached" onClick={onClose}>
      <div className="confetti" aria-hidden>
        {Array.from({ length: 60 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 12) * 0.12}s`, background: ['#f39c12', '#e8491d', '#ffd166', '#3346d3', '#27ae60', '#a1206a'][i % 6] }} />
        ))}
      </div>
      <div className="fire-card" onClick={(e) => e.stopPropagation()}>
        <div className="fire-title">DUMPSTER FIRE!</div>
        <DumpsterScene pct={1} fire label="The dumpster is on fire: goal reached" />
        <p className="fire-what">{what}. The trash pandas did it.</p>
        {goal.prize && <p className="fire-prize">🎁 {goal.prize}</p>}
        <button className="btn primary" onClick={onClose} autoFocus>Back to work</button>
      </div>
    </div>
  );
}

function GoalsEditor({ fun, onClose }: { fun: FunConfig; onClose: () => void }) {
  const { commit } = useHub();
  const [d, setD] = useState<FunConfig>(fun);
  const save = async () => {
    if (await commit([{ type: 'config.fun', data: d }])) {
      toast('Goals and prizes saved.');
      onClose();
    }
  };
  const num = (k: 'week' | 'month' | 'year', label: string) => (
    <label className="field"><span>{label}</span><input className="input" type="number" min={1} value={d.goals[k]} onChange={(e) => setD({ ...d, goals: { ...d.goals, [k]: Number(e.target.value) } })} style={{ width: 110 }} /></label>
  );
  const prize = (k: keyof FunConfig['prizes'], label: string) => (
    <label className="field"><span>{label}</span><input className="input" value={d.prizes[k]} onChange={(e) => setD({ ...d, prizes: { ...d.prizes, [k]: e.target.value } })} /></label>
  );
  return (
    <Modal open onClose={onClose} title="Goals and prizes" footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => void save()}>Save</button></>}>
      <p className="small muted" style={{ margin: 0 }}>Team goals count every ticket Core closes. Last year: 882 closed; this year so far is on the page.</p>
      <div className="row wrap" style={{ gap: 12 }}>
        {num('week', 'Weekly goal')}
        {num('month', 'Monthly goal')}
        {num('year', 'Yearly goal')}
        <label className="field"><span>All-time tiers (comma separated)</span><input className="input" value={d.goals.allTime.join(', ')} onChange={(e) => setD({ ...d, goals: { ...d.goals, allTime: e.target.value.split(',').map((x) => Number(x.trim())).filter((x) => x > 0) } })} style={{ width: 200 }} /></label>
      </div>
      {prize('week', 'Weekly goal prize')}
      {prize('month', 'Monthly goal prize')}
      {prize('year', 'Yearly goal prize')}
      {prize('allTime', 'All-time tier prize')}
      {prize('awards', 'Monthly award prize (each category winner)')}
      <label className="toggle" style={{ alignSelf: 'flex-start' }}>
        <input type="checkbox" checked={d.leaderboard} onChange={(e) => setD({ ...d, leaderboard: e.target.checked })} />
        Show individual rankings to the team (off = team goals and awards only)
      </label>
    </Modal>
  );
}

export function PandaHQ() {
  const { state, role, readOnly } = useHub();
  const cfg = state.config;
  const fun = funOf(cfg);
  const g = useMemo(() => goals(state), [state]);
  const [tab, setTab] = useState<GoalProgress['period']>('month');
  const [period, setPeriod] = useState<Period>('month');
  const [show, setShow] = useState<GoalProgress | null>(null);
  const [editing, setEditing] = useState(false);
  const board = useMemo(() => leaderboard(state, period), [state, period]);
  const recent = useMemo(() => closes(state).slice(0, 12), [state]);
  const now = new Date();
  const awards = useMemo(() => monthlyAwards(state, now.getFullYear(), now.getMonth()), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastAwards = useMemo(() => monthlyAwards(state, now.getFullYear(), now.getMonth() - 1), [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = (u?: string) => (u ? findPerson(cfg, u)?.name ?? u : '');
  const cur = g.find((x) => x.period === tab)!;
  const showRanks = fun.leaderboard || role === 'manager';

  // New closes since this viewer last looked: they drop into the dumpster.
  const [drops] = useState(() => {
    const total = g.find((x) => x.period === 'all')?.count ?? 0;
    let last = total;
    try { last = Number(localStorage.getItem('cwh.panda.seen') ?? total); localStorage.setItem('cwh.panda.seen', String(total)); } catch { /* ignore */ }
    return Math.max(0, total - last);
  });

  // The fire show plays once per achievement per viewer.
  useEffect(() => {
    const due = g.find((x) => x.celebrate && !wasSeen(x.key));
    if (due) {
      markSeen(due.key);
      setTab(due.period);
      setShow(due);
    }
  }, [g]);

  const tierText = (x: GoalProgress) => (x.period === 'all' ? `${x.tier ? `Tier ${x.tier} reached · ` : ''}next tier ${x.goal.toLocaleString()}` : `goal ${x.goal}`);
  const maxPts = Math.max(1, ...board.map((b) => b.points));

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1>Panda HQ</h1>
          <div className="sub">Every ticket Core closes goes in the dumpster. Fill it to the goal and it goes up in flames.</div>
        </div>
        {role === 'manager' && !readOnly && <button className="btn" onClick={() => setEditing(true)}><Icon name="gear" size={16} /> Goals and prizes</button>}
      </div>

      <section className="panel panda-hero" aria-label="Team goals">
        <div className="panda-stage">
          <div className="seg" role="radiogroup" aria-label="Goal">
            {g.map((x) => <button key={x.period} role="radio" aria-checked={tab === x.period} onClick={() => setTab(x.period)}>{GOAL_LABEL[x.period]}</button>)}
          </div>
          <DumpsterScene pct={cur.pct} fire={cur.reached} drops={drops} label={`${cur.count} of ${cur.goal} tickets closed ${GOAL_LABEL[cur.period].toLowerCase()}`} />
          <div className="panda-count">
            <span className="big">{cur.count.toLocaleString()}</span>
            <span className="muted"> / {cur.goal.toLocaleString()} closed · {GOAL_LABEL[cur.period].toLowerCase()}</span>
            {cur.reached && <span className="chip bad" style={{ marginLeft: 8 }}>🔥 On fire</span>}
            {drops > 0 && <span className="chip ok" style={{ marginLeft: 8 }}>+{drops} since you last looked</span>}
          </div>
        </div>
        <div className="panda-goals">
          {g.map((x) => (
            <button key={x.period} className={`goal-row ${tab === x.period ? 'sel' : ''}`} onClick={() => setTab(x.period)}>
              <div className="row" style={{ gap: 8 }}>
                <strong className="grow">{GOAL_LABEL[x.period]}</strong>
                <span className="small">{x.count.toLocaleString()} / {x.goal.toLocaleString()}</span>
              </div>
              <span className={`goal-bar ${x.reached ? 'done' : ''}`} aria-hidden><span style={{ width: `${Math.min(100, x.pct * 100)}%` }} /></span>
              <div className="small muted">{x.reached ? '🔥 Reached!' : `${Math.max(0, x.goal - x.count).toLocaleString()} to go`} · {tierText(x)}</div>
              {x.prize && <div className="small">🎁 {x.prize}</div>}
            </button>
          ))}
          {g.some((x) => x.celebrate) && (
            <button className="btn sm ghost" onClick={() => setShow(g.find((x) => x.celebrate)!)}>Replay the show</button>
          )}
        </div>
      </section>

      {showRanks && (
        <section className="panel" aria-labelledby="lb-h">
          <div className="panel-head">
            <h2 id="lb-h" className="grow">Leaderboard {!fun.leaderboard && <span className="chip src">Only you can see this</span>}</h2>
            <div className="seg" role="radiogroup" aria-label="Leaderboard period">
              {(['week', 'month', 'quarter', 'year'] as Period[]).map((p) => <button key={p} role="radio" aria-checked={period === p} onClick={() => setPeriod(p)}>{PERIOD_LABEL[p].replace('This ', '')}</button>)}
            </div>
          </div>
          <ol className="lb">
            {board.map((b, n) => (
              <li key={b.user} className={n < 3 && b.points ? 'top' : ''}>
                <span className="lb-rank">{b.points && n < 3 ? MEDAL[n] : n + 1}</span>
                <Avatar user={b.user} config={cfg} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <strong>{name(b.user)}</strong>
                    <span className="lb-badges">{b.badges.map((id) => <span key={id} title={`${BADGES[id].label}: ${BADGES[id].how}`} aria-label={BADGES[id].label}>{BADGES[id].icon}</span>)}</span>
                  </div>
                  <span className="lb-bar" aria-hidden><span style={{ width: `${(b.points / maxPts) * 100}%` }} /></span>
                </div>
                <div className="lb-stats small">
                  <strong>{b.points}</strong> pts · {b.closes} closed{b.closes ? ` · ${b.onTimePct}% on time` : ''}
                </div>
              </li>
            ))}
          </ol>
          <details className="small muted lb-how">
            <summary>How points work</summary>
            Each closed ticket: P1 {POINTS.P1}, P2 {POINTS.P2}, P3 {POINTS.P3}, P4 {POINTS.P4} points; +{ON_TIME_BONUS} if closed within its target; +{BACKLOG_BONUS} for a backlog ticket. Hard, on-time and old work beats volume. Badges: {Object.values(BADGES).map((x) => `${x.icon} ${x.label} (${x.how.toLowerCase()})`).join(' · ')}.
          </details>
        </section>
      )}

      <div className="viz-grid">
        <section className="panel" aria-labelledby="aw-h">
          <div className="panel-head">
            <h2 id="aw-h" className="grow">Monthly awards</h2>
            <span className="small muted">🎁 {fun.prizes.awards}</span>
          </div>
          <ul className="awards">
            {awards.map((a) => (
              <li key={a.id}>
                <span className="aw-label"><strong>{a.label}</strong><span className="small muted">{a.how}</span></span>
                {a.winner ? <span className="row" style={{ gap: 6 }}><Avatar user={a.winner} config={cfg} />{name(a.winner)} <span className="small muted">{a.value}</span></span> : <span className="small muted">Up for grabs</span>}
              </li>
            ))}
          </ul>
          <h3 className="small muted" style={{ margin: '4px 16px' }}>Last month's winners</h3>
          <ul className="awards past">
            {lastAwards.filter((a) => a.winner).map((a) => (
              <li key={a.id}><span className="aw-label">{a.label}</span><span className="row" style={{ gap: 6 }}><Avatar user={a.winner} config={cfg} />{name(a.winner)}</span></li>
            ))}
            {!lastAwards.some((a) => a.winner) && <li className="small muted">No winners recorded last month.</li>}
          </ul>
        </section>
        <section className="panel" aria-labelledby="rw-h">
          <div className="panel-head"><h2 id="rw-h" className="grow">Recent wins</h2></div>
          <ul className="wins">
            {recent.map((c) => (
              <li key={c.item.id}>
                <Avatar user={c.user} config={cfg} external={c.user ? undefined : c.item.source_owner} />
                <span className="grow small"><strong>{c.user ? name(c.user) : c.item.source_owner ?? 'Core'}</strong> closed <PriorityChip p={c.priority} /> {c.item.source_id ? `#${c.item.source_id}` : ''} {c.item.title}</span>
                <span className="chip ok">+{c.points}</span>
              </li>
            ))}
            {!recent.length && <li className="small muted">Nothing closed yet. The dumpster is hungry.</li>}
          </ul>
        </section>
      </div>

      {show && <FireShow goal={show} onClose={() => setShow(null)} />}
      {editing && <GoalsEditor fun={fun} onClose={() => setEditing(false)} />}
    </div>
  );
}

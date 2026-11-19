// Training: short lessons on every part of the hub, each with a video, how-to steps and a guided tour on the real
// screen. Finishing a lesson is recorded, so Nick can see the team's progress.
import { useState } from 'react';
import { useHub } from '../store/hub';
import { useNav } from '../nav';
import { Avatar, Icon, toast } from '../components/ui';
import { analysts, currentDispatch, findPerson, todayISO } from '../model/logic';
import { AUDIENCE_LABEL, LESSONS, lessonsFor, type Lesson } from '../training/lessons';
import { startTour } from '../training/Tour';

function LessonVideo({ id }: { id: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return <div className="lesson-video missing small muted">No video installed for this lesson yet. Use <strong>Show me</strong> for the guided tour.</div>;
  return (
    <video className="lesson-video" controls preload="metadata" onError={() => setMissing(true)} aria-label="Lesson video">
      <source src={`training/${id}.mp4`} type="video/mp4" onError={() => setMissing(true)} />
    </video>
  );
}

export function Training() {
  const { state, me, role, commit, readOnly } = useHub();
  const { param, go } = useNav();
  const cfg = state.config;
  const onSupport = currentDispatch(cfg, todayISO())?.analyst === me;
  const mine = lessonsFor(role, onSupport);
  const done = state.training?.[me] ?? {};
  const doneCount = mine.filter((l) => done[l.id]).length;
  const sel = mine.find((l) => l.id === param) ?? mine.find((l) => !done[l.id]) ?? mine[0];

  const markDone = async (l: Lesson) => {
    if (done[l.id] || readOnly) return;
    if (await commit([{ type: 'training.done', data: { lesson: l.id } }])) toast(`“${l.title}” done.`);
  };
  const show = (l: Lesson) => startTour(l, () => void markDone(l));

  return (
    <div className="page">
      <div className="page-head">
        <div className="grow">
          <h1>Training</h1>
          <div className="sub">Short lessons on everything in the hub. Watch the video, read the steps, or press <strong>Show me</strong> for a guided tour on the real screen.</div>
        </div>
      </div>

      <section className="panel su-progress" aria-label="Your progress">
        <div className="row wrap" style={{ gap: 18, alignItems: 'center' }}>
          <div><span className="su-big">{doneCount}</span><span className="muted"> of {mine.length} lessons done</span></div>
          <span className="backlog-bar wide" aria-hidden><span style={{ width: `${mine.length ? (doneCount / mine.length) * 100 : 0}%` }} /></span>
          <span className="small muted">About {mine.reduce((t, l) => t + l.minutes, 0)} minutes in all.</span>
        </div>
      </section>

      <div className="learn">
        <nav className="learn-list" aria-label="Lessons">
          {mine.map((l, n) => (
            <button key={l.id} className={`learn-item ${sel?.id === l.id ? 'sel' : ''}`} aria-current={sel?.id === l.id ? 'true' : undefined} onClick={() => go('training', l.id)}>
              <span className={`learn-num ${done[l.id] ? 'done' : ''}`} aria-label={done[l.id] ? 'Done' : `Lesson ${n + 1}`}>{done[l.id] ? <Icon name="check" size={14} /> : n + 1}</span>
              <span className="grow">
                <span className="learn-t">{l.title}</span>
                <span className="small muted">{l.minutes} min{l.audience !== 'everyone' ? ` · ${AUDIENCE_LABEL[l.audience]}` : ''}</span>
              </span>
            </button>
          ))}
        </nav>

        {sel && (
          <article className="panel learn-detail" aria-labelledby="lesson-h">
            <div className="panel-head">
              <h2 id="lesson-h" className="grow">{sel.title}</h2>
              {done[sel.id] ? <span className="chip ok"><Icon name="check" size={12} /> Done</span> : <span className="small muted">{sel.minutes} min</span>}
            </div>
            <div className="learn-body">
              <p className="learn-why">{sel.why}</p>
              <LessonVideo key={sel.id} id={sel.id} />
              <div className="row wrap" style={{ gap: 8 }}>
                <button className="btn primary" onClick={() => show(sel)}><Icon name="flag" size={16} /> Show me</button>
                {!done[sel.id] && !readOnly && <button className="btn" onClick={() => void markDone(sel)}>Mark as done</button>}
                {(() => {
                  const k = mine.findIndex((l) => l.id === sel.id);
                  return k < mine.length - 1 ? <button className="btn ghost" onClick={() => go('training', mine[k + 1].id)}>Next lesson →</button> : null;
                })()}
              </div>
              {sel.howTo.map((h) => (
                <div key={h.task} className="learn-how">
                  <h3>{h.task}</h3>
                  <ol>{h.steps.map((st) => <li key={st}>{st}</li>)}</ol>
                </div>
              ))}
            </div>
          </article>
        )}
      </div>

      {role === 'manager' && (
        <section className="panel" aria-labelledby="tp-h">
          <div className="panel-head"><h2 id="tp-h" className="grow">Team progress</h2><span className="small muted">Lessons each person has finished.</span></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Person</th><th>Done</th>{LESSONS.map((l) => <th key={l.id} title={l.title} className="small">{l.title.split(/[:(]/)[0].trim()}</th>)}</tr></thead>
              <tbody>
                {[...analysts(cfg), ...cfg.people.filter((p) => p.role === 'viewer')].map((p) => {
                  const d = state.training?.[p.username] ?? {};
                  const theirs = lessonsFor(p.role, false);
                  return (
                    <tr key={p.username}>
                      <td><div className="row"><Avatar user={p.username} config={cfg} />{findPerson(cfg, p.username)?.name}</div></td>
                      <td><strong>{theirs.filter((l) => d[l.id]).length}</strong> / {theirs.length}</td>
                      {LESSONS.map((l) => (
                        <td key={l.id}>{d[l.id] ? <span className="chip ok" title={`Done ${new Date(d[l.id]).toLocaleDateString()}`}><Icon name="check" size={12} /></span> : theirs.includes(l) ? <span className="muted">—</span> : null}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

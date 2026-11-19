import { useMemo } from 'react';
import { useHub } from '../store/hub';
import { srcName } from './ui';
import { assignable, computeScore, suggestOwner, suggestPriority, findPerson, ownerList } from '../model/logic';
import { BUCKETS, BUCKET_LABEL, PRIORITIES, type Bucket, type Grade, type Priority, type WorkItem } from '../model/types';
import { Avatar, BucketDot, Pick } from './ui';
import { EFFORT_LEVELS, EFFORT_SHORT, IMPACT_LEVELS, ScalePick, URGENCY_LEVELS } from './Scale';
import { criteriaOf, effortCriterion } from '../model/teamscore';

export interface Draft {
  bucket?: Bucket;
  priority?: Priority;
  priorityTouched?: boolean;
  impact?: number;
  urgency?: number;
  effort?: number;
  system?: string;
  owner?: string;
  ownerTouched?: boolean;
}

export const draftFrom = (i: WorkItem): Draft => ({
  bucket: i.bucket ?? i.suggested_bucket,
  priority: i.priority,
  priorityTouched: !!i.graded,
  impact: i.impact,
  urgency: i.urgency,
  effort: i.effort,
  system: i.system,
  owner: i.owner,
  // An SD-assigned ticket keeps its technician: never let grading suggest someone else.
  ownerTouched: !!i.owner || !!i.ownerFromSource,
});

export function effectiveGrade(d: Draft, suggestedOwner?: string): Grade | undefined {
  const score = computeScore(d.impact, d.urgency, d.effort);
  const priority = d.priorityTouched ? d.priority : suggestPriority(score) ?? d.priority;
  if (!d.bucket || !priority || !d.impact || !d.urgency || !d.effort) return undefined;
  return { bucket: d.bucket, priority, impact: d.impact, urgency: d.urgency, effort: d.effort, system: d.system, owner: d.ownerTouched ? d.owner : d.owner ?? suggestedOwner };
}

/** One-click grading: bucket, 1–5 impact/urgency/effort, live score and suggested priority, system and owner. */
export function GradeForm({ item, draft, onChange, disabled }: { item: WorkItem; draft: Draft; onChange: (d: Draft) => void; disabled?: boolean }) {
  const { state } = useHub();
  const cfg = state.config;
  const projectEffort = effortCriterion(criteriaOf(cfg));
  const score = computeScore(draft.impact, draft.urgency, draft.effort);
  const sugPri = suggestPriority(score);
  const priority = draft.priorityTouched ? draft.priority : sugPri ?? draft.priority;
  const sug = useMemo(() => suggestOwner(state, draft.system, item.id), [state, draft.system, item.id]);
  const owner = draft.ownerTouched ? draft.owner : draft.owner ?? sug?.username;
  const set = (p: Partial<Draft>) => onChange({ ...draft, ...p });
  const ownerName = (u?: string) => findPerson(cfg, u)?.name ?? u;
  const sys = cfg.systems.find((s) => s.id === draft.system);

  return (
    <div className="grade">
      <div className="grade-row">
        <span className="label" id={`b-${item.id}`}>Bucket</span>
        <Pick label="Bucket" value={draft.bucket} options={BUCKETS} onChange={(b) => set({ bucket: b })} disabled={disabled} render={(b) => <><BucketDot b={b} />{BUCKET_LABEL[b]}</>} />
      </div>
      <div className="grade-row">
        <span className="label">Impact</span>
        <ScalePick label="Impact" value={draft.impact} onChange={(v) => set({ impact: v })} disabled={disabled} levels={IMPACT_LEVELS} />
      </div>
      <div className="grade-row">
        <span className="label">Urgency</span>
        <ScalePick label="Urgency" value={draft.urgency} onChange={(v) => set({ urgency: v })} disabled={disabled} levels={URGENCY_LEVELS} />
      </div>
      <div className="grade-row">
        <span className="label">Effort</span>
        {/* Tickets are sized in hours; projects use the project scale (days to months), same as Team score. */}
        <ScalePick
          label="Effort"
          value={draft.effort}
          onChange={(v) => set({ effort: v })}
          disabled={disabled}
          levels={draft.bucket === 'Project' ? projectEffort?.levels : EFFORT_LEVELS}
          short={draft.bucket === 'Project' ? projectEffort?.short : EFFORT_SHORT}
          points={draft.bucket === 'Project' ? projectEffort?.points : undefined}
        />
      </div>
      <div className="scorebox" aria-live="polite">
        <div>
          <div className="label">Score</div>
          <div className="big">{score ?? '–'}</div>
        </div>
        <div className="small muted">(impact × urgency) ÷ effort</div>
        <div className="grow" />
        <div>
          <div className="label">Priority {sugPri && <span className="muted">· suggested {sugPri}</span>}</div>
          <Pick
            label="Priority"
            value={priority}
            options={PRIORITIES}
            disabled={disabled}
            onChange={(p) => set({ priority: p, priorityTouched: true })}
            render={(p) => <span>{p}</span>}
          />
        </div>
      </div>
      <div className="grid2">
        <label className="field">
          <span>System</span>
          <select className="input" value={draft.system ?? ''} disabled={disabled} onChange={(e) => set({ system: e.target.value || undefined, ownerTouched: draft.ownerTouched && !!draft.owner })}>
            <option value="">No system</option>
            {cfg.systems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Owner{item.ownerFromSource ? ` (assigned in ${srcName(item)})` : ''}</span>
          <select className="input" value={owner ?? ''} disabled={disabled || item.ownerFromSource} onChange={(e) => set({ owner: e.target.value || undefined, ownerTouched: true })}>
            <option value="">{item.ownerFromSource && item.source_owner ? `${item.source_owner} (not on the hub)` : 'No owner'}</option>
            {assignable(cfg).map((p) => (
              <option key={p.username} value={p.username}>
                {p.name}
                {sug?.username === p.username ? ' (suggested)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      {sys && (
        <div className="suggest">
          <Avatar user={item.ownerFromSource ? item.owner : sug?.username} config={cfg} external={item.ownerFromSource && !item.owner ? item.source_owner : undefined} />
          <div className="grow">
            <div style={{ fontWeight: 700 }}>
              {item.ownerFromSource ? (
                <>Assigned in {srcName(item)} to {item.owner ? ownerName(item.owner) : item.source_owner}</>
              ) : sug ? (
                <>Next in rotation: {ownerName(sug.username)} <span className="muted">({sug.slot})</span></>
              ) : (
                'No owners on the map for this system'
              )}
            </div>
            <div className="small muted">
              {item.ownerFromSource ? (sug ? `Rotation would have suggested ${ownerName(sug.username)}. Reassign in ${srcName(item)} if needed.` : '') : `${sug?.reason ?? ''}.`} Map: {ownerName(sys.primary) ?? '–'} → {ownerList(sys.secondary).map((u) => ownerName(u)).join(' / ') || '–'}
              {ownerList(sys.third).length ? ` → ${ownerList(sys.third).map((u) => ownerName(u)).join(' / ')}` : ''}
            </div>
          </div>
          {sug && owner !== sug.username && !item.ownerFromSource && (
            <button type="button" className="btn sm" disabled={disabled} onClick={() => set({ owner: sug.username, ownerTouched: true })}>
              Use {ownerName(sug.username)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

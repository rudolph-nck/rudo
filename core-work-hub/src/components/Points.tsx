// How points work: a small chart of what each priority is worth plus the bonuses, worked examples, and a
// per-item chip whose tooltip shows exactly how that item's points add up. Same rules as fun.closes().
import { useHub } from '../store/hub';
import { BACKLOG_BONUS, BADGES, ON_TIME_BONUS, POINTS, pointsPreview } from '../model/fun';
import { PRIORITIES, priorityStandardOf } from '../model/priority';
import type { WorkItem } from '../model/types';
import { Tip } from './ui';

const MAX = POINTS.P1 + ON_TIME_BONUS + BACKLOG_BONUS;
const whenText = (d: Date) => d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function PointsGuide({ badges = true }: { badges?: boolean }) {
  const { state } = useHub();
  const ps = priorityStandardOf(state.config);
  const target = (p: (typeof PRIORITIES)[number]) => (p === 'P1' && ps.P1.resolveDays <= 1 ? 'same business day' : `${ps[p].resolveDays} business days`);
  return (
    <div className="pts-guide">
      <p className="small" style={{ margin: 0 }}>
        Every ticket you close earns points for its <strong>priority</strong>, plus bonuses. Harder, on-time and older work is worth more than a pile of quick ones.
      </p>
      <div className="pts-chart" role="table" aria-label="Points per closed ticket">
        <div className="pts-row head" role="row">
          <span role="columnheader">Priority</span>
          <span role="columnheader" className="sr-only">Chart</span>
          <span role="columnheader">Closed</span>
          <span role="columnheader">On time</span>
          <span role="columnheader">Up to</span>
        </div>
        {PRIORITIES.map((p) => (
          <div key={p} className="pts-row" role="row">
            <span role="cell"><span className={`chip ${p.toLowerCase()}`}>{p}</span></span>
            <span role="cell" className="pts-bar" aria-hidden>
              <i className={`base ${p.toLowerCase()}`} style={{ width: `${(POINTS[p] / MAX) * 100}%` }} />
              <i className="ontime" style={{ width: `${(ON_TIME_BONUS / MAX) * 100}%` }} />
              <i className="backlog" style={{ width: `${(BACKLOG_BONUS / MAX) * 100}%` }} />
            </span>
            <span role="cell" className="num">{POINTS[p]}</span>
            <span role="cell" className="num">{POINTS[p] + ON_TIME_BONUS}<span className="small muted"> · {target(p)}</span></span>
            <span role="cell" className="num strong">{POINTS[p] + ON_TIME_BONUS + BACKLOG_BONUS}</span>
          </div>
        ))}
      </div>
      <div className="pts-legend small">
        <span><i className="sw base" /> Priority points</span>
        <span><i className="sw ontime" /> +{ON_TIME_BONUS} closed on time</span>
        <span><i className="sw backlog" /> +{BACKLOG_BONUS} backlog ticket</span>
      </div>
      <ul className="pts-rules small">
        <li><strong>On time</strong> means closed within the priority’s target to resolve, counted in business days from when the ticket was opened.</li>
        <li><strong>Backlog</strong> means opened before the standard started{ps.startFrom ? ` (${new Date(ps.startFrom + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })})` : ''}: clearing old work earns +{BACKLOG_BONUS}.</li>
        <li><strong>Who gets them:</strong> the owner when it closes. Tickets owned by someone not on the hub still count toward the team goal (the dumpster).</li>
        <li><strong>No priority yet</strong> counts as P4.</li>
      </ul>
      <div className="pts-examples small">
        <div><span className="chip p2">P2</span> closed in 2 business days → {POINTS.P2} + {ON_TIME_BONUS} = <strong>{POINTS.P2 + ON_TIME_BONUS}</strong></div>
        <div><span className="chip p3">P3</span> closed after its target → <strong>{POINTS.P3}</strong></div>
        <div><span className="chip p4">P4</span> backlog ticket, closed late → {POINTS.P4} + {BACKLOG_BONUS} = <strong>{POINTS.P4 + BACKLOG_BONUS}</strong></div>
        <div><span className="chip p1">P1</span> fixed the same day → {POINTS.P1} + {ON_TIME_BONUS} = <strong>{POINTS.P1 + ON_TIME_BONUS}</strong></div>
      </div>
      {badges && (
        <div className="pts-badges small">
          <strong>Badges:</strong> {Object.values(BADGES).map((x) => <span key={x.label} className="chip src" title={x.how}>{x.icon} {x.label}</span>)}
        </div>
      )}
    </div>
  );
}

/** "7 pts" with a tooltip showing how this item's points add up if it's closed now. */
export function PointsChip({ item }: { item: WorkItem }) {
  const { state } = useHub();
  const p = pointsPreview(state, item);
  const content = (
    <span className="pts-tip">
      <strong>Worth {p.worth} points if closed now</strong>
      <span>{p.priority}{p.ungraded ? ' (no priority yet, counts as P4)' : ''}: {p.base}</span>
      <span>{p.onTimeStill ? `+${ON_TIME_BONUS} on time: close by ${whenText(p.onTimeBy)}` : `On-time bonus missed (target was ${whenText(p.onTimeBy)})`}</span>
      {p.backlog && <span>+{BACKLOG_BONUS} backlog ticket</span>}
    </span>
  );
  return (
    <Tip content={content} label={`Worth ${p.worth} points`}>
      <span className={`chip pts-chip ${p.onTimeStill ? '' : 'late'}`}>{p.worth} pts</span>
    </Tip>
  );
}

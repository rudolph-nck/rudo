import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useHub } from '../store/hub';
import { addDays, checkWip, rankKeyAt, rankedList, todayISO, findPerson } from '../model/logic';
import { BUCKETS, BUCKET_LABEL, COLUMN_LABEL, isRanked, type Bucket, type Column, type NewEvent, type Source, type WorkItem } from '../model/types';
import { Modal, toast } from './ui';
import { ItemDrawer } from './ItemDrawer';

interface UiCtx {
  openItem: (id: string, tab?: 'grade') => void;
  openNew: (parent?: WorkItem) => void;
  /** Move with every rule applied: grading gate, ownership, WIP limit (+ override), rank placement, next-update default. */
  requestMove: (item: WorkItem, to: Column, opts?: MoveOpts) => Promise<boolean>;
  /** Claim a Ready (or To Do) card and start it: owner = me, then Doing, with the WIP check. */
  pickUp: (item: WorkItem) => Promise<boolean>;
}
export interface MoveOpts {
  /** Position in the destination's ranked list (To Do / Ready). */
  index?: number;
  extra?: NewEvent[];
  /** Already asked: reason for taking it off someone's plate. */
  reason?: string;
  release?: boolean;
}
const Ctx = createContext<UiCtx | null>(null);
export const useUi = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useUi outside provider');
  return c;
};

/** Events that place `item` at `index` of a bucket's ranked list (normalizing keys when the gap runs out). */
export function rankEvents(list: WorkItem[], item: WorkItem, index: number, bucket: Bucket, column: Column = 'To Do'): { pre: NewEvent[]; key: number } {
  const others = list.filter((i) => i.id !== item.id);
  const k = rankKeyAt(others, index);
  if (k !== undefined) return { pre: [], key: k };
  return { pre: [{ type: 'rank.normalize', data: { bucket, column, order: others.map((i) => i.id) } }], key: index + 0.5 };
}

/** Leaving Doing for one of these means the work is being taken off someone's plate: ask why. */
const OFF_PLATE: Column[] = ['On Hold', 'Ready', 'To Do'];

interface PendingHold {
  item: WorkItem;
  to: Column;
  opts: MoveOpts;
  resolve: (ok: boolean) => void;
}

interface PendingOverride {
  item: WorkItem;
  messages: string[];
  events: NewEvent[];
  resolve: (ok: boolean) => void;
}

export function UiProvider({ children }: { children: ReactNode }) {
  const { state, me, grader, readOnly, commit } = useHub();
  const [itemId, setItemId] = useState<string>();
  const [itemTab, setItemTab] = useState<'grade' | undefined>();
  const [newOpen, setNewOpen] = useState<{ parent?: WorkItem } | null>(null);
  const [override, setOverride] = useState<PendingOverride | null>(null);
  const [blocked, setBlocked] = useState<{ item: WorkItem; messages: string[] } | null>(null);
  const [reason, setReason] = useState('');
  const [hold, setHold] = useState<PendingHold | null>(null);
  const [holdTo, setHoldTo] = useState<Column>('On Hold');
  const [holdReason, setHoldReason] = useState('');
  const [holdRelease, setHoldRelease] = useState(false);
  const [holdTop, setHoldTop] = useState(true);

  const openItem = useCallback((id: string, tab?: 'grade') => {
    setItemId(id);
    setItemTab(tab);
  }, []);

  const requestMove = useCallback(
    async (item: WorkItem, to: Column, opts: MoveOpts = {}): Promise<boolean> => {
      if (readOnly) {
        toast('Read-only: you can view the board but not change it.');
        return false;
      }
      if (to === item.column && (!isRanked(to) || opts.index === undefined)) return false;
      if (to !== 'Intake' && (!item.bucket || (item.column === 'Intake' && !item.graded && !item.parent_id))) {
        if (grader) {
          openItem(item.id, 'grade');
          toast('Grade it first: pick a bucket and scores.');
        } else toast('Ungraded work stays in Intake until it is graded in standup.');
        return false;
      }
      if (!grader && item.owner && item.owner !== me) {
        toast(`Only ${findPerson(state.config, item.owner)?.name ?? item.owner} or Nick can move this card.`);
        return false;
      }
      // Reprioritizing: Doing -> On Hold / Ready / To Do needs a reason (logged on the card and in the audit trail).
      if (item.column === 'Doing' && OFF_PLATE.includes(to) && opts.reason === undefined) {
        return new Promise<boolean>((resolve) => {
          setHoldTo(to);
          setHoldReason('');
          setHoldRelease(to !== 'On Hold');
          setHoldTop(opts.index === undefined);
          setHold({ item, to, opts, resolve });
        });
      }
      const bucket = item.bucket!;
      const events: NewEvent[] = [...(opts.extra ?? [])];
      let owner = item.owner;
      if (!owner && !grader && !isRanked(to) && to !== 'Intake') {
        events.push({ type: 'item.update', item: item.id, data: { owner: me } });
        owner = me;
      }
      if (opts.release) owner = undefined;
      if (isRanked(to) && item.column === to && opts.index !== undefined) {
        if (!grader) {
          toast('Only Nick re-ranks (or the team in standup).');
          return false;
        }
        const { pre, key } = rankEvents(rankedList(state, bucket, to), item, opts.index, bucket, to);
        return commit([...events, ...pre, { type: 'item.rank', item: item.id, data: { rankKey: key } }]);
      }
      let rankKey: number | undefined;
      if (isRanked(to) && grader && opts.index !== undefined) {
        const r = rankEvents(rankedList(state, bucket, to), item, opts.index, bucket, to);
        events.push(...r.pre);
        rankKey = r.key;
      }
      if ((to === 'Doing' || to === 'Waiting') && !item.next_update_due)
        events.push({ type: 'item.update', item: item.id, data: { next_update_due: addDays(todayISO(), state.config.defaultUpdateDays) } });
      const mv = (ov?: string): NewEvent => ({
        type: 'item.move',
        item: item.id,
        data: {
          column: to,
          ...(rankKey !== undefined ? { rankKey } : {}),
          ...(ov ? { override: ov } : {}),
          ...(opts.reason ? { reason: opts.reason } : {}),
          ...(opts.release ? { release: true } : {}),
        },
      });
      const wip = checkWip(state, item, owner, to);
      if (!wip.ok) {
        if (!grader) {
          setBlocked({ item, messages: wip.messages });
          return false;
        }
        return new Promise<boolean>((resolve) => {
          setReason('');
          setOverride({ item, messages: wip.messages, events, resolve });
        });
      }
      return commit([...events, mv()]);
    },
    [commit, grader, me, openItem, readOnly, state],
  );

  const pickUp = useCallback(
    async (item: WorkItem) => {
      if (item.owner && item.owner !== me) {
        toast(`${findPerson(state.config, item.owner)?.name ?? item.owner} already owns this.`);
        return false;
      }
      const extra: NewEvent[] = item.owner ? [] : [{ type: 'item.update', item: item.id, data: { owner: me } }];
      const ok = await requestMove({ ...item, owner: me }, 'Doing', { extra });
      if (ok) toast('Picked up. It’s in your Doing now.');
      return ok;
    },
    [me, requestMove, state.config],
  );

  const confirmHold = async () => {
    if (!hold || !holdReason.trim()) return;
    const { item, opts, resolve } = hold;
    setHold(null);
    const index = isRanked(holdTo) ? (holdTop && grader ? 0 : holdTo === hold.to ? opts.index : undefined) : undefined;
    const ok = await requestMove(item, holdTo, { ...opts, index, reason: holdReason.trim(), release: holdRelease && !!item.owner });
    resolve(ok);
    if (ok) toast(holdTo === 'On Hold' ? 'On hold. Reason saved on the card.' : `Back in ${COLUMN_LABEL[holdTo]}${holdRelease ? ' for anyone to pick up' : ''}.`);
  };

  const confirmOverride = async () => {
    if (!override || !reason.trim()) return;
    const { item, events, resolve } = override;
    const ok = await commit([...events, { type: 'item.move', item: item.id, data: { column: 'Doing', override: reason.trim() } }]);
    setOverride(null);
    resolve(ok);
    if (ok) toast('Moved. Override logged with your reason.');
  };

  const item = itemId ? state.items.get(itemId) : undefined;

  return (
    <Ctx.Provider value={{ openItem, openNew: (parent) => setNewOpen({ parent }), requestMove, pickUp }}>
      {children}
      {item && <ItemDrawer item={item} initialTab={itemTab} onClose={() => setItemId(undefined)} />}
      {newOpen && <NewWorkDialog parent={newOpen.parent} onClose={() => setNewOpen(null)} />}
      <Modal
        open={!!override}
        onClose={() => {
          override?.resolve(false);
          setOverride(null);
        }}
        title="WIP limit exceeded"
        footer={
          <>
            <button className="btn" onClick={() => { override?.resolve(false); setOverride(null); }}>
              Cancel
            </button>
            <button className="btn primary" disabled={!reason.trim()} onClick={confirmOverride}>
              Override and move
            </button>
          </>
        }
      >
        <div className="banner warn" role="alert">
          <div>
            {override?.messages.map((m) => (
              <div key={m}>{m}</div>
            ))}
          </div>
        </div>
        <p style={{ margin: 0 }}>
          Moving <strong>{override?.item.title}</strong> to Doing breaks the limit. Overriding is logged in the audit trail with your reason.
        </p>
        <label className="field">
          <span>Reason for the override (required)</span>
          <textarea className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. P1 outage, Trey pausing the cert renewal" autoFocus />
        </label>
      </Modal>
      <Modal
        open={!!hold}
        onClose={() => {
          hold?.resolve(false);
          setHold(null);
        }}
        title="Take it off the plate"
        footer={
          <>
            <button className="btn" onClick={() => { hold?.resolve(false); setHold(null); }}>
              Cancel
            </button>
            <button className="btn primary" disabled={!holdReason.trim()} onClick={confirmHold}>
              Move to {COLUMN_LABEL[holdTo]}
            </button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          <strong>{hold?.item.title}</strong> is leaving Doing
          {hold?.item.owner ? ` (${findPerson(state.config, hold.item.owner)?.name ?? hold.item.owner})` : ''}. Where should it go?
        </p>
        <div className="seg" role="radiogroup" aria-label="Destination" style={{ alignSelf: 'flex-start' }}>
          {OFF_PLATE.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={holdTo === c}
              onClick={() => {
                setHoldTo(c);
                setHoldRelease(c !== 'On Hold');
              }}
            >
              {COLUMN_LABEL[c]}
            </button>
          ))}
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          {holdTo === 'On Hold'
            ? 'Paused on purpose. Doesn’t count against anyone’s WIP limit; the reason shows on the card.'
            : holdTo === 'Ready'
              ? 'Ranked and ready for whoever has capacity to pick up next.'
              : 'Back into the bucket’s ranked To Do list for re-planning.'}
        </p>
        <label className="field">
          <span>Why is it coming off the plate? (required)</span>
          <textarea className="input" value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder="e.g. Reprioritized for the core upgrade; resume after Dec 5" autoFocus />
        </label>
        {hold?.item.owner && (
          <label className="toggle" style={{ alignSelf: 'flex-start' }}>
            <input type="checkbox" checked={holdRelease} onChange={(e) => setHoldRelease(e.target.checked)} />
            Release {findPerson(state.config, hold.item.owner)?.name ?? hold.item.owner} so anyone can pick it up
          </label>
        )}
        {isRanked(holdTo) && grader && (
          <label className="toggle" style={{ alignSelf: 'flex-start' }}>
            <input type="checkbox" checked={holdTop} onChange={(e) => setHoldTop(e.target.checked)} />
            Put it at the top of {COLUMN_LABEL[holdTo]}
          </label>
        )}
      </Modal>
      <Modal
        open={!!blocked}
        onClose={() => setBlocked(null)}
        title="Over the WIP limit"
        footer={<button className="btn primary" onClick={() => setBlocked(null)}>OK</button>}
      >
        <div className="banner warn" role="alert">
          <div>
            {blocked?.messages.map((m) => (
              <div key={m}>{m}</div>
            ))}
          </div>
        </div>
        <p style={{ margin: 0 }}>Finish or park something in Doing first, or ask Nick to override the limit for this card.</p>
      </Modal>
    </Ctx.Provider>
  );
}

function NewWorkDialog({ parent, onClose }: { parent?: WorkItem; onClose: () => void }) {
  const { commit, grader, me } = useHub();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requester, setRequester] = useState('');
  const [source, setSource] = useState<Source>('Hub');
  const [sourceId, setSourceId] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [bucket, setBucket] = useState<Bucket | ''>(parent?.bucket ?? '');
  const valid = title.trim().length > 2 && (source === 'Hub' || sourceId.trim());
  const submit = async () => {
    if (!valid) return;
    const id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const ok = await commit([
      {
        type: 'item.create',
        item: id,
        data: {
          source,
          title: title.trim(),
          description: description.trim() || undefined,
          requester: requester.trim() || undefined,
          source_id: source !== 'Hub' ? sourceId.trim() : undefined,
          source_url: sourceUrl.trim() || undefined,
          bucket: bucket || undefined,
          parent_id: parent?.id,
          // A split task inherits the parent's grade context and goes straight to To Do when Nick creates it.
          owner: parent ? parent.owner ?? (grader ? undefined : me) : undefined,
        },
      },
      ...(parent && grader && parent.bucket
        ? ([
            { type: 'item.grade', item: id, data: { bucket: parent.bucket, priority: parent.priority ?? 'P3', impact: parent.impact ?? 3, urgency: parent.urgency ?? 3, effort: 1, system: parent.system, owner: parent.owner } },
            { type: 'item.move', item: id, data: { column: 'To Do' } },
          ] as NewEvent[])
        : []),
    ]);
    if (ok) {
      toast(parent ? 'Task added.' : 'Submitted to Intake for grading.');
      onClose();
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={parent ? `Split into a task: ${parent.title}` : 'New work'}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!valid} onClick={submit}>
            {parent ? 'Add task' : 'Submit to Intake'}
          </button>
        </>
      }
    >
      {!parent && (
        <p className="muted" style={{ margin: 0 }}>
          No ticket, no work: anything from email should be forwarded to Service Desk. Use this for projects, Wrike tasks, and calendar maintenance.
        </p>
      )}
      <label className="field">
        <span>Title</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder={parent ? 'A task that fits in a day' : 'What needs doing?'} />
      </label>
      {!parent && (
        <>
          <div className="grid2">
            <label className="field">
              <span>Where it lives</span>
              <select className="input" value={source} onChange={(e) => setSource(e.target.value as Source)}>
                <option value="Hub">Hub only (project, calendar maintenance)</option>
                <option value="Wrike">Wrike task (entered by hand)</option>
                <option value="SD">Service Desk ticket</option>
              </select>
            </label>
            <label className="field">
              <span>Suggested bucket (optional)</span>
              <select className="input" value={bucket} onChange={(e) => setBucket(e.target.value as Bucket | '')}>
                <option value="">Let grading decide</option>
                {BUCKETS.map((b) => (
                  <option key={b} value={b}>
                    {BUCKET_LABEL[b]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {source !== 'Hub' && (
            <div className="grid2">
              <label className="field">
                <span>{source === 'SD' ? 'Ticket number' : 'Wrike task ID'}</span>
                <input className="input" value={sourceId} onChange={(e) => setSourceId(e.target.value)} />
              </label>
              <label className="field">
                <span>Link (optional)</span>
                <input className="input" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://" />
              </label>
            </div>
          )}
          <label className="field">
            <span>Requester (optional)</span>
            <input className="input" value={requester} onChange={(e) => setRequester(e.target.value)} />
          </label>
        </>
      )}
      <label className="field">
        <span>Notes (optional, no member data)</span>
        <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
    </Modal>
  );
}

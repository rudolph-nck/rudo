// Core Work Hub data model.
//
// Two kinds of data, kept strictly apart:
//  * Source-owned fields (title, requester, status...) come from tickets.json (Service Desk sync or CSV import)
//    or from the item.create event of a hub-entered item. The hub never edits them for synced items.
//  * Hub-owned fields (bucket, column, rank, grade, owner, next update...) only ever come from events in the
//    per-person change files (changes/<username>.jsonl). State = snapshot + replay(events in time order).

export type Source = 'SD' | 'Wrike' | 'Hub';
export type Bucket = 'Project' | 'Maintenance' | 'Support';
export type Column = 'Intake' | 'To Do' | 'Ready' | 'Doing' | 'On Hold' | 'Waiting' | 'Done';
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export type Role = 'manager' | 'analyst' | 'viewer';
export type TimeBucket = 'projects' | 'maintenance' | 'owner_tickets' | 'dispatch' | 'documentation';

export const BUCKETS: Bucket[] = ['Project', 'Maintenance', 'Support'];
export const COLUMNS: Column[] = ['Intake', 'To Do', 'Ready', 'Doing', 'On Hold', 'Waiting', 'Done'];
/** Columns kept in a force-ranked order per bucket. */
export const RANKED_COLUMNS: Column[] = ['To Do', 'Ready'];
export const isRanked = (c?: Column) => !!c && RANKED_COLUMNS.includes(c);
export const COLUMN_LABEL: Record<Column, string> = { Intake: 'Intake', 'To Do': 'To Do', Ready: 'Ready to pick up', Doing: 'Doing', 'On Hold': 'On Hold', Waiting: 'Waiting', Done: 'Done' };
export const PRIORITIES: Priority[] = ['P1', 'P2', 'P3', 'P4'];
export const TIME_BUCKETS: { key: TimeBucket; label: string }[] = [
  { key: 'projects', label: 'Projects' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'owner_tickets', label: 'Owner tickets' },
  { key: 'dispatch', label: 'Dispatch' },
  { key: 'documentation', label: 'Documentation' },
];
export const BUCKET_LABEL: Record<Bucket, string> = { Project: 'Projects', Maintenance: 'Maintenance', Support: 'Support' };

/** One row of tickets.json, written by the sync script (or the CSV importer). Metadata only, never descriptions. */
export interface SourceTicket {
  source: Source;
  source_id: string;
  source_url?: string;
  title: string;
  requester?: string;
  source_status: string;
  /** Raw priority text from the source, e.g. "High". Seeds the hub priority until the item is graded. */
  source_priority?: string;
  /** Technician / assignee display name or username from the source. Seeds owner until the hub sets one. */
  source_owner?: string;
  group?: string;
  category?: string;
  /** Service Desk sub-category ("Symitar Quest", "Meridian Link"…); seeds the item's system via the ownership map. */
  subcategory?: string;
  department?: string;
  /** Service Desk SLA due date. */
  due_by?: string;
  created: string;
  closed?: string;
  /** Per-field timestamps of when the *source* last changed that field (set by the sync), used for conflicts. */
  changed?: { source_owner?: string; source_priority?: string };
}

export interface TicketsSnapshot {
  generatedAt: string;
  generatedBy: string;
  /** "api" (sync script), "csv" (import) or "demo". */
  mode: string;
  items: SourceTicket[];
}

export interface Person {
  /** Windows username; names the change file changes/<username>.jsonl. */
  username: string;
  name: string;
  role: Role;
  /** Initials override for the avatar. */
  initials?: string;
  /** Doing limit for this analyst. */
  wipLimit?: number;
  /** A manager who also takes tickets: shows in the Team view, capacity strip and WIP limits. */
  works?: boolean;
  /** Optional per-bucket Doing limit for this analyst. */
  bucketWip?: Partial<Record<Bucket, number>>;
  /** Name/username as it appears in Service Desk, to map technician -> analyst. */
  sdName?: string;
}

export interface SystemOwnership {
  id: string;
  name: string;
  /** Service Desk sub-categories (or categories) that belong to this system, e.g. ["Symitar Quest", "SymXchange"]. */
  aliases?: string[];
  primary?: string;
  secondary?: string;
  third?: string;
  criticality?: 'High' | 'Medium' | 'Low';
}

export interface DispatchShift {
  analyst: string;
  backup?: string;
  /** Escalation point for the shift (from the rotation). */
  escalation?: string;
  /** True for shifts computed from the rotation (not a hand-entered cover/swap). */
  generated?: boolean;
  /** ISO dates, inclusive. */
  from: string;
  to: string;
}

export type ShiftLength = 'week' | '2weeks' | 'month';

export interface Rotation {
  /** Running order of usernames. */
  order: string[];
  shift: ShiftLength;
  /** Who is on now, and the last day of their shift: the schedule runs on from here. */
  current: { analyst: string; until: string };
  /** Escalation point behind level 1. */
  escalation?: string;
  /** People temporarily out of the rotation. No `until` = until further notice. Keep reasons private. */
  out: { username: string; until?: string }[];
}

export interface HubConfig {
  teamName: string;
  people: Person[];
  systems: SystemOwnership[];
  /** Hand-entered covers and swaps. They take precedence over the rotation for their dates. */
  dispatch: DispatchShift[];
  /** Level 1 support rotation: computed shift by shift from this. */
  rotation?: Rotation;
  /** Team-wide Doing limit per bucket (sum over everyone). */
  bucketWip: Partial<Record<Bucket, number>>;
  defaultWipLimit: number;
  /** Weekly hours per capacity bucket from the communication standards. */
  capacityModel: Record<TimeBucket, number>;
  /** Service Desk statuses that move a card to Done automatically. */
  closedStatuses: string[];
  /** Statuses that mean "ready to close" (resolved but not yet closed). */
  resolvedStatuses: string[];
  /** Link pattern per source; {id} is the ticket/task number. Used when a row has no link of its own. */
  ticketUrls: Partial<Record<Source, string>>;
  /**
   * Service Desk statuses that put a card in a column automatically (case-insensitive; a trailing * matches
   * any ending, e.g. "Waiting*"). Closed statuses always mean Done.
   */
  statusColumns: Record<string, Column | null>;
  /** Columns that Service Desk status controls for synced tickets: the hub won't move SD cards into or out of them. */
  sourceDrivenColumns: Column[];
  /** When true, analysts may grade and rank too (team grading in standup from any seat). */
  analystsCanGrade: boolean;
  /** Days without a next-update date before a Doing/Waiting item counts as overdue. */
  defaultUpdateDays: number;
}

// ---------------------------------------------------------------------------------------------
// Events: one JSON object per line in changes/<username>.jsonl. Append-only; this IS the audit log.

interface EventBase {
  /** Random id, unique per event. */
  id: string;
  /** ISO timestamp from the writer's clock. */
  ts: string;
  /** Username of the writer. Replay trusts the *file name* over this field. */
  user: string;
  /** Values of the touched fields just before the change, for the audit trail. */
  before?: Record<string, unknown>;
}

export interface Grade {
  bucket: Bucket;
  priority: Priority;
  impact: number;
  urgency: number;
  effort: number;
  system?: string;
  owner?: string;
}

export type HubEvent = EventBase &
  (
    | { type: 'item.create'; item: string; data: { source: Source; source_id?: string; source_url?: string; title: string; description?: string; requester?: string; bucket?: Bucket; parent_id?: string; owner?: string; column?: Column } }
    | { type: 'item.grade'; item: string; data: Grade }
    | { type: 'item.move'; item: string; data: { column: Column; rankKey?: number; override?: string; reason?: string; release?: boolean } }
    | { type: 'item.rank'; item: string; data: { rankKey: number } }
    | { type: 'rank.normalize'; data: { bucket: Bucket; column?: Column; order: string[] } }
    | { type: 'item.update'; item: string; data: { owner?: string | null; priority?: Priority; next_update_due?: string | null; title?: string; description?: string; parent_id?: string | null; bucket?: Bucket; system?: string } }
    | { type: 'item.ack'; item: string; data: Record<string, never> }
    | { type: 'item.comment'; item: string; data: { text: string } }
    | { type: 'item.reply'; item: string; data: { via: string } }
    | { type: 'time.log'; item?: string; data: { bucket: TimeBucket; hours: number; date: string; note?: string } }
    | { type: 'config.person'; data: { username: string; wipLimit?: number; bucketWip?: Partial<Record<Bucket, number>>; sdName?: string } }
    | { type: 'config.bucketWip'; data: Partial<Record<Bucket, number>> }
    | { type: 'config.dispatch'; data: { shifts: DispatchShift[] } }
    | { type: 'config.rotation'; data: Rotation }
    | { type: 'config.system'; data: SystemOwnership & { deleted?: boolean } }
  );

export type HubEventType = HubEvent['type'];
/** Distributive Omit so each event variant keeps its own data shape. */
type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewEvent = DistOmit<HubEvent, 'id' | 'ts' | 'user'>;

// ---------------------------------------------------------------------------------------------
// Derived state

export interface Comment { id: string; ts: string; user: string; text: string }

export interface WorkItem {
  id: string;
  source: Source;
  source_id?: string;
  source_url?: string;
  title: string;
  description?: string;
  requester?: string;
  source_status: string;
  source_owner?: string;
  bucket?: Bucket;
  column: Column;
  /** Sort key inside the bucket's ranked list (To Do or Ready). Display rank (1..n, unique) is derived from it. */
  rankKey?: number;
  rank?: number;
  priority?: Priority;
  impact?: number;
  urgency?: number;
  effort?: number;
  score?: number;
  system?: string;
  owner?: string;
  /** Owner acknowledged the assignment. Reset whenever owner changes. */
  acked: boolean;
  next_update_due?: string;
  /** Why it was taken off the plate (set when moved to On Hold or released to Ready from Doing). */
  hold?: { reason: string; since: string; user: string; from?: Column };
  parent_id?: string;
  created: string;
  graded?: string;
  started?: string;
  done?: string;
  /** Service Desk SLA due date. */
  due_by?: string;
  /** When the card entered its current column (for "stuck for N days"). */
  columnSince?: string;
  /** Last time anything happened to the item (any event or source change). */
  touched: string;
  comments: Comment[];
  /** Snapshot no longer lists the item (e.g. aged out after 90 days closed). */
  stale?: boolean;
  /** Source says closed (auto-Done). */
  sourceClosed?: boolean;
  sourceResolved?: boolean;
  /** Owner comes from the Service Desk technician (reassign in Service Desk, not here). */
  ownerFromSource?: boolean;
  subcategory?: string;
  /** Set when the card's column comes from its Service Desk status (it can't be moved in the hub). */
  statusDriven?: Column;
}

export interface Conflict { ts: string; item: string; field: string; hubValue: unknown; sourceValue: unknown; hubUser: string }

export interface AuditEntry {
  event: HubEvent;
  /** File the event came from (username). */
  file: string;
  /** Set when replay refused the event (permission or validation). */
  rejected?: string;
}

export interface TimeEntry { id: string; ts: string; user: string; item?: string; bucket: TimeBucket; hours: number; date: string; note?: string }

export interface HubState {
  config: HubConfig;
  items: Map<string, WorkItem>;
  audit: AuditEntry[];
  conflicts: Conflict[];
  time: TimeEntry[];
  snapshot?: TicketsSnapshot;
}

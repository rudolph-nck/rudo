import { AVATAR_COLORS } from '../model/avatar';
import { STANDUP_LABEL } from '../model/types';
import { findPerson, systemName } from '../model/logic';
import type { HubConfig, HubEvent } from '../model/types';

const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));

/** Human sentence for one audit event, including before → after where the event recorded it. */
export function describeEvent(e: HubEvent, cfg: HubConfig): string {
  const who = (u?: unknown) => (typeof u === 'string' ? findPerson(cfg, u)?.name ?? u : '—');
  const b = (k: string) => (e.before ? e.before[k] : undefined);
  switch (e.type) {
    case 'item.create':
      return `created this (${e.data.source}${e.data.source_id ? ' #' + e.data.source_id : ''})`;
    case 'item.grade': {
      const g = e.data;
      const parts = [`${g.bucket}, ${g.priority}`, `I${g.impact}/U${g.urgency}/E${g.effort}`];
      if (g.system) parts.push(systemName(cfg.systems, g.system) ?? g.system);
      if (g.owner) parts.push(`owner ${who(g.owner)}`);
      const was = e.before && e.before.bucket ? ` (was ${fmt(b('bucket'))}, ${fmt(b('priority'))}, owner ${who(b('owner'))})` : '';
      return `graded: ${parts.join(' · ')}${was}`;
    }
    case 'item.move':
      return `moved ${fmt(b('column'))} → ${e.data.column}${e.data.release ? ' and released the owner' : ''}${e.data.reason ? ` — reason: “${e.data.reason}”` : ''}${e.data.override ? ` — WIP override: “${e.data.override}”` : ''}`;
    case 'item.rank':
      return `re-ranked (was #${fmt(b('rankKey'))})`;
    case 'rank.normalize':
      return `renumbered the ${e.data.bucket} ${e.data.column ?? 'To Do'} list`;
    case 'item.update': {
      const d = e.data;
      const bits: string[] = [];
      if (d.owner !== undefined) bits.push(`owner ${who(b('owner'))} → ${who(d.owner)}`);
      if (d.next_update_due !== undefined) bits.push(`next update ${fmt(b('next_update_due'))} → ${fmt(d.next_update_due)}`);
      if (d.priority !== undefined) bits.push(`priority ${fmt(b('priority'))} → ${d.priority}`);
      if (d.title !== undefined) bits.push(`title → “${d.title}”`);
      if (d.description !== undefined) bits.push('edited notes');
      if (d.parent_id !== undefined) bits.push('changed parent');
      if (d.bucket !== undefined) bits.push(`bucket ${fmt(b('bucket'))} → ${d.bucket}`);
      if (d.system !== undefined) bits.push(`system → ${systemName(cfg.systems, d.system)}`);
      return 'changed ' + bits.join(', ');
    }
    case 'item.ack':
      return 'acknowledged the assignment';
    case 'item.comment':
      return `commented: “${e.data.text.length > 80 ? e.data.text.slice(0, 80) + '…' : e.data.text}”`;
    case 'item.reply':
      return `replied to the requester (${e.data.via})`;
    case 'time.log':
      return `logged ${e.data.hours}h to ${e.data.bucket.replace('_', ' ')} on ${e.data.date}`;
    case 'item.reprioritize':
      return `changed priority to ${e.data.priority}: ${e.data.reason}${e.data.toldRequester ? ' (requester told)' : ''}${e.data.managerAware ? ' (discussed with Matt)' : ''}`;
    case 'item.standup':
      return `stand-up check-in: ${STANDUP_LABEL[e.data.status]}${e.data.note ? ` (${e.data.note})` : ''}`;
    case 'item.commit':
      return e.data.date ? `committed to ${e.data.date}${e.data.note ? `: ${e.data.note}` : ''}` : 'cleared the commitment date';
    case 'config.capacity':
      return `set the ${e.data.level === 'support' ? 'support-week' : e.data.level} time split (${Object.values(e.data.hours).join('/')} h)`;
    case 'config.priorityStandard':
      return `changed the priority standard${e.data.startFrom !== undefined ? ` (start date ${e.data.startFrom || 'none'})` : ''}`;
    case 'profile.set': {
      const d = e.data;
      const parts = [
        d.photo !== undefined && (d.photo ? 'a new photo' : 'no photo'),
        d.emoji !== undefined && (d.emoji ? `emoji ${d.emoji}` : 'no emoji'),
        d.color !== undefined && (d.color ? `colour ${AVATAR_COLORS.find((c) => c.color === d.color)?.name ?? d.color}` : 'default colour'),
      ].filter(Boolean);
      return `changed their avatar${parts.length ? ': ' + parts.join(', ') : ''}`;
    }
    case 'config.person':
      return e.data.level !== undefined ? `set ${who(e.data.username)}'s level to ${e.data.level ?? 'none'}` : `set ${who(e.data.username)}'s WIP limit to ${fmt(e.data.wipLimit)}`;
    case 'config.bucketWip':
      return `set bucket WIP limits: ${Object.entries(e.data).map(([k, v]) => `${k} ${fmt(v)}`).join(', ')}`;
    case 'config.dispatch':
      return `updated the dispatch rotation (${e.data.shifts.length} shifts)`;
    case 'config.rotation':
      return `updated the support rotation (${e.data.order.map((u) => who(u)).join(' → ')}, ${e.data.shift === 'month' ? 'monthly' : e.data.shift === 'week' ? 'weekly' : 'every 2 weeks'})`;
    case 'config.timeoff':
      return `${e.data.deleted ? 'removed' : 'set'} time off for ${who(e.data.username)}: ${e.data.from}${e.data.to !== e.data.from ? ` to ${e.data.to}` : ''}${e.data.cover && !e.data.deleted ? `, ${who(e.data.cover)} covering` : ''}`;
    case 'team.rate':
      return `rated it for the team score (${Object.entries(e.data.ratings).map(([k, v]) => `${k} ${v}`).join(', ')})`;
    case 'team.score':
      return e.data.score === null ? 'cleared the team’s set score' : `set the team score to ${e.data.score}${e.data.reason ? ` — “${e.data.reason}”` : ''}`;
    case 'item.expedite':
      return 'clear' in e.data
        ? `cleared the forced priority${e.data.reason ? ` — “${e.data.reason}”` : ''}`
        : `forced this to the top: requested by ${e.data.requestedBy}${e.data.approvedBy ? `, approved by ${e.data.approvedBy}` : ''} — “${e.data.reason}”${e.data.holds?.length ? ` (${e.data.holds.length} item${e.data.holds.length === 1 ? '' : 's'} put on hold)` : ''}`;
    case 'config.system':
      return `${e.data.deleted ? 'removed' : 'updated'} system “${e.data.name}” on the ownership map`;
  }
}

import { findPerson } from '../model/logic';
import type { HubConfig, WorkItem } from '../model/types';
import type { CommNotice } from '../model/comms';
import { Icon, toast } from './ui';

/*
 * Teams without a server: deep links open a Teams chat with the message already typed, and the person presses
 * Send. Needs each person's work email (Teams sign-in) in hub-config.json ("email").
 * https://learn.microsoft.com/microsoftteams/platform/concepts/build-and-test/deep-link-teams
 */

export function teamsChatLink(emails: string[], message: string) {
  return `https://teams.microsoft.com/l/chat/0/0?users=${emails.map(encodeURIComponent).join(',')}&message=${encodeURIComponent(message)}`;
}

/** "Message in Teams" button for one or more hub people. Hidden when nobody has an email configured. */
export function TeamsButton({ config, to, message, label = 'Message in Teams', small = true }: { config: HubConfig; to: (string | undefined)[]; message: string; label?: string; small?: boolean }) {
  const emails = to.map((u) => findPerson(config, u)?.email).filter((e): e is string => !!e);
  if (!emails.length) return null;
  return (
    <a className={`btn ${small ? 'sm' : ''}`} href={teamsChatLink([...new Set(emails)], message)} target="_blank" rel="noreferrer" title="Opens a Teams chat with the message ready to send">
      <Icon name="chat" size={14} /> {label}
    </a>
  );
}

export function nudgeText(config: HubConfig, i: WorkItem, n: CommNotice) {
  const owner = findPerson(config, i.owner)?.name ?? 'team';
  return `Hi ${owner}, ticket #${i.source_id} "${i.title}" needs its ${n.status.label.replace(/^(?!P1)\w/, (c) => c.toLowerCase())} for the requester (${n.status.lateMinutes ? 'it is past due' : 'due soon'}). Please update it in Service Desk and log it in the Core Work Hub. Thanks!`;
}

/** Plain-text digest of notices, ready to paste into a Teams channel. */
export function digestText(config: HubConfig, title: string, notices: CommNotice[]) {
  const name = (u?: string) => findPerson(config, u)?.name ?? u ?? 'no owner';
  const lines = notices.map((n) => `• #${n.item.source_id} ${n.item.title} — ${n.status.label}, ${n.status.lateMinutes ? 'late' : 'due soon'} (owner: ${n.item.owner ? name(n.item.owner) : n.item.source_owner ?? 'none'})`);
  return [`${title} — ${new Date().toLocaleString()}`, ...(lines.length ? lines : ['Everything is on time.'])].join('\n');
}

export async function copyAndOpenChannel(config: HubConfig, text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(config.teamsChannelUrl ? 'Digest copied. Paste it into the channel.' : 'Digest copied. Paste it into your Teams channel.');
  } catch {
    toast('Copy failed: select the text and copy it.');
  }
  if (config.teamsChannelUrl) window.open(config.teamsChannelUrl, '_blank', 'noopener');
}

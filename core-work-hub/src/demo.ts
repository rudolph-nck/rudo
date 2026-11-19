import { defaultConfig } from './model/config';
import { addDays, todayISO } from './model/logic';
import type { Bucket, Column, HubConfig, HubEvent, Priority, SourceTicket, TicketsSnapshot } from './model/types';

/** Sample board so the hub can be tried without the shared folder. Clearly labelled as demo data in the UI. */
export function demoSeed(): { config: HubConfig; snapshot: TicketsSnapshot; events: HubEvent[] } {
  const config = defaultConfig();
  const today = todayISO();
  const monday = addDays(today, -((new Date().getDay() + 6) % 7));
  // Demo rotation: the same running order, with the current shift ending this coming Sunday.
  config.rotation = { ...config.rotation!, shift: 'week', current: { analyst: 'trey', until: addDays(monday, 6) } };
  config.bucketWip = { Project: 4 };

  const now = Date.now();
  const ago = (days: number, h = 0) => new Date(now - days * 86400000 - h * 3600000).toISOString();
  let seq = 0;
  const ev = (user: string, daysAgo: number, e: Omit<HubEvent, 'id' | 'ts' | 'user'>): HubEvent =>
    ({ id: `demo-${String(++seq).padStart(4, '0')}`, ts: new Date(now - daysAgo * 86400000 - 3600000 + seq * 10000).toISOString(), user, ...e }) as HubEvent;

  type Row = [id: string, title: string, requester: string, status: string, pri: string, tech: string, ageDays: number];
  const sd: Row[] = [
    ['48211', 'VPN disconnects every 20 minutes for remote staff', 'Dana Ortiz', 'Open', 'High', '', 1],
    ['48207', 'New hire setup: 3 branch tellers starting Monday', 'HR Operations', 'Open', 'Medium', '', 2],
    ['48199', 'Shared mailbox permissions for Lending team', 'Priya Shah', 'Open', 'Low', '', 3],
    ['48190', 'Printer on 2nd floor shows offline', 'Front desk', 'Open', 'Low', '', 0],
    ['48188', 'Renew wildcard TLS certificate (expires in 21 days)', 'Nick', 'Open', 'High', 'Trey', 6],
    ['48180', 'Patch Tuesday: server group B', 'Change board', 'Open', 'Medium', 'Michael', 8],
    ['48174', 'Teams phone number port for call center', 'Call Center', 'Waiting for vendor', 'Medium', 'Noelle', 12],
    ['48166', 'Intune compliance policy failing on 14 laptops', 'Security', 'Open', 'High', 'Tabitha', 5],
    ['48160', 'Quarterly restore test: file server', 'Audit', 'Open', 'Medium', 'Noelle', 10],
    ['48155', 'Disable accounts for 4 leavers', 'HR Operations', 'Resolved', 'High', 'Cathy', 4],
    ['48151', 'Firewall rule review (quarterly)', 'Audit', 'Open', 'Medium', 'Trey', 16],
    ['48149', 'Mailbox over quota: Finance shared inbox', 'Finance', 'Open', 'Medium', 'Wes', 3],
    ['48140', 'Replace failing disk in host ESX-04', 'Monitoring', 'Closed', 'High', 'Michael', 9],
    ['48133', 'Conference room display not detecting laptops', 'Facilities', 'Closed', 'Low', 'Tabitha', 14],
    ['48120', 'MFA re-registration for 6 users', 'Service Desk', 'Closed', 'Medium', 'Cathy', 18],
    ['48118', 'Expand SAN volume for document imaging', 'Monitoring', 'Open', 'Medium', 'Michael', 20],
    ['48102', 'Scan-to-email broken after password change', 'Branch 4', 'Open', 'Low', 'Tabitha', 7],
  ];
  const tickets: SourceTicket[] = sd.map(([id, title, req, status, pri, tech, age]) => ({
    source: 'SD',
    source_id: id,
    source_url: `https://servicedesk.example.com/WorkOrder.do?woMode=viewWO&woID=${id}`,
    title,
    requester: req,
    source_status: status,
    source_priority: pri,
    source_owner: tech || undefined,
    group: 'IT Core',
    created: ago(age, 3),
    closed: status === 'Closed' ? ago(Math.max(0, age - 3)) : undefined,
  }));

  const events: HubEvent[] = [];
  const grade = (item: string, d: number, bucket: Bucket, priority: Priority, i: number, u: number, e: number, system: string, owner?: string) =>
    events.push(ev('nick', d, { type: 'item.grade', item, data: { bucket, priority, impact: i, urgency: u, effort: e, system, owner } } as never));
  const move = (user: string, item: string, d: number, column: Column, override?: string) =>
    events.push(ev(user, d, { type: 'item.move', item, data: { column, ...(override ? { override } : {}) } } as never));
  const next = (user: string, item: string, d: number, due: string) =>
    events.push(ev(user, d, { type: 'item.update', item, data: { next_update_due: due } } as never));
  const ack = (user: string, item: string, d: number) => events.push(ev(user, d, { type: 'item.ack', item, data: {} } as never));

  // Hub-entered and Wrike items
  const create = (user: string, item: string, d: number, source: 'Hub' | 'Wrike', title: string, extra: Record<string, unknown> = {}) =>
    events.push(ev(user, d, { type: 'item.create', item, data: { source, title, ...extra } } as never));
  create('nick', 'hub-sp-migration', 30, 'Wrike', 'Migrate department file shares to SharePoint', { source_id: '4410021', source_url: 'https://www.wrike.com/open.htm?id=4410021', requester: 'Matt' });
  create('nick', 'hub-sp-1', 29, 'Hub', 'Inventory share permissions for Lending', { parent_id: 'hub-sp-migration' });
  create('nick', 'hub-sp-2', 29, 'Hub', 'Create Lending SharePoint site + groups', { parent_id: 'hub-sp-migration' });
  create('nick', 'hub-sp-3', 29, 'Hub', 'Pilot migration: Lending (one folder)', { parent_id: 'hub-sp-migration' });
  create('nick', 'hub-backup-docs', 21, 'Wrike', 'Write runbook: Veeam restore for core file server', { source_id: '4410388', source_url: 'https://www.wrike.com/open.htm?id=4410388' });
  create('wes', 'hub-dmarc', 2, 'Hub', 'Move DMARC policy from p=none to quarantine', { requester: 'Security', description: 'Reports clean for 30 days. Needs change window.' });
  create('noelle', 'hub-ups', 1, 'Hub', 'UPS battery replacement in server room (calendar)', { requester: 'Facilities' });
  create('nick', 'hub-ready-mfa', 4, 'Hub', 'Clean up stale MFA methods for 12 accounts', { requester: 'Security' });
  create('nick', 'hub-ready-patch', 4, 'Hub', 'Push Edge update ring to pilot group', { requester: 'Change board' });
  create('nick', 'hub-wifi', 25, 'Wrike', 'Branch Wi-Fi refresh: survey 3 branches', { source_id: '4409902', source_url: 'https://www.wrike.com/open.htm?id=4409902' });

  grade('SD:48188', 5, 'Maintenance', 'P1', 5, 5, 2, 'network', 'trey');
  move('nick', 'SD:48188', 5, 'To Do');
  move('trey', 'SD:48188', 3, 'Doing');
  ack('trey', 'SD:48188', 3);
  next('trey', 'SD:48188', 3, addDays(today, -1));

  grade('SD:48180', 7, 'Maintenance', 'P2', 4, 4, 2, 'vmware', 'michael');
  move('nick', 'SD:48180', 7, 'To Do');
  move('michael', 'SD:48180', 2, 'Doing');
  ack('michael', 'SD:48180', 2);
  next('michael', 'SD:48180', 2, addDays(today, 1));

  grade('SD:48174', 11, 'Support', 'P2', 3, 3, 3, 'voice', 'noelle');
  move('nick', 'SD:48174', 11, 'To Do');
  move('noelle', 'SD:48174', 9, 'Doing');
  // Waiting comes from its Service Desk status ("Waiting for vendor"), not a hub move.
  ack('noelle', 'SD:48174', 9);
  next('noelle', 'SD:48174', 6, addDays(today, -2));

  grade('SD:48166', 4, 'Support', 'P1', 4, 5, 2, 'endpoint', 'tabitha');
  move('nick', 'SD:48166', 4, 'To Do');
  move('tabitha', 'SD:48166', 1, 'Doing');
  next('tabitha', 'SD:48166', 1, addDays(today, 2));

  grade('SD:48160', 9, 'Maintenance', 'P3', 3, 2, 2, 'backup', 'noelle');
  move('nick', 'SD:48160', 9, 'To Do');
  grade('SD:48155', 4, 'Support', 'P2', 4, 4, 1, 'ad', 'cathy');
  move('nick', 'SD:48155', 4, 'To Do');
  move('cathy', 'SD:48155', 3, 'Doing');
  ack('cathy', 'SD:48155', 3);
  grade('SD:48151', 15, 'Maintenance', 'P3', 3, 2, 3, 'network', 'trey');
  move('nick', 'SD:48151', 15, 'To Do');
  grade('SD:48149', 2, 'Support', 'P3', 2, 3, 1, 'm365', 'wes');
  move('nick', 'SD:48149', 2, 'To Do');
  grade('SD:48140', 9, 'Maintenance', 'P1', 5, 5, 2, 'vmware', 'michael');
  move('nick', 'SD:48140', 9, 'To Do');
  move('michael', 'SD:48140', 8, 'Doing');
  grade('SD:48133', 13, 'Support', 'P4', 2, 2, 2, 'endpoint', 'tabitha');
  move('nick', 'SD:48133', 13, 'To Do');
  grade('SD:48120', 17, 'Support', 'P3', 3, 3, 1, 'ad', 'cathy');
  move('nick', 'SD:48120', 17, 'To Do');
  grade('SD:48118', 19, 'Maintenance', 'P3', 3, 2, 2, 'vmware', 'michael');
  move('nick', 'SD:48118', 19, 'To Do');
  grade('SD:48102', 6, 'Support', 'P4', 2, 2, 2, 'print', 'tabitha');
  move('nick', 'SD:48102', 6, 'To Do');

  grade('hub-sp-migration', 28, 'Project', 'P2', 4, 3, 5, 'm365', 'wes');
  move('nick', 'hub-sp-migration', 28, 'To Do');
  move('wes', 'hub-sp-migration', 20, 'Doing');
  ack('wes', 'hub-sp-migration', 20);
  next('wes', 'hub-sp-migration', 4, addDays(today, 3));
  grade('hub-sp-1', 28, 'Project', 'P2', 3, 3, 1, 'm365', 'wes');
  move('nick', 'hub-sp-1', 28, 'To Do');
  move('wes', 'hub-sp-1', 18, 'Done');
  grade('hub-sp-2', 28, 'Project', 'P2', 3, 3, 1, 'm365', 'cathy');
  move('nick', 'hub-sp-2', 28, 'To Do');
  grade('hub-sp-3', 28, 'Project', 'P2', 3, 3, 1, 'm365');
  move('nick', 'hub-sp-3', 28, 'To Do');
  grade('hub-backup-docs', 20, 'Project', 'P3', 3, 2, 2, 'backup', 'noelle');
  move('nick', 'hub-backup-docs', 20, 'To Do');
  grade('hub-wifi', 24, 'Project', 'P3', 3, 2, 4, 'network', 'trey');
  move('nick', 'hub-wifi', 24, 'To Do');

  // Ready to pick up: ranked, nobody owns them yet.
  const ready = (item: string, d: number) => events.push(ev('nick', d, { type: 'item.move', item, data: { column: 'Ready' } } as never));
  grade('hub-ready-mfa', 3, 'Support', 'P3', 3, 2, 1, 'ad');
  ready('hub-ready-mfa', 2);
  grade('hub-ready-patch', 3, 'Maintenance', 'P2', 3, 4, 1, 'endpoint');
  ready('hub-ready-patch', 2);
  // Reprioritized: Wi-Fi survey was in Doing, taken off Trey's plate for the cert renewal.
  move('trey', 'hub-wifi', 10, 'Doing');
  events.push(ev('nick', 3, { type: 'item.move', item: 'hub-wifi', data: { column: 'On Hold', reason: 'Paused for the TLS renewal and Patch Tuesday; resume after Dec 5' } } as never));

  events.push(ev('wes', 4, { type: 'item.comment', item: 'hub-sp-migration', data: { text: 'Lending pilot scheduled for next Thursday after hours.' } } as never));
  events.push(ev('trey', 3, { type: 'item.comment', item: 'SD:48188', data: { text: 'CSR submitted to the CA, waiting on validation email.' } } as never));
  const logs: [string, string, number, number][] = [
    ['wes', 'projects', 6, 1], ['wes', 'owner_tickets', 3, 2], ['wes', 'documentation', 1, 3],
    ['trey', 'maintenance', 5, 1], ['trey', 'dispatch', 4, 2], ['michael', 'maintenance', 7, 1],
    ['noelle', 'owner_tickets', 4, 1], ['noelle', 'projects', 2, 2], ['cathy', 'dispatch', 8, 1],
    ['cathy', 'owner_tickets', 5, 2], ['tabitha', 'owner_tickets', 6, 1], ['tabitha', 'maintenance', 2, 3],
  ];
  logs.forEach(([user, bucket, hours, d]) => events.push(ev(user, d, { type: 'time.log', data: { bucket, hours, date: addDays(today, -d) } } as never)));

  return {
    config,
    snapshot: { generatedAt: new Date().toISOString(), generatedBy: 'demo', mode: 'demo', items: tickets },
    events,
  };
}

import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/model/config';
import { replay, type SourcedEvent } from '../src/model/replay';
import { analysts, checkWip, computeScore, coverageGaps, currentDispatch, nextDispatch, offOn, rotationShifts, schedule, rankKeyAt, rankedList, suggestOwner, suggestPriority, mapSourcePriority, personForSourceName } from '../src/model/logic';
import { importTicketsCsv, maskNumbers, mergeSnapshot, parseCsv } from '../src/model/csv';
import type { HubEvent, TicketsSnapshot, WorkItem } from '../src/model/types';
import { heldUp, overview, priorityConflicts, shiftStats } from '../src/model/analytics';
import { addBusinessDays, addBusinessMinutes, businessMinutesBetween, commStatus, DEFAULT_STANDARD, noticesFor } from '../src/model/comms';
import { criteriaOf, DEFAULT_CRITERIA, effortCriterion, effortLabel, effortPoints, nextFreeAbove, teamBoard, velocity } from '../src/model/teamscore';
import { demoSeed } from '../src/demo';

let n = 0;
const at = (min: number) => new Date(Date.UTC(2026, 10, 18, 9, min)).toISOString();
const ev = (file: string, min: number, e: object): SourcedEvent => ({ file, event: { id: `e${++n}`, ts: at(min), user: file, ...e } as HubEvent });

const snap = (items: Partial<TicketsSnapshot['items'][0]>[]): TicketsSnapshot => ({
  generatedAt: at(0),
  generatedBy: 'test',
  mode: 'csv',
  items: items.map((t, i) => ({ source: 'SD', source_id: String(100 + i), title: `T${i}`, source_status: 'Open', created: at(0), ...t })),
});

const grade = (file: string, min: number, item: string, bucket = 'Support', owner?: string) =>
  ev(file, min, { type: 'item.grade', item, data: { bucket, priority: 'P3', impact: 3, urgency: 3, effort: 1, system: 'ad', owner } });
const move = (file: string, min: number, item: string, column: string, extra: object = {}) => ev(file, min, { type: 'item.move', item, data: { column, ...extra } });

describe('sync rules', () => {
  it('new source items land in Intake, seeded priority and owner', () => {
    const s = replay(defaultConfig(), snap([{ source_priority: 'High', source_owner: 'Wes' }]), []);
    const it = s.items.get('SD:100')!;
    expect(it.column).toBe('Intake');
    expect(it.priority).toBe('P2');
    expect(it.owner).toBe('wes');
  });

  it('a closed source item moves to Done automatically', () => {
    const s = replay(defaultConfig(), snap([{ source_status: 'Closed' }]), [grade('nick', 1, 'SD:100'), move('nick', 2, 'SD:100', 'Doing')]);
    expect(s.items.get('SD:100')!.column).toBe('Done');
  });

  it('sync never overwrites hub-owned fields', () => {
    const s = replay(defaultConfig(), snap([{ source_priority: 'Low' }]), [grade('nick', 1, 'SD:100')]);
    expect(s.items.get('SD:100')!.priority).toBe('P3');
    expect(s.items.get('SD:100')!.bucket).toBe('Support');
  });

  it('conflict: source changed a field after the hub did -> source wins and is logged', () => {
    const sn = snap([{ source_owner: 'Cathy', changed: { source_owner: at(30) } }]);
    const s = replay(defaultConfig(), sn, [grade('nick', 10, 'SD:100', 'Support', 'wes')]);
    expect(s.items.get('SD:100')!.owner).toBe('cathy');
    expect(s.conflicts).toHaveLength(1);
    expect(s.conflicts[0]).toMatchObject({ field: 'owner', hubValue: 'wes', sourceValue: 'cathy' });
  });

  it('SD assigns: the technician owns the card even if the hub set someone later', () => {
    const sn = snap([{ source_owner: 'Cathy', changed: { source_owner: at(5) } }]);
    const s = replay(defaultConfig(), sn, [grade('nick', 10, 'SD:100', 'Support', 'wes')]);
    expect(s.items.get('SD:100')!).toMatchObject({ owner: 'cathy', ownerFromSource: true });
    expect(s.conflicts).toHaveLength(1);
  });

  it('the hub assigns tickets that are unassigned in SD', () => {
    const s = replay(defaultConfig(), snap([{ source_owner: 'Not Assigned' }, {}]), [grade('nick', 1, 'SD:100', 'Support', 'wes'), grade('nick', 2, 'SD:101', 'Support', 'cathy')]);
    expect(s.items.get('SD:100')!.owner).toBe('wes');
    expect(s.items.get('SD:101')!).toMatchObject({ owner: 'cathy', ownerFromSource: false });
    expect(s.conflicts).toHaveLength(0);
  });
});

describe('ranking', () => {
  it('ranks are unique within each bucket, even with identical keys from two people', () => {
    const sn = snap([{}, {}, {}, {}]);
    const evs = [
      ...['SD:100', 'SD:101', 'SD:102'].flatMap((id, i) => [grade('nick', i, id), move('nick', 10 + i, id, 'To Do')]),
      grade('nick', 20, 'SD:103', 'Project'),
      move('nick', 21, 'SD:103', 'To Do'),
      ev('nick', 30, { type: 'item.rank', item: 'SD:102', data: { rankKey: 1 } }),
    ];
    const s = replay(defaultConfig(), sn, evs);
    const ranks = rankedList(s, 'Support').map((i) => i.rank);
    expect(ranks).toEqual([1, 2, 3]);
    expect(rankedList(s, 'Project').map((i) => i.rank)).toEqual([1]);
  });

  it('the latest rank change wins', () => {
    const sn = snap([{}, {}, {}]);
    const base = ['SD:100', 'SD:101', 'SD:102'].flatMap((id, i) => [grade('nick', i, id), move('nick', 10 + i, id, 'To Do')]);
    const s = replay(defaultConfig(), sn, [
      ...base,
      ev('nick', 40, { type: 'item.rank', item: 'SD:102', data: { rankKey: 0.5 } }),
      ev('nick', 41, { type: 'item.rank', item: 'SD:102', data: { rankKey: 2.5 } }),
    ]);
    expect(rankedList(s, 'Support').map((i) => i.id)).toEqual(['SD:100', 'SD:101', 'SD:102']);
  });

  it('rankKeyAt returns midpoints and signals normalization when the gap is exhausted', () => {
    const l = [{ rankKey: 1 }, { rankKey: 2 }] as never[];
    expect(rankKeyAt(l, 0)).toBe(0);
    expect(rankKeyAt(l, 1)).toBe(1.5);
    expect(rankKeyAt(l, 2)).toBe(3);
    expect(rankKeyAt([{ rankKey: 1 }, { rankKey: 1 + 1e-9 }] as never[], 1)).toBeUndefined();
  });

  it('rank.normalize resets keys to 1..n', () => {
    const sn = snap([{}, {}]);
    const s = replay(defaultConfig(), sn, [
      grade('nick', 1, 'SD:100'), move('nick', 2, 'SD:100', 'To Do'), grade('nick', 3, 'SD:101'), move('nick', 4, 'SD:101', 'To Do'),
      ev('nick', 5, { type: 'rank.normalize', data: { bucket: 'Support', order: ['SD:101', 'SD:100'] } }),
    ]);
    expect(rankedList(s, 'Support').map((i) => i.id)).toEqual(['SD:101', 'SD:100']);
  });
});

describe('permissions (enforced at replay by change-file owner)', () => {
  it('viewers cannot change anything', () => {
    const s = replay(defaultConfig(), snap([{}]), [grade('matt', 1, 'SD:100')]);
    expect(s.items.get('SD:100')!.bucket).toBeUndefined();
    expect(s.audit[0].rejected).toMatch(/read-only/);
  });
  it('analysts cannot grade, re-rank or override WIP; can move own cards', () => {
    const s = replay(defaultConfig(), snap([{}]), [
      grade('wes', 1, 'SD:100'),
      grade('nick', 2, 'SD:100', 'Support', 'wes'),
      move('nick', 3, 'SD:100', 'To Do'),
      move('wes', 4, 'SD:100', 'Doing', { override: 'because' }),
      move('cathy', 5, 'SD:100', 'Doing'),
      move('wes', 6, 'SD:100', 'Doing'),
    ]);
    expect(s.audit.map((a) => !!a.rejected)).toEqual([true, false, false, true, true, false]);
    expect(s.items.get('SD:100')!.column).toBe('Doing');
  });
  it('unknown users are ignored', () => {
    const s = replay(defaultConfig(), snap([{}]), [grade('stranger', 1, 'SD:100')]);
    expect(s.audit[0].rejected).toMatch(/not in hub-config/);
  });
  it('trusts the file name over the user field inside the event', () => {
    const forged: SourcedEvent = { file: 'wes', event: { id: 'x', ts: at(1), user: 'nick', type: 'item.grade', item: 'SD:100', data: { bucket: 'Support', priority: 'P1', impact: 1, urgency: 1, effort: 1 } } };
    const s = replay(defaultConfig(), snap([{}]), [forged]);
    expect(s.audit[0].rejected).toBeTruthy();
  });
});

describe('WIP limits', () => {
  it('warns when moving past an analyst limit', () => {
    const cfg = defaultConfig();
    cfg.people.find((p) => p.username === 'wes')!.wipLimit = 1;
    const s = replay(cfg, snap([{}, {}]), [
      grade('nick', 1, 'SD:100', 'Support', 'wes'), move('nick', 2, 'SD:100', 'Doing'),
      grade('nick', 3, 'SD:101', 'Support', 'wes'), move('nick', 4, 'SD:101', 'To Do'),
    ]);
    const c = checkWip(s, s.items.get('SD:101')!, 'wes', 'Doing');
    expect(c.ok).toBe(false);
    expect(c.messages[0]).toMatch(/limit 1/);
    expect(checkWip(s, s.items.get('SD:101')!, 'cathy', 'Doing').ok).toBe(true);
  });
  it('checks team bucket limits too', () => {
    const cfg = defaultConfig();
    cfg.bucketWip = { Support: 1 };
    const s = replay(cfg, snap([{}, {}]), [
      grade('nick', 1, 'SD:100', 'Support', 'wes'), move('nick', 2, 'SD:100', 'Doing'),
      grade('nick', 3, 'SD:101', 'Support', 'cathy'),
    ]);
    expect(checkWip(s, s.items.get('SD:101')!, 'cathy', 'Doing').messages[0]).toMatch(/bucket limit 1/);
  });
});

describe('grading helpers', () => {
  it('score and suggested priority', () => {
    expect(computeScore(5, 5, 1)).toBe(25);
    expect(computeScore(3, 2, 4)).toBe(1.5);
    expect(suggestPriority(25)).toBe('P1');
    expect(suggestPriority(9)).toBe('P2');
    expect(suggestPriority(4)).toBe('P3');
    expect(suggestPriority(1)).toBe('P4');
    expect(mapSourcePriority('P1 - Critical')).toBe('P1');
    expect(mapSourcePriority('Normal')).toBe('P3');
  });
  it('owner suggestion alternates primary and secondary', () => {
    const cfg = defaultConfig(); // ad: primary cathy, secondary wes
    let s = replay(cfg, snap([{}, {}]), []);
    expect(suggestOwner(s, 'ad')!.username).toBe('cathy');
    s = replay(cfg, snap([{}, {}]), [grade('nick', 1, 'SD:100', 'Support', 'cathy')]);
    expect(suggestOwner(s, 'ad')!.username).toBe('wes');
    s = replay(cfg, snap([{}, {}]), [grade('nick', 1, 'SD:100', 'Support', 'cathy'), grade('nick', 2, 'SD:101', 'Support', 'wes')]);
    expect(suggestOwner(s, 'ad')!.username).toBe('cathy');
  });
});

describe('CSV import', () => {
  it('parses quoted fields and newlines', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"\nthere']]);
  });
  it('maps Service Desk columns and masks account numbers', () => {
    const csv = 'Request ID,Subject,Requester,Status,Priority,Technician,Created Time,Description\n' +
      '48211,"Card 4111 1111 1111 1234 declined",Dana,Open,High,Wes,"Nov 17, 2026 09:14 AM",SECRET DETAILS\n';
    const r = importTicketsCsv(csv, 'SD', 'https://sd/{id}');
    expect(r.tickets).toHaveLength(1);
    expect(r.tickets[0].title).toBe('Card ••••1234 declined');
    expect(r.tickets[0].source_url).toBe('https://sd/48211');
    expect(JSON.stringify(r.tickets)).not.toContain('SECRET');
  });
  it('mask keeps short ticket numbers', () => {
    expect(maskNumbers('Ticket 48211 for member 123456789')).toBe('Ticket 48211 for member ••••6789');
  });
  it('merge stamps changed owner/priority for conflict detection', () => {
    const prev = mergeSnapshot(undefined, [{ source: 'SD', source_id: '1', title: 'a', source_status: 'Open', created: at(0), source_owner: 'Wes' }], 'SD', 'nick', 'csv');
    const next = mergeSnapshot(prev, [{ source: 'SD', source_id: '1', title: 'a', source_status: 'Open', created: at(0), source_owner: 'Cathy' }], 'SD', 'nick', 'csv');
    expect(next.items[0].changed?.source_owner).toBeTruthy();
  });
});

describe('demo seed', () => {
  it('replays without rejected events', () => {
    const d = demoSeed();
    const s = replay(d.config, d.snapshot, d.events.map((event) => ({ event, file: event.user })));
    expect(s.audit.filter((a) => a.rejected)).toEqual([]);
    expect(s.items.get('SD:48140')!.column).toBe('Done');
  });
});

describe('Ready to pick up and On Hold', () => {
  const base = () => [grade('nick', 1, 'SD:100', 'Support', 'wes'), move('nick', 2, 'SD:100', 'To Do'), move('wes', 3, 'SD:100', 'Doing')];

  it('Ready is ranked per bucket separately from To Do', () => {
    const s = replay(defaultConfig(), snap([{}, {}, {}]), [
      grade('nick', 1, 'SD:100'), move('nick', 2, 'SD:100', 'Ready'),
      grade('nick', 3, 'SD:101'), move('nick', 4, 'SD:101', 'Ready'),
      grade('nick', 5, 'SD:102'), move('nick', 6, 'SD:102', 'To Do'),
      ev('nick', 7, { type: 'item.rank', item: 'SD:101', data: { rankKey: 0 } }),
    ]);
    expect(rankedList(s, 'Support', 'Ready').map((i) => [i.id, i.rank])).toEqual([['SD:101', 1], ['SD:100', 2]]);
    expect(rankedList(s, 'Support').map((i) => i.rank)).toEqual([1]);
  });

  it('On Hold keeps the owner and the reason, and frees the WIP slot', () => {
    const cfg = defaultConfig();
    cfg.people.find((p) => p.username === 'wes')!.wipLimit = 1;
    const s = replay(cfg, snap([{}, {}]), [...base(), move('nick', 4, 'SD:100', 'On Hold', { reason: 'Reprioritized' }), grade('nick', 5, 'SD:101', 'Support', 'wes')]);
    const it = s.items.get('SD:100')!;
    expect(it.column).toBe('On Hold');
    expect(it.owner).toBe('wes');
    expect(it.hold).toMatchObject({ reason: 'Reprioritized', user: 'nick', from: 'Doing' });
    expect(checkWip(s, s.items.get('SD:101')!, 'wes', 'Doing').ok).toBe(true);
  });

  it('releasing to Ready clears the owner and lands ranked', () => {
    const s = replay(defaultConfig(), snap([{}]), [...base(), move('nick', 4, 'SD:100', 'Ready', { reason: 'Off the plate', release: true })]);
    const it = s.items.get('SD:100')!;
    expect(it.owner).toBeUndefined();
    expect(it.rank).toBe(1);
    expect(it.hold?.reason).toBe('Off the plate');
  });

  it('an analyst can release their own card, and anyone can then pick it up', () => {
    const s = replay(defaultConfig(), snap([{}]), [
      ...base(),
      move('wes', 4, 'SD:100', 'Ready', { reason: 'Swamped', release: true }),
      ev('cathy', 5, { type: 'item.update', item: 'SD:100', data: { owner: 'cathy' } }),
      move('cathy', 6, 'SD:100', 'Doing'),
    ]);
    expect(s.audit.filter((a) => a.rejected)).toEqual([]);
    const it = s.items.get('SD:100')!;
    expect([it.column, it.owner, it.hold]).toEqual(['Doing', 'cathy', undefined]);
  });

  it("an analyst cannot put someone else's card on hold", () => {
    const s = replay(defaultConfig(), snap([{}]), [...base(), move('cathy', 4, 'SD:100', 'On Hold', { reason: 'x' })]);
    expect(s.items.get('SD:100')!.column).toBe('Doing');
  });
});

describe('Service Desk status drives Waiting and Done', () => {
  const doing = (id = 'SD:100') => [grade('nick', 1, id, 'Support', 'wes'), move('nick', 2, id, 'To Do'), move('wes', 3, id, 'Doing')];

  it('a waiting status in SD puts the card in Waiting, and it returns when SD reopens', () => {
    let s = replay(defaultConfig(), snap([{ source_status: 'Waiting for vendor' }]), doing());
    expect(s.items.get('SD:100')!).toMatchObject({ column: 'Waiting', statusDriven: 'Waiting' });
    s = replay(defaultConfig(), snap([{ source_status: 'Open' }]), doing());
    expect(s.items.get('SD:100')!.column).toBe('Doing');
    expect(s.items.get('SD:100')!.statusDriven).toBeUndefined();
  });

  it('SD "On Hold" maps to Waiting, not the hub\'s reprioritized On Hold', () => {
    const s = replay(defaultConfig(), snap([{ source_status: 'On Hold' }]), doing());
    expect(s.items.get('SD:100')!.column).toBe('Waiting');
  });

  it('the hub cannot move a ticket into Done or Waiting; hub items still can', () => {
    const s = replay(defaultConfig(), snap([{}]), [
      ...doing(),
      move('nick', 4, 'SD:100', 'Done'),
      ev('nick', 5, { type: 'item.create', item: 'h1', data: { source: 'Hub', title: 'Hub task' } }),
      grade('nick', 6, 'h1'),
      move('nick', 7, 'h1', 'Done'),
    ]);
    expect(s.items.get('SD:100')!.column).toBe('Doing');
    expect(s.audit.find((a) => a.rejected)?.rejected).toMatch(/Service Desk status controls Done/);
    expect(s.items.get('h1')!.column).toBe('Done');
  });

  it('builds links from the configured pattern when a row has none', () => {
    const cfg = defaultConfig();
    cfg.ticketUrls.SD = 'https://sdp.local/req/{id}';
    const s = replay(cfg, snap([{}]), []);
    expect(s.items.get('SD:100')!.source_url).toBe('https://sdp.local/req/100');
  });

  it('a ticket entered by hand with its number merges with the synced one', () => {
    const s = replay(defaultConfig(), snap([{}]), [ev('wes', 1, { type: 'item.create', item: 'SD:100', data: { source: 'SD', source_id: '100', title: 'dup' } })]);
    expect([...s.items.keys()]).toEqual(['SD:100']);
    expect(s.items.get('SD:100')!.title).toBe('T0');
  });
});

describe('Service Desk "Core - All" report format', () => {
  // Synthetic rows in the exact shape of the Service Desk report export (title lines above the header).
  const csv = [
    'IT Service Desk,,,,,,,,,,,,,,',
    'Core - All,,,,,,,,,,,,,,',
    'Generated by Someone    Created on : 11-18-2026 16:45,,,,,,,,,,,,,,',
    'Total records : 5,,,,,,,,,,,,,,',
    'RequestID,Group,Subject,Technician,Created Time,Due By Time,Request Status,Resolved Time,Assigned Time,Category,Sub Category,Department,Last Updated Time,SLA,Request Type',
    'INC-90001,Core Team,Rate change in core,Wesley Wilson,11-10-2026 09:15,-,New,Not Assigned,11-10-2026 09:20,Software,Symitar Quest,Lending,11-10-2026 09:20,High SLA,Incident',
    'INC-90002,Core Team,Card 4111 1111 1111 1234 declined,Not Assigned,11-12-2026 14:05,11-20-2026 14:05,Waiting for CORE,Not Assigned,Not Assigned,Software,Meridian Link,Card Services,11-12-2026 14:05,Low SLA,Incident',
    'REQ-90003,Core Team,Vendor file stuck,Cathy E. Garcia,11-01-2026 08:00,-,Waiting for 3rd Party,Not Assigned,11-01-2026 08:00,Software,Synergy,Payments,11-03-2026 08:00,VIP SLA,Not Assigned',
    'INC-90004,Core Team,Old closed thing,Kathy Carnley,01-05-2025 10:00,-,Closed - Moved to Project,02-01-2025 10:00,01-05-2025 10:00,Software,Other,IT,02-01-2025 10:00,Low SLA,Incident',
    'INC-90005,Core Team,Recently closed,Retained until 09/30/25 - Someone Else,10-20-2026 10:00,-,Closed - Requester Unresponsive,11-02-2026 10:00,10-20-2026 10:00,Software,Other,IT,11-02-2026 10:00,Low SLA,Incident',
  ].join('\r\n');
  const cfg = () => {
    const c = defaultConfig();
    c.systems.push({ id: 'symitar', name: 'Symitar', aliases: ['Symitar Quest', 'SymXchange'], primary: 'wes', secondary: 'cathy' });
    return c;
  };
  const r = importTicketsCsv(csv, 'SD', { urlTemplate: 'https://sd/WorkOrder.do?woID={num}', now: new Date('2026-11-18T12:00:00') });

  it('finds the header under the title lines, drops "Not Assigned" and old closed rows', () => {
    expect(r.tickets.map((t) => t.source_id)).toEqual(['INC-90001', 'INC-90002', 'REQ-90003', 'INC-90005']);
    expect(r.skippedOldClosed).toBe(1);
    const t2 = r.tickets[1];
    expect(t2.source_owner).toBeUndefined();
    expect(t2.title).toBe('Card ••••1234 declined');
    expect(t2.requester).toBe('Card Services');
    expect(t2.source_url).toBe('https://sd/WorkOrder.do?woID=90002');
    expect(r.tickets[0].created).toBe(new Date(2026, 10, 10, 9, 15).toISOString());
  });

  it('maps technicians, SLA priority, statuses and systems', () => {
    const s = replay(cfg(), { generatedAt: at(0), generatedBy: 't', mode: 'csv', items: r.tickets }, []);
    const g = (id: string) => s.items.get('SD:' + id)!;
    expect(g('INC-90001')).toMatchObject({ owner: 'wes', priority: 'P2', system: 'symitar', column: 'Intake' });
    expect(g('INC-90002')).toMatchObject({ owner: undefined, priority: 'P4', column: 'Intake' }); // Waiting for CORE: our move
    expect(g('REQ-90003')).toMatchObject({ owner: 'cathy', priority: 'P2', column: 'Intake' }); // graded first
    const graded = replay(cfg(), { generatedAt: at(0), generatedBy: 't', mode: 'csv', items: r.tickets }, [grade('nick', 1, 'SD:REQ-90003'), move('nick', 2, 'SD:REQ-90003', 'To Do')]);
    expect(graded.items.get('SD:REQ-90003')!.column).toBe('Waiting');
    expect(g('INC-90005')).toMatchObject({ column: 'Done', owner: undefined, source_owner: 'Retained until 09/30/25 - Someone Else' });
  });

  it('an explicit sdName mapping wins over first-name matching', () => {
    const c = cfg();
    c.people.find((p) => p.username === 'cathy')!.sdName = 'Kathy Carnley';
    expect(personForSourceName(c, 'Kathy Carnley')?.username).toBe('cathy');
    expect(personForSourceName(c, 'Cathy E. Garcia')).toBeUndefined();
    expect(personForSourceName(defaultConfig(), 'Matt Johnson')).toBeUndefined(); // viewers are never matched by first name
    expect(personForSourceName(defaultConfig(), 'Noelle I. Belhumeur')?.username).toBe('noelle');
  });
});

describe('team', () => {
  it('Nick carries work alongside the six analysts; Matt does not', () => {
    expect(analysts(defaultConfig()).map((p) => p.username)).toEqual(['nick', 'wes', 'cathy', 'noelle', 'trey', 'michael', 'tabitha']);
  });
});

describe('support rotation', () => {
  it('runs the order every 2 weeks from Trey (until Nov 30), skipping anyone out, with Nick as escalation', () => {
    const cfg = defaultConfig();
    const s = rotationShifts(cfg, 6);
    expect(s.map((x) => [x.analyst, x.from, x.to])).toEqual([
      ['trey', '2026-11-17', '2026-11-30'],
      ['tabitha', '2026-12-01', '2026-12-14'],
      ['michael', '2026-12-15', '2026-12-28'],
      ['wes', '2026-12-29', '2027-01-11'],
      ['noelle', '2027-01-12', '2027-01-25'],
      ['trey', '2027-01-26', '2027-02-08'],
      ['tabitha', '2027-02-09', '2027-02-22'],
    ]);
    expect(s.every((x) => x.escalation === 'nick')).toBe(true);
    expect(s[0].backup).toBe('tabitha');
    expect(currentDispatch(cfg, '2026-11-19')?.analyst).toBe('trey');
    expect(nextDispatch(cfg, '2026-11-19')?.analyst).toBe('tabitha');
  });
  it('someone returning on a date rejoins in their place in the order', () => {
    const cfg = defaultConfig();
    cfg.rotation!.out = [{ username: 'cathy', until: '2027-01-20' }];
    const names = rotationShifts(cfg, 7).map((x) => x.analyst);
    expect(names).toEqual(['trey', 'tabitha', 'michael', 'wes', 'noelle', 'cathy', 'trey', 'tabitha']);
  });
  it('a cover overrides the rotation for its dates', () => {
    const cfg = defaultConfig();
    cfg.dispatch = [{ analyst: 'wes', from: '2026-11-23', to: '2026-11-25' }];
    expect(currentDispatch(cfg, '2026-11-24')?.analyst).toBe('wes');
    expect(currentDispatch(cfg, '2026-11-26')?.analyst).toBe('trey');
  });
  it('weekly shifts are 7 days', () => {
    const cfg = defaultConfig();
    cfg.rotation = { ...cfg.rotation!, shift: 'week', current: { analyst: 'trey', until: '2026-11-29' } };
    expect(rotationShifts(cfg, 2).map((x) => [x.analyst, x.from, x.to])).toEqual([
      ['trey', '2026-11-23', '2026-11-29'], ['tabitha', '2026-11-30', '2026-12-06'], ['michael', '2026-12-07', '2026-12-13'],
    ]);
  });
});

describe('overview analytics', () => {
  const now = new Date('2026-11-19T12:00:00Z');
  it('counts held-up work, per-person load and flow', () => {
    const d = demoSeed();
    const s = replay(d.config, d.snapshot, d.events.map((event) => ({ event, file: event.user })));
    const o = overview(s, {}, 8, new Date());
    expect(o.kpis.open).toBe([...s.items.values()].filter((i) => i.column !== 'Done').length);
    expect(o.flow).toHaveLength(8);
    expect(o.rows.map((r) => r.username)).toContain('nick');
    expect(o.held.every((h, i, a) => i === 0 || a[i - 1].days >= h.days)).toBe(true);
    expect(o.byColumn.reduce((n, c) => n + c.total, 0)).toBe(o.kpis.open);
    expect(o.aging.reduce((n, c) => n + c.total, 0)).toBe(o.kpis.open);
  });
  it('flags Doing with no update for 5+ days as stalled, and Waiting by its SD status', () => {
    const base = { id: 'x', source: 'SD', title: 't', source_status: 'Open', acked: true, created: '2026-10-01T00:00:00Z', comments: [] } as never as WorkItem;
    expect(heldUp({ ...base, column: 'Doing', touched: '2026-11-10T00:00:00Z' }, now)?.kind).toBe('stale');
    expect(heldUp({ ...base, column: 'Doing', touched: '2026-11-17T00:00:00Z' }, now)).toBeUndefined();
    expect(heldUp({ ...base, column: 'Waiting', statusDriven: 'Waiting', source_status: 'Waiting for 3rd Party', touched: '2026-11-01T00:00:00Z' }, now)?.why).toBe('Waiting for 3rd Party');
  });
});

describe('rotation overrides, time off and support tracking', () => {
  it('a cover cuts into the shift; the rest stays with the rotation person', () => {
    const cfg = defaultConfig();
    cfg.dispatch = [{ analyst: 'wes', from: '2026-12-10', to: '2026-12-12', note: 'Swap' }];
    const dec = schedule(cfg, 3).filter((s) => s.from >= '2026-12-01' && s.to <= '2026-12-14');
    expect(dec.map((s) => [s.analyst, s.from, s.to, s.coverFor ?? null])).toEqual([
      ['tabitha', '2026-12-01', '2026-12-09', null],
      ['wes', '2026-12-10', '2026-12-12', 'tabitha'],
      ['tabitha', '2026-12-13', '2026-12-14', null],
    ]);
  });
  it('flags a support shift where the person has time off', () => {
    const cfg = defaultConfig();
    cfg.timeOff = [{ id: 't1', username: 'tabitha', from: '2026-12-12', to: '2026-12-16', kind: 'holiday' }];
    const gaps = coverageGaps(cfg, 3, '2026-11-19');
    expect(gaps.map((g) => [g.shift.analyst, g.from, g.to])).toEqual([['tabitha', '2026-12-12', '2026-12-14']]);
  });
  it('time off events: set, edit, delete (manager only)', () => {
    const t = { id: 'a', username: 'wes', from: '2026-12-01', to: '2026-12-03', kind: 'pto' };
    let s = replay(defaultConfig(), snap([]), [ev('nick', 1, { type: 'config.timeoff', data: t }), ev('wes', 2, { type: 'config.timeoff', data: { ...t, to: '2026-12-30' } })]);
    expect(s.config.timeOff).toEqual([t]);
    expect(offOn(s.config, 'wes', '2026-12-02')?.id).toBe('a');
    s = replay(defaultConfig(), snap([]), [ev('nick', 1, { type: 'config.timeoff', data: t }), ev('nick', 2, { type: 'config.timeoff', data: { ...t, deleted: true } })]);
    expect(s.config.timeOff).toEqual([]);
  });
  it('owner suggestion skips someone who is off today', () => {
    const cfg = defaultConfig(); // ad: primary cathy, secondary wes
    cfg.timeOff = [{ id: 'x', username: 'cathy', from: '2000-01-01', to: '2099-01-01', kind: 'out' }];
    const s = replay(cfg, snap([]), []);
    expect(suggestOwner(s, 'ad')?.username).toBe('wes');
  });
  it('the person on support can grade during their shift; others cannot', () => {
    const t = (min: number) => new Date(Date.UTC(2026, 10, 20, 9, min)).toISOString();
    const e = (file: string, id: string): SourcedEvent => ({ file, event: { id, ts: t(1), user: file, type: 'item.grade', item: 'SD:100', data: { bucket: 'Support', priority: 'P3', impact: 3, urgency: 3, effort: 1 } } as HubEvent });
    const s = replay(defaultConfig(), snap([{}]), [e('wes', 'w'), e('trey', 't')]); // Trey is on support until Nov 30
    expect(s.audit.map((a) => [a.file, !!a.rejected])).toEqual([['trey', false], ['wes', true]]);
  });
  it('counts what came in, what support triaged, worked and closed during a shift', () => {
    const items = [{ created: '2026-11-20T10:00:00Z', source_status: 'Closed', closed: '2026-11-21T09:00:00Z' }, { created: '2026-11-21T10:00:00Z' }, { created: '2026-10-01T10:00:00Z' }];
    const s = replay(defaultConfig(), snap(items), [
      { file: 'trey', event: { id: 'a', ts: '2026-11-20T11:00:00Z', user: 'trey', type: 'item.grade', item: 'SD:100', data: { bucket: 'Support', priority: 'P3', impact: 3, urgency: 3, effort: 1, owner: 'trey' } } as HubEvent },
      { file: 'trey', event: { id: 'b', ts: '2026-11-20T11:01:00Z', user: 'trey', type: 'item.move', item: 'SD:100', data: { column: 'To Do' }, before: { column: 'Intake' } } as HubEvent },
      { file: 'trey', event: { id: 'c', ts: '2026-11-20T15:00:00Z', user: 'trey', type: 'item.move', item: 'SD:100', data: { column: 'Doing' }, before: { column: 'To Do' } } as HubEvent },
      { file: 'trey', event: { id: 'e', ts: '2026-11-21T09:00:00Z', user: 'trey', type: 'item.comment', item: 'SD:101', data: { text: 'looking' } } as HubEvent },
      { file: 'trey', event: { id: 'f', ts: '2026-11-21T09:00:00Z', user: 'trey', type: 'time.log', data: { bucket: 'dispatch', hours: 3, date: '2026-11-21' } } as HubEvent },
    ]);
    expect(shiftStats(s, 'trey', '2026-11-16', '2026-11-30')).toEqual({ cameIn: 2, triaged: 1, worked: 2, closed: 1, dispatchHours: 3, stillInIntake: 1 });
  });
});

describe('priority conflicts', () => {
  const g = (file: string, min: number, item: string, priority: string, owner?: string) =>
    ev(file, min, { type: 'item.grade', item, data: { bucket: 'Support', priority, impact: 3, urgency: 3, effort: 1, owner } });
  it('finds lower-priority work in Doing while a P1 waits, unowned P1s and rank inversions', () => {
    const s = replay(defaultConfig(), snap([{}, {}, {}, {}]), [
      g('nick', 1, 'SD:100', 'P1', 'wes'), move('nick', 2, 'SD:100', 'To Do'),
      g('nick', 3, 'SD:101', 'P3', 'wes'), move('nick', 4, 'SD:101', 'Doing'),
      g('nick', 5, 'SD:102', 'P2'), move('nick', 6, 'SD:102', 'Doing'),
      g('nick', 7, 'SD:103', 'P4'), move('nick', 8, 'SD:103', 'To Do', { rankKey: 0 }),
    ]);
    const c = priorityConflicts(s);
    expect(c.map((x) => x.kind)).toEqual(['lower-first', 'unowned', 'rank-inversion']);
    expect(c[0]).toMatchObject({ item: { id: 'SD:100' }, other: { id: 'SD:101' } });
    expect(c[2].text).toMatch(/#1 is P4 but #2 is P1/);
  });
});

describe('team score', () => {
  const proj = (id: string, min: number) => [
    ev('nick', min, { type: 'item.create', item: id, data: { source: 'Hub', title: id } }),
    ev('nick', min + 1, { type: 'item.grade', item: id, data: { bucket: 'Project', priority: 'P2', impact: 3, urgency: 3, effort: 3 } }),
    ev('nick', min + 2, { type: 'item.move', item: id, data: { column: 'To Do' } }),
  ];
  const rate = (file: string, min: number, item: string, r: Record<string, number>) => ev(file, min, { type: 'team.rate', item, data: { ratings: r } });
  const all = (n: number) => ({ value: n, risk: n, urgency: n, reach: n, effort: 6 - n });

  it('averages the team’s ratings into a 0–100 score; the latest rating per person counts', () => {
    const s = replay(defaultConfig(), snap([]), [...proj('A', 1), rate('wes', 10, 'A', all(5)), rate('cathy', 11, 'A', all(1)), rate('cathy', 12, 'A', all(5))]);
    const b = teamBoard(s);
    expect(b.rows[0].ts).toMatchObject({ base: 100, score: 100, raters: ['wes', 'cathy'] });
  });

  it('flags ties, and a recorded decision breaks them', () => {
    let evs = [...proj('A', 1), ...proj('B', 5), rate('wes', 10, 'A', all(3)), rate('wes', 11, 'B', all(3))];
    let b = teamBoard(replay(defaultConfig(), snap([]), evs));
    expect(b.ties).toHaveLength(1);
    const tied = b.ties[0][0].ts.score!;
    evs = [...evs, ev('nick', 20, { type: 'team.score', item: 'B', data: { score: nextFreeAbove(tied, [tied]), reason: 'Tie-break' } })];
    b = teamBoard(replay(defaultConfig(), snap([]), evs));
    expect(b.ties).toHaveLength(0);
    expect(b.scored.map((r) => [r.item.id, r.ts.score])).toEqual([['B', tied + 0.1], ['A', tied]]);
  });

  it('refuses a set score another project already has, and analysts can rate but not set', () => {
    const s = replay(defaultConfig(), snap([]), [
      ...proj('A', 1), ...proj('B', 5),
      rate('wes', 10, 'A', all(4)),
      ev('nick', 20, { type: 'team.score', item: 'B', data: { score: 75 } }),
      ev('cathy', 21, { type: 'team.score', item: 'A', data: { score: 90 } }),
    ]);
    const b = teamBoard(s);
    expect(b.rows.find((r) => r.item.id === 'A')!.ts.score).toBe(75);
    expect(b.rows.find((r) => r.item.id === 'B')!.ts.score).toBeUndefined();
    expect(s.audit.filter((a) => a.rejected).map((a) => a.rejected)).toEqual([
      expect.stringMatching(/already “A”; scores must be unique/),
      expect.stringMatching(/Only Nick/),
    ]);
  });
});

describe('effort time and velocity', () => {
  it('maps effort ratings to time and points', () => {
    const ec = effortCriterion(DEFAULT_CRITERIA)!;
    expect([1, 2, 3, 4, 5].map((n) => effortPoints(ec, n))).toEqual([1, 2, 3, 5, 8]);
    expect(effortLabel(ec, 2.6)).toBe('1–3 weeks of work (40–120 hours)');
    expect(effortLabel(ec, 1)).toBe('up to 2 days of work (≤16 hours)');
  });
  it('counts points of finished projects per two weeks', () => {
    const d = demoSeed();
    const s = replay(d.config, d.snapshot, d.events.map((event) => ({ event, file: event.user })));
    const v = velocity(s, 6)!;
    expect(v.periods).toHaveLength(6);
    expect(v.inProgress).toBeGreaterThan(0); // the SharePoint migration is in Doing
  });
  it('a config criterion without scale text gets the built-in descriptions', () => {
    const cfg = defaultConfig();
    cfg.teamCriteria = [{ key: 'effort', label: 'Effort', weight: 50, invert: true }, { key: 'value', label: 'Value', weight: 50 }];
    const c = criteriaOf(cfg);
    expect(c[0].points).toEqual([1, 2, 3, 5, 8]);
    expect(c[1].levels?.[4]).toMatch(/Strategic/);
  });
});

describe('communication standard', () => {
  const L = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m); // local time, Nov 2026 (16 = Mon)
  const std = DEFAULT_STANDARD;
  const tick = (over: Record<string, unknown>) => ({ source: 'SD', source_id: '9001', title: 'T', source_status: 'Open', ...over });
  const st = (cfg: ReturnType<typeof defaultConfig>, t: Record<string, unknown>, evs: SourcedEvent[], now: Date) => {
    const s = replay(cfg, { generatedAt: at(0), generatedBy: 't', mode: 'csv', items: [tick(t) as never] }, evs);
    return { s, c: commStatus(s, s.items.get('SD:9001')!, now)! };
  };

  it('business hours: Thursday starts at 10:00, nights and weekends pause the clock', () => {
    expect(addBusinessMinutes(std, L(18, 17, 0), 60)).toEqual(L(19, 10, 30)); // Wed 5pm + 1h -> Thu 10:30
    expect(addBusinessMinutes(std, L(20, 17, 0), 120)).toEqual(L(23, 10, 0)); // Fri 5pm + 2h -> Mon 10:00
    expect(businessMinutesBetween(std, L(20, 17, 0), L(23, 9, 30))).toBe(90);
  });

  it('first response: P1 within 1 business hour, P4 within 1 business day', () => {
    const cfg = defaultConfig();
    const p1 = st(cfg, { created: L(18, 16, 30).toISOString(), source_priority: 'Critical SLA' }, [], L(18, 16, 45)).c;
    expect([p1.kind, p1.critical, p1.due]).toEqual(['first', true, L(18, 17, 30)]); // the last hour of Wednesday
    const n = st(cfg, { created: L(16, 14, 0).toISOString(), source_priority: 'Low SLA' }, [], L(16, 15, 0)).c;
    expect([n.kind, n.due]).toEqual(['first', L(17, 14, 0)]);
  });

  it('weekly update (P4) after a logged response, and escalation owner -> support -> Nick', () => {
    const cfg = defaultConfig();
    cfg.commStandard = { sdLastUpdatedCountsAsUpdate: false };
    const evs = [
      ev('nick', 1, { type: 'item.grade', item: 'SD:9001', data: { bucket: 'Support', priority: 'P4', impact: 2, urgency: 2, effort: 1, owner: 'wes' } }),
      { file: 'wes', event: { id: 'r', ts: L(16, 10, 0).toISOString(), user: 'wes', type: 'item.reply', item: 'SD:9001', data: { via: 'Service Desk', kind: 'first' } } as HubEvent },
    ];
    const base = { created: L(16, 9, 0).toISOString() };
    const due = st(cfg, base, evs, L(16, 11)).c.due;
    expect(due).toEqual(L(23, 10, 0)); // same time, 5 business days later
    expect(st(cfg, base, evs, L(23, 9, 0)).c).toMatchObject({ level: 'soon', responsible: 'wes' });
    expect(st(cfg, base, evs, L(23, 12, 0)).c).toMatchObject({ level: 'overdue', responsible: 'wes' });
    expect(st(cfg, base, evs, L(24, 12, 0)).c).toMatchObject({ level: 'support', responsible: 'trey' }); // Trey is on support until Nov 30
    expect(st(cfg, base, evs, L(25, 12, 0)).c).toMatchObject({ level: 'manager', responsible: 'nick' });
    const { s: state } = st(cfg, base, evs, L(24, 12, 0));
    expect(noticesFor(state, 'trey', L(24, 12)).map((n) => n.role)).toEqual(['support']);
    expect(noticesFor(state, 'wes', L(24, 12)).map((n) => n.role)).toEqual(['owner']);
    expect(noticesFor(state, 'nick', L(24, 12))).toHaveLength(1);
  });

  it('promised next-update date wins when earlier; logging an update resets the clock', () => {
    const cfg = defaultConfig();
    cfg.commStandard = { sdLastUpdatedCountsAsUpdate: false };
    const evs = [
      ev('nick', 1, { type: 'item.grade', item: 'SD:9001', data: { bucket: 'Support', priority: 'P4', impact: 2, urgency: 2, effort: 1, owner: 'wes' } }),
      { file: 'wes', event: { id: 'r', ts: L(16, 10, 0).toISOString(), user: 'wes', type: 'item.reply', item: 'SD:9001', data: { via: 'SD', kind: 'first', nextUpdate: '2026-11-18' } } as HubEvent },
    ];
    expect(st(cfg, { created: L(16, 9).toISOString() }, evs, L(16, 11)).c.due).toEqual(L(18, 17, 30));
  });

  it('requester follow-ups every 48 hours while Waiting for Requester, counting attempts', () => {
    const cfg = defaultConfig();
    const evs = [
      ev('nick', 1, { type: 'item.grade', item: 'SD:9001', data: { bucket: 'Support', priority: 'P3', impact: 2, urgency: 2, effort: 1, owner: 'wes' } }),
      ev('nick', 2, { type: 'item.move', item: 'SD:9001', data: { column: 'To Do' } }),
      { file: 'wes', event: { id: 'f1', ts: L(16, 10).toISOString(), user: 'wes', type: 'item.reply', item: 'SD:9001', data: { via: 'SD', kind: 'follow-up' } } as HubEvent },
    ];
    const c = st(cfg, { created: L(10, 9).toISOString(), source_status: 'Waiting for Requester', responded: L(10, 10).toISOString() }, evs, L(17, 9)).c;
    expect(c.kind).toBe('follow-up');
    expect(c.label).toMatch(/attempt 2 of 3/);
    expect(c.due).toEqual(L(18, 10));
  });

  it('no owner, or owner off: support handles it from the start', () => {
    const cfg = defaultConfig();
    const c = st(cfg, { created: L(19, 10).toISOString() }, [], L(19, 11)).c;
    expect(c.responsible).toBe(currentDispatch(cfg, '2026-11-19')!.analyst);
    expect(c.why).toMatch(/support/);
  });

  it('importer reads first-response and last-note columns', () => {
    const r = importTicketsCsv('RequestID,Subject,Request Status,Created Time,Responded Time,Last Note Time,Last Updated Time\nINC-1,X,Open,11-16-2026 09:00,11-16-2026 09:30,11-17-2026 14:00,11-18-2026 08:00\n', 'SD', { now: new Date('2026-11-19T12:00:00') });
    expect(r.tickets[0]).toMatchObject({ responded: new Date(2026, 10, 16, 9, 30).toISOString(), last_note: new Date(2026, 10, 17, 14).toISOString(), last_modified: new Date(2026, 10, 18, 8).toISOString() });
  });
});

describe('communication escalation edge cases', () => {
  it('when the owner is the person on support, an escalation goes straight to the manager', () => {
    const L = (d: number, h: number) => new Date(2026, 10, d, h);
    const cfg = defaultConfig();
    cfg.commStandard = { sdLastUpdatedCountsAsUpdate: false };
    const s = replay(cfg, { generatedAt: at(0), generatedBy: 't', mode: 'csv', items: [{ source: 'SD', source_id: '7', title: 'x', source_status: 'Open', created: L(2, 9).toISOString(), responded: L(2, 10).toISOString() }] }, [
      ev('nick', 1, { type: 'item.grade', item: 'SD:7', data: { bucket: 'Support', priority: 'P3', impact: 2, urgency: 2, effort: 1, owner: 'trey' } }),
    ]);
    const c = commStatus(s, s.items.get('SD:7')!, L(18, 12))!; // Trey owns it and is on support
    expect(c).toMatchObject({ level: 'manager', responsible: 'nick' });
    expect(noticesFor(s, 'nick', L(18, 12))[0].role).toBe('manager');
  });
});

describe('forced priority (expedite)', () => {
  const g = (file: string, min: number, item: string, priority: string, owner?: string) =>
    ev(file, min, { type: 'item.grade', item, data: { bucket: 'Support', priority, impact: 3, urgency: 3, effort: 1, owner } });
  it('goes P1 and to the top of its list, stays P1 when re-graded, and can be cleared', () => {
    const evs = [
      g('nick', 1, 'SD:100', 'P1'), move('nick', 2, 'SD:100', 'To Do'),
      g('nick', 3, 'SD:101', 'P4'), move('nick', 4, 'SD:101', 'To Do'),
      ev('nick', 5, { type: 'item.expedite', item: 'SD:101', data: { requestedBy: 'Executive team', reason: 'Board ask' } }),
      g('nick', 6, 'SD:101', 'P3'),
    ];
    let s = replay(defaultConfig(), snap([{}, {}]), evs);
    expect(rankedList(s, 'Support').map((i) => [i.id, i.rank, i.priority])).toEqual([['SD:101', 1, 'P1'], ['SD:100', 2, 'P1']]);
    s = replay(defaultConfig(), snap([{}, {}]), [...evs, ev('nick', 7, { type: 'item.expedite', item: 'SD:101', data: { clear: true } })]);
    expect(s.items.get('SD:101')!.expedite).toBeUndefined();
  });
  it('only Nick can force; a forced item may enter Doing past WIP, even when the owner moves it', () => {
    const cfg = defaultConfig();
    cfg.people.find((p) => p.username === 'wes')!.wipLimit = 1;
    const s = replay(cfg, snap([{}, {}]), [
      g('nick', 1, 'SD:100', 'P2', 'wes'), move('wes', 2, 'SD:100', 'Doing'),
      g('nick', 3, 'SD:101', 'P3', 'wes'), move('nick', 4, 'SD:101', 'To Do'),
      ev('wes', 5, { type: 'item.expedite', item: 'SD:100', data: { requestedBy: 'Me', reason: 'nope' } }),
      ev('nick', 6, { type: 'item.expedite', item: 'SD:101', data: { requestedBy: 'Executive team', approvedBy: 'Matt', reason: 'Exam finding', holds: ['SD:100'] } }),
      move('nick', 7, 'SD:100', 'On Hold', { reason: 'Held for forced priority' }),
      move('wes', 8, 'SD:101', 'Doing', { override: 'Forced priority: Exam finding' }),
    ]);
    expect(s.audit.filter((a) => a.rejected).map((a) => a.rejected)).toEqual(['Only Nick can force a priority']);
    expect(s.items.get('SD:101')).toMatchObject({ column: 'Doing', priority: 'P1', expedite: { approvedBy: 'Matt', holds: ['SD:100'] } });
    expect(s.items.get('SD:100')!.column).toBe('On Hold');
    expect(checkWip(s, s.items.get('SD:101')!, 'wes', 'Doing').ok).toBe(true);
  });
  it('a forced project goes first on the Team score page without changing anyone’s score', () => {
    const proj = (id: string, min: number) => [
      ev('nick', min, { type: 'item.create', item: id, data: { source: 'Hub', title: id } }),
      ev('nick', min + 1, { type: 'item.grade', item: id, data: { bucket: 'Project', priority: 'P3', impact: 3, urgency: 3, effort: 3 } }),
    ];
    const r = (item: string, n: number) => ev('wes', 20, { type: 'team.rate', item, data: { ratings: { value: n, risk: n, urgency: n, reach: n, effort: 6 - n } } });
    const s = replay(defaultConfig(), snap([]), [...proj('A', 1), ...proj('B', 5), r('A', 5), r('B', 2), ev('nick', 30, { type: 'item.expedite', item: 'B', data: { requestedBy: 'CEO', reason: 'x' } })]);
    expect(teamBoard(s).scored.map((x) => [x.item.id, x.position, x.ts.score])).toEqual([['B', 1, 25], ['A', 2, 100]]);
  });
});

describe('shipped config template', () => {
  it('loads cleanly: blank emails and SD names are ignored, standard and rotation present', async () => {
    const { normalizeConfig } = await import('../src/model/config');
    const raw = (await import('../deploy/hub-config.json')).default;
    const cfg = normalizeConfig(raw as never);
    expect(cfg.people).toHaveLength(8);
    expect(cfg.rotation?.shift).toBe('2weeks');
    expect(cfg.commStandard?.updateBusinessDays).toBe(5);
    expect(personForSourceName(cfg, 'Wesley Wilson')?.username).toBe('wes'); // first-name match still works with sdName ''
    const s = replay(cfg, snap([{ source_owner: 'Cathy E. Garcia' }]), []);
    expect(s.items.get('SD:100')!.owner).toBe('cathy');
  });
});

describe('Wrike Excel import', () => {
  it('reads the export, takes IDs from links, skips headings and cancelled, matches names', async () => {
    const { readFileSync } = await import('fs' as string);
    const { readXlsx } = await import('../src/model/xlsx');
    const { importTicketRows } = await import('../src/model/csv');
    const buf = readFileSync('tests/fixtures/wrike-sample.xlsx');
    const sheet = await readXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    expect(sheet.rows[0][0]).toBe('Name');
    const r = importTicketRows(sheet.rows, 'Wrike', { links: sheet.links, now: new Date('2026-11-19T12:00:00') });
    expect(r.tickets.map((t) => t.source_id)).toEqual(['1000000001', '1000000002', '1000000003', '1000000005']);
    expect(r.skippedHeadings).toBe(2);
    expect(r.skippedOldClosed).toBe(1);
    expect(r.tickets[1]).toMatchObject({ source_url: 'https://www.wrike.com/open.htm?id=1000000002', subcategory: 'Synergy', category: 'Maintenance', due_by: new Date(2026, 10, 2).toISOString() });

    const cfg = defaultConfig();
    cfg.systems.push({ id: 'symitar', name: 'Symitar', primary: 'cathy' }, { id: 'synergy', name: 'Synergy', primary: 'wes' });
    cfg.people.find((p) => p.username === 'cathy')!.sdName = 'Cathy E. Garcia';
    cfg.people.find((p) => p.username === 'nick')!.sdName = 'Nick Rudolph';
    const s = replay(cfg, { generatedAt: at(0), generatedBy: 't', mode: 'xlsx', items: r.tickets }, []);
    const g = (id: string) => s.items.get('Wrike:' + id)!;
    expect(g('1000000001')).toMatchObject({ owner: 'cathy', system: 'symitar', suggested_bucket: 'Project', column: 'Intake' }); // "Catherine Garcia" ~ "Cathy E. Garcia"
    expect(g('1000000002')).toMatchObject({ owner: 'michael', source_owners: ['Michael Cariglino', 'Wesley Wilson'], suggested_bucket: 'Maintenance', system: 'synergy' });
    expect(g('1000000003')).toMatchObject({ owner: undefined, system: 'symitar' }); // "Symitar, SharePoint"
    expect(g('1000000005')).toMatchObject({ owner: undefined, ownerFromSource: true }); // assignee not on the hub
    expect(personForSourceName(cfg, 'Nicholas Rudolph')?.username).toBe('nick');
  });
});

describe('communication standard go-live date', () => {
  it('clocks start no earlier than enforceFrom', () => {
    const L = (d: number, h: number) => new Date(2026, 10, d, h);
    const cfg = defaultConfig();
    cfg.commStandard = { sdLastUpdatedCountsAsUpdate: true, enforceFrom: '2026-11-23' };
    const s = replay(cfg, { generatedAt: at(0), generatedBy: 't', mode: 'csv', items: [{ source: 'SD', source_id: '5', title: 'old', source_status: 'Open', created: new Date(2026, 6, 1).toISOString(), last_modified: new Date(2026, 7, 1).toISOString() }] }, []);
    const c = commStatus(s, s.items.get('SD:5')!, L(23, 12))!;
    expect(c.level).toBe('ok');
    expect(c.due).toEqual(addBusinessDays(DEFAULT_STANDARD, new Date(2026, 10, 23), 5));
  });
});

describe('avatars (profile.set)', () => {
  const photo = 'data:image/jpeg;base64,' + 'A'.repeat(200);
  it('applies colour, emoji and photo to the person who wrote the file, and clears with null', () => {
    const s = replay(defaultConfig(), undefined, [
      ev('wes', 1, { type: 'profile.set', data: { color: '#B42318', emoji: '🦊' } }),
      ev('wes', 2, { type: 'profile.set', data: { photo } }),
    ]);
    expect(s.config.people.find((p) => p.username === 'wes')!.avatar).toEqual({ color: '#B42318', emoji: '🦊', photo });
    const s2 = replay(defaultConfig(), undefined, [
      ev('wes', 1, { type: 'profile.set', data: { color: '#B42318', emoji: '🦊', photo } }),
      ev('wes', 2, { type: 'profile.set', data: { photo: null, emoji: null } }),
    ]);
    expect(s2.config.people.find((p) => p.username === 'wes')!.avatar).toEqual({ color: '#B42318' });
  });
  it('can only change your own avatar, and ignores unsafe values', () => {
    const s = replay(defaultConfig(), undefined, [
      ev('wes', 1, { type: 'profile.set', data: { username: 'nick', color: '#7135B8' } }),
      ev('nick', 2, { type: 'profile.set', data: { color: '#123456', emoji: '<b>', photo: 'javascript:alert(1)' } }),
    ]);
    expect(s.config.people.find((p) => p.username === 'wes')!.avatar).toEqual({ color: '#7135B8' });
    expect(s.config.people.find((p) => p.username === 'nick')!.avatar).toEqual({});
  });
  it('viewers can style their own avatar too', () => {
    const viewer = defaultConfig().people.find((p) => p.role === 'viewer')!.username;
    const s = replay(defaultConfig(), undefined, [ev(viewer, 1, { type: 'profile.set', data: { emoji: '🎯' } })]);
    expect(s.config.people.find((p) => p.username === viewer)!.avatar?.emoji).toBe('🎯');
    expect(s.audit.find((a) => a.event.type === 'profile.set')!.rejected).toBeFalsy();
  });
});

describe('ownership map with several people per role', () => {
  const today = new Date().toISOString().slice(0, 10);
  const cfgWith = (off: string[]) => {
    const c = defaultConfig();
    c.systems = [{ id: 'opcon', name: 'OpCon', primary: 'wes', secondary: 'noelle', third: ['michael', 'trey', 'cathy'], criticality: 'Critical' }];
    c.timeOff = off.map((u, i) => ({ id: `t${i}`, username: u, from: today, to: today, kind: 'pto' }) as never);
    return c;
  };
  it('suggests primary first', () => {
    expect(suggestOwner(replay(cfgWith([]), undefined, []), 'opcon')!.username).toBe('wes');
  });
  it('walks the third-backup list in order when people are off', () => {
    expect(suggestOwner(replay(cfgWith(['wes', 'noelle']), undefined, []), 'opcon')!.username).toBe('michael');
    expect(suggestOwner(replay(cfgWith(['wes', 'noelle', 'michael']), undefined, []), 'opcon')!.username).toBe('trey');
  });
  it('a list in secondary alternates with its first person', () => {
    const c = cfgWith([]);
    c.systems[0] = { id: 'sym', name: 'Symitar (Configuration)', primary: 'cathy', secondary: ['trey', 'noelle'], third: 'michael' };
    const s = replay(c, snap([{ source_id: '1', subcategory: 'x' }]), [ev('nick', 1, { type: 'item.grade', item: 'SD:1', data: { bucket: 'Support', impact: 2, urgency: 2, effort: 2, system: 'sym', owner: 'cathy' } })]);
    expect(suggestOwner(s, 'sym')!.username).toBe('trey');
  });
});

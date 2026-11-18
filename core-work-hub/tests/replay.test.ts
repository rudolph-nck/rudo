import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/model/config';
import { replay, type SourcedEvent } from '../src/model/replay';
import { checkWip, computeScore, rankKeyAt, rankedList, suggestOwner, suggestPriority, mapSourcePriority } from '../src/model/logic';
import { importTicketsCsv, maskNumbers, mergeSnapshot, parseCsv } from '../src/model/csv';
import type { HubEvent, TicketsSnapshot } from '../src/model/types';
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

  it('no conflict when the hub changed the field after the source', () => {
    const sn = snap([{ source_owner: 'Cathy', changed: { source_owner: at(5) } }]);
    const s = replay(defaultConfig(), sn, [grade('nick', 10, 'SD:100', 'Support', 'wes')]);
    expect(s.items.get('SD:100')!.owner).toBe('wes');
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

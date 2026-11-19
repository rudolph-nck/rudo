// The IT Core priority standard: targets, aging, bumps, re-prioritizing and the stand-up list.
(globalThis as unknown as { process: { env: Record<string, string> } }).process.env.TZ = 'America/New_York';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/model/config';
import { replay, type SourcedEvent } from '../src/model/replay';
import { ageOf, priorityStandardOf, standup, standupText } from '../src/model/priority';
import { commStatus } from '../src/model/comms';
import type { HubEvent, Priority, TicketsSnapshot } from '../src/model/types';

let n = 0;
const local = (m: number, d: number, h = 9, min = 0) => new Date(2026, m - 1, d, h, min);
const ev = (file: string, ts: Date, e: object): SourcedEvent => ({ file, event: { id: `e${++n}`, ts: ts.toISOString(), user: file, ...e } as HubEvent });
const snap = (items: Partial<TicketsSnapshot['items'][0]>[]): TicketsSnapshot => ({
  generatedAt: local(11, 1).toISOString(),
  generatedBy: 'test',
  mode: 'csv',
  items: items.map((t, i) => ({ source: 'SD', source_id: String(100 + i), title: `T${i}`, source_status: 'Open', created: local(11, 2).toISOString(), ...t })),
});
const grade = (ts: Date, item: string, priority: Priority, owner = 'wes', bucket = 'Support') =>
  ev('nick', ts, { type: 'item.grade', item, data: { bucket, priority, impact: 3, urgency: 3, effort: 1, system: 'ad', owner } });

describe('priority standard', () => {
  it('defaults: P1 same day, P2 3, P3 10, P4 20 business days; P1 1-hour response and hourly updates', () => {
    const ps = priorityStandardOf(defaultConfig());
    expect([ps.P1.resolveDays, ps.P2.resolveDays, ps.P3.resolveDays, ps.P4.resolveDays]).toEqual([1, 3, 10, 20]);
    expect([ps.P1.respond, ps.P1.respondUnit, ps.P1.update, ps.P1.updateUnit]).toEqual([1, 'h', 1, 'h']);
  });
  it('a new P1 must be answered within 1 business hour', () => {
    const cfg = defaultConfig();
    const s = replay(cfg, snap([{ created: local(11, 23, 9, 0).toISOString() }]), [grade(local(11, 23, 9, 1), 'SD:100', 'P1')]);
    const st = commStatus(s, s.items.get('SD:100')!, local(11, 23, 9, 30))!;
    expect(st.kind).toBe('first');
    expect(st.due.getHours()).toBe(10);
    expect(st.due.getMinutes()).toBe(0);
  });
  it('a P2 opened at 4 PM is answered the next business morning (4 business hours)', () => {
    const s = replay(defaultConfig(), snap([{ created: local(11, 23, 16, 0).toISOString() }]), [grade(local(11, 23, 16, 1), 'SD:100', 'P2')]);
    const st = commStatus(s, s.items.get('SD:100')!, local(11, 23, 16, 5))!;
    expect(st.due.getDate()).toBe(24);
    expect(st.due.getHours()).toBe(11); // 1.5h Monday + 2.5h Tuesday from 8:30
  });
});

describe('aging', () => {
  it('a P2 is at risk halfway, past target after 3 business days', () => {
    const s = replay(defaultConfig(), snap([{ created: local(11, 16, 9).toISOString() }]), [grade(local(11, 16, 9, 5), 'SD:100', 'P2')]);
    const i = s.items.get('SD:100')!;
    expect(ageOf(s, i, local(11, 17, 10))!.stage).toBe('ok'); // 38% of the way
    expect(ageOf(s, i, local(11, 17, 15))!.stage).toBe('risk'); // 57%
    const past = ageOf(s, i, local(11, 19, 12))!;
    expect(past.stage).toBe('past');
    expect(past.effective).toBe('P2'); // never raised to P1
  });
  it('a P4 past 20 business days acts as a P3, at twice the target as a P2, never P1', () => {
    const s = replay(defaultConfig(), snap([{ created: local(9, 1, 9).toISOString() }]), [grade(local(9, 1, 9, 5), 'SD:100', 'P4')]);
    const i = s.items.get('SD:100')!;
    expect(ageOf(s, i, local(10, 5))!.effective).toBe('P3');
    expect(ageOf(s, i, local(11, 20))!.effective).toBe('P2');
    expect(ageOf(s, i, local(12, 30))!.effective).toBe('P2');
  });
  it('backlog: tickets older than the start date start their clock on it, but true age still orders them', () => {
    const cfg = defaultConfig();
    cfg.priorityStandard = { startFrom: '2026-12-01' };
    const s = replay(cfg, snap([{ created: local(6, 1).toISOString() }, { created: local(12, 1, 10).toISOString() }]), [
      grade(local(12, 1, 10, 1), 'SD:100', 'P4'),
      grade(local(12, 1, 10, 2), 'SD:101', 'P3'),
    ]);
    const old = ageOf(s, s.items.get('SD:100')!, local(12, 2))!;
    const fresh = ageOf(s, s.items.get('SD:101')!, local(12, 2))!;
    expect(old.backlog).toBe(true);
    expect(old.stage).toBe('ok'); // not overdue on day one
    expect(old.score).toBeGreaterThan(fresh.score); // a 6-month-old P4 is ahead of a brand-new P3
    expect(standup(s, local(12, 2)).backlog.total).toBe(1);
    // A month later the backlog P4 is past 20 days, but it's worked down via the backlog goal, not "past target".
    const later = standup(s, local(12, 31));
    expect(later.past.map((r) => r.item.id)).not.toContain('SD:100');
    expect(later.backlog.next[0].item.id).toBe('SD:100');
    expect(later.backlog.goal).toBe(10);
  });
  it('ungraded tickets with no priority count as P4 until graded', () => {
    const s = replay(defaultConfig(), snap([{ created: local(9, 1).toISOString() }]), []);
    const a = ageOf(s, s.items.get('SD:100')!, local(11, 20))!;
    expect([a.priority, a.ungraded, a.stage]).toEqual(['P4', true, 'double']);
  });
});

describe('bumps', () => {
  const three = () => [
    grade(local(11, 2, 9, 1), 'SD:100', 'P3'),
    grade(local(11, 2, 9, 2), 'SD:101', 'P3'),
    grade(local(11, 2, 9, 3), 'SD:102', 'P3'),
    ev('nick', local(11, 2, 9, 4), { type: 'item.move', item: 'SD:100', data: { column: 'To Do' } }),
    ev('nick', local(11, 2, 9, 5), { type: 'item.move', item: 'SD:101', data: { column: 'To Do' } }),
    ev('nick', local(11, 2, 9, 6), { type: 'item.move', item: 'SD:102', data: { column: 'To Do' } }),
  ];
  const items = snap([{}, {}, {}]);
  it('picking up work ranked lower bumps everything above it', () => {
    const s = replay(defaultConfig(), items, [...three(), ev('wes', local(11, 3), { type: 'item.move', item: 'SD:102', data: { column: 'Doing' } })]);
    expect(s.items.get('SD:100')!.bumps).toBe(1);
    expect(s.items.get('SD:101')!.bumps).toBe(1);
    expect(s.items.get('SD:102')!.bumps ?? 0).toBe(0);
  });
  it('jumping an item to the top bumps the ones it passed', () => {
    const s = replay(defaultConfig(), items, [...three(), ev('nick', local(11, 3), { type: 'item.rank', item: 'SD:102', data: { rankKey: 0.5 } })]);
    expect(s.items.get('SD:100')!.bumps).toBe(1);
    expect(s.items.get('SD:101')!.bumps).toBe(1);
  });
  it('re-prioritizing down needs a reason, is logged, and counts as a bump; 3 bumps flags it for stand-up', () => {
    const s = replay(defaultConfig(), items, [
      ...three(),
      ev('nick', local(11, 3), { type: 'item.reprioritize', item: 'SD:100', data: { priority: 'P4', reason: 'Leadership focus on P1 outage', toldRequester: true, managerAware: true } }),
      ev('wes', local(11, 4), { type: 'item.move', item: 'SD:102', data: { column: 'Doing' } }),
      ev('nick', local(11, 5), { type: 'item.rank', item: 'SD:101', data: { rankKey: 0.1 } }),
    ]);
    const i = s.items.get('SD:100')!;
    expect(i.priority).toBe('P4');
    expect(i.priorityLog?.[0]).toMatchObject({ from: 'P3', to: 'P4', reason: 'Leadership focus on P1 outage', managerAware: true });
    expect(i.bumps).toBe(3);
    expect(standup(s, local(11, 6)).bumped.map((r) => r.item.id)).toContain('SD:100');
  });
  it('analysts cannot re-prioritize', () => {
    const s = replay(defaultConfig(), items, [...three(), ev('wes', local(11, 3), { type: 'item.reprioritize', item: 'SD:100', data: { priority: 'P4', reason: 'x' } })]);
    expect(s.items.get('SD:100')!.priority).toBe('P3');
  });
});

describe('stand-up list', () => {
  it('lists P1s, past-target items, items due within a business day, missed commitments and idle departments', () => {
    const s = replay(
      defaultConfig(),
      snap([
        { created: local(11, 19, 9).toISOString() },
        { created: local(11, 16, 9).toISOString(), department: 'Lending' },
        { created: local(11, 18, 9).toISOString() },
        { created: local(10, 1, 9).toISOString(), department: 'Accounting' },
      ]),
      [
        grade(local(11, 19, 10), 'SD:100', 'P1'),
        grade(local(11, 19, 10), 'SD:101', 'P2'),
        grade(local(11, 19, 10), 'SD:102', 'P2'),
        grade(local(11, 19, 10), 'SD:103', 'P4'),
        ev('nick', local(11, 19, 11), { type: 'item.commit', item: 'SD:102', data: { date: '2026-11-19', note: 'Vendor call' } }),
      ],
    );
    const now = local(11, 20, 9);
    const r = standup(s, now);
    expect(r.p1.map((x) => x.item.id)).toEqual(['SD:100']);
    expect(r.past.map((x) => x.item.id)).toContain('SD:101');
    expect(r.missedCommitments.map((x) => x.item.id)).toEqual(['SD:102']);
    expect(r.departments.map((d) => d.department)).toContain('Accounting');
    expect(r.mustDiscuss).toBeGreaterThanOrEqual(4);
    expect(standupText(s, r, now)).toMatch(/Past target[\s\S]*#101/);
  });
  it('platform-owner check lists tickets owned by someone off the map, with the primary owner', () => {
    const cfg = defaultConfig();
    const s = replay(cfg, snap([{}]), [grade(local(11, 2, 10), 'SD:100', 'P3', 'tabitha')]);
    const m = standup(s, local(11, 3)).mismatches;
    const ad = cfg.systems.find((x) => x.id === 'ad')!;
    expect(m[0].item.id).toBe('SD:100');
    expect(m[0].suggested).toBe(ad.primary);
  });
});

describe('stand-up agenda: due today, coming up, check-ins', () => {
  it('a P2 on day 3 of 3 is "due today"; one due in two days is "coming up"; a check-in counts as discussed', () => {
    const s0 = snap([
      { created: local(11, 16, 11).toISOString() }, // Mon 11:00 -> due Thu
      { created: local(11, 18, 11).toISOString() }, // Wed 11:00 -> due Mon
    ]);
    const evs = [grade(local(11, 16, 11, 5), 'SD:100', 'P2'), grade(local(11, 18, 11, 5), 'SD:101', 'P2')];
    const thu = local(11, 19, 10, 15);
    const r = standup(replay(defaultConfig(), s0, evs), thu);
    expect(r.dueToday.map((x) => x.item.id)).toEqual(['SD:100']);
    expect(r.dueToday[0].why).toMatch(/Last day: day 3 of 3/);
    expect(r.comingUp.map((x) => x.item.id)).toEqual(['SD:101']);
    expect(r.discussed).toBe(0);
    const s2 = replay(defaultConfig(), s0, [...evs, ev('trey', local(11, 19, 10, 20), { type: 'item.standup', item: 'SD:100', data: { status: 'at-risk', note: 'Vendor call at 2' } })]);
    const r2 = standup(s2, local(11, 19, 10, 25));
    expect(r2.discussed).toBe(1); // Trey is on support, so his check-in counts
    expect(standupText(s2, r2, local(11, 19, 10, 25))).toMatch(/\[At risk: Vendor call at 2\]/);
  });
  it('analysts cannot record check-ins', () => {
    const s = replay(defaultConfig(), snap([{}]), [grade(local(11, 2, 10), 'SD:100', 'P3'), ev('wes', local(11, 3), { type: 'item.standup', item: 'SD:100', data: { status: 'blocked' } })]);
    expect(s.items.get('SD:100')!.standupLog).toBeUndefined();
  });
});

describe('levels and support week', () => {
  it('time split follows the level, and the support split during a support shift', async () => {
    const { capacityFor } = await import('../src/model/logic');
    const cfg = defaultConfig();
    cfg.people.find((p) => p.username === 'wes')!.level = 'senior';
    cfg.people.find((p) => p.username === 'michael')!.level = 'junior';
    expect(capacityFor(cfg, 'wes', '2026-11-16')).toMatchObject({ label: 'Senior', hours: { projects: 16 } });
    expect(capacityFor(cfg, 'michael', '2026-11-16')).toMatchObject({ label: 'Junior', hours: { dispatch: 8 } });
    expect(capacityFor(cfg, 'trey', '2026-11-16')).toMatchObject({ label: 'Support week', hours: { dispatch: 20 } }); // Trey is on support
    expect(capacityFor(cfg, 'noelle', '2026-11-16').label).toBe('Team model'); // no level set
  });
  it('projects pause for whoever is on support (WIP check warns; override still possible)', async () => {
    const { checkWip, currentDispatch } = await import('../src/model/logic');
    const onSupport = currentDispatch(defaultConfig())!.analyst; // whoever the rotation has on support today
    const s = replay(defaultConfig(), snap([{}]), [grade(local(11, 2, 10), 'SD:100', 'P3', onSupport, 'Project')]);
    const w = checkWip(s, s.items.get('SD:100')!, onSupport, 'Doing');
    expect(w.ok).toBe(false);
    expect(w.messages.join(' ')).toMatch(/on support until .*projects are paused/);
  });
  it('business time shows whole units only', async () => {
    const { fmtBusiness, DEFAULT_STANDARD } = await import('../src/model/comms');
    expect(fmtBusiness(DEFAULT_STANDARD, 540 * 1.6)).toBe('2 business days');
    expect(fmtBusiness(DEFAULT_STANDARD, 200)).toBe('3h');
  });
});

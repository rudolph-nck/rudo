// Panda HQ: points, team goals, leaderboard credit, badges, awards; time-to-assign analytics.
(globalThis as unknown as { process: { env: Record<string, string> } }).process.env.TZ = 'America/New_York';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/model/config';
import { replay } from '../src/model/replay';
import { assignStats, closes, goals, leaderboard, monthlyAwards, periodStart } from '../src/model/fun';
import type { HubConfig, TicketsSnapshot } from '../src/model/types';

const local = (m: number, d: number, h = 9) => new Date(2026, m - 1, d, h);
const cfgWith = (): HubConfig => {
  const c = defaultConfig();
  const names: Record<string, string> = { wes: 'Wes W', trey: 'Trey C', cathy: 'Cathy G' };
  c.people.forEach((p) => { if (names[p.username]) p.sdName = names[p.username]; });
  c.people.find((p) => p.username === 'trey')!.level = 'junior';
  return c;
};
let n = 0;
const t = (o: Partial<TicketsSnapshot['items'][0]>) => ({ source: 'SD' as const, source_id: String(1000 + ++n), title: `T${n}`, source_status: 'Closed', created: local(11, 2).toISOString(), ...o });
const snapOf = (items: ReturnType<typeof t>[]): TicketsSnapshot => ({ generatedAt: local(11, 20).toISOString(), generatedBy: 't', mode: 'csv', items });

describe('Panda HQ scoring', () => {
  it('points: priority + on-time bonus + backlog bonus; credit to the hub owner', () => {
    const s = replay(cfgWith(), snapOf([
      t({ source_priority: 'Critical', source_owner: 'Wes W', created: local(11, 16, 9).toISOString(), closed: local(11, 16, 15).toISOString() }), // P1 same day: 8+2
      t({ source_priority: 'Low', source_owner: 'Trey C', created: local(6, 1).toISOString(), closed: local(11, 17).toISOString() }), // P4 old: 2+0+3
      t({ source_owner: 'Kathy Retired', closed: local(11, 18).toISOString() }), // not on the hub: team goal only
    ]), []);
    const c = closes(s);
    expect(c).toHaveLength(3);
    const wes = c.find((x) => x.user === 'wes')!;
    expect([wes.priority, wes.onTime, wes.points]).toEqual(['P1', true, 10]);
    const trey = c.find((x) => x.user === 'trey')!;
    expect([trey.backlog, trey.onTime, trey.points]).toEqual([true, false, 5]);
    expect(c.find((x) => !x.user)).toBeTruthy();
    const lb = leaderboard(s, 'month', local(11, 20));
    expect(lb[0]).toMatchObject({ user: 'wes', points: 10, p1: 1 });
    expect(lb[0].badges).toContain('firefighter');
  });

  it('team goals count every close; the fire show is due once a goal is reached; all-time tiers', () => {
    const c = cfgWith();
    c.fun = { goals: { week: 2, month: 50, year: 1200, allTime: [3, 10] } };
    const s = replay(c, snapOf([0, 1, 2].map((k) => t({ source_owner: 'Wes W', closed: local(11, 16 + k).toISOString() }))), []);
    const g = goals(s, local(11, 20));
    const week = g.find((x) => x.period === 'week')!;
    expect([week.count, week.reached, week.celebrate]).toEqual([3, true, true]);
    expect(week.key).toBe('week-2026-11-16');
    const month = g.find((x) => x.period === 'month')!;
    expect([month.count, month.reached]).toEqual([3, false]);
    const all = g.find((x) => x.period === 'all')!;
    expect([all.tier, all.goal, all.celebrate, all.reached, all.key]).toEqual([1, 10, true, false, 'all-1']);
  });

  it('a 5-business-day streak earns the Streak badge (weekends skipped)', () => {
    const days = [13, 16, 17, 18, 19]; // Fri, Mon-Thu
    const s = replay(cfgWith(), snapOf(days.map((d) => t({ source_owner: 'Cathy G', closed: local(11, d, 14).toISOString() }))), []);
    expect(leaderboard(s, 'month', local(11, 20)).find((x) => x.user === 'cathy')!.badges).toContain('streak');
  });

  it('monthly awards spread across categories; Rookie goes to the top junior', () => {
    const s = replay(cfgWith(), snapOf([
      ...[1, 2, 3, 4].map((d) => t({ source_priority: 'High', source_owner: 'Wes W', created: local(11, d).toISOString(), closed: local(11, d + 1).toISOString() })),
      ...[2, 3].map((d) => t({ source_owner: 'Trey C', created: local(5, 1).toISOString(), closed: local(11, d).toISOString() })),
    ]), []);
    const a = monthlyAwards(s, 2026, 10);
    expect(a.find((x) => x.id === 'top')!.winner).toBe('wes');
    expect(a.find((x) => x.id === 'backlog')!.winner).toBe('trey');
    expect(a.find((x) => x.id === 'rookie')!.winner).toBe('trey');
  });
});

describe('time to assign', () => {
  it('median business hours from opened to assigned, and tickets waiting for an owner', () => {
    const s = replay(cfgWith(), snapOf([
      t({ source_status: 'Open', created: local(11, 16, 9).toISOString(), assigned: local(11, 16, 10).toISOString(), source_owner: 'Wes W' }),
      t({ source_status: 'Open', created: local(11, 16, 9).toISOString(), assigned: local(11, 16, 13).toISOString(), source_owner: 'Wes W' }),
      t({ source_status: 'Open', created: local(11, 16, 9).toISOString(), assigned: local(11, 16, 12).toISOString(), source_owner: 'Wes W' }),
      t({ source_status: 'Open', created: local(11, 19, 11).toISOString() }),
    ]), []);
    const a = assignStats(s, 4, local(11, 20, 9));
    expect(a.weekly[a.weekly.length - 1]).toMatchObject({ median: 3, n: 3 });
    expect(a.thisMonthMedian).toBe(3);
    expect(a.within1h).toBe(33);
    expect(a.waiting).toHaveLength(1);
    expect(a.waiting[0].hours).toBe(7); // Thu 11:00-17:30 + Fri 8:30-9:00
  });
  it('periods start Monday / the 1st / Jan 1', () => {
    expect(periodStart('week', local(11, 20)).getDate()).toBe(16);
    expect(periodStart('month', local(11, 20)).getDate()).toBe(1);
    expect(periodStart('quarter', local(11, 20)).getMonth()).toBe(9);
    expect(periodStart('year', local(11, 20)).getMonth()).toBe(0);
  });
});

describe('points preview', () => {
  it('matches what the close actually scores', async () => {
    const { pointsPreview } = await import('../src/model/fun');
    const cfg = cfgWith();
    const created = local(11, 16, 9);
    const open = replay(cfg, snapOf([t({ source_id: 'PV1', source_priority: 'High', source_status: 'Open', source_owner: 'Wes W', created: created.toISOString() })]), []);
    const item = [...open.items.values()].find((i) => i.source_id === 'PV1')!;
    const early = pointsPreview(open, item, local(11, 17, 10));
    expect([early.priority, early.base, early.onTimeStill, early.worth]).toEqual(['P2', 5, true, 7]);
    const late = pointsPreview(open, item, local(11, 25, 10));
    expect([late.onTimeStill, late.worth]).toEqual([false, 5]);
    // Close it on day 2: the leaderboard gives the same 7 the preview promised
    const shut = replay(cfg, snapOf([t({ source_id: 'PV1', source_priority: 'High', source_status: 'Closed', source_owner: 'Wes W', created: created.toISOString(), closed: local(11, 17, 10).toISOString() })]), []);
    expect(closes(shut).find((c) => c.item.source_id === 'PV1')!.points).toBe(early.worth);
  });
});

// Overview insights: weekly trends and the forecast, Ask (explore) answers, and off-path ownership.
(globalThis as unknown as { process: { env: Record<string, string> } }).process.env.TZ = 'America/New_York';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/model/config';
import { replay } from '../src/model/replay';
import { forecast, risers, weekly, whenTheyArrive } from '../src/model/trends';
import { explore } from '../src/model/explore';
import { offPath } from '../src/model/offpath';
import type { HubConfig, TicketsSnapshot, WorkItem } from '../src/model/types';

const now = new Date(2026, 10, 18, 17); // Wed
let n = 0;
type T = TicketsSnapshot['items'][0];
const t = (o: Partial<T>): T => ({ source: 'SD', source_id: String(9000 + ++n), title: `T${n}`, source_status: 'Open', created: now.toISOString(), ...o });
const snap = (items: T[]): TicketsSnapshot => ({ generatedAt: now.toISOString(), generatedBy: 't', mode: 'csv', items });

/** `perWeek` tickets every week for `weeks` weeks, Tuesdays 10am; half of them closed two days later. */
function steady(perWeek: number, weeks: number): T[] {
  const out: T[] = [];
  for (let w = weeks; w >= 1; w--) {
    for (let k = 0; k < perWeek; k++) {
      const c = new Date(now); c.setDate(c.getDate() - 7 * w - 1); c.setHours(10, 0, 0, 0);
      const closed = k % 2 === 0 ? new Date(c.getTime() + 2 * 864e5) : undefined;
      out.push(t({ created: c.toISOString(), ...(closed ? { source_status: 'Closed', closed: closed.toISOString() } : {}) }));
    }
  }
  return out;
}

describe('trends', () => {
  const s = replay(defaultConfig(), snap(steady(10, 40)), []);
  const items = [...s.items.values()] as WorkItem[];
  it('counts opened and closed per week, and what was open at each week end', () => {
    const wk = weekly(items, 8, now);
    expect(wk).toHaveLength(9);
    expect(wk.slice(0, -1).every((w) => w.opened === 10 && w.closed === 5)).toBe(true);
    expect(wk[wk.length - 1].open).toBe(items.filter((i) => i.column !== 'Done' && !i.sourceClosed).length);
  });
  it('forecasts a steady flow as steady, with an honest error and a range', () => {
    const f = forecast(items, 8, now)!;
    expect(f.weeks).toHaveLength(8);
    for (const w of f.weeks) {
      expect(w.expected).toBeGreaterThan(8);
      expect(w.expected).toBeLessThan(12);
      expect(w.low).toBeLessThanOrEqual(w.expected);
      expect(w.high).toBeGreaterThanOrEqual(w.expected);
    }
    expect(f.mae).toBeLessThan(1.5);
    expect(f.recentAvg).toBeCloseTo(10, 0);
  });
  it('needs 12 weeks of history', () => {
    const few = replay(defaultConfig(), snap(steady(5, 6)), []);
    expect(forecast([...few.items.values()], 8, now)).toBeUndefined();
  });
  it('finds when tickets arrive and what is rising', () => {
    const h = whenTheyArrive(items, 26, now);
    expect(h.grid[1][10]).toBeCloseTo(10, 0); // Tuesday 10am
    const extra = [...Array(6)].map(() => t({ subcategory: 'VPN', created: new Date(now.getTime() - 3 * 864e5).toISOString() }));
    const s2 = replay(defaultConfig(), snap([...steady(10, 40), ...extra]), []);
    expect(risers([...s2.items.values()], (i) => i.subcategory, now).map((r) => r.label)).toEqual(['VPN']);
  });
});

describe('Ask', () => {
  const s = replay(defaultConfig(), snap([
    t({ source_priority: 'High', department: 'Payments', created: new Date(2026, 10, 2, 9).toISOString(), source_status: 'Closed', closed: new Date(2026, 10, 4, 9).toISOString() }),
    t({ source_priority: 'High', department: 'Payments', created: new Date(2026, 10, 9, 9).toISOString() }),
    t({ source_priority: 'Low', department: 'Legal', created: new Date(2026, 9, 6, 9).toISOString() }),
  ]), []);
  it('counts by a dimension, biggest first, with the tickets behind each row', () => {
    const a = explore(s, { measure: 'count', event: 'opened', by: 'department', range: '12m' }, now);
    expect(a.rows.map((r) => [r.label, r.value])).toEqual([['Payments', 2], ['Legal', 1]]);
    expect(a.total).toBe(3);
    expect(a.rows[0].ids).toHaveLength(2);
  });
  it('fills time gaps and keeps time in order', () => {
    const a = explore(s, { measure: 'count', event: 'opened', by: 'weekday', range: 'all' }, now);
    expect(a.rows.map((r) => r.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect([a.rows[0].value, a.rows[1].value]).toEqual([2, 1]); // two Mondays, one Tuesday
  });
  it('filters, and measures time to close and what is open', () => {
    expect(explore(s, { measure: 'count', event: 'opened', by: 'none', range: '12m', where: { priority: 'P2' } }, now).total).toBe(2);
    expect(explore(s, { measure: 'days_to_close', event: 'closed', by: 'priority', range: '12m' }, now).rows[0]).toMatchObject({ label: 'P2', value: 2 });
    expect(explore(s, { measure: 'count', event: 'open_now', by: 'none', range: 'all' }, now).total).toBe(2);
  });
});

describe('off-path work', () => {
  const cfg: HubConfig = defaultConfig();
  cfg.people.forEach((p) => { if (p.username === 'wes') p.sdName = 'Wes W'; if (p.username === 'trey') p.sdName = 'Trey C'; });
  cfg.systems = [{ id: 'vpn', name: 'VPN', aliases: ['VPN'], primary: 'wes', secondary: ['cathy'] }, { id: 'ad', name: 'Active Directory', aliases: ['AD'] }];
  const s = replay(cfg, snap([
    t({ subcategory: 'VPN', source_owner: 'Wes W' }),
    t({ subcategory: 'VPN', source_owner: 'Trey C' }),
    t({ subcategory: 'VPN', source_owner: 'Trey C' }),
    t({ subcategory: 'AD', source_owner: 'Trey C' }),
    t({ subcategory: 'VPN', source_owner: 'Trey C', source_status: 'Closed', closed: new Date(2026, 10, 10).toISOString() }),
  ]), []);
  it('counts work outside the listed owners, per person, as a share of mapped work', () => {
    const o = offPath(s, 'open', now);
    const trey = o.people.find((p) => p.user === 'trey')!;
    expect([trey.total, trey.mapped, trey.off, trey.unmapped, trey.offPct]).toEqual([3, 2, 2, 1, 100]);
    expect(o.people.find((p) => p.user === 'wes')).toMatchObject({ onPath: 1, off: 0 });
    expect(o.items.map((x) => x.system.id)).toEqual(['vpn', 'vpn']);
    expect(o.totals).toMatchObject({ mapped: 3, off: 2, offPct: 67 });
  });
  it('can look at closed work instead', () => {
    expect(offPath(s, '90d', now).totals).toMatchObject({ mapped: 1, off: 1 });
  });
});

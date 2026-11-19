// Daylight saving: business-day math must step by calendar day, in the team's own time zone (US Eastern).
// Node applies a TZ set before the first Date is created.
(globalThis as unknown as { process: { env: Record<string, string> } }).process.env.TZ = 'America/New_York';
import { describe, expect, it } from 'vitest';
import { addBusinessDays, addBusinessMinutes, businessMinutesBetween, DEFAULT_STANDARD } from '../src/model/comms';

const std = { ...DEFAULT_STANDARD, holidays: [] };
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe('business time across daylight-saving changes (US Eastern)', () => {
  it('runs in Eastern time', () => {
    expect(new Date(2026, 10, 1, 12).getTimezoneOffset()).toBe(300); // EST after Nov 1
    expect(new Date(2026, 9, 30, 12).getTimezoneOffset()).toBe(240); // EDT before
  });
  it('steps past the 25-hour day when clocks fall back (Sun Nov 1 2026)', () => {
    // Friday Oct 30, 9:00 + 1 business day = Monday Nov 2, 9:00 (local clock)
    const d = addBusinessDays(std, local(2026, 10, 30, 9), 1);
    expect([d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]).toEqual([11, 2, 9, 0]);
    // A ticket from early October still gets a due date, many days later
    const e = addBusinessDays(std, local(2026, 10, 2, 11), 10);
    expect(e.getMonth() + 1).toBe(10);
    expect(e.getDate()).toBe(16);
  });
  it('steps past the 23-hour day when clocks spring forward (Sun Mar 8 2026)', () => {
    const d = addBusinessDays(std, local(2026, 3, 6, 9), 1);
    expect([d.getMonth() + 1, d.getDate(), d.getHours()]).toEqual([3, 9, 9]);
  });
  it('opening time stays 8:30 local on the Monday after the change', () => {
    const d = addBusinessMinutes(std, local(2026, 10, 31, 12), 30); // Saturday -> Monday 8:30 + 30 min
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2, 9, 0]);
  });
  it('counts business minutes across the change (Fri 5:00pm to Mon 9:30am = 30 + 60)', () => {
    expect(businessMinutesBetween(std, local(2026, 10, 30, 17), local(2026, 11, 2, 9, 30))).toBe(90);
  });
});

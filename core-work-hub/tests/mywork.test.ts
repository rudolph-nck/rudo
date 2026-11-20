// My work: focus reasons, urgency order, due groups, and role-based navigation.
(globalThis as unknown as { process: { env: Record<string, string> } }).process.env.TZ = 'America/New_York';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/model/config';
import { replay } from '../src/model/replay';
import { dueGroup, myWork } from '../src/model/mywork';
import { canOpen, homeFor, sectionOf, sectionsFor } from '../src/sections';
import type { HubConfig, TicketsSnapshot } from '../src/model/types';

const local = (m: number, d: number, h = 9) => new Date(2026, m - 1, d, h);
const cfgWith = (): HubConfig => {
  const c = defaultConfig();
  c.people.forEach((p) => { if (p.username === 'wes') p.sdName = 'Wes W'; });
  return c;
};
let n = 0;
const t = (o: Partial<TicketsSnapshot['items'][0]>) => ({ source: 'SD' as const, source_id: String(5000 + ++n), title: `T${n}`, source_status: 'Open', source_owner: 'Wes W', created: local(11, 19).toISOString(), ...o });
const snapOf = (items: ReturnType<typeof t>[]): TicketsSnapshot => ({ generatedAt: local(11, 20).toISOString(), generatedBy: 't', mode: 'csv', items });

describe('My work', () => {
  const now = local(11, 20, 10); // Friday
  const s = replay(cfgWith(), snapOf([
    t({ title: 'fresh P4', source_priority: 'Low', created: local(11, 20, 9).toISOString() }),
    t({ title: 'P1 fire', source_priority: 'Critical', created: local(11, 20, 8).toISOString() }),
    t({ title: 'old P2', source_priority: 'High', created: local(11, 10).toISOString() }),
    t({ title: 'someone else', source_owner: 'Nobody', source_priority: 'High' }),
    t({ title: 'closed', source_status: 'Closed', closed: local(11, 19).toISOString() }),
  ]), []);
  const w = myWork(s, 'wes', now);

  it('lists only my open work, most urgent first', () => {
    expect(w.open.map((x) => x.item.title)).toEqual(['P1 fire', 'old P2', 'fresh P4']);
    expect(w.doneRecently.map((i) => i.title)).toEqual(['closed']);
  });

  it('says why each item needs attention', () => {
    const by = Object.fromEntries(w.open.map((x) => [x.item.title, x.reasons.map((r) => r.key)]));
    expect(by['P1 fire']).toContain('p1');
    expect(by['old P2']).toContain('past');
    expect(w.focus.map((x) => x.item.title)).toContain('P1 fire');
    expect(w.focus.map((x) => x.item.title)).toContain('old P2');
  });

  it('groups by due date', () => {
    const p2 = w.open.find((x) => x.item.title === 'old P2')!;
    expect(dueGroup(p2, now)).toBe('Overdue');
    const p4 = w.open.find((x) => x.item.title === 'fresh P4')!;
    expect(['Next week', 'Later']).toContain(dueGroup(p4, now));
  });
});

describe('Navigation by role', () => {
  it('managers start on Overview with Stand-up and Panda HQ as tabs, plus admin tools', () => {
    expect(homeFor('manager')).toBe('overview');
    expect(sectionOf('manager', 'standup')?.id).toBe('overview');
    expect(sectionOf('manager', 'pandahq')?.id).toBe('overview');
    expect(sectionsFor('manager').filter((x) => x.admin).map((x) => x.id)).toEqual(['training', 'audit', 'settings']);
    expect(canOpen('manager', 'settings')).toBe(true);
  });
  it('the team starts on My work with a short menu and no admin pages', () => {
    expect(homeFor('analyst')).toBe('mine');
    expect(sectionsFor('analyst').map((x) => x.label)).toEqual(['My work', 'Board', 'Team', 'Training']);
    expect(sectionOf('analyst', 'standup')?.id).toBe('team');
    for (const v of ['settings', 'audit', 'overview'] as const) expect(canOpen('analyst', v)).toBe(false);
    for (const v of ['mine', 'board', 'triage', 'priorities', 'standup', 'pandahq', 'teamscore', 'rotation', 'timeoff', 'notifications', 'training'] as const) expect(canOpen('analyst', v)).toBe(true);
  });
});

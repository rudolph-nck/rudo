// Off-path work: tickets owned by someone who isn't listed on that system's ownership map (primary, secondary or
// third). Shows, per person, how much of their work is outside their platforms, and lists every such ticket.
import type { HubState, SystemOwnership, WorkItem } from './types';
import { analysts, ownerList } from './logic';
import { closedAtOf, isClosedItem } from './trends';

export type OffScope = 'open' | '90d' | 'year';
export interface OffItem { item: WorkItem; system: SystemOwnership; listed: string[]; role?: 'primary' | 'secondary' | 'third' }
export interface OffPerson { user: string; total: number; mapped: number; onPath: number; off: number; unmapped: number; offPct: number }

export const listedOwners = (s: SystemOwnership) => [s.primary, ...ownerList(s.secondary), ...ownerList(s.third)].filter(Boolean) as string[];

export function offPath(state: HubState, scope: OffScope, now = new Date()) {
  const cfg = state.config;
  const from = scope === '90d' ? new Date(now.getTime() - 90 * 864e5) : scope === 'year' ? new Date(now.getFullYear(), 0, 1) : undefined;
  const inScope = (i: WorkItem) => {
    if (i.stale || !i.owner) return false;
    if (scope === 'open') return !isClosedItem(i);
    const c = closedAtOf(i);
    return !!c && c >= from! && c <= now;
  };
  const people = new Map<string, OffPerson>();
  const items: OffItem[] = [];
  const bySystem = new Map<string, { system: SystemOwnership; total: number; off: number }>();
  for (const i of state.items.values()) {
    if (!inScope(i)) continue;
    const p = people.get(i.owner!) ?? { user: i.owner!, total: 0, mapped: 0, onPath: 0, off: 0, unmapped: 0, offPct: 0 };
    p.total++;
    const sys = cfg.systems.find((s) => s.id === i.system);
    const listed = sys ? listedOwners(sys) : [];
    if (!sys || !listed.length) p.unmapped++;
    else {
      p.mapped++;
      const sb = bySystem.get(sys.id) ?? { system: sys, total: 0, off: 0 };
      sb.total++;
      if (listed.includes(i.owner!)) p.onPath++;
      else { p.off++; sb.off++; items.push({ item: i, system: sys, listed }); }
      bySystem.set(sys.id, sb);
    }
    people.set(i.owner!, p);
  }
  // Everyone who carries work shows, even with nothing in scope.
  for (const a of analysts(cfg)) if (!people.has(a.username)) people.set(a.username, { user: a.username, total: 0, mapped: 0, onPath: 0, off: 0, unmapped: 0, offPct: 0 });
  const rows = [...people.values()].map((p) => ({ ...p, offPct: p.mapped ? Math.round((p.off / p.mapped) * 100) : 0 })).sort((a, b) => b.off - a.off || b.offPct - a.offPct);
  const mapped = rows.reduce((a, b) => a + b.mapped, 0);
  const off = rows.reduce((a, b) => a + b.off, 0);
  const unmapped = rows.reduce((a, b) => a + b.unmapped, 0);
  items.sort((a, b) => (a.item.priority ?? 'P9').localeCompare(b.item.priority ?? 'P9') || a.item.created.localeCompare(b.item.created));
  return {
    people: rows,
    items,
    systems: [...bySystem.values()].filter((s) => s.off).sort((a, b) => b.off - a.off),
    totals: { mapped, off, unmapped, offPct: mapped ? Math.round((off / mapped) * 100) : 0 },
  };
}

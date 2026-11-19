import { createContext, useContext } from 'react';

export type View = 'overview' | 'notifications' | 'standup' | 'board' | 'priorities' | 'teamscore' | 'mine' | 'triage' | 'team' | 'rotation' | 'timeoff' | 'metrics' | 'audit' | 'settings' | 'list' | 'training';
export interface Nav {
  view: View;
  param?: string;
  go: (v: View, param?: string) => void;
}
export const NavCtx = createContext<Nav>({ view: 'board', go: () => {} });
export const useNav = () => useContext(NavCtx);

export function parseHash(h: string): { view: View; param?: string } {
  const [v, p] = h.replace(/^#\/?/, '').split('/');
  const views: View[] = ['overview', 'notifications', 'standup', 'board', 'priorities', 'teamscore', 'mine', 'triage', 'team', 'rotation', 'timeoff', 'metrics', 'audit', 'settings', 'list', 'training'];
  // Metrics grew into the Overview dashboard; keep old links working.
  const view = v === 'metrics' ? 'overview' : ((views.includes(v as View) ? v : 'board') as View);
  return { view, param: p ? decodeURIComponent(p) : undefined };
}

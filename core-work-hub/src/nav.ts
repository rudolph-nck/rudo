import { createContext, useContext } from 'react';

export type View = 'board' | 'mine' | 'triage' | 'team' | 'metrics' | 'audit' | 'settings' | 'list';
export interface Nav {
  view: View;
  param?: string;
  go: (v: View, param?: string) => void;
}
export const NavCtx = createContext<Nav>({ view: 'board', go: () => {} });
export const useNav = () => useContext(NavCtx);

export function parseHash(h: string): { view: View; param?: string } {
  const [v, p] = h.replace(/^#\/?/, '').split('/');
  const views: View[] = ['board', 'mine', 'triage', 'team', 'metrics', 'audit', 'settings', 'list'];
  return { view: (views.includes(v as View) ? v : 'board') as View, param: p ? decodeURIComponent(p) : undefined };
}

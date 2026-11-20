// Role-aware navigation: managers get the Overview hub and admin tools; the team gets a lighter menu that starts on My work.
// Each section is one sidebar entry; sections with several pages show them as tabs in the top bar (old #/links still work).
import type { Role } from './model/types';
import type { View } from './nav';

export interface SectionTab {
  view: View;
  label: string;
}
export interface Section {
  id: string;
  icon: string;
  label: string;
  tabs: SectionTab[];
  /** Shown in the lower "Admin" group of the sidebar. */
  admin?: boolean;
}

export const isAdmin = (role?: Role) => role === 'manager' || role === 'viewer';

const BOARD: Section = {
  id: 'board',
  icon: 'board',
  label: 'Board',
  tabs: [
    { view: 'board', label: 'Board' },
    { view: 'triage', label: 'Intake' },
    { view: 'priorities', label: 'Priorities' },
  ],
};
const MINE: Section = { id: 'mine', icon: 'me', label: 'My work', tabs: [{ view: 'mine', label: 'My work' }] };

export function sectionsFor(role?: Role): Section[] {
  if (isAdmin(role))
    return [
      {
        id: 'overview',
        icon: 'chart',
        label: 'Overview',
        tabs: [
          { view: 'overview', label: 'Dashboard' },
          { view: 'standup', label: 'Stand-up' },
          { view: 'pandahq', label: 'Panda HQ' },
        ],
      },
      MINE,
      BOARD,
      {
        id: 'team',
        icon: 'team',
        label: 'Team',
        tabs: [
          { view: 'team', label: 'People' },
          { view: 'teamscore', label: 'Team score' },
          { view: 'rotation', label: 'Rotation' },
          { view: 'timeoff', label: 'Time off' },
        ],
      },
      { id: 'audit', icon: 'log', label: 'Audit log', tabs: [{ view: 'audit', label: 'Audit log' }], admin: true },
      { id: 'settings', icon: 'gear', label: 'Settings', tabs: [{ view: 'settings', label: 'Settings' }], admin: true },
    ];
  return [
    MINE,
    BOARD,
    {
      id: 'team',
      icon: 'team',
      label: 'Team',
      tabs: [
        { view: 'standup', label: 'Stand-up' },
        { view: 'pandahq', label: 'Panda HQ' },
        { view: 'team', label: 'People' },
        { view: 'teamscore', label: 'Team score' },
        { view: 'rotation', label: 'Rotation' },
        { view: 'timeoff', label: 'Time off' },
      ],
    },
  ];
}

/** Pages reached from the top bar, the profile menu (Help and training) or links, not from the side menu. */
const ALWAYS: View[] = ['notifications', 'list', 'training'];

export const homeFor = (role?: Role): View => (isAdmin(role) ? 'overview' : 'mine');

export function canOpen(role: Role | undefined, view: View): boolean {
  return ALWAYS.includes(view) || sectionsFor(role).some((s) => s.tabs.some((t) => t.view === view));
}

export function sectionOf(role: Role | undefined, view: View): Section | undefined {
  if (view === 'list') return sectionsFor(role).find((s) => s.id === 'board');
  return sectionsFor(role).find((s) => s.tabs.some((t) => t.view === view));
}

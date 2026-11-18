import type { HubConfig } from './types';

/**
 * Starting config. The real one lives in hub-config.json in the shared folder and is edited by Nick.
 * Usernames are placeholders: replace them with Windows usernames before go-live.
 * Systems are SAMPLE rows: replace them with the real ownership map.
 */
export function defaultConfig(): HubConfig {
  return {
    teamName: 'IT Core',
    people: [
      { username: 'nick', name: 'Nick', role: 'manager', wipLimit: 2 },
      { username: 'wes', name: 'Wes', role: 'analyst', wipLimit: 2 },
      { username: 'cathy', name: 'Cathy', role: 'analyst', wipLimit: 2 },
      { username: 'noelle', name: 'Noelle', role: 'analyst', wipLimit: 2 },
      { username: 'trey', name: 'Trey', role: 'analyst', wipLimit: 2 },
      { username: 'michael', name: 'Michael', role: 'analyst', wipLimit: 2 },
      { username: 'tabitha', name: 'Tabitha', role: 'analyst', wipLimit: 2 },
      { username: 'matt', name: 'Matt', role: 'viewer' },
    ],
    systems: [
      { id: 'm365', name: 'Microsoft 365 / Exchange', primary: 'wes', secondary: 'cathy', third: 'trey', criticality: 'High' },
      { id: 'ad', name: 'Active Directory / Entra ID', primary: 'cathy', secondary: 'wes', third: 'michael', criticality: 'High' },
      { id: 'network', name: 'Network & firewall', primary: 'trey', secondary: 'michael', third: 'wes', criticality: 'High' },
      { id: 'vmware', name: 'VMware / servers', primary: 'michael', secondary: 'trey', third: 'noelle', criticality: 'High' },
      { id: 'backup', name: 'Backup & DR', primary: 'noelle', secondary: 'michael', third: 'trey', criticality: 'High' },
      { id: 'endpoint', name: 'Endpoints / Intune', primary: 'tabitha', secondary: 'noelle', third: 'cathy', criticality: 'Medium' },
      { id: 'voice', name: 'Teams Voice / phones', primary: 'noelle', secondary: 'tabitha', third: 'wes', criticality: 'Medium' },
      { id: 'print', name: 'Printing & scanning', primary: 'tabitha', secondary: 'cathy', criticality: 'Low' },
    ],
    dispatch: [],
    bucketWip: {},
    defaultWipLimit: 2,
    capacityModel: { projects: 14, maintenance: 8, owner_tickets: 10, dispatch: 4, documentation: 4 },
    closedStatuses: ['Closed', 'Cancelled', 'Canceled', 'Completed'],
    resolvedStatuses: ['Resolved'],
    ticketUrls: {
      SD: 'https://servicedesk.example.com/WorkOrder.do?woMode=viewWO&woID={id}',
      Wrike: 'https://www.wrike.com/open.htm?id={id}',
    },
    statusColumns: { 'On Hold': 'Waiting', Onhold: 'Waiting', 'Waiting*': 'Waiting', 'Pending*': 'Waiting' },
    sourceDrivenColumns: ['Waiting', 'Done'],
    analystsCanGrade: false,
    defaultUpdateDays: 2,
  };
}

/** Fills anything missing from a hand-edited hub-config.json with defaults, so a partial file still works. */
export function normalizeConfig(raw: Partial<HubConfig>): HubConfig {
  const d = defaultConfig();
  return {
    ...d,
    ...raw,
    people: raw.people?.length ? raw.people : d.people,
    systems: raw.systems ?? d.systems,
    dispatch: raw.dispatch ?? [],
    bucketWip: raw.bucketWip ?? {},
    capacityModel: { ...d.capacityModel, ...(raw.capacityModel ?? {}) },
    closedStatuses: raw.closedStatuses ?? d.closedStatuses,
    resolvedStatuses: raw.resolvedStatuses ?? d.resolvedStatuses,
    ticketUrls: { ...d.ticketUrls, ...(raw.ticketUrls ?? {}) },
    statusColumns: raw.statusColumns ?? d.statusColumns,
    sourceDrivenColumns: raw.sourceDrivenColumns ?? d.sourceDrivenColumns,
  };
}

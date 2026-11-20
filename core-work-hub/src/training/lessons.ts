// Training: one lesson per part of the hub. Each lesson has what it's for, how-to steps, and a guided tour that
// points at the real screen. The same tours are recorded as the lesson videos (scripts/record-training.cjs).
import type { View } from '../nav';

export type Audience = 'everyone' | 'support' | 'manager';

export interface TourStep {
  view?: View;
  /** CSS selector, or "text:<exact visible text>" of a button, tab, heading or link. Missing = centred note. */
  target?: string;
  title: string;
  body: string;
}

export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  audience: Audience;
  /** One sentence: why this part of the hub exists. */
  why: string;
  howTo: { task: string; steps: string[] }[];
  tour: TourStep[];
}

export const AUDIENCE_LABEL: Record<Audience, string> = { everyone: 'Everyone', support: 'On support', manager: 'Nick' };

export const LESSONS: Lesson[] = [
  {
    id: 'basics',
    title: 'Getting around',
    minutes: 2,
    audience: 'everyone',
    why: 'The hub is where IT Core decides what to work on, in what order and by whom. Service Desk is still where tickets live.',
    howTo: [
      { task: 'Open the hub', steps: ['Double-click the Core Work Hub icon on your desktop.', 'It opens in Edge, already signed in as you.'] },
      { task: 'Change your avatar', steps: ['Click your name at the bottom of the sidebar.', 'Pick a colour, an emoji, or a photo (your Windows picture or an upload), then Save.'] },
      { task: 'Switch light / dark mode', steps: ['Use the three buttons next to your name: System, Light, Dark.'] },
    ],
    tour: [
      { target: '.sidebar .nav', title: 'The menu', body: 'Every part of the hub is here. Red and blue counts tell you where something is waiting for you.' },
      { target: 'text:Notifications', title: 'Notifications', body: 'Tickets where a requester is owed a response or update. Red means it is already late.' },
      { target: '.dispatch-card', title: 'Who is on support', body: 'The person on support this shift, their last day, and the escalation point. Click it for the rotation.' },
      { target: '.foot-row', title: 'Always up to date', body: 'The hub syncs every 20 seconds. Press refresh to sync now.' },
      { target: '.me-btn', title: 'You', body: 'Click your name to set your avatar. Next to it: light or dark mode.' },
    ],
  },
  {
    id: 'board',
    title: 'The Board',
    minutes: 3,
    audience: 'everyone',
    why: 'One view of all graded work, force-ranked so everyone knows what comes next. Finish before you start.',
    howTo: [
      { task: 'Pick up the next item', steps: ['Look at Ready to pick up for your bucket.', 'When you have a free Doing slot, press Pick up on the top card.'] },
      { task: 'Move a card', steps: ['Drag it to another column, or use the ⋯ menu → Move to.', 'Taking work off your plate (to On Hold, Ready or To Do) asks for a reason.'] },
      { task: 'Open the ticket in Service Desk', steps: ['Click the SD # link on the card. If the hub can’t link straight to it, it copies the number and opens Service Desk: paste it into search.'] },
      { task: 'Filter', steps: ['Use All / Projects / Maintenance / Support, or the analyst, priority, system and source filters.'] },
    ],
    tour: [
      { view: 'board', target: '.page-head h1', title: 'The Board', body: 'Graded work from To Do to Done. Ungraded tickets wait in Intake instead.' },
      { view: 'board', target: '.intake-pill', title: 'Intake count', body: 'How many tickets are waiting to be graded. Click to open Intake.' },
      { view: 'board', target: '[aria-label="Bucket"]', title: 'Buckets', body: 'Show all work, or just Projects, Maintenance or Support.' },
      { view: 'board', target: '.board.flat .card', title: 'A card', body: 'Bucket badge, priority, the Service Desk link, owner and age. “Day 4 of 3” means it is past its target.' },
      { view: 'board', target: '.board.flat .card .menu-btn', title: 'Card menu', body: 'Move the card without dragging, or open its details.' },
      { view: 'board', target: 'text:Pick up', title: 'Pick up', body: 'Takes the top-ranked card into Doing. Your WIP limit stops you starting too many things at once.' },
      { view: 'board', target: '.col-head .wip', title: 'WIP limit', body: 'How many items are in Doing against the team’s limit. During your support week, projects pause.' },
    ],
  },
  {
    id: 'mywork',
    title: 'My work',
    minutes: 2,
    audience: 'everyone',
    why: 'Everything you own in one place: acknowledge new assignments and log your time.',
    howTo: [
      { task: 'Acknowledge an assignment', steps: ['Open My work.', 'Press Acknowledge on anything new, so Nick and support know you have it.'] },
      { task: 'Log time', steps: ['In Log time for today, pick the bucket (projects, maintenance, tickets, support, documentation) and the hours.', 'The Team page compares your week with your level’s time split.'] },
    ],
    tour: [
      { view: 'mine', target: '.page-head h1', title: 'My work', body: 'Everything you own, grouped by column.' },
      { view: 'mine', target: 'text:Acknowledge', title: 'Acknowledge', body: 'New assignments show here until you acknowledge them.' },
      { view: 'mine', target: '#lt', title: 'Log time', body: 'Log hours against the capacity buckets. It feeds the Team page.' },
    ],
  },
  {
    id: 'comms',
    title: 'Notifications and the communication standard',
    minutes: 3,
    audience: 'everyone',
    why: 'Requesters hear from us on time: P1 within an hour and hourly, P2 the same day and daily, P3 and P4 within a business day.',
    howTo: [
      { task: 'Clear a notification', steps: ['Comment on the ticket in Service Desk; the hub sees it on the next sync.', 'Or press Log update to record it now and copy a ready-made message.'] },
      { task: 'Know what happens if it is missed', steps: ['It goes to you first, then to whoever is on support after a business day, then to Nick.'] },
    ],
    tour: [
      { view: 'notifications', target: '.page-head h1', title: 'Notifications', body: 'Tickets owed a first response, an update, or a requester follow-up.' },
      { view: 'notifications', target: '.notice', title: 'A notice', body: 'What is due, when, and who should act. Red means late or escalated.' },
      { view: 'notifications', target: 'text:Log update', title: 'Log update', body: 'Record the update and copy wording you can paste into Service Desk.' },
    ],
  },
  {
    id: 'intake',
    title: 'Intake: grading new work',
    minutes: 4,
    audience: 'support',
    why: 'Every new ticket and project gets a bucket, impact, urgency and effort, which become its priority, score and place in line.',
    howTo: [
      { task: 'Grade a ticket', steps: ['Open Intake and select a ticket.', 'Pick the bucket, then impact, urgency and effort (hover any number to see what it means).', 'Check the suggested priority and owner, then Send to To Do.'] },
      { task: 'Go faster', steps: ['J / K move between tickets, 1–4 set priority, Enter sends, O opens it in Service Desk.'] },
    ],
    tour: [
      { view: 'triage', target: '.page-head h1', title: 'Intake', body: 'Everything waiting to be graded. Whoever is on support grades during their shift.' },
      { view: 'triage', target: '.q-item.sel', title: 'The selected ticket', body: 'Pick a bucket and rate impact, urgency and effort. Hover a number to see what it means.' },
      { view: 'triage', target: 'text:Send to To Do', title: 'Send it on', body: 'It joins the ranked To Do list for its bucket.' },
    ],
  },
  {
    id: 'standup',
    title: 'Daily stand-up',
    minutes: 4,
    audience: 'support',
    why: 'One agenda so nothing big or small slips: P1s, what is due today, what is past target, and what is coming up.',
    howTo: [
      { task: 'Run stand-up', steps: ['Open Stand-up and go down the list from the top.', 'Mark each item On track, At risk or Blocked; add a Note if useful.', 'Watch the counter: everything must-discuss should be discussed.'] },
      { task: 'Agree a new date', steps: ['Press Date and pick the day. It comes off “past target” until then.'] },
      { task: 'Change a priority', steps: ['Press Priority. Lowering it needs a reason; tick “Requester told” and copy the message for them.'] },
      { task: 'Post to Teams', steps: ['Press Copy for Teams and paste into the channel.'] },
    ],
    tour: [
      { view: 'standup', target: '.su-progress', title: 'Today’s progress', body: 'How many must-discuss items have been covered, and the totals by section.' },
      { view: 'standup', target: 'text:Open P1s', title: 'P1s first', body: 'Every open P1, every day.' },
      { view: 'standup', target: 'text:Due today', title: 'Due today', body: 'Last day of its target, for example a P2 on day 3 of 3. Address it today or re-prioritize.' },
      { view: 'standup', target: '.su-seg', title: 'Check in', body: 'On track, At risk or Blocked. It is recorded with your name and the time.' },
      { view: 'standup', target: 'text:Coming up', title: 'Coming up', body: 'Reaches its target in the next two business days: a quick touch base.' },
      { view: 'standup', target: 'text:Copy for Teams', title: 'Share it', body: 'Copies the agenda with today’s check-ins for the Teams channel.' },
    ],
  },
  {
    id: 'priorities',
    title: 'Priorities and conflicts',
    minutes: 3,
    audience: 'everyone',
    why: 'All open work by priority, with conflicts spotted for you, such as a P3 in Doing while a P1 waits.',
    howTo: [
      { task: 'Fix a conflict', steps: ['Read the conflict list at the top.', 'Use its button: swap the work, re-rank by priority, or assign an owner.'] },
      { task: 'Force a priority (Nick)', steps: ['When leadership says drop everything: open the item → Force priority, note who asked and what is put on hold.'] },
    ],
    tour: [
      { view: 'priorities', target: '.pri-summary', title: 'By priority', body: 'Open items per priority. Click one to jump to it.' },
      { view: 'priorities', target: '.page-head h1', title: 'Conflicts', body: 'The hub flags lower-priority work in progress while higher priorities wait, missing owners, and rank inversions.' },
    ],
  },
  {
    id: 'teamscore',
    title: 'Team score',
    minutes: 2,
    audience: 'everyone',
    why: 'The team rates projects together so every project gets a unique score and a clear order.',
    howTo: [
      { task: 'Rate a project', steps: ['Open Team score and pick a project.', 'Rate each criterion 1–5 (hover for what each number means). Ties are settled in the meeting.'] },
    ],
    tour: [{ view: 'teamscore', target: '.page-head h1', title: 'Team score', body: 'Rate projects 1–5 per criterion. Scores set the project order.' }],
  },
  {
    id: 'pandahq',
    title: 'Panda HQ: goals and leaderboard',
    minutes: 2,
    audience: 'everyone',
    why: 'Every ticket the team closes goes in the dumpster. Hit the weekly, monthly or yearly goal and it goes up in flames, with a prize.',
    howTo: [
      { task: 'Earn points', steps: ['Close tickets: P1 8, P2 5, P3 3, P4 2 points.', '+2 when it closes within its target, +3 for a backlog ticket. Hard, on-time and old work beats volume.'] },
      { task: 'Win something', steps: ['Team goals: everyone wins when the dumpster catches fire.', 'Monthly awards: Top Points, Backlog Buster, On-time Ace, Most Improved and Rookie of the Month.'] },
    ],
    tour: [
      { view: 'pandahq', target: '.dumpster-scene', title: 'The dumpster', body: 'Fills with every ticket Core closes. At the goal it catches fire.' },
      { view: 'pandahq', target: '.panda-goals', title: 'Team goals', body: 'Week, month, year and all time, with the prize for each.' },
      { view: 'pandahq', target: '#lb-h', title: 'Leaderboard', body: 'Points and badges. Hover a badge to see how it was earned.' },
      { view: 'pandahq', target: '#aw-h', title: 'Monthly awards', body: 'Five categories, so different people can win, juniors included.' },
    ],
  },
  {
    id: 'rotation',
    title: 'Rotation and time off',
    minutes: 2,
    audience: 'everyone',
    why: 'Who is on support and when, who is out, and who covers their work.',
    howTo: [
      { task: 'Check the schedule', steps: ['Rotation shows who is on support now and next. Shifts are two weeks.'] },
      { task: 'Plan time off', steps: ['Nick adds time off on the Time off page and picks who covers your work while you are out.'] },
    ],
    tour: [
      { view: 'rotation', target: '.page-head h1', title: 'Rotation', body: 'Who is on support now, next, and the running order.' },
      { view: 'timeoff', target: '.page-head h1', title: 'Time off', body: 'Who is out and who is covering. Owner suggestions skip anyone who is off.' },
    ],
  },
  {
    id: 'team',
    title: 'Team load and Overview',
    minutes: 3,
    audience: 'manager',
    why: 'Each person’s load against their WIP limit and their level’s time split, and how work is moving overall.',
    howTo: [
      { task: 'Check someone’s load', steps: ['Open Team: Doing against their limit, queue, overdue updates, and hours against their split (support-week split during their shift).'] },
      { task: 'See the big picture', steps: ['Overview: open vs closed, what is held up, cycle time, and team load. Export CSVs for Power BI.'] },
    ],
    tour: [
      { view: 'team', target: '.team-row', title: 'One row per person', body: 'Doing vs limit, queue, overdue updates, and hours vs their level’s time split.' },
      { view: 'overview', target: '.hero', title: 'Overview', body: 'How work is moving, where it is held up, and each person’s load.' },
    ],
  },
  {
    id: 'settings',
    title: 'Settings (Nick)',
    minutes: 4,
    audience: 'manager',
    why: 'The priority standard, WIP limits and levels, the time split, the ownership map, and ticket data.',
    howTo: [
      { task: 'Change a target', steps: ['Settings → Priority standard: response, updates and target to resolve per priority, the start date and the backlog goal.'] },
      { task: 'Set limits and levels', steps: ['Settings → WIP limits: level and Doing limits per person, plus team bucket limits.', 'Weekly time split by level: hours per bucket for senior, mid, junior and support week.'] },
      { task: 'Update the ownership map', steps: ['Settings → Ownership map: primary, secondary and third owners and criticality per system.'] },
    ],
    tour: [
      { view: 'settings', target: '#ps-h', title: 'Priority standard', body: 'Targets per priority, the start date, and the backlog goal.' },
      { view: 'settings', target: '#wip-h', title: 'WIP limits and levels', body: 'Each person’s level and limits.' },
      { view: 'settings', target: '#cap-h', title: 'Time split by level', body: 'What the Team page measures each person against.' },
      { view: 'settings', target: '#sys-h', title: 'Ownership map', body: 'Who owns each system, used to suggest owners when grading.' },
    ],
  },
];

export const lessonsFor = (role?: string, onSupport = false) =>
  LESSONS.filter((l) => l.audience === 'everyone' || (l.audience === 'support' && (onSupport || role === 'manager' || role === 'analyst')) || (l.audience === 'manager' && role === 'manager'));

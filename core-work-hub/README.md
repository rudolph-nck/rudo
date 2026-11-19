# Core Work Hub

One Kanban board for every IT Core work item from Service Desk Plus and Wrike. Rank work, limit work in progress, and see each analyst's load at a glance. It runs from the team's shared folder in Edge: no server, no install, nothing to host.

**Status:** Phase 0 is built (board, intake and grading, triage, analyst view, WIP limits, audit log, CSV import), plus Phase 1's sync script and an early Metrics view with CSV exports. The sync scripts are written but **have not been run against Service Desk or Wrike** (see [What hasn't been tested](#what-hasnt-been-tested)).

## What's in the folder

```
core-work-hub/
  release/index.html     the built app: copy this to the shared folder
  deploy/hub-config.json starter config (people, roles, WIP limits, SAMPLE ownership map)
  sync/                  PowerShell 7 scripts for Nick's PC (Service Desk sync, task registration, Wrike check)
  src/                   React + TypeScript source (Vite single-file build, dnd-kit)
  tests/                 unit tests (vitest) and a multi-user browser test (Playwright)
```

## How it works

```
\\server\share\CoreWorkHub\
  index.html            the app (one self-contained file; fonts and code inlined)
  hub-config.json       people, roles, WIP limits, ownership map, dispatch rotation (Nick edits)
  tickets.json          Service Desk snapshot. Only the sync script or Nick's CSV import writes it
  changes\nick.jsonl    one append-only file per person; each line is one move, grade, rank or comment
  changes\wes.jsonl
  ...
```

- **Reading tickets:** `sync/Sync-ServiceDesk.ps1` runs on Nick's PC every 15 minutes in business hours and writes `tickets.json`. The token stays in Windows Credential Manager on that PC. Until then, Nick imports a Service Desk CSV export in **Settings → Ticket data**.
- **Saving changes:** each browser writes only to its own person's change file, so two people working at once never write the same file.
- **Seeing others' changes:** every 20 seconds (and when the tab regains focus) the page re-reads `tickets.json` and every change file, then replays all changes in time order. When two people re-rank the same list, the later change wins. The change files are the audit log.
- **Sync rules:** new source tickets land in Intake. A ticket closed in Service Desk moves to Done. The sync never touches hub fields (bucket, rank, grade, WIP state). If Service Desk changes the technician or priority *after* the hub set it, the Service Desk value is kept and the conflict is listed under **Audit log → Sync conflicts**.
- **Permissions:** checked when changes are replayed, using the *file name* (not anything written inside the file). Matt's (viewer) changes and changes from unknown names are ignored and flagged in the audit log. The real lock is NTFS: Matt gets read-only on the folder.
- **Identity:** on first open each person picks their name. Their changes go to `changes/<username>.jsonl`. This is honor-system within the team, backed by NTFS: the file owner on disk shows who actually wrote each file.

### Workflow

**Intake → To Do → Ready to pick up → Doing → On Hold → Waiting → Done**

- **To Do** is the bucket's force-ranked backlog. **Ready to pick up** is the short, ranked list that's groomed and next. Anyone with a free WIP slot presses **Pick up** on a Ready card: it becomes theirs and moves to Doing (WIP limit checked).
- **Taking work off someone's plate.** Moving a card out of Doing to On Hold, Ready or To Do opens a **Take it off the plate** dialog. A reason is required, and it shows on the card and in the audit log. **On Hold** keeps the owner and frees their WIP slot. **Ready** or **To Do** can also release the owner (the default for Ready) so anyone can pick it up. Nick can put it at the top of the list.
- Only Doing counts against WIP limits. Analysts can do this to their own cards; Nick can do it to anyone's.

### Screens

| View | What it does |
|---|---|
| **Board** (home, Concept A) | Needs-you tiles (waiting for acknowledgment, no owner, ready to close), bucket switcher, swimlanes, filters by analyst/priority/system/source. Drag between columns; drag within a bucket's To Do or Ready to re-rank. Each card's ⋯ menu offers "Move to…" for keyboard and touch users. |
| **Intake → Triage and rank** (Concept C) | Intake queue on the left, ranked To Do on the right. One-click bucket and 1–5 impact/urgency/effort; live score `(impact × urgency) ÷ effort` and suggested priority; owner suggested from the ownership map, alternating primary and secondary. **Send to To Do** shows the rank it will get. Capacity strip shows Doing slots vs WIP limit. Shortcuts: **J/K** move, **1–4** priority, **Enter** send. |
| **My work** | Everything you own, by column; acknowledge assignments; log time against the capacity buckets. |
| **Team** | One row per analyst: Doing vs WIP limit, To Do queue, overdue updates, unacknowledged items, dispatcher/backup badge, and hours vs the capacity model. |
| **Overview** (home for Nick and Matt) | Open work with a breakdown, Doing vs WIP slots, closed this week, held up, overdue updates, median cycle time, past SLA due date, and who's on support. Charts: opened vs closed per week, where the work is (column × bucket), age of open work, what held-up work is waiting on, open work by system. **Team load** lists each person sorted by what needs attention (over WIP, overdue, stalled, waiting, unacknowledged); click a name to filter the whole page. Each chart has hover tooltips and a table view. Filters: bucket, person, 8/12/26 weeks. CSV exports for Power BI. |
| **Rotation** | Who's on level 1 support now, the escalation point, the running order (with anyone out of rotation), and the next 12 shifts. Nick edits the order, shift length, who's on now and their last day, the escalation point, and who's out (with an optional return date). **Covers and swaps** override the rotation for specific dates. |
| **Audit log** | Every change with who, when, and before → after; sync conflicts; ignored changes; CSV export. |
| **Settings** | CSV import, WIP limits (per analyst, per analyst per bucket, per team bucket), dispatch rotation, ownership map. Nick edits; everyone else reads. |

Score → suggested priority: ≥15 P1, ≥8 P2, ≥3 P3, otherwise P4. When a card enters Doing or Waiting without a next-update date, it gets one `defaultUpdateDays` (2) days out.

## Setup

### Day one: three checks before anything else

1. **Edge folder access.** Copy `release/index.html` and `deploy/hub-config.json` into the shared folder. Open `index.html` in Edge on a team PC → **Choose the shared folder** → pick that folder → allow edits. Move a card, then check that `changes\<you>.jsonl` appeared. If company policy blocks this, the fallback is a Power Apps code app or SharePoint, to be decided with Lee.
2. **Service Desk token.** On Nick's PC:
   ```powershell
   cmdkey /generic:CoreWorkHub-SDP /user:token /pass:<read-only technician key>
   pwsh -File sync\Sync-ServiceDesk.ps1 -HubFolder '\\server\share\CoreWorkHub' -BaseUrl 'https://<sdp host>' -Groups '<Core queue 1>','<Core queue 2>' -Test
   ```
   `-Test` reads one page of open requests and writes nothing. Use `-Edition Cloud` if the instance is Zoho-hosted (OAuth token).
3. **Wrike license.**
   ```powershell
   cmdkey /generic:CoreWorkHub-Wrike /user:token /pass:<permanent token>
   pwsh -File sync\Test-WrikeAccess.ps1
   ```
   If any check fails, v1 ships with Service Desk only and Wrike items are entered by hand (**New work → Wrike task**).

### Configure

Edit `hub-config.json` in the shared folder:
- `people[].username`: replace the placeholders with real **Windows usernames**. Nick is the manager and also carries work (`"works": true`), so he appears in the Team view, the capacity strip and WIP limits; Matt is a read-only viewer. Add `sdName` if the Service Desk technician name differs from `name`.
- `systems`: the sample ownership map is placeholder data. Replace it with the real map (or edit it in Settings).
- `wipLimit` per analyst (starts at 2), `capacityModel` (weekly hours per bucket, from the communication standards), `closedStatuses` and `resolvedStatuses` to match your Service Desk statuses.

### Folder permissions (NTFS)
- IT Core group: **Modify** on the folder.
- Matt: **Read & execute** only.
- No one else.

### Phase 1: turn on the sync
```powershell
pwsh -File sync\Register-SyncTask.ps1 -HubFolder '\\server\share\CoreWorkHub' -BaseUrl 'https://<sdp host>' -Groups '<Core queue 1>','<Core queue 2>'
```
This runs every 15 minutes, 7:00–18:00, Monday–Friday, as Nick. It logs to `%LOCALAPPDATA%\CoreWorkHub\sync.log`.

### Try it without the shared folder
Open `index.html?demo` (or click **Try it with demo data**). Sample data lives only in that browser. Open two tabs as different people to watch live updates.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests: replay, ranking, sync rules, permissions, WIP, CSV
npm run contrast   # WCAG AA check of every color token pair, light and dark
npm run build      # typecheck + single-file build -> release/index.html
npm run e2e        # multi-user browser test (serve dist/ on :4173 first, see the file header)
```

`index.html` is ~590 KB with fonts inlined and makes no network requests.

## Working with Service Desk

### Use the board, jump to the ticket
Every ticket card's **SD #number ↗** badge opens the ticket in Service Desk in a new tab. The card details have an **Open #… in Service Desk** button, and Triage has one too (shortcut **O**). Links are built from `ticketUrls` in `hub-config.json` (for example `"SD": "https://<sdp host>/WorkOrder.do?woMode=viewWO&woID={num}"`, where `{id}` is the full ticket ID like `INC-79744` and `{num}` is just `79744`; open a ticket in Service Desk and copy its address to confirm), so every card gets a link even if an import didn't carry one. Wrike items use the `Wrike` pattern.

### Who controls which column
| Column | Controlled by | Why |
|---|---|---|
| Intake, To Do, Ready to pick up, Doing, On Hold | **Hub** | Prioritizing and WIP: Service Desk has no concept of rank or "ready". |
| Waiting | **Service Desk status** (for tickets) | Statuses listed in `statusColumns` (default: On Hold, Onhold, Waiting*, Pending*) put the card in Waiting. When the status goes back to Open, the card returns to wherever the hub last had it. |
| Done | **Service Desk status** (for tickets) | Closing a ticket in Service Desk moves the card on the next sync. "Resolved" shows in the Ready to close tile. |

Dragging a ticket into or out of a Service Desk-controlled column shows **Service Desk controls this one** with a button to open the ticket. The rule is also enforced when changes are replayed, so a hand-edited change file can't get around it. Hub-only and Wrike items move freely. Change which columns are locked with `sourceDrivenColumns`. Note that Service Desk's "On Hold" status (waiting on someone) maps to **Waiting**; the hub's **On Hold** column means "we deprioritized it".

### Service Desk assigns the work
- If a ticket has a technician in Service Desk, that person owns the card. The owner shows as "assigned in Service Desk" with a **Reassign in Service Desk** link, and grading can't change it.
- The hub assigns only tickets that are unassigned in SD, using the rotation suggestion or **Pick up**. The card then reminds you to set the same technician in Service Desk.
- When SD reassigns a ticket the hub had given to someone else, SD wins and the change is listed under Sync conflicts.
- Technicians who aren't on the hub (another team) show as an outlined avatar with their initials. Their tickets don't count in "No owner".
- **Matching names:** Service Desk uses full names ("Wesley Wilson"). The hub matches first names automatically, and the import screen has a **Service Desk technicians** table to confirm or correct each match (saved as `sdName`). Viewers are never matched automatically.

### Importing the "Core - All" report
Export the report as CSV and import it in **Settings → Ticket data**. The importer:
- finds the header below the report's title lines;
- treats "Not Assigned" and "-" as empty;
- keeps open tickets plus tickets closed in the last 90 days;
- uses the SLA as the starting priority when there's no Priority column (Critical → P1, High/VIP → P2, Medium → P3, Low → P4);
- uses Department as the requester;
- sets each ticket's system from its Sub Category through the ownership map's **SD sub-categories** (aliases).

Status defaults match the report:
- `Closed*` (all the "Closed - …" variants), Canceled and Rejected → Done.
- Waiting for Requester / 3rd Party / Management / Infrastructure / Service Desk → Waiting.
- **Waiting for CORE** stays where the hub has it, because the ball is in our court.

A ticket that's waiting in SD but hasn't been graded yet stays in Intake until it's graded.

### The grade lives in the hub
Bucket, impact, urgency, effort, score, rank and owner are stored in the hub's change files against the ticket number (`SD:48211`), so they survive every sync and every re-import. Service Desk keeps its own priority, which seeds the hub's until the item is graded. For reporting, the **Items CSV** on the Metrics page has `source_id` next to the score, bucket and rank, so Power BI can join it to Service Desk data. If the team wants the score visible inside Service Desk, add custom fields there (for example Hub Bucket, Hub Score, Hub Rank) and fill them with the Phase 2 write-back below.

### Changing Service Desk from the hub

The hub can't change Service Desk live from the page. A browser page opened from a shared folder can't safely hold the API token (anyone with folder access could read it), and Service Desk won't accept calls from a page on a file share anyway. So the split is:

| In Service Desk (system of record) | In the hub (what we work on, in what order, by whom) |
|---|---|
| Ticket intake ("no ticket, no work") | Bucket, grade, rank, To Do / Ready / Doing / On Hold |
| Replies and notes to the requester | WIP limits, pick-ups, reprioritizing with reasons |
| Resolving and closing (the hub follows within 15 min) | Next-update dates, standup triage, metrics |

**Recommended path for write-back, in order:**
1. **Now (Phase 1):** read-only sync every 15 minutes. Owners do ticket work in Service Desk; **Reply to requester** opens the ticket there.
2. **Phase 2, no server needed:** extend `Sync-ServiceDesk.ps1` on Nick's PC to also read the change files and push a few fields back: technician (owner), priority, and a short note on moves (for example "Moved to On Hold: <reason>"), optionally setting Service Desk's own On Hold status so SLA timers pause. It can run every 5 minutes, so changes land in Service Desk within about 5 minutes, not live. This needs a token with write access instead of the read-only one, which is the decision to take to Lee and Matt.
3. **Live (seconds):** only with an approved always-on service (a small server, an Azure Function or a Power Platform flow) holding the token. That is the "if a server is approved" v2 in the scope.

 (v1, phases 0–1)

| Criterion | Status |
|---|---|
| Open Core SD tickets appear within 15 min | Sync script written and scheduled every 15 min. **Not run against Service Desk yet.** |
| Drag between columns and re-rank; everyone sees it within 30 s | Done. Polls every 20 s. Browser test: a second user saw a move in 20.0 s. |
| To Do ranks unique per bucket | Done. Ranks are derived positions (1..n) from sort keys, so ties can't happen. Unit-tested. |
| Past a WIP limit: warning plus logged override | Done. Nick must give a reason, which is stored in the change file. Analysts are blocked and told to ask Nick. |
| Analyst view: all six, Doing vs limit, overdue updates | Done (Team view). |
| Light and dark mode pass WCAG AA | Done for every token pair (`npm run contrast`, lowest 4.97:1). Touch targets 44 px; real buttons and labelled inputs. |
| Only IT Core can change files; Matt read-only | NTFS setup step (above). The app also treats Matt as read-only and ignores any viewer changes. |
| Every change appears in the audit log | Done. The change files are the log. Browser test: 10 of 10 changes shown. |
| No API token in the shared folder, code or page | The token is read only from Credential Manager on Nick's PC. The page never needs it. |

## What hasn't been tested

- **The PowerShell scripts.** PowerShell wasn't available in the build environment. `Sync-ServiceDesk.ps1` follows the SDP v3 `list_info` / `search_criteria` format, but the exact field names (for example `status.in_progress`, `completed_time`, `display_id`) can differ by edition and version. Run `-Test` first.
- **Edge on the real network share.** Browser tests used Chromium's private file system, which has the same API as the shared folder. Network-share behavior and company policy are the day-one check above.
- **Clock skew.** Changes are ordered by each PC's clock. Domain-joined PCs sync time, so this should be fine.

## Assumptions to confirm

- Item IDs for synced tickets are `SD:<ticket number>` (stable across every browser with no coordination), not random UUIDs. Hub-entered items use UUIDs.
- Grading and ranking are manager-only by default. Set `"analystsCanGrade": true` to let the team grade from any seat.
- "Ready to close" means resolved in Service Desk (not yet closed), or every task under the item is done.
- Moving an SD item to Done in the hub doesn't close the ticket. Triage's **Close** reminds you to close it in Service Desk. Write-back waits for an approved server (v2).
- Calendar maintenance work is entered with **New work → Hub only** (open question in the scope).
